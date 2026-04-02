export const runStatement = async (
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  return db.prepare(query).bind(...params).run();
};

export const firstRow = async <T>(
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  return db.prepare(query).bind(...params).first<T>();
};

export const allRows = async <T>(
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  const result = await db.prepare(query).bind(...params).all<T>();
  return result.results;
};

export const batchStatements = async (db: D1Database, statements: D1PreparedStatement[]) => {
  return db.batch(statements);
};

export const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');
