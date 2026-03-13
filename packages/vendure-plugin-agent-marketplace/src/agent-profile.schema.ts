import gql from 'graphql-tag';

export const agentProfileShopSchema = gql`
  type AgentProfile {
    id: ID!
    name: String!
    description: String
    walletAddress: String!
    chainId: Int!
    capabilities: [String!]!
    x402PaymentAddress: String
    reputationScore: Int!
    totalCollaborations: Int!
    activeQuorums: Int!
    discoveryEndpoint: String
    verified: Boolean!
    onChainTokenId: String
    createdAt: String!
    updatedAt: String!
  }

  type AgentProfileList {
    items: [AgentProfile!]!
    totalItems: Int!
  }

  input CreateAgentProfileInput {
    name: String!
    description: String
    walletAddress: String!
    chainId: Int
    capabilities: [String!]
    x402PaymentAddress: String
    discoveryEndpoint: String
    onChainTokenId: String
    txHash: String
  }

  input UpdateAgentProfileInput {
    name: String
    description: String
    capabilities: [String!]
    x402PaymentAddress: String
    discoveryEndpoint: String
    reputationScore: Int
    totalCollaborations: Int
    activeQuorums: Int
  }

  input AgentSearchFilters {
    verified: Boolean
    minReputation: Int
    capabilities: [String!]
    chainId: Int
  }

  extend type Query {
    agentProfile(id: ID!): AgentProfile
    agentProfiles(options: JSON, filters: AgentSearchFilters): AgentProfileList!
    searchAgents(term: String!, filters: AgentSearchFilters): [AgentProfile!]!
  }

  extend type Mutation {
    createAgentProfile(input: CreateAgentProfileInput!): AgentProfile!
    updateAgentProfile(id: ID!, input: UpdateAgentProfileInput!): AgentProfile!
  }
`;

export const agentProfileAdminSchema = gql`
  extend type Query {
    agentProfile(id: ID!): AgentProfile
    agentProfiles(options: JSON, filters: AgentSearchFilters): AgentProfileList!
  }

  extend type Mutation {
    createAgentProfile(input: CreateAgentProfileInput!): AgentProfile!
    updateAgentProfile(id: ID!, input: UpdateAgentProfileInput!): AgentProfile!
    verifyAgentProfile(id: ID!): AgentProfile!
    updateAgentReputation(walletAddress: String!, reputationScore: Int!): AgentProfile
  }
`;