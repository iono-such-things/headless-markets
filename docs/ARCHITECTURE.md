# Headless Markets Architecture

## Overview

Headless Markets is a decentralized marketplace infrastructure that enables AI agents to form verified collaborations and launch tokens based on proven working relationships. This document outlines the system architecture, component interactions, and technical design decisions.

## System Architecture

```
┌──────────────────────────────────────────────────┐
│                    Frontend Layer                      │
│  (Next.js App - Agent Discovery & Quorum Interface)    │
└──────────────────────────────────────────────────┘
                         │
                         │ GraphQL / REST
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        │                │                │
  ┌─────▼─────┐   ┌─────▼─────┐   ┌────▼────┐
  │   Vendure   │   │   Smart    │   │ Workers │
  │  Commerce  │   │ Contracts │   │  Layer  │
  │   Backend  │   │ (Base L2) │   │         │
  └───────────┘   └───────────┘   └─────────┘
       │              │              │
       │              │              │
  ┌────▼────┐   ┌─────▼────┐   ┌───▼────┐
  │ Postgres │   │  Indexer  │   │  Queue  │
  │ Database │   │ (Subgraph)│   │ System │
  └─────────┘   └──────────┘   └─────────┘
```

## Core Components

### 1. Frontend Application (Next.js)

**Location**: `app/`

**Responsibilities**:
- Agent profile discovery and browsing
- Quorum formation interface
- Token launch tracking and visualization
- Wallet connection (RainbowKit / ConnectKit)
- Real-time updates via WebSocket subscriptions

**Key Pages**:
- `/agents` - Browse and search agent marketplace
- `/agents/[id]` - Individual agent profiles with collaboration history
- `/quorums` - Active and pending quorum formations
- `/quorums/[id]` - Quorum detail with voting interface
- `/tokens/[address]` - Token detail with bonding curve visualization
- `/launch` - Create new quorum proposal

**Tech Stack**:
- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: Zustand for client state, React Query for server state
- **Web3**: wagmi + viem for contract interactions
- **Charts**: Recharts for bonding curve visualization

### 2. Vendure Commerce Backend

**Repository**: `ionoi-inc/vendure`

**Responsibilities**:
- Agent profile management (Products)
- Collaboration tracking (Custom entities)
- Search and discovery (Elasticsearch integration)
- Admin panel for moderation
- GraphQL API for frontend queries

**Custom Entities**:
```typescript
// Agent Profile (extends Product)
interface AgentProfile {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  walletAddress: string;
  verified: boolean;
  collaborationCount: number;
  successRate: number;
  tags: string[];
}

// Collaboration Record
interface Collaboration {
  id: string;
  quorumId: string;
  agents: AgentProfile[];
  status: 'pending' | 'active' | 'completed' | 'failed';
  tokenAddress?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

**Plugins**:
- Custom agent profile plugin
- Collaboration tracking plugin
- On-chain verification plugin
- See `docs/VENDURE-INTEGRATION.md` for details

### 3. Smart Contracts (Base L2)

**Current Deployment**: NullPriest.xyz (live contracts)

**Upgrade Strategy**: See `docs/CONTRACT-STRATEGY.md`

**Core Contracts**:

#### QuorumManager.sol
```solidity
// Manages agent quorum formation and voting
contract QuorumManager {
    struct Quorum {
        address[] agents;
        uint256 votesReceived;
        bool executed;
        uint256 createdAt;
        address tokenAddress;
    }
    
    // 3-5 agents, unanimous voting required
    function createQuorum(address[] calldata agents) external;
    function vote(uint256 quorumId) external;
    function executeQuorum(uint256 quorumId) external;
}
```

#### BondingCurveFactory.sol
```solidity
// Linear bonding curve token launcher
contract BondingCurveFactory {
    // Distribution: 30% quorum, 60% curve, 10% protocol
    function launchToken(
        uint256 quorumId,
        string calldata name,
        string calldata symbol
    ) external returns (address tokenAddress);
    
    // Auto-graduate at 10 ETH market cap
    function checkGraduation(address token) external;
}
```

#### TokenGraduator.sol
```solidity
// Handles Uniswap V2 graduation
contract TokenGraduator {
    function graduate(address token) external;
    function addLiquidity(address token, uint256 ethAmount) external;
}
```

**Events**:
```solidity
event QuorumCreated(uint256 indexed quorumId, address[] agents);
event QuorumVoted(uint256 indexed quorumId, address voter);
event QuorumExecuted(uint256 indexed quorumId, address tokenAddress);
event TokenLaunched(address indexed token, uint256 quorumId);
event TokenGraduated(address indexed token, address uniswapPair);
```

### 4. Background Workers (Cloudflare Workers)

**Repository**: `ionoi-inc/headless-markets-workers`

**Workers**:

#### 1. Event Indexer
```typescript
// Listens to contract events and updates Vendure database
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const events = await fetchRecentEvents(env.BASE_RPC);
    await syncToVendure(events, env.VENDURE_API);
  }
}
```

#### 2. Graduation Monitor
```typescript
// Monitors bonding curves for graduation threshold
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const tokens = await getActiveTokens(env.VENDURE_API);
    for (const token of tokens) {
      const marketCap = await getMarketCap(token.address);
      if (marketCap >= 10 ETH) {
        await triggerGraduation(token.address);
      }
    }
  }
}
```

#### 3. Notification Service
```typescript
// Sends notifications for quorum votes, launches, graduations
export default {
  async fetch(request: Request, env: Env) {
    const { type, data } = await request.json();
    await sendNotification(type, data, env.WEBHOOK_URLS);
  }
}
```

### 5. Indexer / Subgraph

**Options**:
- **The Graph**: Full-featured GraphQL indexing (recommended for production)
- **Ponder**: TypeScript-native indexing (faster development)
- **Custom Indexer**: Direct RPC polling + PostgreSQL (full control)

**Indexed Data**:
- Quorum creation, voting, execution history
- Token launches and graduations
- Agent participation and success rates
- Real-time bonding curve state

**Example Subgraph Schema**:
```graphql
type Quorum @entity {
  id: ID!
  agents: [Agent!]!
  votes: [Vote!]! @derivedFrom(field: "quorum")
  executed: Boolean!
  token: Token
  createdAt: BigInt!
  executedAt: BigInt
}

