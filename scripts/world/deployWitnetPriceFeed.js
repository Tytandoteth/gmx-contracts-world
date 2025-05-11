const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy WitnetPriceFeed and configure it for the GMX on World Chain system
 * This is part of the migration from RedStone to Witnet Oracle
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING WITNET PRICE FEED FOR GMX ON WORLD CHAIN");
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
  
  // ---------- CONFIG SECTION ----------
  // These values should be updated based on World Chain's Witnet integration
  const WITNET_PRICE_ROUTER_ADDRESS = "0x0000000000000000000000000000000000000000"; // Update with actual address
  
  // Token IDs mapping based on Witnet standard
  // These are examples and should be updated with actual Witnet feed IDs
  const TOKEN_FEED_IDS = {
    "WLD": "0x574c4455", // Placeholder for WLD/USD
    "WETH": "0x455448", // Standard ETH/USD
    "MAG": "0x4d414755" // Placeholder for MAG/USD
  };
  // ------------------------------------
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: DEPLOYING WITNET PRICE FEED");
  console.log("------------------------------------------------------");
  
  console.log(`\nWitnet Price Router address: ${WITNET_PRICE_ROUTER_ADDRESS}`);
  
  // Deploy WitnetPriceFeed
  const WitnetPriceFeed = await ethers.getContractFactory("WitnetPriceFeed");
  console.log("Deploying WitnetPriceFeed...");
  const witnetPriceFeed = await WitnetPriceFeed.deploy(WITNET_PRICE_ROUTER_ADDRESS);
  await witnetPriceFeed.deployed();
  
  console.log(`✅ WitnetPriceFeed deployed to: ${witnetPriceFeed.address}`);
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: CONFIGURING PRICE FEED IDS");
  console.log("------------------------------------------------------");
  
  // Configure price feed IDs for each token
  try {
    // WLD
    console.log(`\nSetting data feed ID for WLD...`);
    await witnetPriceFeed.setDataFeedId(
      deploymentData.WLD, 
      TOKEN_FEED_IDS.WLD
    );
    console.log("✅ WLD data feed ID set successfully");
    
    // WETH
    console.log(`\nSetting data feed ID for WETH...`);
    await witnetPriceFeed.setDataFeedId(
      deploymentData.WETH, 
      TOKEN_FEED_IDS.WETH
    );
    console.log("✅ WETH data feed ID set successfully");
    
    // MAG (if available)
    if (deploymentData.MAG) {
      console.log(`\nSetting data feed ID for MAG...`);
      await witnetPriceFeed.setDataFeedId(
        deploymentData.MAG, 
        TOKEN_FEED_IDS.MAG
      );
      console.log("✅ MAG data feed ID set successfully");
    } else {
      console.log("⚠️ MAG token address not found in deployment data");
    }
  } catch (error) {
    console.error(`❌ Error configuring data feed IDs: ${error.message}`);
    console.error("This may be because the Witnet Price Router is not properly set up or the feed IDs are incorrect.");
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: UPDATING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Connect to VaultPriceFeed
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Update VaultPriceFeed to use WitnetPriceFeed
  try {
    // WLD
    console.log(`\nUpdating VaultPriceFeed for WLD...`);
    await vaultPriceFeed.setTokenConfig(
      deploymentData.WLD,
      witnetPriceFeed.address,
      8, // priceDecimals (typically 8 for price feeds)
      false // isStrictStable
    );
    console.log("✅ VaultPriceFeed updated for WLD");
    
    // WETH
    console.log(`\nUpdating VaultPriceFeed for WETH...`);
    await vaultPriceFeed.setTokenConfig(
      deploymentData.WETH,
      witnetPriceFeed.address,
      8, // priceDecimals
      false // isStrictStable
    );
    console.log("✅ VaultPriceFeed updated for WETH");
    
    // MAG (if available)
    if (deploymentData.MAG) {
      console.log(`\nUpdating VaultPriceFeed for MAG...`);
      await vaultPriceFeed.setTokenConfig(
        deploymentData.MAG,
        witnetPriceFeed.address,
        8, // priceDecimals
        false // isStrictStable
      );
      console.log("✅ VaultPriceFeed updated for MAG");
    }
  } catch (error) {
    console.error(`❌ Error updating VaultPriceFeed: ${error.message}`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: VERIFYING CONFIGURATION");
  console.log("------------------------------------------------------");
  
  // Verify WitnetPriceFeed configuration
  try {
    console.log("\nVerifying WitnetPriceFeed configuration:");
    
    // WLD
    const wldFeedId = await witnetPriceFeed.dataFeedIds(deploymentData.WLD);
    console.log(`WLD data feed ID: ${wldFeedId}`);
    
    // WETH
    const wethFeedId = await witnetPriceFeed.dataFeedIds(deploymentData.WETH);
    console.log(`WETH data feed ID: ${wethFeedId}`);
    
    // MAG (if available)
    if (deploymentData.MAG) {
      const magFeedId = await witnetPriceFeed.dataFeedIds(deploymentData.MAG);
      console.log(`MAG data feed ID: ${magFeedId}`);
    }
  } catch (error) {
    console.error(`❌ Error verifying WitnetPriceFeed configuration: ${error.message}`);
  }
  
  // Verify VaultPriceFeed configuration
  try {
    console.log("\nVerifying VaultPriceFeed configuration:");
    
    // WLD
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD price feed: ${wldPriceFeed}`);
    if (wldPriceFeed.toLowerCase() === witnetPriceFeed.address.toLowerCase()) {
      console.log("✅ WLD is using WitnetPriceFeed");
    } else {
      console.log("⚠️ WLD is not using WitnetPriceFeed");
    }
    
    // WETH
    const wethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
    console.log(`WETH price feed: ${wethPriceFeed}`);
    if (wethPriceFeed.toLowerCase() === witnetPriceFeed.address.toLowerCase()) {
      console.log("✅ WETH is using WitnetPriceFeed");
    } else {
      console.log("⚠️ WETH is not using WitnetPriceFeed");
    }
    
    // MAG (if available)
    if (deploymentData.MAG) {
      const magPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.MAG);
      console.log(`MAG price feed: ${magPriceFeed}`);
      if (magPriceFeed.toLowerCase() === witnetPriceFeed.address.toLowerCase()) {
        console.log("✅ MAG is using WitnetPriceFeed");
      } else {
        console.log("⚠️ MAG is not using WitnetPriceFeed");
      }
    }
  } catch (error) {
    console.error(`❌ Error verifying VaultPriceFeed configuration: ${error.message}`);
  }
  
  // Update deployment data file
  try {
    deploymentData.WitnetPriceFeed = witnetPriceFeed.address;
    deploymentData.WitnetPriceRouter = WITNET_PRICE_ROUTER_ADDRESS;
    
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n✅ Updated deployment data file with Witnet contract addresses");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("WITNET PRICE FEED DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log(`
Key Witnet Contract Addresses:
- WitnetPriceRouter: ${WITNET_PRICE_ROUTER_ADDRESS}
- WitnetPriceFeed: ${witnetPriceFeed.address}

Next steps:
1. Update the Oracle Keeper to use Witnet instead of RedStone
2. Test price data fetching from Witnet
3. Update frontend to connect with the new oracle system
4. Whitelist tokens in the Vault contract
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
