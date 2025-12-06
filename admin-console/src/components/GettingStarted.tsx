import { CheckCircle2, Info, Link2 } from 'lucide-react';

type KeyType = 'root' | 'institution' | 'unknown';

interface GettingStartedProps {
  apiUrl: string;
  keyType: KeyType;
  hasInstitution: boolean;
  hasApiKey: boolean;
  hasTemplate: boolean;
  hasAsset: boolean;
  hasPosition: boolean;
  onNavigate: (tab: 'institutions' | 'assets' | 'positions') => void;
}

interface Step {
  id: number;
  label: string;
  description: string;
  done: boolean;
  actionLabel: string;
  targetTab: 'institutions' | 'assets' | 'positions';
}

export function GettingStarted({
  apiUrl,
  keyType,
  hasInstitution,
  hasApiKey,
  hasTemplate,
  hasAsset,
  hasPosition,
  onNavigate,
}: GettingStartedProps) {
  const steps: Step[] = [
    {
      id: 1,
      label: 'Create an institution',
      description:
        'Define the bank or organisation that will own templates, assets, and positions.',
      done: hasInstitution,
      actionLabel: 'Go to Institutions',
      targetTab: 'institutions',
    },
    {
      id: 2,
      label: 'Create an institution API key',
      description:
        'Issue an admin key for day-to-day use. The root key should be used only for bootstrap.',
      done: hasApiKey,
      actionLabel: 'Manage API Keys',
      targetTab: 'institutions',
    },
    {
      id: 3,
      label: 'Create an asset template',
      description:
        'Define a product type (e.g. construction escrow) for a specific vertical and region.',
      done: hasTemplate,
      actionLabel: 'Go to Assets',
      targetTab: 'assets',
    },
    {
      id: 4,
      label: 'Create an asset',
      description:
        'Instantiate a concrete asset under a template, such as a specific project escrow.',
      done: hasAsset,
      actionLabel: 'Go to Assets',
      targetTab: 'assets',
    },
    {
      id: 5,
      label: 'Create and transition a position',
      description:
        'Create a holder-specific claim and move it through its lifecycle (e.g. CREATED → FUNDED).',
      done: hasPosition,
      actionLabel: 'Go to Positions',
      targetTab: 'positions',
    },
  ];

  const keyLabel: string =
    keyType === 'root'
      ? 'Root key (full platform admin)'
      : keyType === 'institution'
      ? 'Institution key (tenant-scoped)'
      : 'Unknown (likely institution key)';

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Info size={20} className="text-primary-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Getting started with EscrowGrid</h2>
            <p className="text-sm text-surface-400">
              This page helps you bootstrap a demo or test environment end-to-end. Follow the
              checklist below; you can always come back here to see which steps are complete.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="text-sm">
            <div className="text-surface-400 mb-1">Connected API URL</div>
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-surface-900 rounded-lg">
              <Link2 size={14} className="text-primary-400" />
              <code className="font-mono text-xs break-all">{apiUrl}</code>
            </div>
          </div>
          <div className="text-sm">
            <div className="text-surface-400 mb-1">Current API key type</div>
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-surface-900 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{keyLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <h3 className="text-md font-semibold mb-3">Bootstrap checklist</h3>
        <ol className="space-y-3 text-sm">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5">
                {step.done ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-surface-600 inline-block mt-0.5" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-medium">
                  {step.id}. {step.label}
                </div>
                <p className="text-surface-500">{step.description}</p>
                <button
                  type="button"
                  onClick={() => onNavigate(step.targetTab)}
                  className="btn-secondary btn-xs mt-1"
                >
                  {step.actionLabel}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

