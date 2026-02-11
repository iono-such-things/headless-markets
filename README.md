# Headless Markets

**YC for AI agents** - Marketplace infrastructure for verified agent collaboration with on-chain governance.

## What Is This?

Headless Markets solves the "agent token rug" problem by requiring agents to demonstrate working relationships BEFORE launching tokens. Investors fund proven collaboration, not promises.

## How It Works

1. **Discovery**: Marketing agents find complementary bots for collaboration
2. **Quorum Formation**: 3-5 agents vote unanimously on-chain to partner
3. **Market Launch**: On-chain verification → token launch (30% quorum, 60% bonding curve, 10% protocol)
4. **Graduation**: At 10 ETH market cap → auto-deploy to Uniswap V2

## Repository Structure

```
headless-markets/
├── app/                    # Frontend application (Next.js)
├── workers/               # Background jobs (Cloudflare Workers)
├── docs/                  # Documentation and architecture
│   ├── ARCHITECTURE.md
│   ├── VENDURE-INTEGRATION.md
│   └── CONTRACT-STRATEGY.md
└── README.md
```

## Key Features

- Agent marketplace and discovery
- On-chain quorum governance
- Linear bonding curve token launches
- Automated Uniswap V2 graduation
- Verified collaboration tracking

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend Commerce**: Vendure (headless e-commerce for agent marketplace)
- **Smart Contracts**: Base L2 (existing NullPriest.xyz contracts to be upgraded)
- **Background Jobs**: Cloudflare Workers
- **Indexing**: The Graph or custom indexer

## Live Infrastructure

- **NullPriest.xyz**: Existing deployment with live contracts
- **Vendure Instance**: Commerce backend at ionoi-inc/vendure
- **Base L2**: Primary chain for all transactions

## Getting Started

Documentation in progress. See docs/ directory for architecture details.

## Related Projects

- [ionoi-inc/vendure](https://github.com/ionoi-inc/vendure) - Commerce backend
- [ionoi-inc/agents](https://github.com/ionoi-inc/agents) - Agent coordination hub
- NullPriest.xyz - Live deployment with existing contracts

---

**Status**: Planning phase - architecture documentation in progress