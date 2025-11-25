import { ethers } from 'ethers';
import type { LedgerClient, LedgerContext } from '../domain/ledger';
import type { Position, PositionLifecycleEvent } from '../domain/types';
import { config } from '../config';
import { store } from '../store';

const ledgerAbi = [
  'function recordPositionEvent(string positionId, string kind, string payloadJson)',
] as const;

export class OnchainLedger implements Pick<LedgerClient, 'recordPositionCreated' | 'recordPositionStateChanged'> {
  private provider!: ethers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  private contract!: ethers.Contract;

  constructor() {
    if (!config.onchainRpcUrl || !config.onchainPrivateKey || !config.onchainContractAddress) {
      throw new Error('On-chain ledger requires ONCHAIN_RPC_URL, ONCHAIN_PRIVATE_KEY, and ONCHAIN_CONTRACT_ADDRESS');
    }
    this.provider = new ethers.JsonRpcProvider(config.onchainRpcUrl, config.onchainChainId);
    this.wallet = new ethers.Wallet(config.onchainPrivateKey, this.provider);
    this.contract = new ethers.Contract(config.onchainContractAddress, ledgerAbi, this.wallet);
  }

  async recordPositionCreated(position: Position, context?: LedgerContext): Promise<void> {
    // Check per-asset-template on-chain toggle
    const asset = await store.getAsset(position.assetId);
    if (!asset) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'asset_not_found',
          positionId: position.id,
          assetId: position.assetId,
        }),
      );
      return;
    }
    const template = await store.getAssetTemplate(asset.templateId);
    if (!template) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'template_not_found',
          positionId: position.id,
          assetId: position.assetId,
          templateId: asset.templateId,
        }),
      );
      return;
    }

    const onchainConfig = (template.config as any).onchain as
      | { enabled?: boolean; chainId?: number }
      | undefined;
    if (!onchainConfig?.enabled) {
      console.log(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'onchain_disabled_for_template',
          positionId: position.id,
          templateId: template.id,
        }),
      );
      return;
    }
    if (
      config.onchainChainId !== undefined &&
      onchainConfig.chainId !== undefined &&
      onchainConfig.chainId !== config.onchainChainId
    ) {
      console.log(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'chain_id_mismatch',
          positionId: position.id,
          templateChainId: onchainConfig.chainId,
          configuredChainId: config.onchainChainId,
        }),
      );
      return;
    }

    const payload = {
      institutionId: position.institutionId,
      assetId: position.assetId,
      currency: position.currency,
      amount: position.amount,
      externalReference: position.externalReference,
      state: position.state,
      requestId: context?.requestId,
    };
    try {
      const contract = this.contract;
      const fn = (contract as any)['recordPositionEvent'] as
        | ((positionId: string, kind: string, payloadJson: string) => Promise<any>)
        | undefined;
      if (!fn) {
        throw new Error('Contract method recordPositionEvent is not available');
      }
      const tx = await fn(position.id, 'POSITION_CREATED', JSON.stringify(payload));
      console.log(
        JSON.stringify({
          type: 'onchain_ledger',
          kind: 'POSITION_CREATED',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          txHash: tx.hash,
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_error',
          operation: 'recordPositionCreated',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  async recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
    context?: LedgerContext,
  ): Promise<void> {
    // Check per-asset-template on-chain toggle
    const asset = await store.getAsset(position.assetId);
    if (!asset) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'asset_not_found',
          positionId: position.id,
          assetId: position.assetId,
        }),
      );
      return;
    }
    const template = await store.getAssetTemplate(asset.templateId);
    if (!template) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'template_not_found',
          positionId: position.id,
          assetId: position.assetId,
          templateId: asset.templateId,
        }),
      );
      return;
    }

    const onchainConfig = (template.config as any).onchain as
      | { enabled?: boolean; chainId?: number }
      | undefined;
    if (!onchainConfig?.enabled) {
      console.log(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'onchain_disabled_for_template',
          positionId: position.id,
          templateId: template.id,
        }),
      );
      return;
    }
    if (
      config.onchainChainId !== undefined &&
      onchainConfig.chainId !== undefined &&
      onchainConfig.chainId !== config.onchainChainId
    ) {
      console.log(
        JSON.stringify({
          type: 'onchain_ledger_skip',
          reason: 'chain_id_mismatch',
          positionId: position.id,
          templateChainId: onchainConfig.chainId,
          configuredChainId: config.onchainChainId,
        }),
      );
      return;
    }

    const payload = {
      institutionId: position.institutionId,
      assetId: position.assetId,
      fromState: lifecycleEvent.fromState,
      toState: lifecycleEvent.toState,
      reason: lifecycleEvent.reason,
      at: lifecycleEvent.at,
      requestId: context?.requestId,
    };
    try {
      const contract = this.contract;
      const fn = (contract as any)['recordPositionEvent'] as
        | ((positionId: string, kind: string, payloadJson: string) => Promise<any>)
        | undefined;
      if (!fn) {
        throw new Error('Contract method recordPositionEvent is not available');
      }
      const tx = await fn(position.id, 'POSITION_STATE_CHANGED', JSON.stringify(payload));
      console.log(
        JSON.stringify({
          type: 'onchain_ledger',
          kind: 'POSITION_STATE_CHANGED',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          txHash: tx.hash,
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          type: 'onchain_ledger_error',
          operation: 'recordPositionStateChanged',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

