# Headless Markets - Base Mainnet Deployment Checklist

## Pre-Deployment Verification

### Repository Status
- [x] All three core contracts verified in `/contracts/core/`:
  - `AgentQuorum.sol` (10.8 KB)
  - `BondingCurve.sol` (11.1 KB)
  - `BondingCurveFactory.sol` (4.6 KB)
- [x] Deployment script verified at `/scripts/deploy.ts` (6.8 KB)
- [x] Hardhat configuration includes Base mainnet network

---

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

### Critical - Deployment Access
```bash
# Deployer wallet private key (NEVER commit this)
DEPLOYER_PRIVATE_KEY=0x...

# Base Mainnet RPC URL (required for deployment)
BASE_MAINNET_RPC_URL=https://mainnet.base.org
# Alternative RPC providers:
# - Alchemy: https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
# - Infura: https://base-mainnet.infura.io/v3/YOUR_PROJECT_ID
# - QuickNode: Your QuickNode Base endpoint
```

### Contract Verification
```bash
# BaseScan API Key (for contract verification)
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
# Obtain from: https://basescan.org/myapikey
```

### Optional - Gas Reporting
```bash
# Gas reporting (optional, for cost analysis)
REPORT_GAS=true
COINMARKETCAP_API_KEY=YOUR_CMC_API_KEY
```

### Network Forking (Development Only)
```bash
# Only use for local testing against mainnet fork
FORK_BASE_MAINNET=false  # Set to false for actual deployment
```

---

## Pre-Deployment Wallet Checklist

### Deployer Wallet Requirements

- [ ] **Wallet has sufficient ETH balance on Base Mainnet**
  - Minimum recommended: **0.05 ETH** (for deployment + buffer)
  - Check balance: `cast balance YOUR_ADDRESS --rpc-url https://mainnet.base.org`
  
- [ ] **Verify wallet address matches private key**
  ```bash
  # Derive address from private key to confirm
  cast wallet address --private-key $DEPLOYER_PRIVATE_KEY
  ```

- [ ] **Wallet is NOT compromised or shared**
  - Use a dedicated deployment wallet
  - Consider using a hardware wallet or secure key management

- [ ] **Test wallet connection**
  ```bash
  # Check current block number
  cast block-number --rpc-url $BASE_MAINNET_RPC_URL
  ```

---

## Gas Estimation for Deployment

### Estimated Gas Costs (Base Mainnet)

Based on the deployment script sequence:

| Contract/Operation | Estimated Gas | Notes |
|-------------------|---------------|-------|
| **AgentQuorum** | ~2,500,000 gas | Main governance contract |
| **BondingCurveFactory** | ~3,200,000 gas | Factory with Uniswap integration |
| **setBondingCurveFactory()** | ~50,000 gas | Linking contracts |
| **Verification** (read-only) | 0 gas | Free |
| **Total Estimated** | ~5,750,000 gas | |

### Cost Calculation

```
Base Mainnet Average Gas Price: ~0.001 gwei (dynamic)
Total Cost = 5,750,000 gas × 0.001 gwei = 0.00575 gwei = ~0.0000058 ETH

At $2,800 ETH:
Deployment Cost ≈ $0.016 USD

RECOMMENDATION: Have 0.05 ETH (~$140) for safety margin
```

**Note**: Gas prices on Base are extremely low. The above assumes typical Base conditions. Always check current gas prices before deployment.

### Check Current Gas Prices

```bash
# Get current gas price on Base
cast gas-price --rpc-url https://mainnet.base.org

# Get current ETH price (for cost estimation)
curl "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
```

---

## Uniswap V2 Addresses on Base Mainnet

The deployment script uses these Base Mainnet addresses (hardcoded in `getUniswapAddresses()`):

```
Uniswap V2 Router: 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
Uniswap V2 Factory: 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6
WETH: 0x4200000000000000000000000000000000000006
```

**Verification Required**: Confirm these addresses are still current by checking:
- https://docs.uniswap.org/contracts/v2/reference/smart-contracts/factory
- https://basescan.org/address/0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24

---

## Deployment Execution

### Step 1: Compile Contracts

```bash
# Clean previous artifacts
npx hardhat clean

# Compile with optimizations enabled
npx hardhat compile

# Verify compilation success
ls -la artifacts/contracts/core/
```

**Expected Output**: Compiled artifacts for all three contracts with optimization runs: 200

### Step 2: Run Deployment Script

```bash
# Deploy to Base Mainnet
npx hardhat run scripts/deploy.ts --network base

# Expected execution time: 2-5 minutes
# Monitor transaction confirmations on BaseScan
```

