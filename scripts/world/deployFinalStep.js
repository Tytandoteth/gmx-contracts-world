const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Final step to deploy the PositionManager with the correct parameters
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING POSITION MANAGER (FINAL STEP)");
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
  
  // Verify required components exist
  if (!deploymentData.CustomShortsTracker) {
    console.error("❌ ShortsTracker not found in deployment data");
    process.exit(1);
  }
  
  if (!deploymentData.CustomOrderBook) {
    console.error("❌ OrderBook not found in deployment data");
    process.exit(1);
  }
  
  if (!deploymentData.CustomPositionUtils) {
    console.error("❌ PositionUtils not found in deployment data");
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
  
  // Deploy PositionManager
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING POSITION MANAGER");
  console.log("------------------------------------------------------");
  
  if (!deploymentData.CustomPositionManager) {
    console.log("Deploying PositionManager...");
    
    // Create a modified factory with PositionUtils linked
    const PositionManager = await ethers.getContractFactory("PositionManager", {
      libraries: {
        PositionUtils: deploymentData.CustomPositionUtils
      }
    });
    
    // Constructor params for PositionManager:
    // address _vault,
    // address _router,
    // address _shortsTracker,
    // address _weth,
    // uint256 _depositFee,
    // address _orderBook
    const positionManager = await PositionManager.deploy(
      deploymentData.CustomVault,       // _vault
      deploymentData.CustomRouter,      // _router
      deploymentData.CustomShortsTracker, // _shortsTracker
      deploymentData.WETH,              // _weth
      0,                                // _depositFee - set to zero for now
      deploymentData.CustomOrderBook    // _orderBook
    );
    
    await positionManager.deployed();
    deploymentData.CustomPositionManager = positionManager.address;
    console.log(`✅ PositionManager deployed at: ${positionManager.address}`);
    
    // Set positionManager in shortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deploymentData.CustomShortsTracker);
    await shortsTracker.setHandler(positionManager.address, true);
    console.log("✅ Set PositionManager as handler in ShortsTracker");
    
    // Set positionManager as a plugin in Router
    const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
    await router.addPlugin(positionManager.address);
    console.log("✅ PositionManager added as Router plugin");
    
    // Set order keeper and liquidator roles
    await positionManager.setOrderKeeper(deployer.address, true);
    console.log("✅ Set deployer as order keeper");
    
    await positionManager.setLiquidator(deployer.address, true);
    console.log("✅ Set deployer as liquidator");
  } else {
    console.log(`Using existing PositionManager: ${deploymentData.CustomPositionManager}`);
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
