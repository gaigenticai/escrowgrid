import { ethers } from 'ethers';
import type { LedgerClient, LedgerContext } from '../domain/ledger';
import type { Position, PositionLifecycleEvent } from '../domain/types';
import { config } from '../config';
import { store } from '../store';
import { auditLogger } from './auditLogger';
import type { Pool } from 'pg';
import { createAppPool } from './db';

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
const RETRY_WORKER_ENABLED =
  process.env.ONCHAIN_RETRY_WORKER_ENABLED === undefined ||
  process.env.ONCHAIN_RETRY_WORKER_ENABLED === 'true';
const RETRY_BATCH_SIZE = parseInt(process.env.ONCHAIN_RETRY_BATCH_SIZE ?? '10', 10);

/**
 * Pending on-chain operations that need to be retried.
 * For non-Postgres setups this remains in-memory only.
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

// In-memory queue for pending operations (used when no Postgres queue is available)
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

export class OnchainLedger
  implements Pick<LedgerClient, 'recordPositionCreated' | 'recordPositionStateChanged'>
{
  private provider!: ethers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  private contract!: ethers.Contract;
  private queuePool?: Pool;
  private retryWorkerStarted = false;

  constructor() {
    if (!config.onchainRpcUrl || !config.onchainPrivateKey || !config.onchainContractAddress) {
      throw new Error('On-chain ledger requires ONCHAIN_RPC_URL, ONCHAIN_PRIVATE_KEY, and ONCHAIN_CONTRACT_ADDRESS');
    }
    this.provider = new ethers.JsonRpcProvider(config.onchainRpcUrl, config.onchainChainId);
    this.wallet = new ethers.Wallet(config.onchainPrivateKey, this.provider);
    this.contract = new ethers.Contract(config.onchainContractAddress, ledgerAbi, this.wallet);
    if (config.postgresUrl) {
      this.queuePool = createAppPool(config.postgresUrl);
    }
    if (FAILURE_MODE === 'queue' && RETRY_WORKER_ENABLED && this.queuePool) {
      this.startRetryWorker();
    }
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
      const txHash = await this.sendToContract('POSITION_CREATED', position.id, payload);
      console.log(
        JSON.stringify({
          type: 'onchain_ledger',
          kind: 'POSITION_CREATED',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          txHash,
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
      const txHash = await this.sendToContract('POSITION_STATE_CHANGED', position.id, payload);
      console.log(
        JSON.stringify({
          type: 'onchain_ledger',
          kind: 'POSITION_STATE_CHANGED',
          positionId: position.id,
          requestId: context?.requestId ?? null,
          txHash,
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

  private async sendToContract(
    kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED',
    positionId: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const contract = this.contract;
    const fn = (contract as any)['recordPositionEvent'] as
      | ((positionId: string, kind: string, payloadJson: string) => Promise<any>)
      | undefined;
    if (!fn) {
      throw new Error('Contract method recordPositionEvent is not available');
    }
    const tx = await fn(positionId, kind, JSON.stringify(payload));
    return tx.hash as string;
  }

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
      throw new OnchainLedgerError(operation, positionId, error);
    }

    if (this.queuePool) {
      await this.enqueuePendingOperationDb(kind, positionId, payload, errorMessage);

      console.warn(
        JSON.stringify({
          type: 'onchain_ledger_alert',
          severity: 'warning',
          message: `On-chain ${operation} queued for retry`,
          positionId,
          queueBackend: 'postgres',
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
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

      console.warn(
        JSON.stringify({
          type: 'onchain_ledger_alert',
          severity: 'warning',
          message: `On-chain ${operation} queued for retry`,
          positionId,
          queuedOperationId: pendingOp.id,
          pendingQueueSize: pendingOperationsQueue.length,
          queueBackend: 'memory',
          timestamp: new Date().toISOString(),
        }),
      );

      if (pendingOp.attemptCount < MAX_RETRIES) {
        setTimeout(() => this.retryPendingOperation(pendingOp), RETRY_DELAY_MS);
      }
    }
  }

  private async retryPendingOperation(pendingOp: PendingOperation): Promise<void> {
    pendingOp.attemptCount++;
    pendingOp.lastAttemptAt = new Date().toISOString();

    try {
      const txHash = await this.sendToContract(
        pendingOp.kind,
        pendingOp.positionId,
        pendingOp.payload,
      );

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
          txHash,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      pendingOp.error = err instanceof Error ? err.message : String(err);

      if (pendingOp.attemptCount >= MAX_RETRIES) {
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

  private async enqueuePendingOperationDb(
    kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED',
    positionId: string,
    payload: Record<string, unknown>,
    errorMessage: string,
  ): Promise<void> {
    if (!this.queuePool) {
      return;
    }
    const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toISOString();
    await this.queuePool.query(
      `INSERT INTO onchain_pending_operations
       (id, position_id, kind, payload, attempt_count, last_attempt_at, last_error, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, positionId, kind, payload, 1, timestamp, errorMessage, timestamp, timestamp],
    );
  }

  private startRetryWorker(): void {
    if (!this.queuePool || this.retryWorkerStarted) {
      return;
    }
    this.retryWorkerStarted = true;
    const intervalMs = RETRY_DELAY_MS;
    const run = async () => {
      try {
        await this.processPendingBatchDb();
      } catch (err) {
        console.error(
          JSON.stringify({
            type: 'onchain_ledger_retry_worker_error',
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    };
    const timer = setInterval(run, intervalMs);
    if (typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
  }

  private async processPendingBatchDb(): Promise<void> {
    if (!this.queuePool) {
      return;
    }
    const result = await this.queuePool.query(
      `SELECT id, position_id, kind, payload, attempt_count
       FROM onchain_pending_operations
       WHERE attempt_count < $1
       ORDER BY updated_at ASC
       LIMIT $2`,
      [MAX_RETRIES, RETRY_BATCH_SIZE],
    );
    if (result.rowCount === 0) {
      return;
    }
    for (const row of result.rows) {
      const op = {
        id: row.id as string,
        positionId: row.position_id as string,
        kind: row.kind as 'POSITION_CREATED' | 'POSITION_STATE_CHANGED',
        payload: row.payload as Record<string, unknown>,
        attemptCount: Number(row.attempt_count) as number,
      };
      // eslint-disable-next-line no-await-in-loop
      await this.retryPendingOperationDb(op);
    }
  }

  private async retryPendingOperationDb(op: {
    id: string;
    kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED';
    positionId: string;
    payload: Record<string, unknown>;
    attemptCount: number;
  }): Promise<void> {
    if (!this.queuePool) {
      return;
    }
    const nextAttempt = op.attemptCount + 1;
    const timestamp = new Date().toISOString();

    try {
      const txHash = await this.sendToContract(op.kind, op.positionId, op.payload);

      await this.queuePool.query('DELETE FROM onchain_pending_operations WHERE id = $1', [
        op.id,
      ]);

      console.log(
        JSON.stringify({
          type: 'onchain_ledger_retry_success',
          operation: op.kind,
          positionId: op.positionId,
          attemptCount: nextAttempt,
          txHash,
          timestamp,
        }),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.queuePool.query(
        `UPDATE onchain_pending_operations
         SET attempt_count = $1, last_attempt_at = $2, last_error = $3, updated_at = $2
         WHERE id = $4`,
        [nextAttempt, timestamp, errorMessage, op.id],
      );

      if (nextAttempt >= MAX_RETRIES) {
        console.error(
          JSON.stringify({
            type: 'onchain_ledger_retry_exhausted',
            severity: 'critical',
            message: `Max retries (${MAX_RETRIES}) exhausted for on-chain operation`,
            operation: op.kind,
            positionId: op.positionId,
            attemptCount: nextAttempt,
            error: errorMessage,
            timestamp,
          }),
        );

        await auditLogger.record({
          action: 'ONCHAIN_LEDGER_RETRY_EXHAUSTED',
          outcome: 'failure',
          method: 'INTERNAL',
          path: `/onchain/retry/${op.kind}`,
          requestId: (op.payload as any)?.requestId ?? 'N/A',
          resourceType: 'position',
          resourceId: op.positionId,
          payload: {
            operation: op.kind,
            attemptCount: nextAttempt,
          },
          error: {
            code: 'ONCHAIN_RETRY_EXHAUSTED',
            message: errorMessage,
          },
          statusCode: 500,
        });
      } else {
        console.warn(
          JSON.stringify({
            type: 'onchain_ledger_retry_scheduled',
            operation: op.kind,
            positionId: op.positionId,
            attemptCount: nextAttempt,
            nextRetryIn: `${RETRY_DELAY_MS}ms`,
            error: errorMessage,
            timestamp,
          }),
        );
      }
    }
  }
}
