import pg from "pg";
import type { Config } from "../../config.js";

// BIGINT ids and NUMERIC(15,0) amounts are safe integers; return numbers, not strings.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export function createPool(config: Config): pg.Pool {
  return new pg.Pool({ connectionString: config.databaseUrl });
}

/** Runs `fn` on one client inside BEGIN/COMMIT, rolling back when it throws. */
export async function withTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
