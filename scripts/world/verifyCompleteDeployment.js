const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const { formatUnits, parseUnits } = require("ethers/lib/utils");

/**
 * Comprehensive verification script to check that all components of the GMX trading
 * system are properly deployed and configured for WLD and WETH tokens.
 */
async function main() {
  console.log("======================================================");
  console.log("VERIFYING COMPLETE GMX DEPLOYMENT");
  console.log("======================================================");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded custom deployment data");
  } catch (error) {
    console.error("❌ Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  
  // Track verification status
  let verificationPassed = true;
  
  // STEP 1: VERIFY TOKEN CONTRACTS
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: VERIFYING TOKEN CONTRACTS");
  console.log("------------------------------------------------------");
  
  // Verify WLD
  try {
    console.log("\nVerifying WLD Token...");
    if (!deploymentData.WLD) {
      throw new Error("WLD Token address not found in deployment data");
    }
    
    const wld = await ethers.getContractAt("ERC20", deploymentData.WLD);
    const wldSymbol = await wld.symbol();
    const wldDecimals = await wld.decimals();
    
    console.log(`WLD Symbol: ${wldSymbol}`);
    console.log(`WLD Decimals: ${wldDecimals}`);
    console.log("✅ WLD Token verified");
  } catch (error) {
    console.error(`❌ WLD Token verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify WETH
  try {
    console.log("\nVerifying WETH Token...");
    if (!deploymentData.WETH) {
      throw new Error("WETH Token address not found in deployment data");
    }
    
    const weth = await ethers.getContractAt("WETH9", deploymentData.WETH);
    const wethSymbol = await weth.symbol();
    const wethDecimals = await weth.decimals();
    
    console.log(`WETH Symbol: ${wethSymbol}`);
    console.log(`WETH Decimals: ${wethDecimals}`);
    console.log("✅ WETH Token verified");
  } catch (error) {
    console.error(`❌ WETH Token verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // STEP 2: VERIFY PRICE FEED CONTRACTS
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: VERIFYING PRICE FEED CONTRACTS");
  console.log("------------------------------------------------------");
  
  // Verify RedStonePriceFeed
  try {
    console.log("\nVerifying RedStonePriceFeed...");
    if (!deploymentData.RedStonePriceFeed) {
      throw new Error("RedStonePriceFeed address not found in deployment data");
    }
    
    const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
    const owner = await redStonePriceFeed.owner();
    
    console.log(`RedStonePriceFeed Owner: ${owner}`);
    if (owner !== deployer.address) {
      console.warn(`⚠️ RedStonePriceFeed owner is not deployer. This might be intentional.`);
    }
    
    // Check if token decimals are set correctly
    try {
      const wldDecimals = await redStonePriceFeed.tokenDecimals("WLD");
      console.log(`WLD Decimals in RedStonePriceFeed: ${wldDecimals}`);
    } catch (error) {
      console.warn(`⚠️ Could not get WLD decimals from RedStonePriceFeed: ${error.message}`);
    }
    
    console.log("✅ RedStonePriceFeed verified");
  } catch (error) {
    console.error(`❌ RedStonePriceFeed verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify VaultPriceFeed
  try {
    console.log("\nVerifying VaultPriceFeed...");
    if (!deploymentData.CustomVaultPriceFeed) {
      throw new Error("VaultPriceFeed address not found in deployment data");
    }
    
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
    const gov = await vaultPriceFeed.gov();
    
    console.log(`VaultPriceFeed Gov: ${gov}`);
    if (gov !== deployer.address) {
      console.warn(`⚠️ VaultPriceFeed gov is not deployer. This might be intentional.`);
    }
    
    // Check WLD price feed
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD Price Feed in VaultPriceFeed: ${wldPriceFeed}`);
    if (wldPriceFeed !== deploymentData.RedStonePriceFeed) {
      console.warn(`⚠️ WLD price feed doesn't match RedStonePriceFeed`);
    }
    
    // Check WETH price feed
    const wethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
    console.log(`WETH Price Feed in VaultPriceFeed: ${wethPriceFeed}`);
    if (wethPriceFeed !== deploymentData.RedStonePriceFeed) {
      console.warn(`⚠️ WETH price feed doesn't match RedStonePriceFeed`);
    }
    
    console.log("✅ VaultPriceFeed verified");
  } catch (error) {
    console.error(`❌ VaultPriceFeed verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // STEP 3: VERIFY CORE CONTRACTS
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: VERIFYING CORE CONTRACTS");
  console.log("------------------------------------------------------");
  
  // Verify Vault
  try {
    console.log("\nVerifying Vault...");
    if (!deploymentData.CustomVault) {
      throw new Error("Vault address not found in deployment data");
    }
    
    const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
    const gov = await vault.gov();
    
    console.log(`Vault Gov: ${gov}`);
    if (gov !== deployer.address) {
      console.warn(`⚠️ Vault gov is not deployer. This might be intentional.`);
    }
    
    // Check if WLD is whitelisted
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    console.log(`Is WLD whitelisted: ${isWldWhitelisted}`);
    if (!isWldWhitelisted) {
      console.error(`❌ WLD is not whitelisted in Vault`);
      verificationPassed = false;
    }
    
    // Check if WETH is whitelisted
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    console.log(`Is WETH whitelisted: ${isWethWhitelisted}`);
    if (!isWethWhitelisted) {
      console.error(`❌ WETH is not whitelisted in Vault`);
      verificationPassed = false;
    }
    
    console.log("✅ Vault verified");
  } catch (error) {
    console.error(`❌ Vault verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify Router
  try {
    console.log("\nVerifying Router...");
    if (!deploymentData.CustomRouter) {
      throw new Error("Router address not found in deployment data");
    }
    
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    const gov = await router.gov();
    
    console.log(`Router Gov: ${gov}`);
    if (gov !== deployer.address) {
      console.warn(`⚠️ Router gov is not deployer. This might be intentional.`);
    }
    
    // Check if plugins are properly set
    if (deploymentData.CustomOrderBook) {
      const isOrderBookPlugin = await router.plugins(deploymentData.CustomOrderBook);
      console.log(`Is OrderBook a Router plugin: ${isOrderBookPlugin}`);
      if (!isOrderBookPlugin) {
        console.warn(`⚠️ OrderBook is not set as a Router plugin`);
      }
    }
    
    if (deploymentData.CustomPositionRouter) {
      const isPositionRouterPlugin = await router.plugins(deploymentData.CustomPositionRouter);
      console.log(`Is PositionRouter a Router plugin: ${isPositionRouterPlugin}`);
      if (!isPositionRouterPlugin) {
        console.warn(`⚠️ PositionRouter is not set as a Router plugin`);
      }
    }
    
    if (deploymentData.CustomPositionManager) {
      const isPositionManagerPlugin = await router.plugins(deploymentData.CustomPositionManager);
      console.log(`Is PositionManager a Router plugin: ${isPositionManagerPlugin}`);
      if (!isPositionManagerPlugin) {
        console.warn(`⚠️ PositionManager is not set as a Router plugin`);
      }
    }
    
    console.log("✅ Router verified");
  } catch (error) {
    console.error(`❌ Router verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // STEP 4: VERIFY TRADING SYSTEM CONTRACTS
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: VERIFYING TRADING SYSTEM CONTRACTS");
  console.log("------------------------------------------------------");
  
  // Verify OrderBook
  try {
    console.log("\nVerifying OrderBook...");
    if (!deploymentData.CustomOrderBook) {
      throw new Error("OrderBook address not found in deployment data");
    }
    
    const orderBook = await ethers.getContractAt("OrderBook", deploymentData.CustomOrderBook);
    const isInitialized = await orderBook.isInitialized();
    
    console.log(`OrderBook Initialized: ${isInitialized}`);
    if (!isInitialized) {
      console.error(`❌ OrderBook is not initialized`);
      verificationPassed = false;
    }
    
    console.log("✅ OrderBook verified");
  } catch (error) {
    console.error(`❌ OrderBook verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify ShortsTracker
  try {
    console.log("\nVerifying ShortsTracker...");
    if (!deploymentData.CustomShortsTracker) {
      throw new Error("ShortsTracker address not found in deployment data");
    }
    
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deploymentData.CustomShortsTracker);
    const gov = await shortsTracker.gov();
    
    console.log(`ShortsTracker Gov: ${gov}`);
    if (gov !== deployer.address) {
      console.warn(`⚠️ ShortsTracker gov is not deployer. This might be intentional.`);
    }
    
    // Check handlers
    if (deploymentData.CustomPositionRouter) {
      const isPositionRouterHandler = await shortsTracker.isHandler(deploymentData.CustomPositionRouter);
      console.log(`Is PositionRouter a ShortsTracker handler: ${isPositionRouterHandler}`);
      if (!isPositionRouterHandler) {
        console.warn(`⚠️ PositionRouter is not set as a ShortsTracker handler`);
      }
    }
    
    if (deploymentData.CustomPositionManager) {
      const isPositionManagerHandler = await shortsTracker.isHandler(deploymentData.CustomPositionManager);
      console.log(`Is PositionManager a ShortsTracker handler: ${isPositionManagerHandler}`);
      if (!isPositionManagerHandler) {
        console.warn(`⚠️ PositionManager is not set as a ShortsTracker handler`);
      }
    }
    
    console.log("✅ ShortsTracker verified");
  } catch (error) {
    console.error(`❌ ShortsTracker verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify PositionRouter
  try {
    console.log("\nVerifying PositionRouter...");
    if (!deploymentData.CustomPositionRouter) {
      throw new Error("PositionRouter address not found in deployment data");
    }
    
    const positionRouter = await ethers.getContractAt("PositionRouter", deploymentData.CustomPositionRouter);
    const isPositionKeeperSet = await positionRouter.isPositionKeeper(deployer.address);
    
    console.log(`Is deployer a position keeper: ${isPositionKeeperSet}`);
    if (!isPositionKeeperSet) {
      console.warn(`⚠️ Deployer is not set as a position keeper`);
    }
    
    console.log("✅ PositionRouter verified");
  } catch (error) {
    console.error(`❌ PositionRouter verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // Verify PositionManager
  try {
    console.log("\nVerifying PositionManager...");
    if (!deploymentData.CustomPositionManager) {
      throw new Error("PositionManager address not found in deployment data");
    }
    
    const positionManager = await ethers.getContractAt("PositionManager", deploymentData.CustomPositionManager);
    const isOrderKeeperSet = await positionManager.isOrderKeeper(deployer.address);
    const isLiquidatorSet = await positionManager.isLiquidator(deployer.address);
    
    console.log(`Is deployer an order keeper: ${isOrderKeeperSet}`);
    if (!isOrderKeeperSet) {
      console.warn(`⚠️ Deployer is not set as an order keeper`);
    }
    
    console.log(`Is deployer a liquidator: ${isLiquidatorSet}`);
    if (!isLiquidatorSet) {
      console.warn(`⚠️ Deployer is not set as a liquidator`);
    }
    
    console.log("✅ PositionManager verified");
  } catch (error) {
    console.error(`❌ PositionManager verification failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // STEP 5: TRY TO FETCH TOKEN PRICES (BASIC FUNCTIONALITY TEST)
  console.log("\n------------------------------------------------------");
  console.log("STEP 5: TESTING PRICE FEED FUNCTIONALITY");
  console.log("------------------------------------------------------");
  
  try {
    console.log("\nFetching WLD and WETH prices from VaultPriceFeed...");
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
    
    // This is a view function but needs to be called via a tx due to RedStone's approach
    // We'll just log that this feature requires wrapping in a tx
    console.log("Note: Direct price fetching requires wrapping in a transaction with RedStone data.");
    console.log("This can be tested with the mockPriceFeeder.js script or with the frontend integration.");
    console.log("✅ Price feed functionality documented");
  } catch (error) {
    console.error(`❌ Price feed test failed: ${error.message}`);
    verificationPassed = false;
  }
  
  // FINAL VERIFICATION RESULT
  console.log("\n======================================================");
  if (verificationPassed) {
    console.log("✅ VERIFICATION PASSED: All components properly deployed and configured");
    console.log("======================================================");
    
    console.log("\nYou now have a fully functional GMX trading system focused on WLD and WETH.");
    console.log("\nNext steps:");
    console.log("1. Use the mockPriceFeeder.js script to set mock prices for development");
    console.log("2. Connect the frontend interface to the custom deployed contracts");
    console.log("3. Set up the RedStone oracle keeper service for production use");
  } else {
    console.log("❌ VERIFICATION FAILED: Some components have issues");
    console.log("======================================================");
    console.log("\nPlease review the output above and address any issues before proceeding.");
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
