import { useState } from 'react';
import { Wallet, Plus, History, ArrowRight, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Position, Asset, LedgerEvent, PositionState } from '../types';
import { POSITION_TRANSITIONS } from '../types';
import * as api from '../api';
import { SkeletonList } from './Skeleton';
import { StateBadge } from './StateBadge';
import { ConfirmDialog } from './ConfirmDialog';

interface PositionsTabProps {
  apiKey: string;
  positions: Position[];
  assets: Asset[];
  ledgerEvents: LedgerEvent[];
  selectedPositionId: string | null;
  loading: boolean;
  onSelectPosition: (id: string | null) => void;
  onPositionCreated: (position: Position) => void;
  onPositionUpdated: (position: Position) => void;
}

export function PositionsTab({
  apiKey,
  positions,
  assets,
  ledgerEvents,
  selectedPositionId,
  loading,
  onSelectPosition,
  onPositionCreated,
  onPositionUpdated,
}: PositionsTabProps) {
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAssetId, setNewAssetId] = useState('');
  const [newHolder, setNewHolder] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newAmount, setNewAmount] = useState('');
  const [creating, setCreating] = useState(false);

  // Transition state
  const [transitionConfirm, setTransitionConfirm] = useState<{
    position: Position;
    toState: PositionState;
  } | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);

  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetId || !newHolder.trim() || !newAmount) return;

    setCreating(true);
    try {
      const position = await api.createPosition(apiKey, {
        assetId: newAssetId,
        holderReference: newHolder.trim(),
        currency: newCurrency,
        amount: parseFloat(newAmount),
      });
      onPositionCreated(position);
      setNewHolder('');
      setNewAmount('');
      setShowCreateForm(false);
      toast.success('Position created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setCreating(false);
    }
  };

  const handleTransition = async () => {
    if (!transitionConfirm) return;

    setTransitioning(true);
    try {
      const updated = await api.transitionPosition(
        apiKey,
        transitionConfirm.position.id,
        transitionConfirm.toState,
      );
      onPositionUpdated(updated);
      onSelectPosition(updated.id);
      toast.success(`Position transitioned to ${transitionConfirm.toState}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transition position');
    } finally {
      setTransitioning(false);
      setTransitionConfirm(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return <SkeletonList count={4} />;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Positions List */}
      <div className="lg:col-span-2">
        <div className="card">
          <div className="p-4 border-b border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={20} className="text-primary-400" />
              <h2 className="text-lg font-semibold">Positions</h2>
              <span className="badge badge-neutral">{positions.length}</span>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn-primary text-sm"
              disabled={assets.length === 0}
            >
              <Plus size={16} className="mr-1 inline" />
              New Position
            </button>
          </div>

          {showCreateForm && (
            <form
              onSubmit={handleCreatePosition}
              className="p-4 border-b border-surface-800 bg-surface-800/30"
            >
              <p className="text-xs text-surface-500 mb-3">
                Create a new holder-specific claim on an asset. Policies and validation rules may
                reject amounts or currencies that are not allowed.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-surface-400 mb-1">
                    Asset <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="select"
                    value={newAssetId}
                    onChange={(e) => setNewAssetId(e.target.value)}
                    required
                  >
                    <option value="">Select asset...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-1">
                    Holder Reference <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="HOLDER_001"
                    value={newHolder}
                    onChange={(e) => setNewHolder(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="select"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="SGD">SGD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-1">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder="10000.00"
                    step="0.01"
                    min="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                  />
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
                  {creating ? 'Creating...' : 'Create Position'}
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-surface-800">
            {positions.length === 0 ? (
              <p className="p-4 text-surface-500 text-center">No positions yet</p>
            ) : (
              positions.map((position) => {
                const asset = assets.find((a) => a.id === position.assetId);
                const allowedTransitions = POSITION_TRANSITIONS[position.state];

                return (
                  <div
                    key={position.id}
                    className={`p-4 cursor-pointer hover:bg-surface-800/50 transition-colors ${
                      selectedPositionId === position.id
                        ? 'bg-surface-800/50 border-l-2 border-primary-500'
                        : ''
                    }`}
                    onClick={() => onSelectPosition(position.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-surface-400">
                            {position.id.slice(0, 12)}...
                          </span>
                          <StateBadge state={position.state} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xl font-semibold">
                          <DollarSign size={18} className="text-emerald-400" />
                          {formatAmount(position.amount, position.currency)}
                        </div>
                        <div className="text-sm text-surface-500 mt-1">
                          <span>Holder: {position.holderReference}</span>
                          <span className="mx-2">·</span>
                          <span>Asset: {asset?.label ?? position.assetId.slice(0, 8)}</span>
                        </div>
                      </div>

                      {allowedTransitions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {allowedTransitions.map((toState) => (
                            <button
                              key={toState}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTransitionConfirm({ position, toState });
                              }}
                              className="btn-ghost text-xs px-2 py-1"
                            >
                              <ArrowRight size={12} className="mr-1 inline" />
                              {toState}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Position Details / Ledger */}
      <div className="lg:col-span-1">
        <div className="card sticky top-4">
          <div className="p-4 border-b border-surface-800 flex items-center gap-2">
            <History size={20} className="text-accent-400" />
            <h3 className="text-lg font-semibold">Ledger Events</h3>
          </div>

          {selectedPosition ? (
            <div className="divide-y divide-surface-800">
              {/* Position Summary */}
              <div className="p-4 bg-surface-800/30">
                <div className="text-sm text-surface-400 mb-1">Position</div>
                <div className="font-mono text-sm mb-2">{selectedPosition.id}</div>
                <div className="flex items-center gap-2">
                  <StateBadge state={selectedPosition.state} />
                  <span className="font-semibold">
                    {formatAmount(selectedPosition.amount, selectedPosition.currency)}
                  </span>
                </div>
              </div>

              {/* Events Timeline */}
              {ledgerEvents.length === 0 ? (
                <p className="p-4 text-surface-500 text-center text-sm">No events yet</p>
              ) : (
                <div className="p-4 space-y-3">
                  {ledgerEvents.map((event, index) => (
                    <div key={event.id} className="relative">
                      {index < ledgerEvents.length - 1 && (
                        <div className="absolute left-2.5 top-6 bottom-0 w-px bg-surface-700" />
                      )}
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-800 border-2 border-surface-600 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {event.kind === 'POSITION_CREATED' ? (
                              'Created'
                            ) : (
                              <>
                                {event.previousState}
                                <ArrowRight size={12} className="inline mx-1 text-surface-500" />
                                {event.newState}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-surface-500 mt-0.5">
                            {new Date(event.at).toLocaleString()}
                          </div>
                          {event.txHash && (
                            <div className="text-xs font-mono text-primary-400 mt-0.5">
                              tx: {event.txHash.slice(0, 16)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="p-4 text-surface-500 text-center">Select a position to view events</p>
          )}
        </div>
      </div>

      {/* Transition Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!transitionConfirm}
        title="Transition Position"
        message={`Are you sure you want to transition this position from ${transitionConfirm?.position.state} to ${transitionConfirm?.toState}?`}
        confirmLabel={transitioning ? 'Transitioning...' : `Transition to ${transitionConfirm?.toState}`}
        variant="warning"
        onConfirm={handleTransition}
        onCancel={() => setTransitionConfirm(null)}
      />
    </div>
  );
}
