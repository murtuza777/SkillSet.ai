import { Hono } from 'hono';

import { jsonError, jsonSuccess } from '../lib/http';
import { getSkillBySlug, listSkills, searchSkills } from '../services/skills-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

app.get('/', async (c) => {
  const skills = await listSkills(c.env.DB);
  return jsonSuccess(c, skills);
});

app.get('/search', async (c) => {
  const query = c.req.query('q') ?? '';

  if (!query.trim()) {
    return jsonSuccess(c, []);
  }

  const skills = await searchSkills(c.env.DB, query.trim());
  return jsonSuccess(c, skills);
});

app.get('/:slug', async (c) => {
  const skill = await getSkillBySlug(c.env.DB, c.req.param('slug'));

  if (!skill) {
    return jsonError(c, 404, 'Skill not found');
  }

  return jsonSuccess(c, skill);
});

export default app;
