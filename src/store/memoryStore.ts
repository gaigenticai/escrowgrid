import { Asset, AssetTemplate, Institution, Position, PositionLifecycleEvent, Region, Vertical } from '../domain/types';
import type { Store } from './store';
import { validateTemplateConfig } from '../domain/verticals';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

class MemoryStore implements Store {
  private institutions = new Map<string, Institution>();
  private assetTemplates = new Map<string, AssetTemplate>();
  private assets = new Map<string, Asset>();
  private positions = new Map<string, Position>();

  async createInstitution(input: {
    name: string;
    regions: Region[];
    verticals?: Vertical[] | undefined;
  }): Promise<Institution> {
    const id = generateId('inst');
    const timestamp = now();
    const institution: Institution = {
      id,
      name: input.name,
      regions: input.regions,
      verticals: input.verticals ?? ['CONSTRUCTION', 'TRADE_FINANCE'],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.institutions.set(id, institution);
    return institution;
  }

  async listInstitutions(): Promise<Institution[]> {
    return Array.from(this.institutions.values());
  }

  async getInstitution(id: string): Promise<Institution | undefined> {
    return this.institutions.get(id);
  }

  async createAssetTemplate(input: {
    institutionId: string;
    code: string;
    name: string;
    vertical: Vertical;
    region: Region;
    config: Record<string, unknown>;
  }): Promise<AssetTemplate> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }

    validateTemplateConfig({
      vertical: input.vertical,
      code: input.code,
      region: input.region,
      config: input.config,
    });

    const id = generateId('tmpl');
    const timestamp = now();
    const template: AssetTemplate = {
      id,
      institutionId: input.institutionId,
      code: input.code,
      name: input.name,
      vertical: input.vertical,
      region: input.region,
      config: input.config,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.assetTemplates.set(id, template);
    return template;
  }

  async listAssetTemplates(params?: { institutionId?: string }): Promise<AssetTemplate[]> {
    const all = Array.from(this.assetTemplates.values());
    if (!params || params.institutionId === undefined) {
      return all;
    }
    return all.filter((t) => t.institutionId === params.institutionId);
  }

  async getAssetTemplate(id: string): Promise<AssetTemplate | undefined> {
    return this.assetTemplates.get(id);
  }

  async createAsset(input: {
    institutionId: string;
    templateId: string;
    label: string;
    metadata?: Record<string, unknown>;
  }): Promise<Asset> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }
    const template = await this.getAssetTemplate(input.templateId);
    if (!template || template.institutionId !== input.institutionId) {
      throw new Error('Asset template not found for institution');
    }

    const id = generateId('ast');
    const timestamp = now();
    const asset: Asset = {
      id,
      institutionId: input.institutionId,
      templateId: input.templateId,
      label: input.label,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.assets.set(id, asset);
    return asset;
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async listAssets(params?: { institutionId?: string; templateId?: string }): Promise<Asset[]> {
    let all = Array.from(this.assets.values());
    if (!params) {
      return all;
    }
    if ('institutionId' in params) {
      const { institutionId } = params;
      if (institutionId !== undefined) {
        all = all.filter((a) => a.institutionId === institutionId);
      }
    }
    if ('templateId' in params) {
      const { templateId } = params;
      if (templateId !== undefined) {
        all = all.filter((a) => a.templateId === templateId);
      }
    }
    return all;
  }

  async createPosition(input: {
    institutionId: string;
    assetId: string;
    holderReference: string;
    currency: string;
    amount: number;
    externalReference?: string | undefined;
  }): Promise<Position> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }
    const asset = await this.getAsset(input.assetId);
    if (!asset || asset.institutionId !== input.institutionId) {
      throw new Error('Asset not found for institution');
    }

    const id = generateId('pos');
    const timestamp = now();
    const position: Position = {
      id,
      institutionId: input.institutionId,
      assetId: input.assetId,
      holderReference: input.holderReference,
      currency: input.currency,
      amount: input.amount,
      state: 'CREATED',
      externalReference: input.externalReference,
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
    };
    this.positions.set(id, position);
    return position;
  }

  async getPosition(id: string): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async listPositions(params?: {
    institutionId?: string;
    assetId?: string;
    holderReference?: string;
  }): Promise<Position[]> {
    let all = Array.from(this.positions.values());
    if (params && params.institutionId !== undefined) {
      all = all.filter((p) => p.institutionId === params.institutionId);
    }
    if (params && params.assetId !== undefined) {
      all = all.filter((p) => p.assetId === params.assetId);
    }
    if (params && params.holderReference !== undefined) {
      all = all.filter((p) => p.holderReference === params.holderReference);
    }
    return all;
  }

  async updatePosition(position: Position, _latestEvent?: PositionLifecycleEvent): Promise<Position> {
    if (!this.positions.has(position.id)) {
      throw new Error('Position not found');
    }
    this.positions.set(position.id, position);
    return position;
  }
}

export const memoryStore = new MemoryStore();

