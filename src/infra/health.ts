import { config, requirePostgresUrl } from '../config';
import { Pool } from 'pg';

export interface ReadinessStatus {
  ok: boolean;
  storeBackend: string;
  db?: {
    ok: boolean;
    error?: string;
  };
}

export async function checkReadiness(): Promise<ReadinessStatus> {
  if (config.storeBackend !== 'postgres') {
    return {
      ok: true,
      storeBackend: config.storeBackend,
    };
  }

  let pool: Pool | undefined;
  try {
    const connectionString = requirePostgresUrl();
    pool = new Pool({ connectionString });
    await pool.query('SELECT 1');
    return {
      ok: true,
      storeBackend: config.storeBackend,
      db: { ok: true },
    };
  } catch (err) {
    return {
      ok: false,
      storeBackend: config.storeBackend,
      db: {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}

