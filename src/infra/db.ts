import { Pool } from 'pg';

const pools = new Set<Pool>();

export function createAppPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString });
  pools.add(pool);
  return pool;
}

export async function shutdownAllPools(): Promise<void> {
  const toShutdown = Array.from(pools);
  pools.clear();

  await Promise.all(
    toShutdown.map(async (pool) => {
      try {
        await pool.end();
      } catch {
        // Swallow errors on shutdown to avoid masking the primary shutdown reason.
      }
    }),
  );
}


