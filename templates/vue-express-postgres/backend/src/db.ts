import { Pool } from "pg";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T extends object>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}
