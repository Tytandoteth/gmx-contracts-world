const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, '..', '..', '.world-deployment.json');
  if (fs.existsSync(deploymentPath)) {
    return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  return {};
}

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, '..', '..', '.world-deployment.json');
  const existingData = await getDeploymentData();
  const updatedData = { ...existingData, ...data };
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);
}

async function main() {
  try {
    console.log("Deploying GMX periphery contracts to World Chain...");
    
    // Get the deployer account from hardhat config
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    // Get the previously deployed core contract addresses
    const deploymentData = await getDeploymentData();
    
    // Check if core contracts are deployed
    const requiredContracts = ['WLD', 'Vault', 'Router', 'PositionRouter', 'PositionManager', 'OrderBook'];
    for (const contract of requiredContracts) {
      if (!deploymentData[contract]) {
        throw new Error(`${contract} address not found. Please deploy core contracts first.`);
      }
    }
    
    console.log("Found all required core contract addresses.");
    
    // Deploy VaultReader
    console.log("Deploying VaultReader...");
    const VaultReader = await ethers.getContractFactory("VaultReader");
    const vaultReader = await VaultReader.deploy();
    await vaultReader.deployed();
    console.log(`VaultReader deployed at: ${vaultReader.address}`);
    
    // Deploy ReaderV2
    console.log("Deploying ReaderV2...");
    const ReaderV2 = await ethers.getContractFactory("ReaderV2");
    const reader = await ReaderV2.deploy();
    await reader.deployed();
    console.log(`ReaderV2 deployed at: ${reader.address}`);
    
    // Deploy OrderBookReader
    console.log("Deploying OrderBookReader...");
    const OrderBookReader = await ethers.getContractFactory("OrderBookReader");
    const orderBookReader = await OrderBookReader.deploy();
    await orderBookReader.deployed();
    console.log(`OrderBookReader deployed at: ${orderBookReader.address}`);
    
    // Deploy PositionRouterReader
    console.log("Deploying PositionRouterReader...");
    const PositionRouterReader = await ethers.getContractFactory("PositionRouterReader");
    const positionRouterReader = await PositionRouterReader.deploy();
    await positionRouterReader.deployed();
    console.log(`PositionRouterReader deployed at: ${positionRouterReader.address}`);
    
    // Deploy Timelock for governance
    console.log("Deploying Timelock...");
    const Timelock = await ethers.getContractFactory("Timelock");
    const buffer = 24 * 60 * 60; // 24 hours
    const timelock = await Timelock.deploy(
      deployer.address, // admin
      buffer, // buffer
      ethers.constants.AddressZero, // tokenManager
      ethers.constants.AddressZero, // mintReceiver
      deploymentData.GlpManager // glpManager
    );
    await timelock.deployed();
    console.log(`Timelock deployed at: ${timelock.address}`);
    
    // Configure oracle integration
    console.log("Setting up price feed for WLD token...");
    const priceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // Add WLD to price feed with a temporary price oracle
    // In production, you would connect to a real oracle like Redstone
    // For this demo, we're setting a fixed price for WLD at $1.00
    await priceFeed.setTokenConfig(
      deploymentData.WLD, // token
      deploymentData.WLD, // tokenOracle (using the token itself as a placeholder)
      18, // tokenDecimals
      true, // isStrictStable (set to true for stablecoins)
      false // isShortable
    );
    console.log("WLD token added to price feed");
    
    // Save all deployed periphery contract addresses
    await saveDeploymentData({
      VaultReader: vaultReader.address,
      ReaderV2: reader.address,
      OrderBookReader: orderBookReader.address,
      PositionRouterReader: positionRouterReader.address,
      Timelock: timelock.address
    });
    
    // Create frontend configuration
    const frontendConfigPath = path.join(__dirname, '..', '..', 'frontend-config.env');
    const frontendConfig = `# GMX Frontend Configuration for World Chain
RPC_URL=${process.env.WORLDCHAIN_URL || "https://rpc.worldchain.network"}
CHAIN_ID=480

# Contract addresses
VAULT_ADDRESS=${deploymentData.Vault}
POSITION_ROUTER_ADDRESS=${deploymentData.PositionRouter}
POSITION_MANAGER_ADDRESS=${deploymentData.PositionManager}
READER_ADDRESS=${reader.address}
GLP_MANAGER_ADDRESS=${deploymentData.GlpManager}
WLD_TOKEN=${deploymentData.WLD}

# Oracle configuration
ORACLE_SERVER_URL=

# Network settings
NETWORK_NAME=World Chain

# Feature flags
ENABLE_STAKING=false
ENABLE_LEADERBOARD=false
`;
    fs.writeFileSync(frontendConfigPath, frontendConfig);
    console.log(`Frontend configuration saved to ${frontendConfigPath}`);
    
    console.log("\nPeriphery Contracts Deployment Successful!");
    console.log("----------------------------------------");
    console.log(`VaultReader: ${vaultReader.address}`);
    console.log(`ReaderV2: ${reader.address}`);
    console.log(`OrderBookReader: ${orderBookReader.address}`);
    console.log(`PositionRouterReader: ${positionRouterReader.address}`);
    console.log(`Timelock: ${timelock.address}`);
    console.log("\nNext steps:");
    console.log("1. Deploy governance token with: npx hardhat run scripts/worldchain/deployGovToken.js --network worldchain (optional)");
    console.log("2. Test the deployment with: npx hardhat run scripts/worldchain/validateDeployment.js --network worldchain");
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
