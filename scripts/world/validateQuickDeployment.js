const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatUnits } = ethers.utils;

// Get deployment data
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-quick-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Quick deployment data not found at", deploymentPath);
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

// Format an address for display
function formatAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Validate the quick deployment
async function main() {
  console.log("=== VALIDATING QUICK GMX DEPLOYMENT ON WORLD CHAIN ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Quick deployment data loaded successfully\n");
  
  // Prepare results arrays
  const results = {
    success: [],
    warning: [],
    error: []
  };
  
  // 1. Check Core Contracts
  console.log("1. Checking Core Contracts...");
  const contracts = [
    "Vault", "VaultPriceFeed", "Router", "PositionRouter", "PositionManager", 
    "ShortsTracker", "OrderBook", "GlpManager", "VaultUtils", "Timelock", 
    "GMX", "EsGMX", "WLD", "WWORLD", "USDG", "RewardRouter", "RewardReader",
    "PositionUtils"
  ];
  
  for (const contractName of contracts) {
    try {
      if (!deploymentData[contractName]) {
        results.error.push(`${contractName} address not found in deployment data`);
        continue;
      }
      
      const contract = await ethers.getContractAt("Governable", deploymentData[contractName]);
      const code = await ethers.provider.getCode(deploymentData[contractName]);
      
      if (code === "0x") {
        results.error.push(`${contractName} has no code at address ${formatAddress(deploymentData[contractName])}`);
      } else {
        results.success.push(`${contractName} exists at ${formatAddress(deploymentData[contractName])}`);
      }
    } catch (error) {
      results.warning.push(`Error checking ${contractName}: ${error.message}`);
    }
  }
  
  // 2. Check Mock Price Feeds
  console.log("\n2. Checking Mock Price Feeds...");
  if (!deploymentData.MockPriceFeeds) {
    results.error.push("MockPriceFeeds not found in deployment data");
  } else {
    for (const [tokenSymbol, priceFeedAddress] of Object.entries(deploymentData.MockPriceFeeds)) {
      try {
        const priceFeed = await ethers.getContractAt("MockPriceFeed", priceFeedAddress);
        const price = await priceFeed.latestAnswer();
        results.success.push(`${tokenSymbol} price feed exists with price ${formatUnits(price, 8)} USD`);
      } catch (error) {
        results.error.push(`Error with ${tokenSymbol} price feed: ${error.message}`);
      }
    }
  }
  
  // 3. Check Router Configuration
  console.log("\n3. Checking Router Configuration...");
  try {
    const router = await ethers.getContractAt("Router", deploymentData.Router);
    
    // Check Vault in Router
    const routerVault = await router.vault();
    if (routerVault.toLowerCase() === deploymentData.Vault.toLowerCase()) {
      results.success.push(`Router has correct Vault: ${formatAddress(routerVault)}`);
    } else {
      results.error.push(`Router has wrong Vault: ${formatAddress(routerVault)}, expected: ${formatAddress(deploymentData.Vault)}`);
    }
    
    // Check USDG in Router
    const routerUsdg = await router.usdg();
    if (routerUsdg.toLowerCase() === deploymentData.USDG.toLowerCase()) {
      results.success.push(`Router has correct USDG: ${formatAddress(routerUsdg)}`);
    } else {
      results.error.push(`Router has wrong USDG: ${formatAddress(routerUsdg)}, expected: ${formatAddress(deploymentData.USDG)}`);
    }
    
    // Check plugins
    const isOrderBookPlugin = await router.plugins(deploymentData.OrderBook);
    if (isOrderBookPlugin) {
      results.success.push(`OrderBook correctly set as Router plugin`);
    } else {
      results.error.push(`OrderBook NOT set as Router plugin`);
    }
    
    const isPositionRouterPlugin = await router.plugins(deploymentData.PositionRouter);
    if (isPositionRouterPlugin) {
      results.success.push(`PositionRouter correctly set as Router plugin`);
    } else {
      results.error.push(`PositionRouter NOT set as Router plugin`);
    }
  } catch (error) {
    results.error.push(`Error checking Router configuration: ${error.message}`);
  }
  
  // 4. Check Vault Configuration
  console.log("\n4. Checking Vault Configuration...");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // Check Router in Vault
    const vaultRouter = await vault.router();
    if (vaultRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      results.success.push(`Vault has correct Router: ${formatAddress(vaultRouter)}`);
    } else {
      results.error.push(`Vault has wrong Router: ${formatAddress(vaultRouter)}, expected: ${formatAddress(deploymentData.Router)}`);
    }
    
    // Check VaultUtils in Vault
    const vaultUtils = await vault.vaultUtils();
    if (vaultUtils.toLowerCase() === deploymentData.VaultUtils.toLowerCase()) {
      results.success.push(`Vault has correct VaultUtils: ${formatAddress(vaultUtils)}`);
    } else {
      results.error.push(`Vault has wrong VaultUtils: ${formatAddress(vaultUtils)}, expected: ${formatAddress(deploymentData.VaultUtils)}`);
    }
    
    // Check token whitelisting
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    if (isWldWhitelisted) {
      results.success.push(`WLD token correctly whitelisted in Vault`);
      
      // Check token weight
      const wldWeight = await vault.tokenWeights(deploymentData.WLD);
      results.success.push(`WLD token weight: ${wldWeight.toString()}`);
    } else {
      results.error.push(`WLD token NOT whitelisted in Vault`);
    }
    
    const isWworldWhitelisted = await vault.whitelistedTokens(deploymentData.WWORLD);
    if (isWworldWhitelisted) {
      results.success.push(`WWORLD token correctly whitelisted in Vault`);
      
      // Check token weight
      const wworldWeight = await vault.tokenWeights(deploymentData.WWORLD);
      results.success.push(`WWORLD token weight: ${wworldWeight.toString()}`);
    } else {
      results.error.push(`WWORLD token NOT whitelisted in Vault`);
    }
    
    // Check governance
    const vaultGov = await vault.gov();
    if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
      results.success.push(`Vault governance correctly set to deployer (for testing)`);
    } else if (vaultGov.toLowerCase() === deploymentData.Timelock.toLowerCase()) {
      results.success.push(`Vault governance correctly set to Timelock`);
    } else {
      results.error.push(`Vault has unexpected governor: ${formatAddress(vaultGov)}`);
    }
  } catch (error) {
    results.error.push(`Error checking Vault configuration: ${error.message}`);
  }
  
  // 5. Check VaultPriceFeed Configuration
  console.log("\n5. Checking VaultPriceFeed Configuration...");
  try {
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // Check WLD price feed
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    if (wldPriceFeed.toLowerCase() === deploymentData.MockPriceFeeds.WLD.toLowerCase()) {
      results.success.push(`WLD price feed correctly set to ${formatAddress(wldPriceFeed)}`);
      
      // Try to get price
      try {
        const wldPrice = await vaultPriceFeed.getPrice(deploymentData.WLD, false, true, true);
        results.success.push(`WLD price: ${formatUnits(wldPrice, 30)} USD`);
      } catch (error) {
        results.warning.push(`Error getting WLD price: ${error.message}`);
      }
    } else {
      results.error.push(`WLD price feed not correctly set: ${formatAddress(wldPriceFeed)}, expected: ${formatAddress(deploymentData.MockPriceFeeds.WLD)}`);
    }
    
    // Check WWORLD price feed
    const wworldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WWORLD);
    if (wworldPriceFeed.toLowerCase() === deploymentData.MockPriceFeeds.WWORLD.toLowerCase()) {
      results.success.push(`WWORLD price feed correctly set to ${formatAddress(wworldPriceFeed)}`);
      
      // Try to get price
      try {
        const wworldPrice = await vaultPriceFeed.getPrice(deploymentData.WWORLD, false, true, true);
        results.success.push(`WWORLD price: ${formatUnits(wworldPrice, 30)} USD`);
      } catch (error) {
        results.warning.push(`Error getting WWORLD price: ${error.message}`);
      }
    } else {
      results.error.push(`WWORLD price feed not correctly set: ${formatAddress(wworldPriceFeed)}, expected: ${formatAddress(deploymentData.MockPriceFeeds.WWORLD)}`);
    }
    
    // Check governance
    const priceFeedGov = await vaultPriceFeed.gov();
    if (priceFeedGov.toLowerCase() === deployer.address.toLowerCase()) {
      results.success.push(`VaultPriceFeed governance correctly set to deployer (for testing)`);
    } else if (priceFeedGov.toLowerCase() === deploymentData.Timelock.toLowerCase()) {
      results.success.push(`VaultPriceFeed governance correctly set to Timelock`);
    } else {
      results.error.push(`VaultPriceFeed has unexpected governor: ${formatAddress(priceFeedGov)}`);
    }
  } catch (error) {
    results.error.push(`Error checking VaultPriceFeed configuration: ${error.message}`);
  }
  
  // 6. Check Timelock Configuration
  console.log("\n6. Checking Timelock Configuration...");
  try {
    const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
    
    // Check buffer
    const buffer = await timelock.buffer();
    if (buffer.toString() === "300") {
      results.success.push(`Timelock buffer correctly set to 5 minutes (300 seconds)`);
    } else {
      results.warning.push(`Timelock buffer is ${buffer.toString()} seconds, expected: 300 seconds (5 minutes)`);
    }
    
    // Check admin
    const admin = await timelock.admin();
    if (admin.toLowerCase() === deployer.address.toLowerCase()) {
      results.success.push(`Timelock admin correctly set to deployer`);
    } else {
      results.error.push(`Timelock has unexpected admin: ${formatAddress(admin)}, expected: ${formatAddress(deployer.address)}`);
    }
  } catch (error) {
    results.error.push(`Error checking Timelock configuration: ${error.message}`);
  }
  
  // Print validation report
  console.log("\n=== QUICK DEPLOYMENT VALIDATION REPORT ===");
  console.log(`\n✅ SUCCESSFUL CHECKS (${results.success.length}):`);
  results.success.forEach((msg, idx) => console.log(`  ${idx + 1}. ${msg}`));
  
  if (results.warning.length > 0) {
    console.log(`\n⚠️ WARNINGS (${results.warning.length}):`);
    results.warning.forEach((msg, idx) => console.log(`  ${idx + 1}. ${msg}`));
  }
  
  if (results.error.length > 0) {
    console.log(`\n❌ ERRORS (${results.error.length}):`);
    results.error.forEach((msg, idx) => console.log(`  ${idx + 1}. ${msg}`));
  }
  
  // Summary
  console.log("\n=== VALIDATION SUMMARY ===");
  if (results.error.length === 0) {
    if (results.warning.length === 0) {
      console.log("✅ ALL CHECKS PASSED! The quick deployment is fully functional.");
    } else {
      console.log("⚠️ DEPLOYMENT CHECKS PASSED WITH WARNINGS - Review the warnings and address them if necessary.");
    }
  } else {
    console.log(`❌ DEPLOYMENT HAS ${results.error.length} ERRORS - These need to be fixed for proper operation.`);
  }
  
  console.log("\n=== NEXT STEPS ===");
  if (results.error.length > 0) {
    console.log("1. Run quickDeployWorld.js script again to fix any errors.");
    console.log("2. Run this validation script again to verify all issues are resolved.");
  } else {
    console.log("1. Your deployment is ready for testing!");
    console.log("2. You can now test trading functionality directly with the contracts.");
    console.log("3. Remember that governance is currently set to the deployer for easy testing.");
    console.log("   You can transfer governance to the Timelock when ready for production.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
