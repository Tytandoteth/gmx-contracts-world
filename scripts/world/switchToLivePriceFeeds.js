const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * This script transitions the system from development (mock price feeds)
 * to production mode using RedStonePriceFeed for live data
 */
async function main() {
  console.log("======================================================");
  console.log("SWITCHING TO LIVE PRICE FEEDS (PRODUCTION MODE)");
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
  
  // Connect to VaultPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING VAULTPRICEFEED FOR LIVE DATA");
  console.log("------------------------------------------------------");
  
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  console.log(`RedStonePriceFeed address: ${deploymentData.RedStonePriceFeed}`);
  
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Check current configuration
  console.log("\nCurrent price feed configuration:");
  
  let wldPriceFeed;
  let wethPriceFeed;
  
  try {
    wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD price feed: ${wldPriceFeed}`);
  } catch (error) {
    console.warn(`Error checking WLD price feed: ${error.message}`);
  }
  
  try {
    wethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
    console.log(`WETH price feed: ${wethPriceFeed}`);
  } catch (error) {
    console.warn(`Error checking WETH price feed: ${error.message}`);
  }
  
  // Update price feeds to use RedStonePriceFeed
  console.log("\nUpdating price feeds to use RedStonePriceFeed...");
  
  try {
    // Set WLD price feed to RedStonePriceFeed
    console.log(`Setting WLD price feed to RedStonePriceFeed...`);
    let tx = await vaultPriceFeed.setPriceFeed(
      deploymentData.WLD, 
      deploymentData.RedStonePriceFeed
    );
    await tx.wait();
    console.log("✅ WLD price feed updated successfully");
    
    // Set WETH price feed to RedStonePriceFeed
    console.log(`Setting WETH price feed to RedStonePriceFeed...`);
    tx = await vaultPriceFeed.setPriceFeed(
      deploymentData.WETH,
      deploymentData.RedStonePriceFeed
    );
    await tx.wait();
    console.log("✅ WETH price feed updated successfully");
    
  } catch (error) {
    console.error(`❌ Error updating price feeds: ${error.message}`);
  }
  
  // Verify updated configuration
  console.log("\nVerifying updated price feed configuration:");
  
  try {
    wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD price feed: ${wldPriceFeed}`);
    
    if (wldPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase()) {
      console.log("✅ WLD is now using RedStonePriceFeed");
    } else {
      console.log("⚠️ WLD is not using RedStonePriceFeed");
    }
  } catch (error) {
    console.warn(`Error checking WLD price feed: ${error.message}`);
  }
  
  try {
    wethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
    console.log(`WETH price feed: ${wethPriceFeed}`);
    
    if (wethPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase()) {
      console.log("✅ WETH is now using RedStonePriceFeed");
    } else {
      console.log("⚠️ WETH is not using RedStonePriceFeed");
    }
  } catch (error) {
    console.warn(`Error checking WETH price feed: ${error.message}`);
  }
  
  // Configure RedStonePriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING REDSTONEPRICEFEED");
  console.log("------------------------------------------------------");
  
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
  
  // Setup RedStonePriceFeed with proper data feed IDs
  console.log("\nConfiguring data feed IDs for tokens...");
  
  try {
    // Configure WLD data feed ID (usually the token symbol)
    console.log("Setting WLD data feed ID...");
    const wldFeedId = ethers.utils.formatBytes32String("WLD");
    let tx = await redStonePriceFeed.setDataFeedId(deploymentData.WLD, wldFeedId);
    await tx.wait();
    console.log("✅ WLD data feed ID set successfully");
    
    // Configure WETH data feed ID
    console.log("Setting WETH data feed ID...");
    const wethFeedId = ethers.utils.formatBytes32String("ETH");  // Note: RedStone typically uses ETH, not WETH
    tx = await redStonePriceFeed.setDataFeedId(deploymentData.WETH, wethFeedId);
    await tx.wait();
    console.log("✅ WETH data feed ID set successfully");
    
    // Set unique signers threshold for production (at least 3 for security)
    console.log("Setting unique signers threshold to 3...");
    tx = await redStonePriceFeed.setUniqueSignersThreshold(3);
    await tx.wait();
    console.log("✅ Unique signers threshold set to 3");
    
  } catch (error) {
    console.error(`❌ Error configuring RedStonePriceFeed: ${error.message}`);
  }
  
  // Verify RedStonePriceFeed configuration
  console.log("\nVerifying RedStonePriceFeed configuration:");
  
  try {
    // Check data feed IDs
    const wldFeedId = await redStonePriceFeed.dataFeedIds(deploymentData.WLD);
    console.log(`WLD data feed ID: ${ethers.utils.parseBytes32String(wldFeedId)}`);
    
    const wethFeedId = await redStonePriceFeed.dataFeedIds(deploymentData.WETH);
    console.log(`WETH data feed ID: ${ethers.utils.parseBytes32String(wethFeedId)}`);
    
    // Check unique signers threshold
    const uniqueSignersThreshold = await redStonePriceFeed.uniqueSignersThreshold();
    console.log(`Unique signers threshold: ${uniqueSignersThreshold}`);
    
    if (uniqueSignersThreshold >= 3) {
      console.log("✅ Unique signers threshold is set appropriately for production");
    } else {
      console.log("⚠️ Unique signers threshold is too low for production");
    }
    
  } catch (error) {
    console.error(`❌ Error verifying RedStonePriceFeed configuration: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("PRODUCTION CONFIGURATION COMPLETE");
  console.log("======================================================");
  console.log("\nThe system is now configured to use live price data from RedStone.");
  console.log("\nNext steps:");
  console.log("1. Configure and deploy the Oracle Keeper with USE_MOCK_PRICES=false");
  console.log("2. Run the token whitelisting script with RedStone SDK:");
  console.log("   npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain");
  console.log("3. Verify the deployment is working correctly:");
  console.log("   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain");
  console.log("4. Integrate the frontend with RedStone SDK for transaction wrapping");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
