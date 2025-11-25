export type StoreBackend = 'memory' | 'postgres';

export interface AppConfig {
  port: number;
  storeBackend: StoreBackend;
  postgresUrl?: string | undefined;
  rootApiKey?: string | undefined;
  onchainLedgerEnabled: boolean;
  onchainRpcUrl?: string | undefined;
  onchainPrivateKey?: string | undefined;
  onchainContractAddress?: string | undefined;
  onchainChainId?: number | undefined;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : 4000;
const rawRateLimitWindow = process.env.RATE_LIMIT_WINDOW_MS;
const rawRateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;

export const config: AppConfig = {
  port: Number.isNaN(parsedPort) ? 4000 : parsedPort,
  storeBackend: (process.env.STORE_BACKEND as StoreBackend | undefined) ?? 'memory',
  postgresUrl: process.env.DATABASE_URL,
  rootApiKey: process.env.ROOT_API_KEY,
  onchainLedgerEnabled: process.env.ONCHAIN_LEDGER_ENABLED === 'true',
  onchainRpcUrl: process.env.ONCHAIN_RPC_URL,
  onchainPrivateKey: process.env.ONCHAIN_PRIVATE_KEY,
  onchainContractAddress: process.env.ONCHAIN_CONTRACT_ADDRESS,
  onchainChainId: process.env.ONCHAIN_CHAIN_ID
    ? Number.parseInt(process.env.ONCHAIN_CHAIN_ID, 10)
    : undefined,
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  rateLimitWindowMs: rawRateLimitWindow ? Number.parseInt(rawRateLimitWindow, 10) : 60000,
  rateLimitMaxRequests: rawRateLimitMax ? Number.parseInt(rawRateLimitMax, 10) : 1000,
};

export function requirePostgresUrl(): string {
  if (!config.postgresUrl) {
    throw new Error('DATABASE_URL is required when STORE_BACKEND=postgres');
  }
  return config.postgresUrl;
}

