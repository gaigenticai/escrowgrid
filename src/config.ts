export type StoreBackend = 'memory' | 'postgres';

export interface AppConfig {
  port: number;
  storeBackend: StoreBackend;
  postgresUrl?: string | undefined;
  rootApiKey?: string | undefined;
  /**
   * Optional comma-separated list of IP addresses allowed to use the root API key.
   * Example: "10.0.0.1,192.168.1.100,::1"
   * If unset, root key can be used from any IP.
   * For production, strongly recommend setting this to limit root access.
   */
  rootApiKeyAllowedIps?: string[];
  /**
   * Optional comma-separated list of allowed CORS origins.
   * Example: "https://admin.escrowgrid.io,https://app.partner-bank.com"
   * If unset, CORS is effectively disabled (no Access-Control-Allow-Origin header)
   * which is safest for production API deployments behind an API gateway.
   */
  corsAllowedOrigins?: string | undefined;
  /**
   * When true, OpenAPI/Swagger/ReDoc are served without authentication.
   * In production you will typically want this false so that docs require an API key.
   */
  publicDocsEnabled: boolean;
  /**
   * When true and the optional helmet dependency is installed, the service
   * will use helmet for HTTP security headers instead of the built-in minimal
   * header set. Enable this in environments where the Node process terminates TLS.
   */
  helmetEnabled: boolean;
  onchainLedgerEnabled: boolean;
  onchainRpcUrl?: string | undefined;
  onchainPrivateKey?: string | undefined;
  onchainContractAddress?: string | undefined;
  onchainChainId?: number | undefined;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  /**
   * Controls whether in-process request metrics are recorded and exposed.
   * Set METRICS_ENABLED=false when you rely entirely on an external gateway
   * or sidecar for metrics.
   */
  metricsEnabled: boolean;
}

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : 4000;
const rawRateLimitWindow = process.env.RATE_LIMIT_WINDOW_MS;
const rawRateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;

// Parse root API key allowed IPs
const rawRootAllowedIps = process.env.ROOT_API_KEY_ALLOWED_IPS;
const rootApiKeyAllowedIps = rawRootAllowedIps
  ? rawRootAllowedIps.split(',').map((ip) => ip.trim()).filter(Boolean)
  : undefined;

export const config: AppConfig = {
  port: Number.isNaN(parsedPort) ? 4000 : parsedPort,
  storeBackend: (process.env.STORE_BACKEND as StoreBackend | undefined) ?? 'memory',
  postgresUrl: process.env.DATABASE_URL,
  rootApiKey: process.env.ROOT_API_KEY,
  rootApiKeyAllowedIps,
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  publicDocsEnabled: process.env.PUBLIC_DOCS_ENABLED === 'true',
  helmetEnabled: process.env.HELMET_ENABLED === 'true',
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
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
};

export function requirePostgresUrl(): string {
  if (!config.postgresUrl) {
    throw new Error('DATABASE_URL is required when STORE_BACKEND=postgres');
  }
  return config.postgresUrl;
}

