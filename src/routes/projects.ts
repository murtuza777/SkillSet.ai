import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { createProject, getProject, joinProject, listProjectMembers, updateProject } from '../services/project-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const createProjectSchema = z.object({
  learningPathId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  visibility: z.string().default('private'),
  repoUrl: z.string().url().nullable().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  visibility: z.string().optional(),
  repoUrl: z.string().url().nullable().optional(),
  status: z.string().optional(),
});

app.post(
  '/',
  requireAuth,
  zValidator('json', createProjectSchema),
  async (c) => {
    const authUser = requireCurrentUser(c);
    const payload = c.req.valid('json');
    const project = await createProject(c.env.DB, {
      userId: authUser.id,
      learningPathId: payload.learningPathId,
      title: payload.title,
      description: payload.description,
      visibility: payload.visibility,
      repoUrl: payload.repoUrl,
    });

    return jsonSuccess(c, project, 201);
  },
);

app.get('/:id', requireAuth, async (c) => {
  const project = await getProject(c.env.DB, c.req.param('id'));

  if (!project) {
    return jsonError(c, 404, 'Project not found');
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
    const project = await getProject(c.env.DB, c.req.param('id'));

    if (!project) {
      return jsonError(c, 404, 'Project not found');
    }

    if (project.ownerId !== authUser.id && authUser.role !== 'admin') {
      return jsonError(c, 403, 'Only the project owner or an admin can update the project');
    }

    const updated = await updateProject(c.env.DB, project.id, c.req.valid('json'));
    return jsonSuccess(c, updated);
  },
);

app.get('/:id/members', requireAuth, async (c) => {
  const members = await listProjectMembers(c.env.DB, c.req.param('id'));
  return jsonSuccess(c, members);
});

export default app;
