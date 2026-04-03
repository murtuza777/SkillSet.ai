import { allRows, firstRow, runStatement } from '../db/client';
import { isoNow, randomId } from '../lib/crypto';
import {
  enqueueGamificationEvent,
  logActivity,
  processGamificationQueueMessage,
} from './gamification-service';
import type { AppBindings } from '../types';

const mapProject = (project: {
  id: string;
  learning_path_id: string | null;
  title: string;
  description: string | null;
  owner_id: string;
  visibility: string;
  repo_url: string | null;
  status: string;
  created_at: string;
  room_id: string | null;
}) => ({
  id: project.id,
  learningPathId: project.learning_path_id,
  title: project.title,
  description: project.description,
  ownerId: project.owner_id,
  visibility: project.visibility,
  repoUrl: project.repo_url,
  status: project.status,
  createdAt: project.created_at,
  roomId: project.room_id,
});

export const listProjectsForUser = async (db: D1Database, userId: string) =>
  allRows<{
    id: string;
    learning_path_id: string | null;
    title: string;
    description: string | null;
    owner_id: string;
    visibility: string;
    repo_url: string | null;
    status: string;
    created_at: string;
    room_id: string | null;
  }>(
    db,
    `SELECT
       p.id,
       p.learning_path_id,
       p.title,
       p.description,
       p.owner_id,
       p.visibility,
       p.repo_url,
       p.status,
       p.created_at,
       (
         SELECT cr.id
         FROM chat_rooms cr
         WHERE cr.related_project_id = p.id
           AND cr.room_type = 'project_room'
         LIMIT 1
       ) AS room_id
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id
     WHERE p.owner_id = ?
        OR pm.user_id = ?
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId, userId],
  ).then((rows) => rows.map(mapProject));

export const getProjectById = async (db: D1Database, projectId: string) => {
  const project = await firstRow<{
    id: string;
    learning_path_id: string | null;
    title: string;
    description: string | null;
    owner_id: string;
    visibility: string;
    repo_url: string | null;
    status: string;
    created_at: string;
    room_id: string | null;
  }>(
    db,
    `SELECT
       p.id,
       p.learning_path_id,
       p.title,
       p.description,
       p.owner_id,
       p.visibility,
       p.repo_url,
       p.status,
       p.created_at,
       (
         SELECT cr.id
         FROM chat_rooms cr
         WHERE cr.related_project_id = p.id
           AND cr.room_type = 'project_room'
         LIMIT 1
       ) AS room_id
     FROM projects p
     WHERE p.id = ?
     LIMIT 1`,
    [projectId],
  );

  return project ? mapProject(project) : null;
};

export const isProjectMember = async (db: D1Database, projectId: string, userId: string) =>
  Boolean(
    await firstRow<{ id: string }>(
      db,
      `SELECT id
       FROM project_members
       WHERE project_id = ?
         AND user_id = ?
       LIMIT 1`,
      [projectId, userId],
    ),
  );

export const createProject = async (
  db: D1Database,
  payload: {
    ownerId: string;
    learningPathId?: string | null;
    title: string;
    description?: string | null;
    visibility: string;
  },
) => {
  const projectId = randomId();
  const roomId = randomId();
  const now = isoNow();

  await runStatement(
    db,
    `INSERT INTO projects
      (id, learning_path_id, title, description, owner_id, visibility, repo_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', ?)`,
    [
      projectId,
      payload.learningPathId ?? null,
      payload.title,
      payload.description ?? null,
      payload.ownerId,
      payload.visibility,
      now,
    ],
  );

  await runStatement(
    db,
    `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'owner', ?)`,
    [randomId(), projectId, payload.ownerId, now],
  );

  await runStatement(
    db,
    `INSERT INTO chat_rooms
      (id, room_type, name, related_project_id, related_module_id, created_by, created_at)
     VALUES (?, 'project_room', ?, ?, NULL, ?, ?)`,
    [roomId, `${payload.title} room`, projectId, payload.ownerId, now],
  );

  await runStatement(
    db,
    `INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
     VALUES (?, ?, ?, 'member', ?, NULL)`,
    [randomId(), roomId, payload.ownerId, now],
  );

  return getProjectById(db, projectId);
};

export const joinProject = async (db: D1Database, projectId: string, userId: string) => {
  const project = await getProjectById(db, projectId);
  if (!project) {
    return null;
  }

  const now = isoNow();
  await runStatement(
    db,
    `INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'member', ?)`,
    [randomId(), projectId, userId, now],
  );

  if (project.roomId) {
    await runStatement(
      db,
      `INSERT OR IGNORE INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
       VALUES (?, ?, ?, 'member', ?, NULL)`,
      [randomId(), project.roomId, userId, now],
    );
  }

  return getProjectById(db, projectId);
};

export const updateProject = async (
  db: D1Database,
  projectId: string,
  payload: {
    title?: string;
    description?: string | null;
    visibility?: string;
    repoUrl?: string | null;
    status?: string;
  },
) => {
  const current = await getProjectById(db, projectId);
  if (!current) {
    return null;
  }

  await runStatement(
    db,
    `UPDATE projects
     SET title = ?, description = ?, visibility = ?, repo_url = ?, status = ?
     WHERE id = ?`,
    [
      payload.title ?? current.title,
      payload.description ?? current.description,
      payload.visibility ?? current.visibility,
      payload.repoUrl ?? current.repoUrl,
      payload.status ?? current.status,
      projectId,
    ],
  );

  return getProjectById(db, projectId);
};

export const getProjectMembers = async (db: D1Database, projectId: string) =>
  allRows<{
    user_id: string;
    role: string;
    joined_at: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    db,
    `SELECT
       pm.user_id,
       pm.role,
       pm.joined_at,
       p.display_name,
       p.avatar_url
     FROM project_members pm
     JOIN profiles p ON p.user_id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY pm.joined_at ASC`,
    [projectId],
  ).then((rows) =>
    rows.map((row) => ({
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    })),
  );

export const markProjectCompleted = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    userId: string;
    projectId: string;
  },
) => {
  await logActivity(db, {
    userId: payload.userId,
    eventType: 'project_completed',
    entityType: 'project',
    entityId: payload.projectId,
  });

  const gamificationMessage = {
    type: 'project_completed' as const,
    userId: payload.userId,
    projectId: payload.projectId,
    idempotencyKey: `project_completed:${payload.userId}:${payload.projectId}`,
  };

  try {
    await enqueueGamificationEvent(env, {
      ...gamificationMessage,
    });
  } catch (error) {
    console.error('Unable to enqueue project completion event', error);
  }

  // Keep points and badges in sync for immediate UX feedback.
  await processGamificationQueueMessage(db, gamificationMessage);
};
