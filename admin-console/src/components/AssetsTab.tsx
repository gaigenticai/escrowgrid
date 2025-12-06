import { useState } from 'react';
import { Layers, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { AssetTemplate, Asset, Region, Vertical, TemplateCode } from '../types';
import { REGIONS, VERTICALS, TEMPLATE_CODES } from '../types';
import * as api from '../api';
import { SkeletonList } from './Skeleton';

interface AssetsTabProps {
  apiKey: string;
  templates: AssetTemplate[];
  assets: Asset[];
  loading: boolean;
  onTemplateCreated: (template: AssetTemplate) => void;
  onAssetCreated: (asset: Asset) => void;
}

export function AssetsTab({
  apiKey,
  templates,
  assets,
  loading,
  onTemplateCreated,
  onAssetCreated,
}: AssetsTabProps) {
  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateCode, setTemplateCode] = useState<TemplateCode>('CONSTR_ESCROW');
  const [templateName, setTemplateName] = useState('');
  const [templateRegion, setTemplateRegion] = useState<Region>('EU_UK');
  const [templateVertical, setTemplateVertical] = useState<Vertical>('CONSTRUCTION');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Asset form state
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetLabel, setAssetLabel] = useState('');
  const [assetTemplateId, setAssetTemplateId] = useState('');
  const [creatingAsset, setCreatingAsset] = useState(false);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setCreatingTemplate(true);
    try {
      const template = await api.createAssetTemplate(apiKey, {
        code: templateCode,
        name: templateName.trim(),
        vertical: templateVertical,
        region: templateRegion,
      });
      onTemplateCreated(template);
      setTemplateName('');
      setShowTemplateForm(false);
      toast.success(`Template "${template.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetLabel.trim() || !assetTemplateId) return;

    setCreatingAsset(true);
    try {
      const asset = await api.createAsset(apiKey, {
        templateId: assetTemplateId,
        label: assetLabel.trim(),
      });
      onAssetCreated(asset);
      setAssetLabel('');
      setShowAssetForm(false);
      toast.success(`Asset "${asset.label}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create asset');
    } finally {
      setCreatingAsset(false);
    }
  };

  if (loading) {
    return <SkeletonList count={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Asset Templates */}
      <div className="card">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-primary-400" />
            <h2 className="text-lg font-semibold">Asset Templates</h2>
          </div>
          <button
            onClick={() => setShowTemplateForm(!showTemplateForm)}
            className="btn-primary text-sm"
          >
            <Plus size={16} className="mr-1 inline" />
            New Template
          </button>
        </div>

        {showTemplateForm && (
          <form
            onSubmit={handleCreateTemplate}
            className="p-4 border-b border-surface-800 bg-surface-800/30"
          >
            <p className="text-xs text-surface-500 mb-3">
              Define reusable templates for different product types (e.g. construction escrow) in a
              specific vertical and region.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <select
                  className="select"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value as TemplateCode)}
                >
                  {TEMPLATE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Vertical <span className="text-red-500">*</span>
                </label>
                <select
                  className="select"
                  value={templateVertical}
                  onChange={(e) => setTemplateVertical(e.target.value as Vertical)}
                >
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Region <span className="text-red-500">*</span>
                </label>
                <select
                  className="select"
                  value={templateRegion}
                  onChange={(e) => setTemplateRegion(e.target.value as Region)}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplateForm(false)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={creatingTemplate} className="btn-primary text-sm">
                {creatingTemplate ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-surface-800">
          {templates.length === 0 ? (
            <p className="p-4 text-surface-500 text-center">No templates yet</p>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      <span className="badge badge-info">{template.code}</span>
                    </div>
                    <div className="text-sm text-surface-500 mt-0.5">
                      <span className="font-mono">{template.id.slice(0, 12)}...</span>
                      <span className="mx-2">·</span>
                      <span>{template.vertical}</span>
                      <span className="mx-2">·</span>
                      <span>{template.region}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assets */}
      <div className="card">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-accent-400" />
            <h2 className="text-lg font-semibold">Assets</h2>
          </div>
          <button
            onClick={() => setShowAssetForm(!showAssetForm)}
            className="btn-primary text-sm"
            disabled={templates.length === 0}
          >
            <Plus size={16} className="mr-1 inline" />
            New Asset
          </button>
        </div>

        {showAssetForm && (
          <form
            onSubmit={handleCreateAsset}
            className="p-4 border-b border-surface-800 bg-surface-800/30"
          >
            <p className="text-xs text-surface-500 mb-3">
              Create concrete assets under a template (for example, a specific project escrow).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Template <span className="text-red-500">*</span>
                </label>
                <select
                  className="select"
                  value={assetTemplateId}
                  onChange={(e) => setAssetTemplateId(e.target.value)}
                  required
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Asset label"
                  value={assetLabel}
                  onChange={(e) => setAssetLabel(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssetForm(false)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={creatingAsset} className="btn-primary text-sm">
                {creatingAsset ? 'Creating...' : 'Create Asset'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-surface-800">
          {assets.length === 0 ? (
            <p className="p-4 text-surface-500 text-center">No assets yet</p>
          ) : (
            assets.map((asset) => {
              const template = templates.find((t) => t.id === asset.templateId);
              return (
                <div key={asset.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{asset.label}</div>
                      <div className="text-sm text-surface-500 mt-0.5">
                        <span className="font-mono">{asset.id.slice(0, 12)}...</span>
                        <span className="mx-2">·</span>
                        <span>Template: {template?.name ?? asset.templateId.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
