import { Injectable } from '@nestjs/common';
import {
  ID,
  ListQueryBuilder,
  ProductService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';

export interface CreateAgentProfileInput {
  name: string;
  description?: string;
  walletAddress: string;
  chainId?: number;
  capabilities?: string[];
  x402PaymentAddress?: string;
  discoveryEndpoint?: string;
  onChainTokenId?: string;
  txHash?: string;
}

export interface UpdateAgentProfileInput {
  name?: string;
  description?: string;
  capabilities?: string[];
  x402PaymentAddress?: string;
  discoveryEndpoint?: string;
  reputationScore?: number;
  totalCollaborations?: number;
  activeQuorums?: number;
}

export interface AgentSearchFilters {
  verified?: boolean;
  minReputation?: number;
  capabilities?: string[];
  chainId?: number;
}

@Injectable()
export class AgentProfileService {
  constructor(
    private productService: ProductService,
    private connection: TransactionalConnection,
    private listQueryBuilder: ListQueryBuilder,
  ) {}

  async createAgentProfile(ctx: RequestContext, input: CreateAgentProfileInput) {
    const capabilitiesJson = JSON.stringify(input.capabilities || []);
    const product = await this.productService.create(ctx, {
      translations: [{
        languageCode: ctx.languageCode,
        name: input.name,
        slug: this.slugify(input.name + '-' + input.walletAddress.slice(2, 8)),
        description: input.description || '',
        customFields: {},
      }],
      facetValueIds: [],
      assetIds: [],
      featuredAssetId: undefined,
      customFields: {
        walletAddress: input.walletAddress,
        chainId: input.chainId ?? 8453,
        capabilities: capabilitiesJson,
        x402PaymentAddress: input.x402PaymentAddress ?? null,
        reputationScore: 0,
        totalCollaborations: 0,
        activeQuorums: 0,
        discoveryEndpoint: input.discoveryEndpoint ?? null,
        verified: false,
        onChainTokenId: input.onChainTokenId ?? null,
        txHash: input.txHash ?? null,
      },
    });
    return this.toAgentProfile(product);
  }

  async updateAgentProfile(ctx: RequestContext, id: ID, input: UpdateAgentProfileInput) {
    const customFields: Record<string, any> = {};
    if (input.capabilities !== undefined)       customFields.capabilities = JSON.stringify(input.capabilities);
    if (input.x402PaymentAddress !== undefined)  customFields.x402PaymentAddress = input.x402PaymentAddress;
    if (input.discoveryEndpoint !== undefined)   customFields.discoveryEndpoint = input.discoveryEndpoint;
    if (input.reputationScore !== undefined)     customFields.reputationScore = input.reputationScore;
    if (input.totalCollaborations !== undefined) customFields.totalCollaborations = input.totalCollaborations;
    if (input.activeQuorums !== undefined)       customFields.activeQuorums = input.activeQuorums;

    const translations: any[] = [];
    if (input.name || input.description) {
      translations.push({
        languageCode: ctx.languageCode,
        name: input.name,
        description: input.description,
        customFields: {},
      });
    }

    const product = await this.productService.update(ctx, {
      id,
      translations: translations.length ? translations : undefined,
      customFields,
    });
    return this.toAgentProfile(product);
  }

  async verifyAgentProfile(ctx: RequestContext, id: ID) {
    const product = await this.productService.update(ctx, {
      id,
      customFields: { verified: true },
    });
    return this.toAgentProfile(product);
  }

  async updateAgentReputation(ctx: RequestContext, walletAddress: string, score: number) {
    const repo = this.connection.getRepository(ctx, 'Product' as any);
    const all  = await repo.find({ where: { deletedAt: null as any } });
    const match = all.find((p: any) => p.customFields?.walletAddress === walletAddress);
    if (!match) {
      console.warn('[AgentProfileService] No profile for wallet ' + walletAddress);
      return null;
    }
    return this.updateAgentProfile(ctx, match.id, {
      reputationScore: Math.min(100, Math.max(0, score)),
    });
  }

  async findOne(ctx: RequestContext, id: ID) {
    const product = await this.productService.findOne(ctx, id);
    if (!product) return null;
    return this.toAgentProfile(product);
  }

  async findAll(ctx: RequestContext, options?: any, filters?: AgentSearchFilters) {
    const result = await this.productService.findAll(ctx, options);
    let items = result.items.map((p: any) => this.toAgentProfile(p));
    if (filters) {
      if (filters.verified !== undefined)
        items = items.filter(a => a.verified === filters.verified);
      if (filters.minReputation !== undefined)
        items = items.filter(a => a.reputationScore >= filters.minReputation!);
      if (filters.chainId !== undefined)
        items = items.filter(a => a.chainId === filters.chainId);
      if (filters.capabilities && filters.capabilities.length > 0)
        items = items.filter(a =>
          filters.capabilities!.every(c => a.capabilities.includes(c))
        );
    }
    return { items, totalItems: items.length };
  }

  async searchAgents(ctx: RequestContext, term: string, filters?: AgentSearchFilters) {
    const lower = term.toLowerCase();
    const all   = await this.findAll(ctx, undefined, filters);
    return all.items.filter(a =>
      a.name.toLowerCase().includes(lower) ||
      a.capabilities.some((c: string) => c.toLowerCase().includes(lower)) ||
      a.walletAddress.toLowerCase().includes(lower),
    );
  }

  private toAgentProfile(product: any) {
    const cf = product.customFields || {};
    let capabilities: string[] = [];
    try { capabilities = cf.capabilities ? JSON.parse(cf.capabilities) : []; } catch { capabilities = []; }
    return {
      id: product.id,
      name: product.name || product.translations?.[0]?.name || '',
      description: product.description || product.translations?.[0]?.description || '',
      walletAddress: cf.walletAddress || '',
      chainId: cf.chainId ?? 8453,
      capabilities,
      x402PaymentAddress: cf.x402PaymentAddress || null,
      reputationScore: cf.reputationScore ?? 0,
      totalCollaborations: cf.totalCollaborations ?? 0,
      activeQuorums: cf.activeQuorums ?? 0,
      discoveryEndpoint: cf.discoveryEndpoint || null,
      verified: cf.verified ?? false,
      onChainTokenId: cf.onChainTokenId || null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private slugify(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  }
}