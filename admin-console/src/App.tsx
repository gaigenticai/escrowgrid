import { useEffect, useState, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import {
  Building2,
  Layers,
  Wallet,
  KeyRound,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import type {
  Institution,
  ApiKey,
  AssetTemplate,
  Asset,
  Position,
  Policy,
  LedgerEvent,
  ActiveTab,
} from './types';
import * as api from './api';
import { InstitutionsTab } from './components/InstitutionsTab';
import { AssetsTab } from './components/AssetsTab';
import { PositionsTab } from './components/PositionsTab';
import { GettingStarted } from './components/GettingStarted';

function App() {
  // Auth state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiUrlInput, setApiUrlInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('admin_api_url') ?? '';
  });
  const [apiKey, setApiKey] = useState<string | null>(() => {
    return localStorage.getItem('admin_api_key');
  });

  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('institutions');

  // Data state
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [templates, setTemplates] = useState<AssetTemplate[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [keyType, setKeyType] = useState<'root' | 'institution' | 'unknown'>('unknown');

  // Loading states
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const selectedInstitution = institutions.find((i) => i.id === selectedInstitutionId) ?? null;

  // Load institutions on auth
  useEffect(() => {
    if (!apiKey) return;

    setLoadingInstitutions(true);
    api
      .listInstitutions(apiKey)
      .then((data) => {
        setInstitutions(data);
        if (data.length > 0 && !selectedInstitutionId) {
          setSelectedInstitutionId(data[0].id);
        }
      })
      .catch((err) => {
        toast.error(`Failed to load institutions: ${err.message}`);
        if (err.status === 401) {
          handleLogout();
        }
      })
      .finally(() => setLoadingInstitutions(false));

    // Detect key type (root vs institution) using a root-only endpoint.
    api
      .detectKeyType(apiKey)
      .then(setKeyType)
      .catch(() => setKeyType('unknown'));
  }, [apiKey]);

  // Load institution data when selection changes
  useEffect(() => {
    if (!apiKey || !selectedInstitutionId) return;

    setLoadingData(true);

    Promise.all([
      api.listApiKeys(apiKey, selectedInstitutionId).catch(() => []),
      api.listAssetTemplates(apiKey, selectedInstitutionId).catch(() => []),
      api.listAssets(apiKey, selectedInstitutionId).catch(() => []),
      api.listPositions(apiKey, selectedInstitutionId).catch(() => []),
      api.listPolicies(apiKey, selectedInstitutionId).catch(() => []),
    ])
      .then(([keys, tmpls, assts, poss, pols]) => {
        setApiKeys(keys);
        setTemplates(tmpls);
        setAssets(assts);
        setPositions(poss);
        setPolicies(pols);
      })
      .finally(() => setLoadingData(false));
  }, [apiKey, selectedInstitutionId]);

  // Load ledger events for selected position
  useEffect(() => {
    if (!apiKey || !selectedPositionId) {
      setLedgerEvents([]);
      return;
    }

    api
      .listLedgerEvents(apiKey, selectedPositionId)
      .then(setLedgerEvents)
      .catch(() => setLedgerEvents([]));
  }, [apiKey, selectedPositionId]);

  const handleLogin = useCallback(() => {
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    const key = apiKeyInput.trim();
    if (apiUrlInput.trim()) {
      api.setApiBaseUrl(apiUrlInput);
    } else {
      api.setApiBaseUrl(null);
    }
    localStorage.setItem('admin_api_key', key);
    setApiKey(key);
    setApiKeyInput('');
    toast.success('Logged in successfully');
  }, [apiKeyInput, apiUrlInput]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_api_key');
    setApiKey(null);
    setInstitutions([]);
    setSelectedInstitutionId(null);
    setApiKeys([]);
    setTemplates([]);
    setAssets([]);
    setPositions([]);
    setPolicies([]);
    setKeyType('unknown');
    toast.info('Logged out');
  }, []);

  // Tab configuration
  const tabs: { id: ActiveTab; label: string; icon: typeof Building2 }[] = [
    { id: 'getting-started', label: 'Getting Started', icon: KeyRound },
    { id: 'institutions', label: 'Institutions', icon: Building2 },
    { id: 'assets', label: 'Assets', icon: Layers },
    { id: 'positions', label: 'Positions', icon: Wallet },
  ];

  // Login screen
  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            className: 'bg-surface-800 border border-surface-700 text-surface-100',
          }}
        />
        <div className="card p-8 max-w-md w-full animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4">
              <KeyRound size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold">EscrowGrid Admin</h1>
            <p className="text-surface-400 mt-2">
              Enter your API key to access the admin console
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-surface-400 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-surface-500 mb-1">
                For the Docker demo, use the ROOT_API_KEY set in <code>docker-compose.yml</code>
                (default: <code>replace-me-root-key</code>). In real environments, use a root or
                institution admin key issued by your operator.
              </p>
              <input
                type="password"
                className="input"
                placeholder="ak_..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1">
                API URL <span className="text-surface-500 text-xs">(optional)</span>
              </label>
              <p className="text-xs text-surface-500 mb-1">
                Base URL of the EscrowGrid API. Leave blank for the default{' '}
                <code>http://localhost:4000</code> used by the Docker demo. If you exposed the API
                on a different port or host, enter it here (for example,
                <code> http://localhost:5000</code> or <code>https://api.example.com</code>).
              </p>
              <input
                type="text"
                className="input"
                placeholder="http://localhost:4000"
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              <ChevronRight size={18} className="mr-1 inline" />
              Sign In
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Need an API key? Contact your administrator
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          className: 'bg-surface-800 border border-surface-700 text-surface-100',
        }}
      />

      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Layers size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg">EscrowGrid</span>
            </div>

            {/* Institution selector */}
            {institutions.length > 0 && (
              <select
                className="select max-w-xs"
                value={selectedInstitutionId ?? ''}
                onChange={(e) => setSelectedInstitutionId(e.target.value || null)}
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-500 hidden sm:inline">
                Using API key <code className="font-mono">{apiKey.slice(0, 10)}...</code>
              </span>
              <button onClick={handleLogout} className="btn-ghost p-2" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-surface-800 bg-surface-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2
                    ${
                      isActive
                        ? 'text-primary-400'
                        : 'text-surface-400 hover:text-surface-100'
                    }`}
                >
                  <Icon size={18} />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'getting-started' && (
          <GettingStarted
            apiUrl={apiUrlInput.trim() || (typeof window !== 'undefined'
              ? localStorage.getItem('admin_api_url') ?? (import.meta.env.VITE_API_URL ?? 'http://localhost:4000')
              : import.meta.env.VITE_API_URL ?? 'http://localhost:4000')}
            keyType={keyType}
            hasInstitution={institutions.length > 0}
            hasApiKey={apiKeys.length > 0}
            hasTemplate={templates.length > 0}
            hasAsset={assets.length > 0}
            hasPosition={positions.length > 0}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'institutions' && (
          <InstitutionsTab
            apiKey={apiKey}
            institutions={institutions}
            selectedInstitution={selectedInstitution}
            apiKeys={apiKeys}
            policies={policies}
            loading={loadingInstitutions || loadingData}
            onSelectInstitution={setSelectedInstitutionId}
            onInstitutionCreated={(inst) => {
              setInstitutions((prev) => [...prev, inst]);
              setSelectedInstitutionId(inst.id);
            }}
            onApiKeyCreated={(key) => setApiKeys((prev) => [...prev, key])}
            onApiKeyRevoked={(keyId) =>
              setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
            }
            onPolicyUpdated={(policy) => {
              setPolicies((prev) => {
                const others = prev.filter(
                  (p) => !(p.institutionId === policy.institutionId && p.region === policy.region),
                );
                return [...others, policy];
              });
            }}
          />
        )}

        {activeTab === 'assets' && (
          <AssetsTab
            apiKey={apiKey}
            templates={templates}
            assets={assets}
            loading={loadingData}
            onTemplateCreated={(tmpl) => setTemplates((prev) => [...prev, tmpl])}
            onAssetCreated={(asset) => setAssets((prev) => [...prev, asset])}
          />
        )}

        {activeTab === 'positions' && (
          <PositionsTab
            apiKey={apiKey}
            positions={positions}
            assets={assets}
            ledgerEvents={ledgerEvents}
            selectedPositionId={selectedPositionId}
            loading={loadingData}
            onSelectPosition={setSelectedPositionId}
            onPositionCreated={(pos) => setPositions((prev) => [...prev, pos])}
            onPositionUpdated={(pos) =>
              setPositions((prev) => prev.map((p) => (p.id === pos.id ? pos : p)))
            }
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-4 text-center text-sm text-surface-500">
        EscrowGrid TAAS Platform
      </footer>
    </div>
  );
}

export default App;