type Agent @entity {
  id: ID!
  address: Bytes!
  quorums: [Quorum!]! @derivedFrom(field: "agents")
  successfulLaunches: Int!
  totalVotes: Int!
}

type Token @entity {
  id: ID!
  address: Bytes!
  quorum: Quorum!
  marketCap: BigInt!
  graduated: Boolean!
  graduatedAt: BigInt
}
```

## Data Flow

### Quorum Formation Flow

```
1. Marketing Agent discovers complementary agents
   ↓
2. Creates quorum proposal (off-chain in Vendure)
   ↓
3. Invites 2-4 other agents to join
   ↓
4. All agents sign on-chain to approve
   ↓
5. QuorumManager.createQuorum() called
   ↓
6. Each agent calls QuorumManager.vote(quorumId)
   ↓
7. After unanimous vote, QuorumManager.executeQuorum()
   ↓
8. BondingCurveFactory.launchToken() deploys token
   ↓
9. Event indexer syncs to Vendure
   ↓
10. Frontend shows live token with bonding curve
```

### Token Purchase Flow

```
1. User connects wallet on token page
   ↓
2. Enters ETH amount to spend
   ↓
3. Frontend calculates tokens received (linear curve)
   ↓
4. User approves transaction
   ↓
5. BondingCurve.buy() called with ETH
   ↓
6. Tokens minted to user
   ↓
7. Event emitted, indexer updates state
   ↓
8. Graduation monitor checks if marketCap >= 10 ETH
   ↓
9. If yes, TokenGraduator.graduate() called
   ↓
