const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * This script transitions the system from development (mock price feeds)
 * to production mode using RedStonePriceFeed for live data
 * FIXED version that uses the correct VaultPriceFeed interface
 */
async function main() {
  console.log("======================================================");
  console.log("SWITCHING TO LIVE PRICE FEEDS (PRODUCTION MODE) - FIXED");
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
  
  // Update price feeds to use RedStonePriceFeed using setTokenConfig
  console.log("\nUpdating price feeds to use RedStonePriceFeed...");
  
  try {
    // Set WLD price feed to RedStonePriceFeed
    console.log(`Setting WLD price feed to RedStonePriceFeed...`);
    let tx = await vaultPriceFeed.setTokenConfig(
      deploymentData.WLD,              // token
      deploymentData.RedStonePriceFeed, // priceFeed
      8,                               // priceDecimals (typically 8 for price feeds)
      false                            // isStrictStable (WLD is not a stable coin)
    );
    await tx.wait();
    console.log("✅ WLD price feed updated successfully");
    
    // Set WETH price feed to RedStonePriceFeed
    console.log(`Setting WETH price feed to RedStonePriceFeed...`);
    tx = await vaultPriceFeed.setTokenConfig(
      deploymentData.WETH,             // token
      deploymentData.RedStonePriceFeed, // priceFeed
      8,                               // priceDecimals (typically 8 for price feeds)
      false                            // isStrictStable (WETH is not a stable coin)
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
  // Instead of direct contract config which may not be available,
  // we'll provide instructions for Oracle Keeper configuration
  console.log("\n------------------------------------------------------");
  console.log("REDSTONE PRICE FEED CONFIGURATION");
  console.log("------------------------------------------------------");
  
  console.log(`
Note: The RedStonePriceFeed contract should be configured through the Oracle Keeper.
Make sure the Oracle Keeper is configured with:

1. The correct contract address: ${deploymentData.RedStonePriceFeed}
2. Proper token-to-feed mappings:
   - WLD should use "WLD" data feed ID
   - WETH should use "ETH" data feed ID (RedStone typically uses ETH, not WETH)
3. Set USE_MOCK_PRICES=false in your .env file
4. Configure a valid REDSTONE_API_KEY for production
  `);
  
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
