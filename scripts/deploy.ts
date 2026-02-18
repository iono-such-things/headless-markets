import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  network: string;
  chainId: number;
  agentQuorum: string;
  bondingCurveFactory: string;
  uniswapV2Router: string;
  uniswapV2Factory: string;
  weth: string;
  deployer: string;
  timestamp: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("=".repeat(60));
  console.log("HEADLESS MARKETS - SMART CONTRACT DEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("=".repeat(60));

  // Network-specific addresses
  const UNISWAP_ADDRESSES = getUniswapAddresses(Number(network.chainId));
  
  console.log("\n📋 Configuration:");
  console.log(`  Uniswap V2 Router: ${UNISWAP_ADDRESSES.router}`);
  console.log(`  Uniswap V2 Factory: ${UNISWAP_ADDRESSES.factory}`);
  console.log(`  WETH: ${UNISWAP_ADDRESSES.weth}`);

  // Step 1: Deploy AgentQuorum
  console.log("\n🚀 Step 1: Deploying AgentQuorum...");
  const AgentQuorum = await ethers.getContractFactory("AgentQuorum");
  const agentQuorum = await AgentQuorum.deploy(deployer.address);
  await agentQuorum.waitForDeployment();
  const agentQuorumAddress = await agentQuorum.getAddress();
  console.log(`✅ AgentQuorum deployed to: ${agentQuorumAddress}`);

  // Step 2: Deploy BondingCurveFactory
  console.log("\n🚀 Step 2: Deploying BondingCurveFactory...");
  const BondingCurveFactory = await ethers.getContractFactory("BondingCurveFactory");
  const factory = await BondingCurveFactory.deploy(
    agentQuorumAddress,
    deployer.address, // Platform fee recipient
    UNISWAP_ADDRESSES.router,
    UNISWAP_ADDRESSES.factory,
    UNISWAP_ADDRESSES.weth
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`✅ BondingCurveFactory deployed to: ${factoryAddress}`);

  // Step 3: Set factory address in AgentQuorum
  console.log("\n🔗 Step 3: Linking contracts...");
  const tx = await agentQuorum.setBondingCurveFactory(factoryAddress);
  await tx.wait();
  console.log(`✅ AgentQuorum.setBondingCurveFactory(${factoryAddress})`);

  // Step 4: Verify deployment
  console.log("\n✔️  Step 4: Verifying deployment...");
  const storedFactory = await agentQuorum.bondingCurveFactory();
  if (storedFactory.toLowerCase() !== factoryAddress.toLowerCase()) {
    throw new Error("Factory address mismatch!");
  }
  console.log("✅ Contract linkage verified");

  // Save deployment addresses
  const deploymentData: DeploymentAddresses = {
    network: network.name,
    chainId: Number(network.chainId),
    agentQuorum: agentQuorumAddress,
    bondingCurveFactory: factoryAddress,
    uniswapV2Router: UNISWAP_ADDRESSES.router,
    uniswapV2Factory: UNISWAP_ADDRESSES.factory,
    weth: UNISWAP_ADDRESSES.weth,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

  console.log("\n💾 Deployment addresses saved to:", filepath);

  // Generate TypeScript constants file
  generateContractAddresses(deploymentData);

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📝 Summary:");
  console.log(`  AgentQuorum: ${agentQuorumAddress}`);
  console.log(`  BondingCurveFactory: ${factoryAddress}`);
  console.log("\n🔍 Next steps:");
  console.log(`  1. Verify contracts on BaseScan:`);
  console.log(`     npx hardhat verify --network ${network.name} ${agentQuorumAddress} "${deployer.address}"`);
  console.log(`     npx hardhat verify --network ${network.name} ${factoryAddress} "${agentQuorumAddress}" "${deployer.address}" "${UNISWAP_ADDRESSES.router}" "${UNISWAP_ADDRESSES.factory}" "${UNISWAP_ADDRESSES.weth}"`);
  console.log(`  2. Update frontend contract addresses`);
  console.log(`  3. Start indexer to sync events`);
  console.log("=".repeat(60) + "\n");
}

function getUniswapAddresses(chainId: number): { router: string; factory: string; weth: string } {
  // Base Mainnet (chainId: 8453)
  if (chainId === 8453) {
    return {
      router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Base Uniswap V2 Router
      factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", // Base Uniswap V2 Factory
      weth: "0x4200000000000000000000000000000000000006", // WETH on Base
    };
  }
  
  // Base Sepolia Testnet (chainId: 84532)
  if (chainId === 84532) {
    return {
      router: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602", // Sepolia Uniswap V2 Router (or deploy mock)
      factory: "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e", // Sepolia Uniswap V2 Factory
      weth: "0x4200000000000000000000000000000000000006", // WETH on Base Sepolia
    };
  }

  // Local/Hardhat (chainId: 31337) - Deploy mock contracts
  if (chainId === 31337) {
    throw new Error("Local deployment requires mock Uniswap contracts. Deploy those first or use fork mode.");
  }

  throw new Error(`Unsupported network chainId: ${chainId}`);
}

function generateContractAddresses(deployment: DeploymentAddresses) {
  const content = `// Auto-generated by deployment script
// Network: ${deployment.network} (${deployment.chainId})
// Deployed: ${deployment.timestamp}

export const HEADLESS_MARKETS_ADDRESSES = {
  agentQuorum: "${deployment.agentQuorum}" as const,
  bondingCurveFactory: "${deployment.bondingCurveFactory}" as const,
  uniswapV2Router: "${deployment.uniswapV2Router}" as const,
  uniswapV2Factory: "${deployment.uniswapV2Factory}" as const,
  weth: "${deployment.weth}" as const,
} as const;

export const DEPLOYMENT_INFO = {
  network: "${deployment.network}",
  chainId: ${deployment.chainId},
  deployer: "${deployment.deployer}",
  timestamp: "${deployment.timestamp}",
} as const;
`;

  const libDir = path.join(__dirname, "..", "lib", "contracts");
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  const addressesFile = path.join(libDir, "addresses.ts");
  fs.writeFileSync(addressesFile, content);
  console.log(`📄 Contract addresses TypeScript file: ${addressesFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
