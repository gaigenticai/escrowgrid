import type {
  Institution,
  ApiKey,
  AssetTemplate,
  Asset,
  Position,
  Policy,
  LedgerEvent,
  Region,
  Vertical,
  TemplateCode,
  ApiKeyRole,
  PositionState,
} from './types';

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function setApiBaseUrl(url: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (url && url.trim().length > 0) {
    const normalized = url.trim().replace(/\/+$/, '');
    localStorage.setItem('admin_api_url', normalized);
  } else {
    localStorage.removeItem('admin_api_url');
  }
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }
  const stored = localStorage.getItem('admin_api_url');
  if (stored && stored.trim().length > 0) {
    return stored;
  }
  return DEFAULT_API_BASE_URL;
}

export interface ApiError extends Error {
  status: number;
  statusText: string;
  body: string;
}

function createApiError(status: number, statusText: string, body: string): ApiError {
  const error = new Error(`API error ${status}: ${body}`) as ApiError;
  error.name = 'ApiError';
  error.status = status;
  error.statusText = statusText;
  error.body = body;
  return error;
}

export type KeyType = 'root' | 'institution' | 'unknown';

async function apiFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw createApiError(res.status, res.statusText, text);
  }

  return (await res.json()) as T;
}

export async function detectKeyType(apiKey: string): Promise<KeyType> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/metrics`, {
      headers: {
        'X-API-KEY': apiKey,
      },
    });
    if (res.status === 200) {
      return 'root';
    }
    if (res.status === 403 || res.status === 404) {
      return 'institution';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Institutions
export async function listInstitutions(apiKey: string): Promise<Institution[]> {
  return apiFetch<Institution[]>('/institutions', apiKey);
}

export async function createInstitution(
  apiKey: string,
  data: { name: string; regions: Region[]; verticals?: Vertical[] },
): Promise<Institution> {
  return apiFetch<Institution>('/institutions', apiKey, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// API Keys
export async function listApiKeys(apiKey: string, institutionId: string): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>(`/institutions/${institutionId}/api-keys`, apiKey);
}

export async function createApiKey(
  apiKey: string,
  institutionId: string,
  data: { label: string; role: ApiKeyRole },
): Promise<{ record: ApiKey; apiKey: string }> {
  const result = await apiFetch<{
    id: string;
    institutionId: string;
    label: string;
    role: ApiKeyRole;
    createdAt: string;
    apiKey: string;
  }>(`/institutions/${institutionId}/api-keys`, apiKey, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return {
    record: {
      id: result.id,
      institutionId: result.institutionId,
      label: result.label,
      role: result.role,
      createdAt: result.createdAt,
    },
    apiKey: result.apiKey,
  };
}

export async function revokeApiKey(
  apiKey: string,
  institutionId: string,
  keyId: string,
): Promise<ApiKey> {
  return apiFetch<ApiKey>(
    `/institutions/${institutionId}/api-keys/${keyId}/revoke`,
    apiKey,
    { method: 'POST' },
  );
}

// Asset Templates
export async function listAssetTemplates(
  apiKey: string,
  institutionId?: string,
): Promise<AssetTemplate[]> {
  const params = institutionId ? `?institutionId=${institutionId}` : '';
  return apiFetch<AssetTemplate[]>(`/asset-templates${params}`, apiKey);
}

export async function createAssetTemplate(
  apiKey: string,
  data: {
    code: TemplateCode;
    name: string;
    vertical: Vertical;
    region: Region;
    config?: Record<string, unknown>;
  },
): Promise<AssetTemplate> {
  return apiFetch<AssetTemplate>('/asset-templates', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      config: data.config ?? { currency: 'USD' },
    }),
  });
}

// Assets
export async function listAssets(apiKey: string, institutionId?: string): Promise<Asset[]> {
  const params = institutionId ? `?institutionId=${institutionId}` : '';
  return apiFetch<Asset[]>(`/assets${params}`, apiKey);
}

export async function createAsset(
  apiKey: string,
  data: {
    templateId: string;
    label: string;
    metadata?: Record<string, unknown>;
  },
): Promise<Asset> {
  return apiFetch<Asset>('/assets', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      metadata: data.metadata ?? {},
    }),
  });
}

// Positions
export async function listPositions(apiKey: string, institutionId?: string): Promise<Position[]> {
  const params = institutionId ? `?institutionId=${institutionId}` : '';
  return apiFetch<Position[]>(`/positions${params}`, apiKey);
}

export async function createPosition(
  apiKey: string,
  data: {
    assetId: string;
    holderReference: string;
    currency: string;
    amount: number;
    externalReference?: string;
  },
): Promise<Position> {
  return apiFetch<Position>('/positions', apiKey, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function transitionPosition(
  apiKey: string,
  positionId: string,
  toState: PositionState,
  reason?: string,
): Promise<Position> {
  return apiFetch<Position>(`/positions/${positionId}/transition`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ toState, reason }),
  });
}

// Policies
export async function listPolicies(apiKey: string, institutionId: string): Promise<Policy[]> {
  return apiFetch<Policy[]>(`/institutions/${institutionId}/policies`, apiKey);
}

export async function upsertPolicy(
  apiKey: string,
  institutionId: string,
  region: Region,
  config: { position: { minAmount?: number; maxAmount?: number; allowedCurrencies?: string[] } },
): Promise<Policy> {
  return apiFetch<Policy>(`/institutions/${institutionId}/policies/${region}`, apiKey, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// Ledger
export async function listLedgerEvents(
  apiKey: string,
  positionId?: string,
): Promise<LedgerEvent[]> {
  const params = positionId ? `?positionId=${positionId}` : '';
  return apiFetch<LedgerEvent[]>(`/ledger-events${params}`, apiKey);
}
