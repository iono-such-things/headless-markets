import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import {
  AgentProfileService,
  AgentSearchFilters,
  CreateAgentProfileInput,
  UpdateAgentProfileInput,
} from '../services/agent-profile.service';

@Resolver()
export class AgentProfileShopResolver {
  constructor(private agentProfileService: AgentProfileService) {}

  @Query()
  async agentProfile(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
    return this.agentProfileService.findOne(ctx, args.id);
  }

  @Query()
  async agentProfiles(@Ctx() ctx: RequestContext, @Args() args: { options?: any; filters?: AgentSearchFilters }) {
    return this.agentProfileService.findAll(ctx, args.options, args.filters);
  }

  @Query()
  async searchAgents(@Ctx() ctx: RequestContext, @Args() args: { term: string; filters?: AgentSearchFilters }) {
    return this.agentProfileService.searchAgents(ctx, args.term, args.filters);
  }

  @Mutation()
  async createAgentProfile(@Ctx() ctx: RequestContext, @Args() args: { input: CreateAgentProfileInput }) {
    return this.agentProfileService.createAgentProfile(ctx, args.input);
  }

  @Mutation()
  async updateAgentProfile(@Ctx() ctx: RequestContext, @Args() args: { id: string; input: UpdateAgentProfileInput }) {
    return this.agentProfileService.updateAgentProfile(ctx, args.id, args.input);
  }
}

@Resolver()
export class AgentProfileAdminResolver {
  constructor(private agentProfileService: AgentProfileService) {}

  @Query()
  @Allow(Permission.ReadCatalog)
  async agentProfile(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
    return this.agentProfileService.findOne(ctx, args.id);
  }

  @Query()
  @Allow(Permission.ReadCatalog)
  async agentProfiles(@Ctx() ctx: RequestContext, @Args() args: { options?: any; filters?: AgentSearchFilters }) {
    return this.agentProfileService.findAll(ctx, args.options, args.filters);
  }

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async createAgentProfile(@Ctx() ctx: RequestContext, @Args() args: { input: CreateAgentProfileInput }) {
    return this.agentProfileService.createAgentProfile(ctx, args.input);
  }

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async updateAgentProfile(@Ctx() ctx: RequestContext, @Args() args: { id: string; input: UpdateAgentProfileInput }) {
    return this.agentProfileService.updateAgentProfile(ctx, args.id, args.input);
  }

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async verifyAgentProfile(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
    return this.agentProfileService.verifyAgentProfile(ctx, args.id);
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async updateAgentReputation(@Ctx() ctx: RequestContext, @Args() args: { walletAddress: string; reputationScore: number }) {
    return this.agentProfileService.updateAgentReputation(ctx, args.walletAddress, args.reputationScore);
  }
}