### Step 3: Save Deployment Addresses

The script automatically saves deployment data to:
```
deployments/base-mainnet-{timestamp}.json
```

**Critical**: Immediately backup this file and record the contract addresses:
- `agentQuorum`: _______________
- `bondingCurveFactory`: _______________

---

## Contract Verification on BaseScan

### Automatic Verification (Recommended)

After deployment completes, verify contracts on BaseScan:

```bash
# Verify AgentQuorum
npx hardhat verify --network base AGENT_QUORUM_ADDRESS "DEPLOYER_ADDRESS"

# Verify BondingCurveFactory
npx hardhat verify --network base FACTORY_ADDRESS \
  "AGENT_QUORUM_ADDRESS" \
  "DEPLOYER_ADDRESS" \
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24" \
  "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" \
  "0x4200000000000000000000000000000000000006"
```

### Verification Checklist

- [ ] AgentQuorum verified on BaseScan
- [ ] BondingCurveFactory verified on BaseScan
- [ ] Contract source code matches repository
- [ ] Constructor arguments are correct
- [ ] Solidity compiler version: 0.8.20
- [ ] Optimization enabled: Yes (200 runs)
- [ ] License: MIT

### Manual Verification (if automatic fails)

1. Go to https://basescan.org/verifyContract
2. Enter contract address
3. Select compiler version: 0.8.20
4. Enable optimization: Yes (200 runs)
5. Upload flattened source code:
   ```bash
   npx hardhat flatten contracts/core/AgentQuorum.sol > AgentQuorum-flat.sol
   npx hardhat flatten contracts/core/BondingCurveFactory.sol > BondingCurveFactory-flat.sol
   ```

---

## Post-Deployment Testing Checklist

### Phase 1: Contract State Verification

Execute these read-only calls to verify deployment integrity:

#### AgentQuorum Contract
```bash
# Check owner
cast call AGENT_QUORUM_ADDRESS "owner()(address)" --rpc-url $BASE_MAINNET_RPC_URL

# Check bondingCurveFactory address
cast call AGENT_QUORUM_ADDRESS "bondingCurveFactory()(address)" --rpc-url $BASE_MAINNET_RPC_URL

# Expected: Should return FACTORY_ADDRESS
```

#### BondingCurveFactory Contract
```bash
# Check agentQuorum reference
cast call FACTORY_ADDRESS "agentQuorum()(address)" --rpc-url $BASE_MAINNET_RPC_URL

# Check platform fee recipient
cast call FACTORY_ADDRESS "platformFeeRecipient()(address)" --rpc-url $BASE_MAINNET_RPC_URL

# Check Uniswap addresses
cast call FACTORY_ADDRESS "uniswapV2Router()(address)" --rpc-url $BASE_MAINNET_RPC_URL
cast call FACTORY_ADDRESS "uniswapV2Factory()(address)" --rpc-url $BASE_MAINNET_RPC_URL
cast call FACTORY_ADDRESS "weth()(address)" --rpc-url $BASE_MAINNET_RPC_URL
```

### Phase 2: Contract Linkage Verification

- [ ] **Verify bidirectional linkage**
  - AgentQuorum.bondingCurveFactory() returns correct factory address
  - BondingCurveFactory.agentQuorum() returns correct quorum address

- [ ] **Verify ownership**
  - AgentQuorum.owner() returns deployer address
  - BondingCurveFactory owner/admin matches expected address

### Phase 3: Functional Testing (Test Transactions)

**WARNING**: These operations cost gas and interact with mainnet. Use minimal amounts.

#### Test 1: Register an Agent (AgentQuorum)

```bash
# Register a test agent
cast send AGENT_QUORUM_ADDRESS \
  "registerAgent(string,string)" \
  "Test Agent" \
  "ipfs://QmTest..." \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $BASE_MAINNET_RPC_URL

# Verify registration
cast call AGENT_QUORUM_ADDRESS "getAgentCount()(uint256)" --rpc-url $BASE_MAINNET_RPC_URL
```

#### Test 2: Create a Bonding Curve

```bash
# Create a bonding curve for the test agent
cast send FACTORY_ADDRESS \
  "createBondingCurve(uint256,string,string)" \
  0 \
  "TestToken" \
  "TEST" \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --value 0.001ether

# Get created bonding curve address
cast call FACTORY_ADDRESS "getBondingCurveByAgent(uint256)(address)" 0 --rpc-url $BASE_MAINNET_RPC_URL
```

