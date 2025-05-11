const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to set up mock prices for WLD and WETH tokens
 * This also deploys mock price feeds if they don't exist yet
 * and configures both the VaultPriceFeed and Vault to work with these tokens
 */
async function main() {
  console.log("======================================================");
  console.log("SETTING UP MOCK PRICES FOR WLD AND WETH");
  console.log("======================================================");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Loaded custom deployment data");
  } catch (error) {
    console.error("❌ Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  
  // Initialize MockPriceFeeds object if it doesn't exist
  if (!deploymentData.MockPriceFeeds) {
    deploymentData.MockPriceFeeds = {};
  }
  
  // STEP 1: DEPLOY MOCK PRICE FEEDS FOR WLD AND WETH
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: DEPLOYING MOCK PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  // Deploy WLD MockPriceFeed if it doesn't exist
  if (!deploymentData.MockPriceFeeds.WLD) {
    console.log("Deploying WLD MockPriceFeed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wldPriceFeed = await MockPriceFeed.deploy();
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
    const wethPriceFeed = await MockPriceFeed.deploy();
    await wethPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WETH = wethPriceFeed.address;
    console.log(`✅ WETH MockPriceFeed deployed at: ${wethPriceFeed.address}`);
  } else {
    console.log(`Using existing WETH MockPriceFeed: ${deploymentData.MockPriceFeeds.WETH}`);
  }
  
  // Save updates to deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  
  // STEP 2: SET MOCK PRICES
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: SETTING MOCK PRICES");
  console.log("------------------------------------------------------");
  
  // Connect to the mock price feeds
  const wldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
  const wethPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WETH);
  
  // Set WLD price to $1.25
  console.log("Setting WLD price to $1.25...");
  await wldPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1.25", 8));
  console.log("✅ WLD price set to $1.25");
  
  // Set WETH price to $3,000.00
  console.log("Setting WETH price to $3,000.00...");
  await wethPriceFeed.setLatestAnswer(ethers.utils.parseUnits("3000", 8));
  console.log("✅ WETH price set to $3,000.00");
  
  // STEP 3: CONFIGURE VAULT PRICE FEED
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: CONFIGURING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Connect to VaultPriceFeed
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Configure VaultPriceFeed for WLD
  console.log("Configuring VaultPriceFeed for WLD...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,              // token
    deploymentData.MockPriceFeeds.WLD, // priceFeed
    8,                               // priceDecimals
    false                            // isStable
  );
  console.log("✅ VaultPriceFeed configured for WLD");
  
  // Configure VaultPriceFeed for WETH
  console.log("Configuring VaultPriceFeed for WETH...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,               // token
    deploymentData.MockPriceFeeds.WETH, // priceFeed
    8,                                 // priceDecimals
    false                              // isStable
  );
  console.log("✅ VaultPriceFeed configured for WETH");
  
  // STEP 4: CONFIGURE VAULT
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: CONFIGURING VAULT");
  console.log("------------------------------------------------------");
  
  // Connect to Vault
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Configure Vault for WLD
  console.log("Checking if WLD is whitelisted in Vault...");
  try {
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    
    if (!isWldWhitelisted) {
      console.log("Setting WLD token configuration in Vault...");
      // Note: Since the mock price feed is now configured, getMaxPrice should work
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
      // Note: Since the mock price feed is now configured, getMaxPrice should work
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
  
  console.log("\n======================================================");
  console.log("MOCK PRICE SETUP COMPLETE");
  console.log("======================================================");
  
  console.log("\nMock price feeds have been set up with the following prices:");
  console.log(`- WLD: $1.25`);
  console.log(`- WETH: $3,000.00`);
  
  console.log("\nYou can now use the following scripts to verify the complete deployment:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Failed to set up mock prices:", error);
    process.exit(1);
  });
