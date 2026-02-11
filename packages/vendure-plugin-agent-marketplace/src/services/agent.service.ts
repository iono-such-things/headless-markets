import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { AgentEntity } from '../entities/agent.entity';

/**
 * Agent Service
 * 
 * Business logic for agent marketplace operations:
 * - CRUD operations for agents
 * - Performance tracking
 * - License management
 * - Revenue distribution
 */
@Injectable()
export class AgentService {
  constructor(private connection: TransactionalConnection) {}

  /**
   * Find all agents with optional filters
   */
  async findAll(ctx: RequestContext, options?: FindAgentsOptions): Promise<AgentEntity[]> {
    const qb = this.connection
      .getRepository(ctx, AgentEntity)
      .createQueryBuilder('agent')
      .where('agent.isActive = :isActive', { isActive: true });

    if (options?.category) {
      qb.andWhere('agent.category = :category', { category: options.category });
    }

    if (options?.isVerified !== undefined) {
      qb.andWhere('agent.isVerified = :isVerified', { isVerified: options.isVerified });
    }

    if (options?.sortBy) {
      qb.orderBy(`agent.${options.sortBy}`, options.sortOrder || 'DESC');
    }

    return qb.getMany();
  }

  /**
   * Find agent by ID
   */
  async findOne(ctx: RequestContext, id: string): Promise<AgentEntity | null> {
    return this.connection.getRepository(ctx, AgentEntity).findOne({ where: { id } });
  }

  /**
   * Create new agent
   */
  async create(ctx: RequestContext, input: CreateAgentInput): Promise<AgentEntity> {
    const agent = new AgentEntity({
      name: input.name,
      description: input.description,
      category: input.category,
      ownerAddress: input.ownerAddress,
      licenseTerms: input.licenseTerms,
      strategyConfig: input.strategyConfig,
      isActive: true,
      isVerified: false,
    });

    return this.connection.getRepository(ctx, AgentEntity).save(agent);
  }

  /**
   * Update agent
   */
  async update(
    ctx: RequestContext,
    id: string,
    input: UpdateAgentInput
  ): Promise<AgentEntity> {
    const agent = await this.findOne(ctx, id);
    if (!agent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    Object.assign(agent, input);
    return this.connection.getRepository(ctx, AgentEntity).save(agent);
  }

  /**
   * Update agent performance metrics
   */
  async updatePerformance(
    ctx: RequestContext,
    id: string,
    metrics: PerformanceMetrics
  ): Promise<AgentEntity> {
    const agent = await this.findOne(ctx, id);
    if (!agent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    agent.totalTrades = metrics.totalTrades;
    agent.successRate = metrics.successRate;
    agent.totalProfit = metrics.totalProfit;
    agent.totalVolume = metrics.totalVolume;

    return this.connection.getRepository(ctx, AgentEntity).save(agent);
  }

  /**
   * Verify agent (admin only)
   */
  async verify(ctx: RequestContext, id: string): Promise<AgentEntity> {
    return this.update(ctx, id, { isVerified: true });
  }

  /**
   * Deactivate agent
   */
  async deactivate(ctx: RequestContext, id: string): Promise<AgentEntity> {
    return this.update(ctx, id, { isActive: false });
  }
}

// Type definitions
export interface FindAgentsOptions {
  category?: string;
  isVerified?: boolean;
  sortBy?: 'successRate' | 'totalProfit' | 'totalVolume' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateAgentInput {
  name: string;
  description: string;
  category: string;
  ownerAddress: string;
  licenseTerms?: any;
  strategyConfig?: any;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  category?: string;
  licenseTerms?: any;
  strategyConfig?: any;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface PerformanceMetrics {
  totalTrades: number;
  successRate: number;
  totalProfit: number;
  totalVolume: number;
}
