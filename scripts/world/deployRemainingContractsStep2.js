const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy remaining contract components after PositionUtils is deployed.
 * 
 * This deploys:
 * 1. PositionRouter - For position management
 * 2. PositionManager - For advanced position control
 * 3. Configures tokens for trading
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING REMAINING GMX CONTRACTS (STEP 2)");
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
  
  // Verify PositionUtils is deployed
  if (!deploymentData.CustomPositionUtils) {
    console.error("❌ PositionUtils not found in deployment data. Please run deployPositionUtils.js first.");
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  console.log(`Router address: ${deploymentData.CustomRouter}`);
  console.log(`ShortsTracker address: ${deploymentData.CustomShortsTracker}`);
  console.log(`OrderBook address: ${deploymentData.CustomOrderBook}`);
  console.log(`PositionUtils address: ${deploymentData.CustomPositionUtils}`);
  
  // 1. Deploy PositionRouter
  console.log("\n------------------------------------------------------");
  console.log("1. DEPLOYING POSITION ROUTER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionRouter) {
    try {
      console.log("Deploying PositionRouter...");
      
      // Create a modified factory with PositionUtils linked
      const PositionRouter = await ethers.getContractFactory("PositionRouter", {
        libraries: {
          PositionUtils: deploymentData.CustomPositionUtils
        }
      });
      
      const positionRouter = await PositionRouter.deploy(
        deploymentData.CustomVault,
        deploymentData.CustomRouter,
        deploymentData.WETH, // weth 
        deploymentData.CustomShortsTracker,
        ethers.utils.parseUnits("30", "gwei"), // minExecutionFee, 30 gwei
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
    } catch (error) {
      console.error("Error deploying PositionRouter:", error.message);
      process.exit(1);
    }
  } else {
    console.log(`Using existing PositionRouter: ${deploymentData.CustomPositionRouter}`);
  }
  
  // 2. Deploy PositionManager
  console.log("\n------------------------------------------------------");
  console.log("2. DEPLOYING POSITION MANAGER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionManager) {
    try {
      console.log("Deploying PositionManager...");
      
      // Create a modified factory with PositionUtils linked
      const PositionManager = await ethers.getContractFactory("PositionManager", {
        libraries: {
          PositionUtils: deploymentData.CustomPositionUtils
        }
      });
      
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
    } catch (error) {
      console.error("Error deploying PositionManager:", error.message);
      process.exit(1);
    }
  } else {
    console.log(`Using existing PositionManager: ${deploymentData.CustomPositionManager}`);
  }
  
  // 3. Configure the Vault to whitelist tokens
  console.log("\n------------------------------------------------------");
  console.log("3. CONFIGURING VAULT WHITELISTS");
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
  
  // Save updated deployment data
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
  console.log(`- PositionRouter: ${deploymentData.CustomPositionRouter}`);
  console.log(`- PositionManager: ${deploymentData.CustomPositionManager}`);
  console.log(`- PositionUtils: ${deploymentData.CustomPositionUtils}`);
  
  console.log("\nTo verify the complete deployment, run:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeployment.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
