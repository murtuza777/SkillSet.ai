import { allRows, firstRow } from '../db/client';

export const listSkills = async (db: D1Database) =>
  allRows<{
    id: string;
    slug: string;
    name: string;
    category: string | null;
    description: string | null;
    is_active: number;
  }>(
    db,
    `SELECT id, slug, name, category, description, is_active
     FROM skills
     WHERE is_active = 1
     ORDER BY name ASC`,
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      description: row.description,
      isActive: Boolean(row.is_active),
    })),
  );

export const searchSkills = async (db: D1Database, query: string) =>
  allRows<{
    id: string;
    slug: string;
    name: string;
    category: string | null;
    description: string | null;
    is_active: number;
  }>(
    db,
    `SELECT id, slug, name, category, description, is_active
     FROM skills
     WHERE is_active = 1
       AND (
         LOWER(name) LIKE LOWER(?)
         OR LOWER(slug) LIKE LOWER(?)
         OR LOWER(COALESCE(description, '')) LIKE LOWER(?)
       )
     ORDER BY name ASC
     LIMIT 20`,
    [`%${query}%`, `%${query}%`, `%${query}%`],
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      description: row.description,
      isActive: Boolean(row.is_active),
    })),
  );

export const getSkillBySlug = async (db: D1Database, slug: string) => {
  const skill = await firstRow<{
    id: string;
    slug: string;
    name: string;
    category: string | null;
    description: string | null;
    is_active: number;
  }>(
    db,
    `SELECT id, slug, name, category, description, is_active
     FROM skills
     WHERE slug = ?
     LIMIT 1`,
    [slug],
  );

  if (!skill) {
    return null;
  }

  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    category: skill.category,
    description: skill.description,
    isActive: Boolean(skill.is_active),
  };
};
