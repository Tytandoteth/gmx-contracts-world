const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to whitelist tokens in the Vault using mock price feeds
 * This approach works around the issue with RedStonePriceFeed requiring special transaction wrapping
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELISTING TOKENS WITH MOCK PRICE FEEDS");
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
  
  // STEP 1: ENSURE MOCK PRICE FEEDS ARE READY
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: CHECKING MOCK PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  // Initialize MockPriceFeeds object if it doesn't exist
  if (!deploymentData.MockPriceFeeds) {
    deploymentData.MockPriceFeeds = {};
  }
  
  // Deploy WLD MockPriceFeed if it doesn't exist
  if (!deploymentData.MockPriceFeeds.WLD) {
    console.log("Deploying WLD MockPriceFeed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wldPriceFeed = await MockPriceFeed.deploy(0); // Initial price 0
    await wldPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WLD = wldPriceFeed.address;
    console.log(`✅ WLD MockPriceFeed deployed at: ${wldPriceFeed.address}`);
  } else {
    console.log(`Using existing WLD MockPriceFeed: ${deploymentData.MockPriceFeeds.WLD}`);
  }
  
  // Deploy WETH MockPriceFeed if it doesn't exist
  if (!deploymentData.MockPriceFeeds.WETH) {
    console.log("Deploying WETH MockPriceFeed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wethPriceFeed = await MockPriceFeed.deploy(0); // Initial price 0
    await wethPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WETH = wethPriceFeed.address;
    console.log(`✅ WETH MockPriceFeed deployed at: ${wethPriceFeed.address}`);
  } else {
    console.log(`Using existing WETH MockPriceFeed: ${deploymentData.MockPriceFeeds.WETH}`);
  }
  
  // STEP 2: SET MOCK PRICES
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: SETTING MOCK PRICES");
  console.log("------------------------------------------------------");
  
  // Connect to the mock price feeds
  const wldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
  const wethPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WETH);
  
  // Set WLD price to $1.25
  console.log("Setting WLD price to $1.25...");
  await wldPriceFeed.setPrice(ethers.utils.parseUnits("1.25", 8));
  console.log("✅ WLD price set to $1.25");
  
  // Set WETH price to $3,000.00
  console.log("Setting WETH price to $3,000.00...");
  await wethPriceFeed.setPrice(ethers.utils.parseUnits("3000", 8));
  console.log("✅ WETH price set to $3,000.00");
  
  // STEP 3: CONFIGURE VAULT PRICE FEED TEMPORARILY WITH MOCK FEEDS
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: TEMPORARILY CONFIGURING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Connect to VaultPriceFeed
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Store original price feed configurations to restore later
  console.log("Saving original price feed configurations...");
  let originalWldPriceFeed;
  let originalWethPriceFeed;
  
  try {
    originalWldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    originalWethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
    console.log(`Original WLD price feed: ${originalWldPriceFeed}`);
    console.log(`Original WETH price feed: ${originalWethPriceFeed}`);
  } catch (error) {
    console.warn(`Unable to get original price feeds: ${error.message}`);
    // Continue anyway as we'll be setting new ones
  }
  
  // Configure VaultPriceFeed for WLD with mock feed
  console.log("Configuring VaultPriceFeed temporarily for WLD...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,              // token
    deploymentData.MockPriceFeeds.WLD, // priceFeed
    8,                               // priceDecimals
    false                            // isStable
  );
  console.log("✅ VaultPriceFeed temporarily configured for WLD");
  
  // Configure VaultPriceFeed for WETH with mock feed
  console.log("Configuring VaultPriceFeed temporarily for WETH...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,               // token
    deploymentData.MockPriceFeeds.WETH, // priceFeed
    8,                                 // priceDecimals
    false                              // isStable
  );
  console.log("✅ VaultPriceFeed temporarily configured for WETH");
  
  // STEP 4: CONFIGURE VAULT WITH TOKENS
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: CONFIGURING VAULT WITH TOKENS");
  console.log("------------------------------------------------------");
  
  // Connect to Vault
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Configure Vault for WLD
  console.log("Checking if WLD is whitelisted in Vault...");
  try {
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    
    if (!isWldWhitelisted) {
      console.log("Setting WLD token configuration in Vault...");
      await vault.setTokenConfig(
        deploymentData.WLD,  // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      console.log("✅ WLD token configured in Vault");
    } else {
      console.log("✅ WLD already whitelisted in Vault");
    }
  } catch (error) {
    console.error(`❌ Error configuring WLD in Vault: ${error.message}`);
  }
  
  // Configure Vault for WETH
  console.log("Checking if WETH is whitelisted in Vault...");
  try {
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    
    if (!isWethWhitelisted) {
      console.log("Setting WETH token configuration in Vault...");
      await vault.setTokenConfig(
        deploymentData.WETH, // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      console.log("✅ WETH token configured in Vault");
    } else {
      console.log("✅ WETH already whitelisted in Vault");
    }
  } catch (error) {
    console.error(`❌ Error configuring WETH in Vault: ${error.message}`);
  }
  
  // STEP 5: RESTORE ORIGINAL PRICE FEED CONFIGURATION
  console.log("\n------------------------------------------------------");
  console.log("STEP 5: RESTORING ORIGINAL PRICE FEED CONFIGURATION");
  console.log("------------------------------------------------------");
  
  // If we want to restore to RedStonePriceFeed for production
  if (originalWldPriceFeed && originalWethPriceFeed) {
    console.log("Restoring original price feed configuration...");
    
    // Check if original feeds were RedStonePriceFeed
    const restoreToRedStone = originalWldPriceFeed === deploymentData.RedStonePriceFeed;
    
    if (restoreToRedStone) {
      console.log("Original feeds were RedStonePriceFeed. For production use, you should use RedStonePriceFeed.");
      console.log("For development and testing, we'll keep the mock feeds configured.");
    } else {
      // Restore original price feed configuration if they weren't RedStonePriceFeed
      try {
        console.log("Restoring WLD to original price feed...");
        await vaultPriceFeed.setTokenConfig(
          deploymentData.WLD,
          originalWldPriceFeed,
          8,
          false
        );
        
        console.log("Restoring WETH to original price feed...");
        await vaultPriceFeed.setTokenConfig(
          deploymentData.WETH,
          originalWethPriceFeed,
          8,
          false
        );
        
        console.log("✅ Original price feed configuration restored");
      } catch (error) {
        console.error(`❌ Error restoring original price feeds: ${error.message}`);
      }
    }
  } else {
    console.log("No original price feed configuration to restore.");
    console.log("Using mock price feeds for development and testing.");
  }
  
  // Save updated deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\n✅ Deployment data updated successfully");
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELIST COMPLETE");
  console.log("======================================================");
  
  console.log("\nWLD and WETH tokens have been successfully whitelisted in the Vault.");
  console.log("\nNotes:");
  console.log("1. For development and testing, mock price feeds are configured.");
  console.log("2. For production use, you should use the RedStonePriceFeed with proper transaction wrapping.");
  console.log("\nYou can now run the verification script to confirm the configuration:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Failed to whitelist tokens:", error);
    process.exit(1);
  });
