import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import {
  createProject,
  getProjectById,
  getProjectMembers,
  isProjectMember,
  joinProject,
  listProjectsForUser,
  markProjectCompleted,
  updateProject,
} from '../services/projects-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const createProjectSchema = z.object({
  learningPathId: z.string().nullable().optional(),
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
});

const updateProjectSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  repoUrl: z.string().url().nullable().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
});

app.get('/', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const projects = await listProjectsForUser(c.env.DB, authUser.id);
  return jsonSuccess(c, projects);
});

app.post(
  '/',
  requireAuth,
  zValidator('json', createProjectSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const project = await createProject(c.env.DB, {
      ownerId: authUser.id,
      learningPathId: payload.learningPathId,
      title: payload.title,
      description: payload.description,
      visibility: payload.visibility,
    });

    return jsonSuccess(c, project, 201);
  },
);

app.get('/:id', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const project = await getProjectById(c.env.DB, c.req.param('id'));

  if (!project) {
    return jsonError(c, 404, 'Project not found');
  }

  if (project.visibility !== 'public') {
    const member = await isProjectMember(c.env.DB, project.id, authUser.id);
    const canView = project.ownerId === authUser.id || member;

    if (!canView) {
      return jsonError(c, 403, 'You are not a member of this project');
    }
  }

  return jsonSuccess(c, project);
});

app.post('/:id/join', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const project = await joinProject(c.env.DB, c.req.param('id'), authUser.id);

  if (!project) {
    return jsonError(c, 404, 'Project not found');
  }

  return jsonSuccess(c, project);
});

app.patch(
  '/:id',
  requireAuth,
  zValidator('json', updateProjectSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const existing = await getProjectById(c.env.DB, c.req.param('id'));

    if (!existing) {
      return jsonError(c, 404, 'Project not found');
    }

    if (existing.ownerId !== authUser.id && authUser.role !== 'admin') {
      return jsonError(c, 403, 'Only the project owner can update this project');
    }

    const payload = c.req.valid('json');
    const project = await updateProject(c.env.DB, existing.id, payload);

    if (!project) {
      return jsonError(c, 404, 'Project not found');
    }

    if (payload.status === 'completed') {
      await markProjectCompleted(c.env, c.env.DB, {
        userId: authUser.id,
        projectId: project.id,
      });
    }

    return jsonSuccess(c, project);
  },
);

app.get('/:id/members', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const project = await getProjectById(c.env.DB, c.req.param('id'));

  if (!project) {
    return jsonError(c, 404, 'Project not found');
  }

  const member = await isProjectMember(c.env.DB, project.id, authUser.id);
  const canView = project.ownerId === authUser.id || member || project.visibility === 'public';
  if (!canView) {
    return jsonError(c, 403, 'You are not a member of this project');
  }

  const members = await getProjectMembers(c.env.DB, project.id);
  return jsonSuccess(c, members);
});

export default app;
