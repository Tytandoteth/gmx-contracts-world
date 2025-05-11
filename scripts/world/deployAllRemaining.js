const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive script to deploy all remaining components of the GMX trading system
 * in the correct order and with proper dependencies
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING ALL REMAINING GMX CONTRACTS");
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
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  console.log(`Router address: ${deploymentData.CustomRouter}`);
  
  const { AddressZero } = ethers.constants;
  
  // STEP 1: ENSURE USDG IS DEPLOYED
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: CHECKING USDG");
  console.log("------------------------------------------------------");
  
  // Check for USDG
  let usdgAddress = deploymentData.CustomUSDG;
  
  // If no USDG, deploy it (required for OrderBook)
  if (!usdgAddress) {
    console.log("USDG not found in deployment data, deploying...");
    const USDG = await ethers.getContractFactory("USDG");
    const usdg = await USDG.deploy(deploymentData.CustomVault);
    await usdg.deployed();
    deploymentData.CustomUSDG = usdg.address;
    usdgAddress = usdg.address;
    console.log(`USDG deployed at: ${usdg.address}`);
  } else {
    console.log(`Using existing USDG: ${usdgAddress}`);
  }
  
  // Save updated deployment data after USDG
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 2: DEPLOY SHORTS TRACKER
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: DEPLOYING SHORTS TRACKER");
  console.log("------------------------------------------------------");
  
  let shortsTrackerAddress;
  
  if (!deploymentData.CustomShortsTracker) {
    console.log("Deploying ShortsTracker...");
    const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
    const shortsTracker = await ShortsTracker.deploy(deploymentData.CustomVault);
    await shortsTracker.deployed();
    deploymentData.CustomShortsTracker = shortsTracker.address;
    shortsTrackerAddress = shortsTracker.address;
    console.log(`ShortsTracker deployed at: ${shortsTracker.address}`);
    
    // Set gov of ShortsTracker to deployer
    await shortsTracker.setGov(deployer.address);
    console.log("Set ShortsTracker governance to deployer");
  } else {
    shortsTrackerAddress = deploymentData.CustomShortsTracker;
    console.log(`Using existing ShortsTracker: ${shortsTrackerAddress}`);
  }
  
  // Save updated deployment data after ShortsTracker
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 3: DEPLOY ORDER BOOK
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: DEPLOYING ORDER BOOK");
  console.log("------------------------------------------------------");
  
  let orderBookAddress;
  
  if (!deploymentData.CustomOrderBook) {
    console.log("Deploying OrderBook...");
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy();
    await orderBook.deployed();
    deploymentData.CustomOrderBook = orderBook.address;
    orderBookAddress = orderBook.address;
    console.log(`OrderBook deployed at: ${orderBook.address}`);
    
    // Initialize OrderBook
    console.log("Initializing OrderBook...");
    
    // OrderBook initialize requires 6 parameters:
    // _router, _vault, _weth, _usdg, _minExecutionFee, _minPurchaseTokenAmountUsd
    await orderBook.initialize(
      deploymentData.CustomRouter,        // router
      deploymentData.CustomVault,         // vault
      deploymentData.WETH,                // weth
      deploymentData.CustomUSDG,          // usdg
      ethers.utils.parseEther("0.001"),   // minExecutionFee (0.001 WETH)
      expandDecimals(10, 30)              // minPurchaseTokenAmountUsd ($10 USD)
    );
    console.log("OrderBook initialized");
    
    // Add OrderBook as a Router plugin
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(orderBook.address);
    console.log("OrderBook added as Router plugin");
  } else {
    orderBookAddress = deploymentData.CustomOrderBook;
    console.log(`Using existing OrderBook: ${orderBookAddress}`);
  }
  
  // Save updated deployment data after OrderBook
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 4: DEPLOY POSITION UTILS
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: DEPLOYING POSITION UTILS");
  console.log("------------------------------------------------------");
  
  let positionUtilsAddress;
  
  if (!deploymentData.CustomPositionUtils) {
    console.log("Deploying PositionUtils...");
    const PositionUtils = await ethers.getContractFactory("PositionUtils");
    const positionUtils = await PositionUtils.deploy();
    await positionUtils.deployed();
    deploymentData.CustomPositionUtils = positionUtils.address;
    positionUtilsAddress = positionUtils.address;
    console.log(`PositionUtils deployed at: ${positionUtils.address}`);
  } else {
    positionUtilsAddress = deploymentData.CustomPositionUtils;
    console.log(`Using existing PositionUtils: ${positionUtilsAddress}`);
  }
  
  // Save updated deployment data after PositionUtils
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 5: DEPLOY POSITION ROUTER
  console.log("\n------------------------------------------------------");
  console.log("STEP 5: DEPLOYING POSITION ROUTER");
  console.log("------------------------------------------------------");
  
  let positionRouterAddress;
  
  if (!deploymentData.CustomPositionRouter) {
    console.log("Deploying PositionRouter...");
    
    // Create a modified factory with PositionUtils linked
    const PositionRouter = await ethers.getContractFactory("PositionRouter", {
      libraries: {
        PositionUtils: positionUtilsAddress
      }
    });
    
    const positionRouter = await PositionRouter.deploy(
      deploymentData.CustomVault,
      deploymentData.CustomRouter,
      deploymentData.WETH, // weth 
      shortsTrackerAddress,
      ethers.utils.parseUnits("30", "gwei"), // minExecutionFee, 30 gwei
      600, // minBlockDelayKeeper, 10 minutes
      600 // minTimeDelayPublic, 10 minutes
    );
    
    await positionRouter.deployed();
    deploymentData.CustomPositionRouter = positionRouter.address;
    positionRouterAddress = positionRouter.address;
    console.log(`PositionRouter deployed at: ${positionRouter.address}`);
    
    // Set positionRouter in shortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", shortsTrackerAddress);
    await shortsTracker.setHandler(positionRouter.address, true);
    console.log("Set PositionRouter as handler in ShortsTracker");
    
    // Set positionRouter as a plugin in Router
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(positionRouter.address);
    console.log("PositionRouter added as Router plugin");
    
    // Set callbacks in positionRouter
    await positionRouter.setCallbackGasLimit(1_000_000); // 1 million gas
    console.log("Set PositionRouter callback gas limit to 1M");
    
    // Set position keeper
    await positionRouter.setPositionKeeper(deployer.address, true);
    console.log("Set deployer as position keeper");
  } else {
    positionRouterAddress = deploymentData.CustomPositionRouter;
    console.log(`Using existing PositionRouter: ${positionRouterAddress}`);
  }
  
  // Save updated deployment data after PositionRouter
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 6: DEPLOY POSITION MANAGER
  console.log("\n------------------------------------------------------");
  console.log("STEP 6: DEPLOYING POSITION MANAGER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionManager) {
    console.log("Deploying PositionManager...");
    
    // Create a modified factory with PositionUtils linked
    const PositionManager = await ethers.getContractFactory("PositionManager", {
      libraries: {
        PositionUtils: positionUtilsAddress
      }
    });
    
    const positionManager = await PositionManager.deploy(
      deploymentData.CustomVault,
      deploymentData.CustomRouter,
      shortsTrackerAddress,
      deploymentData.WETH // weth
    );
    
    await positionManager.deployed();
    deploymentData.CustomPositionManager = positionManager.address;
    console.log(`PositionManager deployed at: ${positionManager.address}`);
    
    // Set positionManager in shortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", shortsTrackerAddress);
    await shortsTracker.setHandler(positionManager.address, true);
    console.log("Set PositionManager as handler in ShortsTracker");
    
    // Set positionManager as a plugin in Router
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(positionManager.address);
    console.log("PositionManager added as Router plugin");
  } else {
    console.log(`Using existing PositionManager: ${deploymentData.CustomPositionManager}`);
  }
  
  // Save updated deployment data after PositionManager
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 7: CONFIGURE THE VAULT FOR TOKEN TRADING
  console.log("\n------------------------------------------------------");
  console.log("STEP 7: CONFIGURING VAULT WHITELISTS");
  console.log("------------------------------------------------------");
  
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Whitelist WLD token for trading
  try {
    console.log("Whitelisting WLD for trading...");
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    if (!isWldWhitelisted) {
      await vault.setTokenConfig(
        deploymentData.WLD,  // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      console.log("✅ WLD whitelisted for trading");
    } else {
      console.log("✅ WLD already whitelisted for trading");
    }
  } catch (error) {
    console.error("Error whitelisting WLD:", error.message);
  }
  
  // Whitelist WETH token for trading
  try {
    console.log("Whitelisting WETH for trading...");
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    if (!isWethWhitelisted) {
      await vault.setTokenConfig(
        deploymentData.WETH, // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      console.log("✅ WETH whitelisted for trading");
    } else {
      console.log("✅ WETH already whitelisted for trading");
    }
  } catch (error) {
    console.error("Error whitelisting WETH:", error.message);
  }
  
  // Save final deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\n✅ Deployment data updated successfully");
  
  console.log("\n======================================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log("\nThe following contracts have been deployed and configured:");
  console.log(`- WLD Token: ${deploymentData.WLD}`);
  console.log(`- WETH Token: ${deploymentData.WETH}`);
  console.log(`- VaultPriceFeed: ${deploymentData.CustomVaultPriceFeed}`);
  console.log(`- RedStonePriceFeed: ${deploymentData.RedStonePriceFeed}`);
  console.log(`- Vault: ${deploymentData.CustomVault}`);
  console.log(`- Router: ${deploymentData.CustomRouter}`);
  console.log(`- VaultUtils: ${deploymentData.CustomVaultUtils}`);
  console.log(`- USDG: ${deploymentData.CustomUSDG}`);
  console.log(`- ShortsTracker: ${deploymentData.CustomShortsTracker}`);
  console.log(`- OrderBook: ${deploymentData.CustomOrderBook}`);
  console.log(`- PositionUtils: ${deploymentData.CustomPositionUtils}`);
  console.log(`- PositionRouter: ${deploymentData.CustomPositionRouter}`);
  console.log(`- PositionManager: ${deploymentData.CustomPositionManager}`);
  
  console.log("\nTo verify the complete deployment, run:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeployment.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
