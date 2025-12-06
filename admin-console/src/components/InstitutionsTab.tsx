import { useState } from 'react';
import { Building2, Plus, Key, Shield, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Institution, ApiKey, Policy, Region, ApiKeyRole } from '../types';
import { REGIONS, API_KEY_ROLES } from '../types';
import * as api from '../api';
import { SkeletonList } from './Skeleton';
import { ConfirmDialog } from './ConfirmDialog';

interface InstitutionsTabProps {
  apiKey: string;
  institutions: Institution[];
  selectedInstitution: Institution | null;
  apiKeys: ApiKey[];
  policies: Policy[];
  loading: boolean;
  onSelectInstitution: (id: string) => void;
  onInstitutionCreated: (institution: Institution) => void;
  onApiKeyCreated: (apiKey: ApiKey) => void;
  onApiKeyRevoked: (apiKeyId: string) => void;
  onPolicyUpdated: (policy: Policy) => void;
}

export function InstitutionsTab({
  apiKey,
  institutions,
  selectedInstitution,
  apiKeys,
  policies,
  loading,
  onSelectInstitution,
  onInstitutionCreated,
  onApiKeyCreated,
  onApiKeyRevoked,
  onPolicyUpdated,
}: InstitutionsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createRegions, setCreateRegions] = useState<Region[]>(['EU_UK']);
  const [creating, setCreating] = useState(false);

  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<ApiKeyRole>('admin');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [revokeConfirm, setRevokeConfirm] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || createRegions.length === 0) return;

    setCreating(true);
    try {
      const institution = await api.createInstitution(apiKey, {
        name: createName.trim(),
        regions: createRegions,
        verticals: ['CONSTRUCTION', 'TRADE_FINANCE'],
      });
      onInstitutionCreated(institution);
      setCreateName('');
      setCreateRegions(['EU_UK']);
      setShowCreateForm(false);
      toast.success(`Institution "${institution.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create institution');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstitution || !newKeyLabel.trim()) return;

    setCreatingKey(true);
    try {
      const result = await api.createApiKey(apiKey, selectedInstitution.id, {
        label: newKeyLabel.trim(),
        role: newKeyRole,
      });
      onApiKeyCreated(result.record);
      setNewKeyToken(result.apiKey);
      setNewKeyLabel('');
      toast.success('API key created - copy it now!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!selectedInstitution || !revokeConfirm) return;

    setRevoking(true);
    try {
      await api.revokeApiKey(apiKey, selectedInstitution.id, revokeConfirm.id);
      onApiKeyRevoked(revokeConfirm.id);
      toast.success('API key revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke API key');
    } finally {
      setRevoking(false);
      setRevokeConfirm(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (loading) {
    return <SkeletonList count={3} />;
  }

  return (
    <div className="space-y-6">
      {/* Institutions List */}
      <div className="card">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-primary-400" />
            <h2 className="text-lg font-semibold">Institutions</h2>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary text-sm"
          >
            <Plus size={16} className="mr-1 inline" />
            New Institution
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateInstitution} className="p-4 border-b border-surface-800 bg-surface-800/30">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-surface-500 mb-1">
                  Legal or display name of the institution (e.g. &quot;Demo Bank&quot;).
                </p>
                <input
                  type="text"
                  className="input"
                  placeholder="Institution name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Regions <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-surface-500 mb-1">
                  Jurisdictions where this institution is allowed to originate assets and positions.
                </p>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((region) => (
                    <label key={region} className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500"
                        checked={createRegions.includes(region)}
                        onChange={(e) =>
                          setCreateRegions((prev) =>
                            e.target.checked
                              ? [...prev, region]
                              : prev.filter((r) => r !== region),
                          )
                        }
                      />
                      <span className="text-sm">{region}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn-primary text-sm">
                {creating ? 'Creating...' : 'Create Institution'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-surface-800">
          {institutions.length === 0 ? (
            <p className="p-4 text-surface-500 text-center">No institutions yet</p>
          ) : (
            institutions.map((inst) => (
              <button
                key={inst.id}
                onClick={() => onSelectInstitution(inst.id)}
                className={`w-full p-4 text-left hover:bg-surface-800/50 transition-colors ${
                  selectedInstitution?.id === inst.id ? 'bg-surface-800/50 border-l-2 border-primary-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{inst.name}</div>
                    <div className="text-sm text-surface-500 mt-0.5">
                      <span className="font-mono">{inst.id.slice(0, 12)}...</span>
                      <span className="mx-2">·</span>
                      <span>{inst.regions.join(', ')}</span>
                    </div>
                  </div>
                  {selectedInstitution?.id === inst.id && (
                    <div className="text-primary-400">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Selected Institution Details */}
      {selectedInstitution && (
        <>
          {/* API Keys */}
          <div className="card">
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={20} className="text-accent-400" />
                <h3 className="text-lg font-semibold">API Keys</h3>
              </div>
              <button
                onClick={() => {
                  setShowApiKeyForm(!showApiKeyForm);
                  setNewKeyToken(null);
                }}
                className="btn-secondary text-sm"
              >
                <Plus size={16} className="mr-1 inline" />
                New Key
              </button>
            </div>

            {showApiKeyForm && (
              <div className="p-4 border-b border-surface-800 bg-surface-800/30">
                {newKeyToken ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check size={20} />
                      <span className="font-medium">API Key Created</span>
                    </div>
                    <p className="text-sm text-surface-400">
                      Copy this key now - it won't be shown again!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-surface-900 rounded-lg font-mono text-sm break-all">
                        {newKeyToken}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newKeyToken)}
                        className="btn-secondary p-2"
                        title="Copy to clipboard"
                      >
                        {copiedKey ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowApiKeyForm(false);
                        setNewKeyToken(null);
                      }}
                      className="btn-ghost text-sm"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateApiKey} className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-surface-400 mb-1">
                        Label <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-surface-500 mb-1">
                        Short description to recognise this key (e.g. &quot;Backoffice app&quot;).
                      </p>
                      <input
                        type="text"
                        className="input"
                        placeholder="Key label"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-40">
                      <label className="block text-sm text-surface-400 mb-1">Role</label>
                      <p className="text-xs text-surface-500 mb-1">
                        <span className="font-medium">admin</span> can read/write;{' '}
                        <span className="font-medium">read_only</span> can only read.
                      </p>
                      <select
                        className="select"
                        value={newKeyRole}
                        onChange={(e) => setNewKeyRole(e.target.value as ApiKeyRole)}
                      >
                        {API_KEY_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" disabled={creatingKey} className="btn-primary">
                      {creatingKey ? 'Creating...' : 'Create'}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="divide-y divide-surface-800">
              {apiKeys.length === 0 ? (
                <p className="p-4 text-surface-500 text-center">No API keys</p>
              ) : (
                apiKeys.map((key) => (
                  <div key={key.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.label}</span>
                        <span
                          className={`badge ${
                            key.role === 'admin' ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {key.role}
                        </span>
                      </div>
                      <div className="text-sm text-surface-500 mt-0.5">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => setRevokeConfirm(key)}
                      className="btn-danger text-sm"
                    >
                      <Trash2 size={14} className="mr-1 inline" />
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Policies */}
          <div className="card">
            <div className="p-4 border-b border-surface-800 flex items-center gap-2">
              <Shield size={20} className="text-emerald-400" />
              <h3 className="text-lg font-semibold">Position Policies</h3>
            </div>
            <p className="px-4 pt-3 pb-1 text-xs text-surface-500">
              Optional safety rails applied when creating positions. Leave fields blank for a region
              to allow any amount/currency, or set minimum/maximum and allowed currency list.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-surface-400">
                      Region
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-surface-400">
                      Min Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-surface-400">
                      Max Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-surface-400">
                      Currencies
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-surface-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {REGIONS.map((region) => {
                    const policy = policies.find(
                      (p) => p.institutionId === selectedInstitution.id && p.region === region,
                    );
                    return (
                      <PolicyRow
                        key={region}
                        apiKey={apiKey}
                        institutionId={selectedInstitution.id}
                        region={region}
                        policy={policy}
                        onUpdated={onPolicyUpdated}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!revokeConfirm}
        title="Revoke API Key"
        message={`Are you sure you want to revoke the API key "${revokeConfirm?.label}"? This action cannot be undone.`}
        confirmLabel={revoking ? 'Revoking...' : 'Revoke Key'}
        variant="danger"
        onConfirm={handleRevokeApiKey}
        onCancel={() => setRevokeConfirm(null)}
      />
    </div>
  );
}

// Policy Row Component
function PolicyRow({
  apiKey,
  institutionId,
  region,
  policy,
  onUpdated,
}: {
  apiKey: string;
  institutionId: string;
  region: Region;
  policy?: Policy;
  onUpdated: (policy: Policy) => void;
}) {
  const [minAmount, setMinAmount] = useState(policy?.config.position.minAmount?.toString() ?? '');
  const [maxAmount, setMaxAmount] = useState(policy?.config.position.maxAmount?.toString() ?? '');
  const [currencies, setCurrencies] = useState(
    policy?.config.position.allowedCurrencies?.join(', ') ?? '',
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.upsertPolicy(apiKey, institutionId, region, {
        position: {
          minAmount: minAmount ? Number(minAmount) : undefined,
          maxAmount: maxAmount ? Number(maxAmount) : undefined,
          allowedCurrencies: currencies
            ? currencies.split(',').map((c) => c.trim()).filter(Boolean)
            : undefined,
        },
      });
      onUpdated(updated);
      toast.success(`Policy for ${region} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{region}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          className="input w-28"
          placeholder="0"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          className="input w-28"
          placeholder="∞"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          className="input"
          placeholder="USD, EUR, GBP"
          value={currencies}
          onChange={(e) => setCurrencies(e.target.value)}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
