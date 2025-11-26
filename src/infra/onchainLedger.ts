import { ethers } from 'ethers';
import type { LedgerClient, LedgerContext } from '../domain/ledger';
import type { Position, PositionLifecycleEvent } from '../domain/types';
import { config } from '../config';
import { store } from '../store';
import { auditLogger } from './auditLogger';

const ledgerAbi = [
  'function recordPositionEvent(string positionId, string kind, string payloadJson)',
] as const;

/**
 * Configuration for on-chain failure handling.
 * In production, set ONCHAIN_FAILURE_MODE to 'fail' to make operations fail
 * when on-chain recording fails. Default is 'queue' which logs and queues for retry.
 */
type OnchainFailureMode = 'fail' | 'queue';
const FAILURE_MODE: OnchainFailureMode = (process.env.ONCHAIN_FAILURE_MODE as OnchainFailureMode) ?? 'queue';
const MAX_RETRIES = parseInt(process.env.ONCHAIN_MAX_RETRIES ?? '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.ONCHAIN_RETRY_DELAY_MS ?? '5000', 10);

/**
 * Pending on-chain operations that need to be retried.
 * In a production system, this would be persisted to a database.
 */
interface PendingOperation {
  id: string;
  kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED';
  positionId: string;
  payload: Record<string, unknown>;
  context?: LedgerContext;
  attemptCount: number;
  lastAttemptAt: string;
  error?: string;
}

// In-memory queue for pending operations (would be persistent in production)
const pendingOperationsQueue: PendingOperation[] = [];

/**
 * Error class for on-chain ledger failures.
 * When ONCHAIN_FAILURE_MODE=fail, this error will propagate up and fail the operation.
 */
export class OnchainLedgerError extends Error {
  constructor(
    public readonly operation: string,
    public readonly positionId: string,
    public readonly originalError: Error,
    public readonly retryable: boolean = true,
  ) {
    super(`On-chain ledger ${operation} failed for position ${positionId}: ${originalError.message}`);
    this.name = 'OnchainLedgerError';
  }
}

/**
 * Get pending operations count (for monitoring)
 */
export function getPendingOperationsCount(): number {
  return pendingOperationsQueue.length;
}

/**
 * Get pending operations (for admin/debugging)
 */
export function getPendingOperations(): ReadonlyArray<PendingOperation> {
  return [...pendingOperationsQueue];
}

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
      await this.handleOnchainError(
        'recordPositionCreated',
        'POSITION_CREATED',
        position.id,
        payload,
        context,
        err as Error,
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
      await this.handleOnchainError(
        'recordPositionStateChanged',
        'POSITION_STATE_CHANGED',
        position.id,
        payload,
        context,
        err as Error,
      );
    }
  }

  /**
   * Handle on-chain ledger errors according to the configured failure mode.
   * - 'fail' mode: throws an error that will fail the operation
   * - 'queue' mode: logs an alert and queues for retry
   */
  private async handleOnchainError(
    operation: string,
    kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED',
    positionId: string,
    payload: Record<string, unknown>,
    context: LedgerContext | undefined,
    error: Error,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log structured error for monitoring/alerting
    console.error(
      JSON.stringify({
        type: 'onchain_ledger_error',
        severity: 'critical',
        operation,
        positionId,
        requestId: context?.requestId ?? null,
        error: errorMessage,
        failureMode: FAILURE_MODE,
        timestamp: new Date().toISOString(),
      }),
    );

    // Record in audit log for compliance
    await auditLogger.record({
      action: 'ONCHAIN_LEDGER_FAILED',
      outcome: 'failure',
      method: 'INTERNAL',
      path: `/onchain/${operation}`,
      requestId: context?.requestId ?? 'N/A',
      resourceType: 'position',
      resourceId: positionId,
      payload: { operation, kind },
      error: {
        code: 'ONCHAIN_ERROR',
        message: errorMessage,
      },
      statusCode: 500,
    });

    if (FAILURE_MODE === 'fail') {
      // In 'fail' mode, throw error to fail the operation
      throw new OnchainLedgerError(operation, positionId, error);
    }

    // In 'queue' mode, add to retry queue
    const pendingOp: PendingOperation = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      kind,
      positionId,
      payload,
      context,
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString(),
      error: errorMessage,
    };
    pendingOperationsQueue.push(pendingOp);

    // Log alert for operations team
    console.warn(
      JSON.stringify({
        type: 'onchain_ledger_alert',
        severity: 'warning',
        message: `On-chain ${operation} queued for retry`,
        positionId,
        queuedOperationId: pendingOp.id,
        pendingQueueSize: pendingOperationsQueue.length,
        timestamp: new Date().toISOString(),
      }),
    );

    // Schedule retry (in production, this would be handled by a job scheduler)
    if (pendingOp.attemptCount < MAX_RETRIES) {
      setTimeout(() => this.retryPendingOperation(pendingOp), RETRY_DELAY_MS);
    }
  }

  /**
   * Retry a pending operation.
   * In production, this would be handled by a persistent job queue.
   */
  private async retryPendingOperation(pendingOp: PendingOperation): Promise<void> {
    pendingOp.attemptCount++;
    pendingOp.lastAttemptAt = new Date().toISOString();

    try {
      const contract = this.contract;
      const fn = (contract as any)['recordPositionEvent'] as
        | ((positionId: string, kind: string, payloadJson: string) => Promise<any>)
        | undefined;
      if (!fn) {
        throw new Error('Contract method recordPositionEvent is not available');
      }
      const tx = await fn(pendingOp.positionId, pendingOp.kind, JSON.stringify(pendingOp.payload));

      // Success - remove from queue
      const idx = pendingOperationsQueue.indexOf(pendingOp);
      if (idx !== -1) {
        pendingOperationsQueue.splice(idx, 1);
      }

      console.log(
        JSON.stringify({
          type: 'onchain_ledger_retry_success',
          operation: pendingOp.kind,
          positionId: pendingOp.positionId,
          attemptCount: pendingOp.attemptCount,
          txHash: tx.hash,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      pendingOp.error = err instanceof Error ? err.message : String(err);

      if (pendingOp.attemptCount >= MAX_RETRIES) {
        // Max retries reached - log critical alert
        console.error(
          JSON.stringify({
            type: 'onchain_ledger_retry_exhausted',
            severity: 'critical',
            message: `Max retries (${MAX_RETRIES}) exhausted for on-chain operation`,
            operation: pendingOp.kind,
            positionId: pendingOp.positionId,
            attemptCount: pendingOp.attemptCount,
            error: pendingOp.error,
            timestamp: new Date().toISOString(),
          }),
        );

        // Record final failure in audit log
        await auditLogger.record({
          action: 'ONCHAIN_LEDGER_RETRY_EXHAUSTED',
          outcome: 'failure',
          method: 'INTERNAL',
          path: `/onchain/retry/${pendingOp.kind}`,
          requestId: pendingOp.context?.requestId ?? 'N/A',
          resourceType: 'position',
          resourceId: pendingOp.positionId,
          payload: {
            operation: pendingOp.kind,
            attemptCount: pendingOp.attemptCount,
          },
          error: {
            code: 'ONCHAIN_RETRY_EXHAUSTED',
            message: pendingOp.error,
          },
          statusCode: 500,
        });
      } else {
        // Schedule next retry
        console.warn(
          JSON.stringify({
            type: 'onchain_ledger_retry_scheduled',
            operation: pendingOp.kind,
            positionId: pendingOp.positionId,
            attemptCount: pendingOp.attemptCount,
            nextRetryIn: `${RETRY_DELAY_MS}ms`,
            error: pendingOp.error,
            timestamp: new Date().toISOString(),
          }),
        );
        setTimeout(() => this.retryPendingOperation(pendingOp), RETRY_DELAY_MS);
      }
    }
  }
}

