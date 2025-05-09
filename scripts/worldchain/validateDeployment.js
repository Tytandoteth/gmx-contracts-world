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

async function main() {
  try {
    console.log("Validating GMX deployment on World Chain...");
    
    // Get the deployment data
    const deploymentData = await getDeploymentData();
    
    if (Object.keys(deploymentData).length === 0) {
      throw new Error("No deployment data found. Please deploy contracts first.");
    }
    
    console.log("Found deployment data with the following contracts:");
    
    // Required contracts for basic functionality
    const requiredContracts = [
      'WLD',
      'Vault',
      'Router',
      'VaultUtils',
      'GlpManager',
      'PositionRouter',
      'PositionManager',
      'OrderBook'
    ];
    
    const missingContracts = [];
    for (const contract of requiredContracts) {
      if (!deploymentData[contract]) {
        missingContracts.push(contract);
      }
    }
    
    if (missingContracts.length > 0) {
      console.error(`Missing required contracts: ${missingContracts.join(", ")}`);
      console.error("Please complete the core deployment before validation.");
      process.exit(1);
    }
    
    console.log("All required core contracts found.");
    
    // Connect to deployed contracts and validate configuration
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // Basic validation of Vault configuration
    console.log("\nValidating Vault configuration...");
    
    const wldTokenAddress = await vault.usdg();
    if (wldTokenAddress.toLowerCase() !== deploymentData.WLD.toLowerCase()) {
      console.warn(`Warning: Vault's USDG address (${wldTokenAddress}) doesn't match WLD token address (${deploymentData.WLD})`);
    } else {
      console.log("✓ Vault is correctly configured with WLD token as USDG");
    }
    
    // Check Router
    const routerAddress = await vault.router();
    if (routerAddress.toLowerCase() !== deploymentData.Router.toLowerCase()) {
      console.warn(`Warning: Vault's Router address (${routerAddress}) doesn't match deployed Router (${deploymentData.Router})`);
    } else {
      console.log("✓ Vault is correctly configured with Router");
    }
    
    // Check GlpManager
    const glpManager = await ethers.getContractAt("GlpManager", deploymentData.GlpManager);
    const glpManagerVault = await glpManager.vault();
    if (glpManagerVault.toLowerCase() !== deploymentData.Vault.toLowerCase()) {
      console.warn(`Warning: GlpManager's Vault address (${glpManagerVault}) doesn't match deployed Vault (${deploymentData.Vault})`);
    } else {
      console.log("✓ GlpManager is correctly configured with Vault");
    }
    
    // Check PositionRouter
    const positionRouter = await ethers.getContractAt("PositionRouter", deploymentData.PositionRouter);
    const positionRouterVault = await positionRouter.vault();
    if (positionRouterVault.toLowerCase() !== deploymentData.Vault.toLowerCase()) {
      console.warn(`Warning: PositionRouter's Vault address (${positionRouterVault}) doesn't match deployed Vault (${deploymentData.Vault})`);
    } else {
      console.log("✓ PositionRouter is correctly configured with Vault");
    }
    
    // Check if governance token is deployed
    if (deploymentData.GMX) {
      console.log("\nGovernance token found:");
      console.log(`GMX Token: ${deploymentData.GMX}`);
      
      // Validate GMX token
      const gmx = await ethers.getContractAt("GMX", deploymentData.GMX);
      const gmxSymbol = await gmx.symbol();
      const gmxTotalSupply = await gmx.totalSupply();
      console.log(`Token symbol: ${gmxSymbol}`);
      console.log(`Total supply: ${ethers.utils.formatUnits(gmxTotalSupply, 18)} ${gmxSymbol}`);
    } else {
      console.log("\nGovernance token not deployed (optional)");
    }
    
    // Check Oracle configuration
    console.log("\nValidating Oracle configuration...");
    try {
      const priceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
      
      // Test WLD price 
      try {
        const isWldConfigured = await priceFeed.isTokenConfigured(deploymentData.WLD);
        if (isWldConfigured) {
          const wldPrice = await priceFeed.getPrice(deploymentData.WLD, false, true, false);
          console.log(`WLD Price: $${ethers.utils.formatUnits(wldPrice, 30)}`);
          console.log("✓ Oracle price feed is configured for WLD");
        } else {
          console.log("✗ WLD token is not configured in the price feed");
        }
      } catch (error) {
        console.log("✗ Error getting WLD price:", error.message);
      }
    } catch (error) {
      console.log("✗ Error accessing price feed:", error.message);
    }
    
    console.log("\nSummary of deployed contracts on World Chain:");
    console.log("--------------------------------------------");
    
    // Display all deployed contracts
    for (const [name, address] of Object.entries(deploymentData)) {
      console.log(`${name}: ${address}`);
    }
    
    console.log("\nGMX deployment on World Chain has been validated.");
    console.log("Next steps:");
    console.log("1. Test trading functionality");
    console.log("2. Configure frontend with the deployed contract addresses");
    console.log("3. Set up a proper oracle feed for production use");
    
  } catch (error) {
    console.error("Validation failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
