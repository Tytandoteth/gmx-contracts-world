const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy remaining contract components needed for a fully functional
 * GMX trading system focused on WLD and WETH.
 * 
 * This deploys:
 * 1. ShortsTracker - For tracking short positions
 * 2. OrderBook - For limit orders
 * 3. PositionRouter - For position management
 * 4. PositionManager - For advanced position control
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING REMAINING GMX CONTRACTS");
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
  
  // 1. Deploy ShortsTracker
  console.log("\n------------------------------------------------------");
  console.log("1. DEPLOYING SHORTS TRACKER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomShortsTracker) {
    console.log("Deploying ShortsTracker...");
    const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
    const shortsTracker = await ShortsTracker.deploy(deploymentData.CustomVault);
    await shortsTracker.deployed();
    deploymentData.CustomShortsTracker = shortsTracker.address;
    console.log(`ShortsTracker deployed at: ${shortsTracker.address}`);
    
    // Set gov of ShortsTracker to deployer
    await shortsTracker.setGov(deployer.address);
    console.log("Set ShortsTracker governance to deployer");
  } else {
    console.log(`Using existing ShortsTracker: ${deploymentData.CustomShortsTracker}`);
  }
  
  // 2. Deploy OrderBook
  console.log("\n------------------------------------------------------");
  console.log("2. DEPLOYING ORDER BOOK");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomOrderBook) {
    console.log("Deploying OrderBook...");
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy();
    await orderBook.deployed();
    deploymentData.CustomOrderBook = orderBook.address;
    console.log(`OrderBook deployed at: ${orderBook.address}`);
    
    // Initialize OrderBook
    console.log("Initializing OrderBook...");
    await orderBook.initialize(
      deploymentData.CustomRouter,
      deploymentData.CustomVault,
      deploymentData.WETH, // native token address
      "10000000000000000" // min bid size: 0.01 native token
    );
    console.log("OrderBook initialized");
    
    // Add OrderBook as a Router plugin
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(orderBook.address);
    console.log("OrderBook added as Router plugin");
  } else {
    console.log(`Using existing OrderBook: ${deploymentData.CustomOrderBook}`);
  }
  
  // 3. Deploy PositionRouter
  console.log("\n------------------------------------------------------");
  console.log("3. DEPLOYING POSITION ROUTER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionRouter) {
    console.log("Deploying PositionRouter...");
    const PositionRouter = await ethers.getContractFactory("PositionRouter");
    const positionRouter = await PositionRouter.deploy(
      deploymentData.CustomVault,
      deploymentData.CustomRouter,
      deploymentData.WETH, // weth 
      deploymentData.CustomShortsTracker,
      30, // minExecutionFee, 0.0000003 ETH
      600, // minBlockDelayKeeper, 10 minutes
      600 // minTimeDelayPublic, 10 minutes
    );
    await positionRouter.deployed();
    deploymentData.CustomPositionRouter = positionRouter.address;
    console.log(`PositionRouter deployed at: ${positionRouter.address}`);
    
    // Set positionRouter in shortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deploymentData.CustomShortsTracker);
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
    console.log(`Using existing PositionRouter: ${deploymentData.CustomPositionRouter}`);
  }
  
  // 4. Deploy PositionManager
  console.log("\n------------------------------------------------------");
  console.log("4. DEPLOYING POSITION MANAGER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionManager) {
    console.log("Deploying PositionManager...");
    const PositionManager = await ethers.getContractFactory("PositionManager");
    const positionManager = await PositionManager.deploy(
      deploymentData.CustomVault,
      deploymentData.CustomRouter,
      deploymentData.CustomShortsTracker,
      deploymentData.WETH // weth
    );
    await positionManager.deployed();
    deploymentData.CustomPositionManager = positionManager.address;
    console.log(`PositionManager deployed at: ${positionManager.address}`);
    
    // Set positionManager in shortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deploymentData.CustomShortsTracker);
    await shortsTracker.setHandler(positionManager.address, true);
    console.log("Set PositionManager as handler in ShortsTracker");
    
    // Set positionManager as a plugin in Router
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(positionManager.address);
    console.log("PositionManager added as Router plugin");
  } else {
    console.log(`Using existing PositionManager: ${deploymentData.CustomPositionManager}`);
  }
  
  // 5. Deploy PositionUtils if not already deployed
  console.log("\n------------------------------------------------------");
  console.log("5. DEPLOYING POSITION UTILS");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionUtils) {
    try {
      console.log("Deploying PositionUtils...");
      const PositionUtils = await ethers.getContractFactory("PositionUtils");
      const positionUtils = await PositionUtils.deploy();
      await positionUtils.deployed();
      deploymentData.CustomPositionUtils = positionUtils.address;
      console.log(`PositionUtils deployed at: ${positionUtils.address}`);
    } catch (error) {
      console.log(`Note: PositionUtils deployment skipped. It might not be required in this version: ${error.message}`);
    }
  } else {
    console.log(`Using existing PositionUtils: ${deploymentData.CustomPositionUtils}`);
  }
  
  // Save updated deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\n✅ Deployment data updated successfully");
  
  console.log("\n======================================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log("\nThe following contracts have been deployed and configured:");
  console.log(`- ShortsTracker: ${deploymentData.CustomShortsTracker}`);
  console.log(`- OrderBook: ${deploymentData.CustomOrderBook}`);
  console.log(`- PositionRouter: ${deploymentData.CustomPositionRouter}`);
  console.log(`- PositionManager: ${deploymentData.CustomPositionManager}`);
  if (deploymentData.CustomPositionUtils) {
    console.log(`- PositionUtils: ${deploymentData.CustomPositionUtils}`);
  }
  
  console.log("\nTo verify the complete deployment, run:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeployment.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
