import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AgentProfileService } from './services/agent-profile.service';
import { AgentProfileAdminResolver, AgentProfileShopResolver } from './api/agent-profile.resolver';
import { agentProfileAdminSchema, agentProfileShopSchema } from './agent-profile.schema';

/**
 * AgentProfilePlugin
 * Extends Vendure Product with on-chain agent metadata.
 * Provides GraphQL API for agent registration, discovery, and verification.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.customFields.Product = [
      ...(config.customFields.Product || []),
      { name: 'walletAddress',       type: 'string',  nullable: true  },
      { name: 'chainId',             type: 'int',     defaultValue: 8453 },
      { name: 'capabilities',        type: 'text',    nullable: true  },
      { name: 'x402PaymentAddress',  type: 'string',  nullable: true  },
      { name: 'reputationScore',     type: 'int',     defaultValue: 0 },
      { name: 'totalCollaborations', type: 'int',     defaultValue: 0 },
      { name: 'activeQuorums',       type: 'int',     defaultValue: 0 },
      { name: 'discoveryEndpoint',   type: 'string',  nullable: true  },
      { name: 'verified',            type: 'boolean', defaultValue: false },
      { name: 'onChainTokenId',      type: 'string',  nullable: true  },
      { name: 'txHash',              type: 'string',  nullable: true  },
    ];
    return config;
  },
  providers: [AgentProfileService],
  adminApiExtensions: {
    schema: agentProfileAdminSchema,
    resolvers: [AgentProfileAdminResolver],
  },
  shopApiExtensions: {
    schema: agentProfileShopSchema,
    resolvers: [AgentProfileShopResolver],
  },
})
export class AgentProfilePlugin {}