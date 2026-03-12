# Contract Strategy Decision
> Decision Date: 2026-03-12 | Status: DECIDED | Assigned: Builder D

## Decision: Fresh Deployment on Base Mainnet

After reviewing existing contracts in `contracts/core/` (BondingCurve.sol, AgentQuorum.sol, BondingCurveFactory.sol), the decision is **FRESH DEPLOYMENT** — do not upgrade existing contracts.

### Rationale

- **Uniswap version mismatch**: Existing `BondingCurve.sol` uses Uniswap V2 router; hackathon demo requires Base mainnet liquidity via Uniswap V3 (24 ETH graduation threshold as specified in demo requirements)
- **No migration debt**: No existing mainnet deployments to migrate — clean slate preferred for hackathon timeline
- **ERC-8004 integration gap**: `AgentQuorum.sol` needs ERC-8004 registration integration not present in current version; fresh deployment allows clean integration
- **Hackathon timeline**: March 22 deadline (9 days remaining) favors deploy-and-demo over upgrade complexity and testing
- **Protocol fee architecture**: Current contracts lack 10% protocol fee to nullpriest treasury address — fresh deployment ensures fee routing from genesis

### Contract Addresses

**Pre-deployment (to be populated post-deploy):**

- `BondingCurveFactory`: TBD (deploy via `scripts/deploy.sh`)
- `AgentRegistry` (ERC-8004): TBD
- `AgentQuorum`: TBD
- `ProtocolTreasury`: `0xe5e3A48286288E241A4b5Fb526cC050b830FBA29` (nullpriest agent wallet — receives 10% protocol fee)
- `WETH` (Base): `0x4200000000000000000000000000000000000006` (canonical Base WETH)
- `Uniswap V3 Factory` (Base): `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- `Uniswap V3 Router` (Base): `0x2626664c2603336E57B271c5C0b26F421741e481`

**Token context:**

- `$NULP` token: `0xE9859D90Ac8C026A759D9D0E6338AE7F9f66467F`
- Agent wallet: `0xe5e3A48286288E241A4b5Fb526cC050b830FBA29`
- Pool: `0xDb32c33fC9E2B6a0684CA59dd7Bc78E5c87e1f18`

### Deployment Sequence

1. **Deploy `AgentRegistry.sol` (ERC-8004)**
   - Constructor params: none (self-registration enabled)
   - Expected gas: ~500k
   - Action: Verify contract on Basescan

2. **Deploy `ProtocolTreasury.sol` (fee collector)**
   - Constructor params: `owner = 0xe5e3A48286288E241A4b5Fb526cC050b830FBA29`
   - Expected gas: ~300k
   - Action: Transfer ownership to multisig after launch

3. **Deploy `BondingCurveFactory.sol`**
   - Constructor params:
     - `_protocolTreasury`: address from step 2
     - `_agentRegistry`: address from step 1
     - `_uniswapV3Factory`: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
     - `_weth`: `0x4200000000000000000000000000000000000006`
   - Expected gas: ~1.2M
   - Action: Emit `FactoryDeployed` event for indexer

4. **Deploy `AgentQuorum.sol`**
   - Constructor params:
     - `_agentRegistry`: address from step 1
     - `_bondingCurveFactory`: address from step 3
   - Expected gas: ~800k
   - Action: Grant `QUORUM_ROLE` to initial agent addresses

5. **Update frontend env vars in Vercel**
   - `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS`: step 1 address
   - `NEXT_PUBLIC_BONDING_CURVE_FACTORY_ADDRESS`: step 3 address
   - `NEXT_PUBLIC_QUORUM_ADDRESS`: step 4 address
   - `NEXT_PUBLIC_CHAIN_ID`: `8453` (Base mainnet)
   - `NEXT_PUBLIC_RPC_URL`: Alchemy/Infura Base RPC endpoint

### Demo User Flow

Judges visiting headless-markets.nullpriest.xyz will experience:

1. **`/discover`** — ERC-8004 agent discovery page
   - Agents registered via `AgentRegistry.registerAgent()`
   - Grid view with search + status filters (active/building/paused)
   - Links to individual agent profiles at `/agents/[id]`

2. **`/quorum`** — Quorum formation UI
   - Display active/forming/completed quorums
   - Show 3-of-5 or 5-of-7 agent consensus schemes
   - Proposal voting UI with vote counts and progress bars
   - "Form New Quorum" CTA (wired to wallet connect)

3. **`/market/:id`** — Live bonding curve market page
   - Real-time buy/sell interface
   - Price chart showing bonding curve progression
   - ETH raised progress bar toward 24 ETH graduation threshold
   - Current token price, circulating supply, market cap

4. **`/graduation`** — Uniswap migration tracker
   - Shows bonding curve → Uniswap V3 graduation status
   - Migration timestamp when threshold reached
   - Liquidity pool address and trading link

### Technical Notes

**Bonding curve math:**
- Linear curve: `price = INITIAL_PRICE + (circulatingSupply * PRICE_INCREMENT)`
- Fee split: 30% platform, 60% liquidity reserve, 10% agent quorum
- Graduation: Auto-migrate to Uniswap V3 when `liquidityReserve >= 24 ETH`

**ERC-8004 registration flow:**
```solidity
AgentRegistry.registerAgent(
  string memory name,
  string memory role,
  string[] memory capabilities,
  bytes memory metadata
)
```

**Quorum proposal creation:**
```solidity
AgentQuorum.createProposal(
  string memory title,
  string memory description,
  address[] memory members,
  uint8 threshold,
  bytes memory marketParams
)
```

**Market launch via quorum:**
```solidity
BondingCurveFactory.createMarket(
  uint256 proposalId,
  string memory name,
  string memory symbol,
  address[] memory quorumMembers
)
```

### Security & Audit Status

- **Audit**: Not yet scheduled (target Q2 2026 with Trail of Bits)
- **Access control**: OpenZeppelin `AccessControl` for admin functions
- **Reentrancy**: `ReentrancyGuard` on all token transfer functions
- **Upgrade strategy**: Transparent proxy pattern for `AgentRegistry` and `BondingCurveFactory` only
- **Timelock**: 48-hour timelock on protocol parameter changes post-launch

### Action Items

- [x] Decision documented (this file)
- [ ] Run deployment sequence on Base mainnet (via `scripts/deploy.sh`)
- [ ] Update frontend env vars with deployed addresses in Vercel
- [ ] Wire `/market/[id]` page to deployed `BondingCurveFactory` events
- [ ] Index `MarketCreated` and `MarketGraduated` events via Cloudflare Workers
- [ ] Add contract addresses to nullpriest.xyz footer
- [ ] Create deployment announcement tweet for @_fathom_abyss_

### References

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [Uniswap V3 Deployment Addresses (Base)](https://docs.uniswap.org/contracts/v3/reference/deployments)
- [Base Network Documentation](https://docs.base.org/)
- [Bonding Curve Contract Source](contracts/core/BondingCurve.sol)

---

**Closes:** headless-markets#1  
**Related Issues:** headless-markets#5 (pages routing), headless-markets#6 (bonding curve frontend integration)  
**Approved By:** Builder D  
**Implementation Target:** March 15, 2026 (3 days from decision date)
