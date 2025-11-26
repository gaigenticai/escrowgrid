import { Asset, AssetTemplate, Institution, Position, PositionLifecycleEvent, PositionState } from '../domain/types';
import { Region, Vertical } from '../domain/types';

/**
 * Error thrown when a position update fails due to optimistic concurrency conflict.
 * This occurs when the position's current state doesn't match the expected state,
 * indicating another process modified the position concurrently.
 */
export class ConcurrencyConflictError extends Error {
  constructor(
    public readonly positionId: string,
    public readonly expectedState: PositionState,
    public readonly actualState: PositionState,
  ) {
    super(
      `Concurrency conflict: position ${positionId} expected state ${expectedState} but found ${actualState}`,
    );
    this.name = 'ConcurrencyConflictError';
  }
}

export interface Store {
  createInstitution(input: {
    name: string;
    regions: Region[];
    verticals?: Vertical[] | undefined;
  }): Promise<Institution>;

  listInstitutions(): Promise<Institution[]>;

  getInstitution(id: string): Promise<Institution | undefined>;

  createAssetTemplate(input: {
    institutionId: string;
    code: string;
    name: string;
    vertical: Vertical;
    region: Region;
    config: Record<string, unknown>;
  }): Promise<AssetTemplate>;

  listAssetTemplates(params?: { institutionId?: string }): Promise<AssetTemplate[]>;

  getAssetTemplate(id: string): Promise<AssetTemplate | undefined>;

  createAsset(input: {
    institutionId: string;
    templateId: string;
    label: string;
    metadata?: Record<string, unknown>;
  }): Promise<Asset>;

  getAsset(id: string): Promise<Asset | undefined>;

  listAssets(params?: { institutionId?: string; templateId?: string }): Promise<Asset[]>;

  createPosition(input: {
    institutionId: string;
    assetId: string;
    holderReference: string;
    currency: string;
    amount: number;
    externalReference?: string | undefined;
  }): Promise<Position>;

  getPosition(id: string): Promise<Position | undefined>;

  listPositions(params?: {
    institutionId?: string;
    assetId?: string;
    holderReference?: string;
  }): Promise<Position[]>;

  /**
   * Update a position with optimistic concurrency control.
   * @param position - The new position state to save
   * @param latestEvent - Optional lifecycle event to record
   * @param expectedState - If provided, the update will fail with ConcurrencyConflictError
   *                        if the current DB state doesn't match
   * @throws ConcurrencyConflictError if expectedState is provided and doesn't match current state
   */
  updatePosition(
    position: Position,
    latestEvent?: PositionLifecycleEvent,
    expectedState?: PositionState,
  ): Promise<Position>;
}

