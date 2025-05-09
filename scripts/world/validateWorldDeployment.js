const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatUnits } = ethers.utils;

// Get deployment data
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found at", deploymentPath);
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

// Format an address for display
function formatAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Check if a contract exists at the address
async function contractExists(address) {
  const code = await ethers.provider.getCode(address);
  return code !== "0x";
}

// Validate the deployment
async function main() {
  console.log("=== VALIDATING GMX DEPLOYMENT ON WORLD CHAIN ===\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully\n");
  
  // Prepare results arrays
  const results = {
    success: [],
    warning: [],
    error: []
  };
  
  // 1. Check Core Contracts Existence
  console.log("1. Checking Core Contracts Existence...");
  const coreContracts = [
    "Vault",
    "VaultPriceFeed",
    "Router",
    "PositionRouter",
    "PositionManager",
    "OrderBook",
    "GlpManager",
    "VaultUtils",
    "ShortsTracker"
  ];
  
  for (const contractName of coreContracts) {
    const address = deploymentData[contractName];
    if (!address) {
      results.error.push(`${contractName} address not found in deployment data`);
      continue;
    }
    
    const exists = await contractExists(address);
    if (exists) {
      results.success.push(`${contractName} exists at ${formatAddress(address)}`);
    } else {
      results.error.push(`${contractName} does not exist at ${formatAddress(address)}`);
    }
  }
  
  // 2. Check Periphery Contracts Existence
  console.log("\n2. Checking Periphery Contracts Existence...");
  const peripheryContracts = [
    "Timelock",
    "GMX",
    "EsGMX",
    "RewardRouter",
    "RewardReader"
  ];
  
  for (const contractName of peripheryContracts) {
    const address = deploymentData[contractName];
    if (!address) {
      results.error.push(`${contractName} address not found in deployment data`);
      continue;
    }
    
    const exists = await contractExists(address);
    if (exists) {
      results.success.push(`${contractName} exists at ${formatAddress(address)}`);
    } else {
      results.error.push(`${contractName} does not exist at ${formatAddress(address)}`);
    }
  }
  
  // 3. Check Mock Price Feeds
  console.log("\n3. Checking Mock Price Feeds...");
  if (!deploymentData.MockPriceFeeds) {
    results.error.push("MockPriceFeeds not found in deployment data");
  } else {
    for (const [tokenSymbol, priceFeedAddress] of Object.entries(deploymentData.MockPriceFeeds)) {
      const exists = await contractExists(priceFeedAddress);
      if (exists) {
        results.success.push(`${tokenSymbol} price feed exists at ${formatAddress(priceFeedAddress)}`);
      } else {
        results.error.push(`${tokenSymbol} price feed does not exist at ${formatAddress(priceFeedAddress)}`);
      }
    }
  }
  
  // 4. Check Vault Configuration
  console.log("\n4. Checking Vault Configuration...");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // Check governance
    const vaultGov = await vault.gov();
    if (vaultGov.toLowerCase() === deploymentData.Timelock.toLowerCase()) {
      results.success.push(`Vault governance correctly set to Timelock: ${formatAddress(vaultGov)}`);
    } else {
      results.warning.push(`Vault governance set to ${formatAddress(vaultGov)}, expected Timelock: ${formatAddress(deploymentData.Timelock)}`);
    }
    
    // Check router
    const currentRouter = await vault.router();
    if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      results.success.push(`Vault Router correctly set to: ${formatAddress(currentRouter)}`);
    } else {
      results.error.push(`Vault Router mismatch! Current: ${formatAddress(currentRouter)}, Expected: ${formatAddress(deploymentData.Router)}`);
    }
    
    // Check whitelisted tokens
    const tokens = [
      { symbol: "WLD", address: deploymentData.WLD },
      { symbol: "WWORLD", address: deploymentData.WWORLD }
    ];
    
    for (const token of tokens) {
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      if (isWhitelisted) {
        results.success.push(`${token.symbol} is whitelisted in Vault`);
        
        // Check token configuration
        const tokenConfig = await vault.tokenDecimals(token.address);
        if (tokenConfig.toString() !== "0") {
          results.success.push(`${token.symbol} config is set with ${tokenConfig} decimals`);
        } else {
          results.warning.push(`${token.symbol} is whitelisted but config appears incomplete`);
        }
      } else {
        results.error.push(`${token.symbol} is NOT whitelisted in Vault`);
      }
    }
  } catch (error) {
    results.error.push(`Error checking Vault configuration: ${error.message}`);
  }
  
  // 5. Check VaultPriceFeed Configuration
  console.log("\n5. Checking VaultPriceFeed Configuration...");
  try {
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // Check governance
    const priceFeedGov = await vaultPriceFeed.gov();
    if (priceFeedGov.toLowerCase() === deploymentData.Timelock.toLowerCase()) {
      results.success.push(`VaultPriceFeed governance correctly set to Timelock: ${formatAddress(priceFeedGov)}`);
    } else {
      results.warning.push(`VaultPriceFeed governance set to ${formatAddress(priceFeedGov)}, expected Timelock: ${formatAddress(deploymentData.Timelock)}`);
    }
    
    // Check price feeds
    const tokens = [
      { symbol: "WLD", address: deploymentData.WLD, priceFeed: deploymentData.MockPriceFeeds.WLD },
      { symbol: "WWORLD", address: deploymentData.WWORLD, priceFeed: deploymentData.MockPriceFeeds.WWORLD }
    ];
    
    for (const token of tokens) {
      const configuredPriceFeed = await vaultPriceFeed.priceFeeds(token.address);
      if (configuredPriceFeed.toLowerCase() === token.priceFeed.toLowerCase()) {
        results.success.push(`${token.symbol} price feed correctly configured to ${formatAddress(configuredPriceFeed)}`);
        
        // Try to get price
        try {
          const price = await vaultPriceFeed.getPrice(token.address, false, true, true);
          results.success.push(`${token.symbol} price feed returned ${formatUnits(price, 30)} USD`);
        } catch (error) {
          results.warning.push(`Cannot get price for ${token.symbol}: ${error.message}`);
        }
      } else if (configuredPriceFeed === ethers.constants.AddressZero) {
        results.error.push(`${token.symbol} price feed not set in VaultPriceFeed`);
      } else {
        results.error.push(`${token.symbol} price feed mismatch! Current: ${formatAddress(configuredPriceFeed)}, Expected: ${formatAddress(token.priceFeed)}`);
      }
    }
  } catch (error) {
    results.error.push(`Error checking VaultPriceFeed configuration: ${error.message}`);
  }
  
  // 6. Check Router Configuration
  console.log("\n6. Checking Router Configuration...");
  try {
    const router = await ethers.getContractAt("Router", deploymentData.Router);
    
    // Check the Vault in Router
    const routerVault = await router.vault();
    if (routerVault.toLowerCase() === deploymentData.Vault.toLowerCase()) {
      results.success.push(`Router's Vault correctly set to: ${formatAddress(routerVault)}`);
    } else {
      results.error.push(`Router's Vault mismatch! Current: ${formatAddress(routerVault)}, Expected: ${formatAddress(deploymentData.Vault)}`);
    }
    
    // Check the USDG in Router
    const routerUSDG = await router.usdg();
    if (routerUSDG === ethers.constants.AddressZero) {
      results.warning.push(`Router's USDG not set yet`);
    } else {
      results.success.push(`Router's USDG set to: ${formatAddress(routerUSDG)}`);
    }
    
    // Check the whitelisted plugins
    try {
      const isOrderBookPlugin = await router.plugins(deploymentData.OrderBook);
      if (isOrderBookPlugin) {
        results.success.push(`OrderBook whitelisted as a Router plugin`);
      } else {
        results.warning.push(`OrderBook not whitelisted as a Router plugin`);
      }
      
      const isPositionRouterPlugin = await router.plugins(deploymentData.PositionRouter);
      if (isPositionRouterPlugin) {
        results.success.push(`PositionRouter whitelisted as a Router plugin`);
      } else {
        results.warning.push(`PositionRouter not whitelisted as a Router plugin`);
      }
    } catch (error) {
      results.warning.push(`Error checking Router plugins: ${error.message}`);
    }
  } catch (error) {
    results.error.push(`Error checking Router configuration: ${error.message}`);
  }
  
  // 7. Check PositionRouter Configuration
  console.log("\n7. Checking PositionRouter Configuration...");
  try {
    const positionRouter = await ethers.getContractAt("PositionRouter", deploymentData.PositionRouter);
    
    // Check the Router in PositionRouter
    const posRouterRouter = await positionRouter.router();
    if (posRouterRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      results.success.push(`PositionRouter's Router correctly set to: ${formatAddress(posRouterRouter)}`);
    } else {
      results.error.push(`PositionRouter's Router mismatch! Current: ${formatAddress(posRouterRouter)}, Expected: ${formatAddress(deploymentData.Router)}`);
    }
    
    // Check the Vault in PositionRouter
    const posRouterVault = await positionRouter.vault();
    if (posRouterVault.toLowerCase() === deploymentData.Vault.toLowerCase()) {
      results.success.push(`PositionRouter's Vault correctly set to: ${formatAddress(posRouterVault)}`);
    } else {
      results.error.push(`PositionRouter's Vault mismatch! Current: ${formatAddress(posRouterVault)}, Expected: ${formatAddress(deploymentData.Vault)}`);
    }
  } catch (error) {
    results.error.push(`Error checking PositionRouter configuration: ${error.message}`);
  }
  
  // 8. Check PositionManager Configuration
  console.log("\n8. Checking PositionManager Configuration...");
  try {
    const positionManager = await ethers.getContractAt("PositionManager", deploymentData.PositionManager);
    
    // Check the Router in PositionManager
    const posMgrRouter = await positionManager.router();
    if (posMgrRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      results.success.push(`PositionManager's Router correctly set to: ${formatAddress(posMgrRouter)}`);
    } else {
      results.error.push(`PositionManager's Router mismatch! Current: ${formatAddress(posMgrRouter)}, Expected: ${formatAddress(deploymentData.Router)}`);
    }
    
    // Check the Vault in PositionManager
    const posMgrVault = await positionManager.vault();
    if (posMgrVault.toLowerCase() === deploymentData.Vault.toLowerCase()) {
      results.success.push(`PositionManager's Vault correctly set to: ${formatAddress(posMgrVault)}`);
    } else {
      results.error.push(`PositionManager's Vault mismatch! Current: ${formatAddress(posMgrVault)}, Expected: ${formatAddress(deploymentData.Vault)}`);
    }
  } catch (error) {
    results.error.push(`Error checking PositionManager configuration: ${error.message}`);
  }
  
  // 9. Check OrderBook Configuration
  console.log("\n9. Checking OrderBook Configuration...");
  try {
    const orderBook = await ethers.getContractAt("OrderBook", deploymentData.OrderBook);
    
    // Check the Router in OrderBook
    const orderBookRouter = await orderBook.router();
    if (orderBookRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      results.success.push(`OrderBook's Router correctly set to: ${formatAddress(orderBookRouter)}`);
    } else {
      results.error.push(`OrderBook's Router mismatch! Current: ${formatAddress(orderBookRouter)}, Expected: ${formatAddress(deploymentData.Router)}`);
    }
    
    // Check the Vault in OrderBook
    const orderBookVault = await orderBook.vault();
    if (orderBookVault.toLowerCase() === deploymentData.Vault.toLowerCase()) {
      results.success.push(`OrderBook's Vault correctly set to: ${formatAddress(orderBookVault)}`);
    } else {
      results.error.push(`OrderBook's Vault mismatch! Current: ${formatAddress(orderBookVault)}, Expected: ${formatAddress(deploymentData.Vault)}`);
    }
  } catch (error) {
    results.error.push(`Error checking OrderBook configuration: ${error.message}`);
  }
  
  // 10. Check Governance/Timelock Configuration
  console.log("\n10. Checking Governance/Timelock Configuration...");
  try {
    const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
    
    // Check the admin of Timelock
    const timelockAdmin = await timelock.admin();
    if (timelockAdmin.toLowerCase() === deployer.address.toLowerCase()) {
      results.success.push(`Timelock admin correctly set to deployer: ${formatAddress(timelockAdmin)}`);
    } else {
      results.warning.push(`Timelock admin is not deployer. Current: ${formatAddress(timelockAdmin)}, Expected: ${formatAddress(deployer.address)}`);
    }
    
    // Check the buffer period
    const buffer = await timelock.buffer();
    results.success.push(`Timelock buffer set to ${buffer.toString()} seconds (${buffer.div(3600).toString()} hours)`);
    
    // List pending actions
    const pendingActionsFilter = timelock.filters.SignalPendingAction();
    const pendingEvents = await timelock.queryFilter(pendingActionsFilter);
    
    if (pendingEvents.length > 0) {
      results.warning.push(`Timelock has ${pendingEvents.length} pending governance actions`);
      for (const event of pendingEvents) {
        const action = event.args._action;
        const timestamp = await timelock.pendingActions(action);
        if (timestamp.toString() !== "0") {
          const readyTime = new Date(timestamp.toNumber() * 1000);
          results.warning.push(`Pending action ${action.substring(0, 10)}... executable after: ${readyTime.toLocaleString()}`);
        }
      }
    } else {
      results.success.push("No pending governance actions found");
    }
  } catch (error) {
    results.error.push(`Error checking Timelock configuration: ${error.message}`);
  }
  
  // 11. Check Custom Actions
  console.log("\n11. Checking Custom Actions Files...");
  const customActionFiles = [
    ".world-wld-whitelist-action.json",
    ".world-wworld-whitelist-action.json",
    ".world-wld-pricefeed-action.json",
    ".world-wworld-pricefeed-action.json"
  ];
  
  for (const actionFile of customActionFiles) {
    const filePath = path.join(__dirname, "../../", actionFile);
    if (fs.existsSync(filePath)) {
      try {
        const actionData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        results.warning.push(`Custom action file ${actionFile} exists with target: ${formatAddress(actionData.target)}`);
      } catch (error) {
        results.error.push(`Error reading custom action file ${actionFile}: ${error.message}`);
      }
    } else {
      results.success.push(`No custom action file ${actionFile} found - likely already executed`);
    }
  }
  
  // Print final validation report
  console.log("\n\n=== GMX DEPLOYMENT VALIDATION REPORT ===");
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
  
  console.log("\n=== VALIDATION SUMMARY ===");
  if (results.error.length === 0) {
    if (results.warning.length === 0) {
      console.log("✅ ALL CHECKS PASSED! The deployment looks perfect.");
    } else {
      console.log("⚠️ DEPLOYMENT CHECKS PASSED WITH WARNINGS - Review the warnings and address them if necessary.");
    }
  } else {
    console.log(`❌ DEPLOYMENT HAS ${results.error.length} ERRORS - These need to be fixed for proper operation.`);
  }
  
  // Provide next steps based on validation results
  console.log("\n=== NEXT STEPS ===");
  if (results.error.length > 0) {
    console.log("1. Fix the errors identified in the validation report.");
    console.log("2. Run the createWorldGov.js script again to create any missing governance actions.");
    console.log("3. Wait for the buffer period to elapse (usually 24 hours).");
    console.log("4. Execute the governance actions with executeWorldGov.js.");
    console.log("5. Run this validation script again to verify all issues are resolved.");
  } else if (results.warning.length > 0 && customActionFiles.some(file => fs.existsSync(path.join(__dirname, "../../", file)))) {
    console.log("1. Wait for the buffer period to elapse if you created governance actions recently.");
    console.log("2. Execute the governance actions with executeWorldGov.js.");
    console.log("3. Run this validation script again to verify all issues are resolved.");
  } else {
    console.log("1. Your deployment looks good! You can now proceed to test trading functionality.");
    console.log("2. Consider adding additional tokens if needed using the same governance process.");
    console.log("3. Remember to deploy actual price feeds instead of mocks for production use.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
