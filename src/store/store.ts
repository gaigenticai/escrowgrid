import { Asset, AssetTemplate, Institution, Position, PositionLifecycleEvent } from '../domain/types';
import { Region, Vertical } from '../domain/types';

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

  updatePosition(position: Position, latestEvent?: PositionLifecycleEvent): Promise<Position>;
}

