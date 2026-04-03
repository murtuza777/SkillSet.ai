import { allRows, firstRow, runStatement } from '../db/client';
import { isoNow, randomId } from '../lib/crypto';
import type { AppBindings } from '../types';
import { enqueueGamificationEvent, logActivity } from './gamification-service';

export const createProject = async (
  db: D1Database,
  payload: {
    userId: string;
    learningPathId?: string | null;
    title: string;
    description?: string | null;
    visibility: string;
    repoUrl?: string | null;
  },
) => {
  const projectId = randomId();
  const roomId = randomId();

  await runStatement(
    db,
    `INSERT INTO projects
      (id, learning_path_id, title, description, owner_id, visibility, repo_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      projectId,
      payload.learningPathId ?? null,
      payload.title,
      payload.description ?? null,
      payload.userId,
      payload.visibility,
      payload.repoUrl ?? null,
      isoNow(),
    ],
  );

  await runStatement(
    db,
    `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'owner', ?)`,
    [randomId(), projectId, payload.userId, isoNow()],
  );

  await runStatement(
    db,
    `INSERT INTO chat_rooms
      (id, room_type, name, related_project_id, related_module_id, created_by, created_at)
     VALUES (?, 'project_room', ?, ?, NULL, ?, ?)`,
    [roomId, payload.title, projectId, payload.userId, isoNow()],
  );

  await runStatement(
    db,
    `INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
     VALUES (?, ?, ?, 'owner', ?, NULL)`,
    [randomId(), roomId, payload.userId, isoNow()],
  );

  await logActivity(db, {
    userId: payload.userId,
    eventType: 'project_created',
    entityType: 'project',
    entityId: projectId,
  });

  return getProject(db, projectId);
};

export const getProject = async (db: D1Database, projectId: string) => {
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
  }>(
    db,
    `SELECT id, learning_path_id, title, description, owner_id, visibility, repo_url, status, created_at
     FROM projects
     WHERE id = ?
     LIMIT 1`,
    [projectId],
  );

  if (!project) {
    return null;
  }

  const room = await firstRow<{ id: string }>(
    db,
    `SELECT id FROM chat_rooms WHERE related_project_id = ? LIMIT 1`,
    [projectId],
  );

  return {
    id: project.id,
    learningPathId: project.learning_path_id,
    title: project.title,
    description: project.description,
    ownerId: project.owner_id,
    visibility: project.visibility,
    repoUrl: project.repo_url,
    status: project.status,
    createdAt: project.created_at,
    roomId: room?.id ?? null,
  };
};

export const joinProject = async (db: D1Database, projectId: string, userId: string) => {
  const room = await firstRow<{ id: string }>(
    db,
    `SELECT id FROM chat_rooms WHERE related_project_id = ? LIMIT 1`,
    [projectId],
  );

  await runStatement(
    db,
    `INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'member', ?)`,
    [randomId(), projectId, userId, isoNow()],
  );

  if (room?.id) {
    await runStatement(
      db,
      `INSERT OR IGNORE INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
       VALUES (?, ?, ?, 'member', ?, NULL)`,
      [randomId(), room.id, userId, isoNow()],
    );
  }

  await logActivity(db, {
    userId,
    eventType: 'project_joined',
    entityType: 'project',
    entityId: projectId,
  });

  return getProject(db, projectId);
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
  const existing = await firstRow<{
    title: string;
    description: string | null;
    visibility: string;
    repo_url: string | null;
    status: string;
  }>(
    db,
    `SELECT title, description, visibility, repo_url, status
     FROM projects
     WHERE id = ?
     LIMIT 1`,
    [projectId],
  );

  if (!existing) {
    return null;
  }

  await runStatement(
    db,
    `UPDATE projects
     SET title = ?, description = ?, visibility = ?, repo_url = ?, status = ?
     WHERE id = ?`,
    [
      payload.title ?? existing.title,
      payload.description ?? existing.description,
      payload.visibility ?? existing.visibility,
      payload.repoUrl ?? existing.repo_url,
      payload.status ?? existing.status,
      projectId,
    ],
  );

  return getProject(db, projectId);
};

export const listProjectMembers = async (db: D1Database, projectId: string) =>
  allRows<{
    user_id: string;
    role: string;
    joined_at: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    db,
    `SELECT pm.user_id, pm.role, pm.joined_at, p.display_name, p.avatar_url
     FROM project_members pm
     JOIN profiles p ON p.user_id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY pm.joined_at ASC`,
    [projectId],
  ).then((rows) =>
    rows.map((member) => ({
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      displayName: member.display_name,
      avatarUrl: member.avatar_url,
    })),
  );

export const completeProject = async (
  env: Pick<AppBindings, 'GAMIFICATION_QUEUE'>,
  db: D1Database,
  projectId: string,
  userId: string,
) => {
  await logActivity(db, {
    userId,
    eventType: 'project_completed',
    entityType: 'project',
    entityId: projectId,
  });

  await enqueueGamificationEvent(env as never, {
    type: 'project_completed',
    userId,
    projectId,
    idempotencyKey: `project_completed:${userId}:${projectId}`,
  });
};
