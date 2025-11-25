import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type Institution = {
  id: string;
  name: string;
  regions: string[];
  verticals: string[];
};

type ApiKey = {
  id: string;
  institutionId: string;
  label: string;
  role: string;
  createdAt: string;
  revokedAt?: string;
};

type AssetTemplate = {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  vertical: string;
  region: string;
};

type Asset = {
  id: string;
  institutionId: string;
  templateId: string;
  label: string;
};

type Position = {
  id: string;
  institutionId: string;
  assetId: string;
  holderReference: string;
  currency: string;
  amount: number;
  state: string;
};

type PolicyConfig = {
  region: string;
  position: {
    minAmount?: number;
    maxAmount?: number;
    allowedCurrencies?: string[];
  };
};

type Policy = {
  id: string;
  institutionId: string;
  region: string;
  config: PolicyConfig;
};

type LedgerEvent = {
  id: string;
  kind: string;
  positionId: string;
  at: string;
  previousState?: string | null;
  newState?: string | null;
};

type ActiveTab = 'institutions' | 'assets' | 'positions';
type PositionState = 'CREATED' | 'FUNDED' | 'PARTIALLY_RELEASED' | 'RELEASED' | 'CANCELLED' | 'EXPIRED';

async function apiFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function App() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(() => {
    return localStorage.getItem('admin_api_key');
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('institutions');

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);

  const [templates, setTemplates] = useState<AssetTemplate[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [policies, setPolicies] = useState<Policy[]>([]);

  const [createInstitutionName, setCreateInstitutionName] = useState('');
  const [createInstitutionRegions, setCreateInstitutionRegions] = useState('EU_UK');

  const [newApiKeyLabel, setNewApiKeyLabel] = useState('admin-key');
  const [newApiKeyRole, setNewApiKeyRole] = useState<'admin' | 'read_only'>('admin');
  const [createdApiKeyToken, setCreatedApiKeyToken] = useState<string | null>(null);

  const [newTemplateCode, setNewTemplateCode] = useState('CONSTR_ESCROW');
  const [newTemplateName, setNewTemplateName] = useState('Construction Escrow');
  const [newTemplateRegion, setNewTemplateRegion] = useState('EU_UK');
  const [newTemplateVertical, setNewTemplateVertical] = useState('CONSTRUCTION');

  const [newAssetLabel, setNewAssetLabel] = useState('New Asset');
  const [newAssetTemplateId, setNewAssetTemplateId] = useState<string | null>(null);

  const [newPositionAssetId, setNewPositionAssetId] = useState<string | null>(null);
  const [newPositionHolder, setNewPositionHolder] = useState('HOLDER_1');
  const [newPositionCurrency, setNewPositionCurrency] = useState('USD');
  const [newPositionAmount, setNewPositionAmount] = useState(1000);

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);

  const selectedInstitution = useMemo(
    () => institutions.find((i) => i.id === selectedInstitutionId) ?? null,
    [institutions, selectedInstitutionId],
  );

  useEffect(() => {
    if (!apiKey) return;
    setInstitutionsLoading(true);
    setInstitutionsError(null);
    apiFetch<Institution[]>('/institutions', apiKey)
      .then((data) => {
        setInstitutions(data);
        if (data.length > 0 && !selectedInstitutionId) {
          setSelectedInstitutionId(data[0].id);
        }
      })
      .catch((err) => {
        setInstitutionsError(err.message);
      })
      .finally(() => {
        setInstitutionsLoading(false);
      });
  }, [apiKey, selectedInstitutionId]);

  useEffect(() => {
    if (!apiKey || !selectedInstitutionId) return;
    setApiKeysLoading(true);
    apiFetch<ApiKey[]>(`/institutions/${selectedInstitutionId}/api-keys`, apiKey)
      .then(setApiKeys)
      .catch(() => {
        setApiKeys([]);
      })
      .finally(() => setApiKeysLoading(false));

    apiFetch<AssetTemplate[]>(`/asset-templates?institutionId=${selectedInstitutionId}`, apiKey)
      .then((data) => {
        setTemplates(data);
        if (data.length > 0 && !newAssetTemplateId) {
          setNewAssetTemplateId(data[0].id);
        }
      })
      .catch(() => setTemplates([]));

    apiFetch<Asset[]>(`/assets?institutionId=${selectedInstitutionId}`, apiKey)
      .then(setAssets)
      .catch(() => setAssets([]));

    apiFetch<Position[]>(`/positions?institutionId=${selectedInstitutionId}`, apiKey)
      .then(setPositions)
      .catch(() => setPositions([]));

    apiFetch<Policy[]>(`/institutions/${selectedInstitutionId}/policies`, apiKey)
      .then(setPolicies)
      .catch(() => setPolicies([]));
  }, [apiKey, selectedInstitutionId, newAssetTemplateId]);

  useEffect(() => {
    if (!apiKey || !selectedPositionId) {
      setLedgerEvents([]);
      return;
    }
    apiFetch<LedgerEvent[]>(`/ledger-events?positionId=${selectedPositionId}`, apiKey)
      .then(setLedgerEvents)
      .catch(() => setLedgerEvents([]));
  }, [apiKey, selectedPositionId]);

  const handleSaveApiKeyLocally = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem('admin_api_key', apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
  };

  const handleCreateInstitution = async () => {
    if (!apiKey) return;
    if (!createInstitutionName.trim()) return;
    const regions = createInstitutionRegions.split(',').map((r) => r.trim()).filter(Boolean);
    const payload = {
      name: createInstitutionName.trim(),
      regions: regions.length > 0 ? regions : ['EU_UK'],
      verticals: ['CONSTRUCTION', 'TRADE_FINANCE'],
    };
    const created = await apiFetch<Institution>('/institutions', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setInstitutions((prev) => [...prev, created]);
    setCreateInstitutionName('');
  };

  const handleCreateApiKey = async () => {
    if (!apiKey || !selectedInstitutionId) return;
    const created = await apiFetch<{
      id: string;
      institutionId: string;
      label: string;
      role: string;
      createdAt: string;
      apiKey: string;
    }>(`/institutions/${selectedInstitutionId}/api-keys`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ label: newApiKeyLabel, role: newApiKeyRole }),
    });
    setCreatedApiKeyToken(created.apiKey);
    setApiKeys((prev) => [
      ...prev,
      {
        id: created.id,
        institutionId: created.institutionId,
        label: created.label,
        role: created.role,
        createdAt: created.createdAt,
      },
    ]);
  };

  const handleCreateTemplate = async () => {
    if (!apiKey || !selectedInstitutionId) return;
    const payload = {
      code: newTemplateCode,
      name: newTemplateName,
      vertical: newTemplateVertical,
      region: newTemplateRegion,
      config: { currency: 'USD' },
    };
    const created = await apiFetch<AssetTemplate>('/asset-templates', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setTemplates((prev) => [...prev, created]);
  };

  const handleCreateAsset = async () => {
    if (!apiKey || !newAssetTemplateId) return;
    const payload = {
      templateId: newAssetTemplateId,
      label: newAssetLabel,
      metadata: {},
    };
    const created = await apiFetch<Asset>('/assets', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAssets((prev) => [...prev, created]);
  };

  const handleCreatePosition = async () => {
    if (!apiKey || !newPositionAssetId) return;
    const payload = {
      assetId: newPositionAssetId,
      holderReference: newPositionHolder,
      currency: newPositionCurrency,
      amount: newPositionAmount,
    };
    const created = await apiFetch<Position>('/positions', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setPositions((prev) => [...prev, created]);
  };

  const handleTransitionPosition = async (positionId: string, toState: PositionState) => {
    if (!apiKey) return;
    const updated = await apiFetch<Position>(`/positions/${positionId}/transition`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ toState }),
    });
    setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPositionId(updated.id);
  };

  const handleSavePolicy = async (
    institutionId: string,
    region: string,
    positionConfig: PolicyConfig['position'],
  ) => {
    if (!apiKey) return;
    const payload = { position: positionConfig };
    const saved = await apiFetch<Policy>(
      `/institutions/${institutionId}/policies/${region}`,
      apiKey,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    setPolicies((prev) => {
      const others = prev.filter(
        (p) => !(p.institutionId === institutionId && p.region === region),
      );
      return [...others, saved];
    });
  };

  const renderInstitutionsTab = () => (
    <div>
      <h2>Institutions</h2>
      {!apiKey && <p>Enter an API key above to load institutions.</p>}
      {institutionsLoading && <p>Loading institutions...</p>}
      {institutionsError && <p style={{ color: 'red' }}>{institutionsError}</p>}
      {institutions.length > 0 && (
        <ul>
          {institutions.map((inst) => (
            <li key={inst.id}>
              <button
                onClick={() => setSelectedInstitutionId(inst.id)}
                style={{
                  fontWeight: inst.id === selectedInstitutionId ? 'bold' : 'normal',
                  marginRight: 8,
                }}
              >
                {inst.name}
              </button>
              <span>
                ({inst.id.slice(0, 6)}..., regions: {inst.regions.join(', ')})
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>Create institution (root key required)</h3>
      <div>
        <input
          placeholder="Name"
          value={createInstitutionName}
          onChange={(e) => setCreateInstitutionName(e.target.value)}
        />
        <input
          placeholder="Regions (comma separated, e.g. EU_UK,US)"
          value={createInstitutionRegions}
          onChange={(e) => setCreateInstitutionRegions(e.target.value)}
        />
        <button onClick={handleCreateInstitution}>Create</button>
      </div>

      {selectedInstitution && (
        <>
          <h3>API keys for {selectedInstitution.name}</h3>
          {apiKeysLoading && <p>Loading API keys...</p>}
          {apiKeys.length > 0 ? (
            <ul>
              {apiKeys.map((k) => (
                <li key={k.id}>
                  {k.label} ({k.role}) – created {new Date(k.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No API keys yet.</p>
          )}

          <h4>Create new API key</h4>
          <div>
            <input
              placeholder="Label"
              value={newApiKeyLabel}
              onChange={(e) => setNewApiKeyLabel(e.target.value)}
            />
            <select
              value={newApiKeyRole}
              onChange={(e) => setNewApiKeyRole(e.target.value as 'admin' | 'read_only')}
            >
              <option value="admin">admin</option>
              <option value="read_only">read_only</option>
            </select>
            <button onClick={handleCreateApiKey}>Create API key</button>
          </div>
          {createdApiKeyToken && (
            <p>
              <strong>New API key (copy now, will not be shown again):</strong>{' '}
              <code>{createdApiKeyToken}</code>
            </p>
          )}

          <h3>Policies</h3>
          <p>Configure per-region min/max amounts and allowed currencies for positions.</p>
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th>Min amount</th>
                <th>Max amount</th>
                <th>Allowed currencies (comma-separated)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {['US', 'EU_UK', 'SG', 'UAE'].map((region) => {
                const existing = policies.find(
                  (p) => p.institutionId === selectedInstitution.id && p.region === region,
                );
                const positionConfig = existing?.config.position ?? {};
                const [minAmountStr, maxAmountStr, allowedCurrenciesStr] = [
                  positionConfig.minAmount?.toString() ?? '',
                  positionConfig.maxAmount?.toString() ?? '',
                  (positionConfig.allowedCurrencies ?? []).join(','),
                ];
                return (
                  <PolicyRow
                    key={region}
                    institutionId={selectedInstitution.id}
                    region={region}
                    initialMinAmount={minAmountStr}
                    initialMaxAmount={maxAmountStr}
                    initialAllowedCurrencies={allowedCurrenciesStr}
                    onSave={handleSavePolicy}
                  />
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );

  const renderAssetsTab = () => (
    <div>
      <h2>Asset templates</h2>
      {templates.length > 0 ? (
        <ul>
          {templates.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong> ({t.code}) – {t.vertical} / {t.region} – id:{' '}
              {t.id.slice(0, 8)}...
            </li>
          ))}
        </ul>
      ) : (
        <p>No templates yet.</p>
      )}

      <h3>Create template</h3>
      <div>
        <select value={newTemplateCode} onChange={(e) => setNewTemplateCode(e.target.value)}>
          <option value="CONSTR_ESCROW">CONSTR_ESCROW</option>
          <option value="CONSTR_RETAINAGE">CONSTR_RETAINAGE</option>
          <option value="TF_INVOICE">TF_INVOICE</option>
          <option value="TF_LC">TF_LC</option>
        </select>
        <input
          placeholder="Name"
          value={newTemplateName}
          onChange={(e) => setNewTemplateName(e.target.value)}
        />
        <select value={newTemplateVertical} onChange={(e) => setNewTemplateVertical(e.target.value)}>
          <option value="CONSTRUCTION">CONSTRUCTION</option>
          <option value="TRADE_FINANCE">TRADE_FINANCE</option>
        </select>
        <select value={newTemplateRegion} onChange={(e) => setNewTemplateRegion(e.target.value)}>
          <option value="US">US</option>
          <option value="EU_UK">EU_UK</option>
          <option value="SG">SG</option>
          <option value="UAE">UAE</option>
        </select>
        <button onClick={handleCreateTemplate}>Create template</button>
      </div>

      <h2>Assets</h2>
      {assets.length > 0 ? (
        <ul>
          {assets.map((a) => {
            const tpl = templates.find((t) => t.id === a.templateId);
            return (
              <li key={a.id}>
                <strong>{a.label}</strong> – template: {tpl ? tpl.name : a.templateId} – id:{' '}
                {a.id.slice(0, 8)}...
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No assets yet.</p>
      )}

      <h3>Create asset</h3>
      <div>
        <select
          value={newAssetTemplateId ?? ''}
          onChange={(e) => setNewAssetTemplateId(e.target.value || null)}
        >
          <option value="">Select template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </select>
        <input
          placeholder="Label"
          value={newAssetLabel}
          onChange={(e) => setNewAssetLabel(e.target.value)}
        />
        <button onClick={handleCreateAsset}>Create asset</button>
      </div>
    </div>
  );

  const renderPositionsTab = () => (
    <div>
      <h2>Positions</h2>
      {positions.length > 0 ? (
        <ul>
          {positions.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedPositionId(p.id)}
                style={{
                  fontWeight: p.id === selectedPositionId ? 'bold' : 'normal',
                  marginRight: 8,
                }}
              >
                {p.id.slice(0, 8)}...
              </button>
              <span>
                {p.state} – {p.amount} {p.currency} – asset {p.assetId.slice(0, 8)}... – holder{' '}
                {p.holderReference}
              </span>
              {p.state !== 'RELEASED' && p.state !== 'CANCELLED' && p.state !== 'EXPIRED' && (
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => handleTransitionPosition(p.id, 'FUNDED')}
                >
                  Mark FUNDED
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No positions yet.</p>
      )}

      <h3>Create position</h3>
      <div>
        <select
          value={newPositionAssetId ?? ''}
          onChange={(e) => setNewPositionAssetId(e.target.value || null)}
        >
          <option value="">Select asset</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} ({a.id.slice(0, 8)}...)
            </option>
          ))}
        </select>
        <input
          placeholder="Holder reference"
          value={newPositionHolder}
          onChange={(e) => setNewPositionHolder(e.target.value)}
        />
        <input
          placeholder="Currency"
          value={newPositionCurrency}
          onChange={(e) => setNewPositionCurrency(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newPositionAmount}
          onChange={(e) => setNewPositionAmount(Number(e.target.value))}
        />
        <button onClick={handleCreatePosition}>Create position</button>
      </div>

      {selectedPositionId && (
        <div>
          <h3>Ledger events for position {selectedPositionId.slice(0, 8)}...</h3>
          {ledgerEvents.length > 0 ? (
            <ul>
              {ledgerEvents.map((e) => (
                <li key={e.id}>
                  [{new Date(e.at).toLocaleString()}] {e.kind} {e.previousState} → {e.newState}
                </li>
              ))}
            </ul>
          ) : (
            <p>No ledger events yet.</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="App">
      <header>
        <h1>TAAS Admin Console</h1>
        <div>
          <input
            placeholder="Enter API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            style={{ width: 300, marginRight: 8 }}
          />
          <button onClick={handleSaveApiKeyLocally}>Use API key</button>
          {apiKey && (
            <span style={{ marginLeft: 8 }}>
              Active key: <code>{apiKey.slice(0, 6)}...</code>
            </span>
          )}
        </div>
      </header>

      <nav style={{ marginTop: 16, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('institutions')}
          style={{ fontWeight: activeTab === 'institutions' ? 'bold' : 'normal', marginRight: 8 }}
        >
          Institutions & Policies
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          style={{ fontWeight: activeTab === 'assets' ? 'bold' : 'normal', marginRight: 8 }}
        >
          Templates & Assets
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          style={{ fontWeight: activeTab === 'positions' ? 'bold' : 'normal' }}
        >
          Positions & Ledger
        </button>
      </nav>

      <main>
        {activeTab === 'institutions' && renderInstitutionsTab()}
        {activeTab === 'assets' && renderAssetsTab()}
        {activeTab === 'positions' && renderPositionsTab()}
      </main>
    </div>
  );
}

type PolicyRowProps = {
  institutionId: string;
  region: string;
  initialMinAmount: string;
  initialMaxAmount: string;
  initialAllowedCurrencies: string;
  onSave: (
    institutionId: string,
    region: string,
    position: { minAmount?: number; maxAmount?: number; allowedCurrencies?: string[] },
  ) => Promise<void>;
};

function PolicyRow(props: PolicyRowProps) {
  const [minAmount, setMinAmount] = useState(props.initialMinAmount);
  const [maxAmount, setMaxAmount] = useState(props.initialMaxAmount);
  const [allowedCurrencies, setAllowedCurrencies] = useState(props.initialAllowedCurrencies);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const position = {
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      allowedCurrencies: allowedCurrencies
        ? allowedCurrencies.split(',').map((c) => c.trim()).filter(Boolean)
        : undefined,
    };
    await props.onSave(props.institutionId, props.region, position);
    setSaving(false);
  };

  return (
    <tr>
      <td>{props.region}</td>
      <td>
        <input value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
      </td>
      <td>
        <input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
      </td>
      <td>
        <input
          value={allowedCurrencies}
          onChange={(e) => setAllowedCurrencies(e.target.value)}
        />
      </td>
      <td>
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

export default App;