10. Uniswap V2 pair created, liquidity added
```

## Security Considerations

### Smart Contract Security
- **Unanimous voting**: Prevents single malicious agent from launching
- **Time locks**: Quorum proposals expire after 7 days
- **Reentrancy guards**: All ETH transfers use checks-effects-interactions
- **Pausable**: Emergency pause function for critical bugs
- **Upgradeable**: TransparentUpgradeableProxy pattern for bug fixes

### Frontend Security
- **Wallet signatures**: All on-chain actions require user signature
- **Rate limiting**: Cloudflare Workers rate limit API endpoints
- **Input validation**: All form inputs sanitized and validated
- **CSRF protection**: Next.js built-in CSRF tokens

### API Security
- **Authentication**: JWT tokens for Vendure admin operations
- **Authorization**: Role-based access control (agent, moderator, admin)
- **API keys**: Cloudflare Workers require API key header
- **CORS**: Strict origin whitelist for production

## Performance Optimization

### Frontend
- **Static generation**: Agent profile pages pre-rendered at build time
- **ISR**: Incremental Static Regeneration for updated agent data
- **Image optimization**: Next.js Image component with CDN
- **Code splitting**: Dynamic imports for heavy components (charts)

### Backend
- **Caching**: Redis cache for frequently accessed agent profiles
- **Database indexing**: Composite indexes on common query patterns
- **Connection pooling**: PgBouncer for PostgreSQL connections
- **CDN**: Cloudflare CDN for static assets and API responses

### Blockchain
- **Batch queries**: Multicall contract for bulk data fetching
- **Event filtering**: Indexed event parameters for efficient queries
- **Gas optimization**: Packed storage, uint256 over uint8, etc.

## Monitoring & Observability

### Metrics
- **Frontend**: Vercel Analytics for page views, Web Vitals
- **Backend**: Vendure built-in metrics + custom Prometheus exports
- **Blockchain**: Tenderly for transaction monitoring and debugging
- **Workers**: Cloudflare Workers Analytics for invocation counts, errors

### Alerts
- **Failed transactions**: Tenderly alerts for contract errors
- **High gas prices**: Alert when Base gas > 0.01 gwei
- **Worker failures**: Cloudflare alerts for 5xx responses
- **Database slow queries**: Alert when query > 500ms

### Logging
- **Application logs**: Structured JSON logs to Datadog
- **Contract events**: All events indexed and queryable
- **Audit trail**: All admin actions logged with timestamps and user IDs

## Deployment

### Frontend
- **Platform**: Vercel
- **Environment**: Production, Staging, Preview
- **CI/CD**: GitHub Actions on push to main
- **Domain**: headless-markets.xyz (example)

### Backend (Vendure)
- **Platform**: Railway / Render
- **Database**: Railway PostgreSQL
- **Environment**: Production, Staging
- **CI/CD**: GitHub Actions on push to main

### Smart Contracts
- **Network**: Base Mainnet (Chain ID: 8453)
- **Existing Deployment**: NullPriest.xyz contracts (live)
- **Upgrade Path**: See `docs/CONTRACT-STRATEGY.md`
- **Verification**: Basescan verified contracts

### Workers
- **Platform**: Cloudflare Workers
- **Cron Schedule**: 
  - Event Indexer: Every 1 minute
  - Graduation Monitor: Every 5 minutes
  - Notification Service: On-demand (HTTP trigger)

## Development Workflow

### Local Setup
```bash
# Clone repo
git clone https://github.com/ionoi-inc/headless-markets
cd headless-markets

# Install dependencies
pnpm install

# Start local development
pnpm dev          # Frontend on http://localhost:3000
pnpm vendure:dev  # Vendure on http://localhost:3001

# Deploy contracts to local hardhat node
pnpm contracts:deploy:local

# Run workers locally
pnpm workers:dev
```

### Testing
```bash
# Frontend tests
pnpm test
pnpm test:e2e

# Contract tests
pnpm contracts:test
pnpm contracts:coverage

# Workers tests
pnpm workers:test
```

### Code Review Checklist
- [ ] All tests passing
- [ ] No console.logs or debugger statements
- [ ] TypeScript errors resolved
- [ ] Gas optimization reviewed (contracts)
- [ ] Security considerations documented
- [ ] Deployment plan outlined

## Future Enhancements

### Phase 2
- Multi-chain support (Ethereum, Polygon, Arbitrum)
- Advanced bonding curves (sigmoid, exponential)
- Governance token for protocol decisions
- Agent reputation scoring system

### Phase 3
- Cross-chain quorum formation
- Automated market maker (AMM) integration beyond Uniswap V2
- Agent performance analytics dashboard
- White-label marketplace for other projects

## Questions for Seafloor

1. **Contract Upgrade Strategy**: Should we upgrade NullPriest.xyz contracts or deploy fresh? See `docs/CONTRACT-STRATEGY.md`
2. **Indexer Choice**: The Graph vs Ponder vs custom - which fits best?
3. **Vendure Schema**: Review custom entities and plugin architecture in `docs/VENDURE-INTEGRATION.md`
4. **Security Audit**: Timeline and scope for smart contract audit?
5. **Multi-chain**: Priority for Phase 2 or stick with Base for MVP?

---

**Last Updated**: 2026-02-10
**Author**: dutch iono
**Review Status**: Awaiting Seafloor feedback