#### Test 3: Purchase Tokens (Bonding Curve)

```bash
# Buy tokens from the bonding curve
cast send BONDING_CURVE_ADDRESS \
  "buy(uint256)" \
  1000000000000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --value 0.01ether

# Check token balance
cast call BONDING_CURVE_ADDRESS "balanceOf(address)(uint256)" $DEPLOYER_ADDRESS --rpc-url $BASE_MAINNET_RPC_URL
```

### Phase 4: Security Verification

- [ ] **Access control working correctly**
  - Only owner can call restricted functions
  - Non-owners are properly rejected

- [ ] **Fee mechanism operational**
  - Platform fees are being collected
  - Fee recipient receiving payments

- [ ] **Emergency functions accessible**
  - Pause/unpause mechanisms work (if implemented)
  - Owner can upgrade if upgradeable

### Phase 5: Integration Testing

- [ ] **Uniswap integration functional**
  - Can create liquidity pairs
  - Can execute swaps through router
  - WETH wrapping/unwrapping works

- [ ] **Event emission verified**
  - All major events are being emitted
  - Event parameters are correct
  - Can be indexed by frontend

---

## Monitoring & Maintenance

### Post-Deployment Monitoring

- [ ] **Add contracts to monitoring dashboard**
  - Tenderly: https://dashboard.tenderly.co/
  - OpenZeppelin Defender: https://defender.openzeppelin.com/

- [ ] **Set up transaction alerts**
  - Alert on large transactions
  - Alert on ownership changes
  - Alert on contract pauses

- [ ] **BaseScan verification**
  - Add contract labels
  - Enable email notifications for contract interactions

### Backup Critical Information

Save the following in a secure location (password manager, encrypted vault):

```
Deployment Date: _______________
Network: Base Mainnet (Chain ID: 8453)
Deployer Address: _______________
AgentQuorum Address: _______________
BondingCurveFactory Address: _______________
Deployment Transaction Hash: _______________
Verification Status: _______________
Initial Gas Price: _______________
Total Deployment Cost: _______________
```

---

## Emergency Procedures

### If Deployment Fails

1. **Check transaction status on BaseScan**
   - If reverted: Read revert reason
   - If pending: Wait for confirmation or increase gas price

2. **Common failure reasons:**
   - Insufficient gas
   - Nonce issues (transaction ordering)
   - Contract compilation errors
   - Invalid constructor parameters

3. **Recovery steps:**
   ```bash
   # Reset nonce if needed
   cast nonce $DEPLOYER_ADDRESS --rpc-url $BASE_MAINNET_RPC_URL
   
   # Redeploy with higher gas limit
   npx hardhat run scripts/deploy.ts --network base
   ```

### If Verification Fails

1. **Check BaseScan error message**
2. **Verify compiler settings match deployment**
3. **Use hardhat-verify plugin for automatic retry**
4. **Contact BaseScan support if persistent issues**

---

## Final Pre-Launch Checklist

Before announcing deployment or integrating with frontend:

- [ ] All contracts deployed successfully
- [ ] All contracts verified on BaseScan
- [ ] Contract linkage verified (AgentQuorum ↔ BondingCurveFactory)
- [ ] Ownership confirmed
- [ ] Test transactions executed successfully
- [ ] Deployment addresses backed up securely
- [ ] Monitoring and alerts configured
- [ ] Team notified of deployment
- [ ] Frontend environment variables updated with new addresses
- [ ] Documentation updated with contract addresses

---

## Contract Addresses (Fill after deployment)

```json
{
  "network": "base",
  "chainId": 8453,
  "contracts": {
    "AgentQuorum": "0x...",
    "BondingCurveFactory": "0x...",
    "UniswapV2Router": "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    "UniswapV2Factory": "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    "WETH": "0x4200000000000000000000000000000000000006"
  },
  "deployer": "0x...",
  "deploymentTx": "0x...",
  "timestamp": "2026-02-18T02:00:00Z",
  "verified": true
}
```

---

## Support & Resources

- **Base Documentation**: https://docs.base.org/
- **BaseScan**: https://basescan.org/
- **Hardhat Documentation**: https://hardhat.org/
- **Uniswap V2 Docs**: https://docs.uniswap.org/contracts/v2/overview

---

**DEPLOYMENT STATUS**: ⏸️ READY FOR MAINNET DEPLOYMENT

**Last Updated**: 2026-02-17 21:00 EST
**Prepared By**: GitHub Agent
**Review Status**: Pending final review before execution
