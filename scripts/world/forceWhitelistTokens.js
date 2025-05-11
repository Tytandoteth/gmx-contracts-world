const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to force whitelist tokens in the Vault using a fixed gas limit
 * This works around the gas estimation failure issue
 */
async function main() {
  console.log("======================================================");
  console.log("FORCE WHITELISTING TOKENS IN VAULT");
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
  
  // STEP 1: ENSURE MOCK PRICE FEEDS ARE PROPERLY SET
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: SETTING UP MOCK PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  // Update MockPriceFeeds with latest prices
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
  
  // STEP 2: ENSURE VAULT PRICE FEED IS CONFIGURED WITH MOCK FEEDS
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: CONFIGURING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Connect to VaultPriceFeed
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Configure VaultPriceFeed for WLD with mock feed
  console.log("Configuring VaultPriceFeed for WLD...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,              // token
    deploymentData.MockPriceFeeds.WLD, // priceFeed
    8,                               // priceDecimals
    false                            // isStable
  );
  console.log("✅ VaultPriceFeed configured for WLD");
  
  // Configure VaultPriceFeed for WETH with mock feed
  console.log("Configuring VaultPriceFeed for WETH...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,               // token
    deploymentData.MockPriceFeeds.WETH, // priceFeed
    8,                                 // priceDecimals
    false                              // isStable
  );
  console.log("✅ VaultPriceFeed configured for WETH");
  
  // STEP 3: FORCE WHITELIST TOKENS IN VAULT WITH FIXED GAS LIMIT
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: FORCE WHITELISTING TOKENS IN VAULT");
  console.log("------------------------------------------------------");
  
  // Get contract instance but use a different approach to send transactions
  const vaultAddress = deploymentData.CustomVault;
  console.log(`Vault address: ${vaultAddress}`);
  
  // Connect to Vault
  const vault = await ethers.getContractAt("Vault", vaultAddress);
  
  // Get the encoded calldata for WLD setTokenConfig
  const wldCalldata = vault.interface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,  // token
    18,                  // tokenDecimals
    10000,               // tokenWeight
    75,                  // minProfitBps (0.75%)
    0,                   // maxUsdgAmount
    false,               // isStable
    true                 // isShortable
  ]);
  
  // Get the encoded calldata for WETH setTokenConfig
  const wethCalldata = vault.interface.encodeFunctionData("setTokenConfig", [
    deploymentData.WETH, // token
    18,                  // tokenDecimals
    10000,               // tokenWeight
    75,                  // minProfitBps (0.75%)
    0,                   // maxUsdgAmount
    false,               // isStable
    true                 // isShortable
  ]);
  
  // Force whitelist WLD
  console.log("Force whitelisting WLD token with fixed gas limit...");
  try {
    // Check if already whitelisted
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    
    if (isWldWhitelisted) {
      console.log("✅ WLD is already whitelisted in Vault");
    } else {
      // Send transaction with fixed gas limit
      const tx = await deployer.sendTransaction({
        to: vaultAddress,
        data: wldCalldata,
        gasLimit: 5000000, // Fixed high gas limit of 5 million
      });
      
      // Wait for transaction confirmation
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: Block ${receipt.blockNumber}, Gas Used: ${receipt.gasUsed.toString()}`);
      
      // Verify whitelisting was successful
      const isNowWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
      if (isNowWhitelisted) {
        console.log("✅ WLD successfully whitelisted in Vault");
      } else {
        console.error("❌ WLD whitelisting failed despite successful transaction");
      }
    }
  } catch (error) {
    console.error(`❌ Error whitelisting WLD: ${error.message}`);
  }
  
  // Force whitelist WETH
  console.log("\nForce whitelisting WETH token with fixed gas limit...");
  try {
    // Check if already whitelisted
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    
    if (isWethWhitelisted) {
      console.log("✅ WETH is already whitelisted in Vault");
    } else {
      // Send transaction with fixed gas limit
      const tx = await deployer.sendTransaction({
        to: vaultAddress,
        data: wethCalldata,
        gasLimit: 5000000, // Fixed high gas limit of 5 million
      });
      
      // Wait for transaction confirmation
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: Block ${receipt.blockNumber}, Gas Used: ${receipt.gasUsed.toString()}`);
      
      // Verify whitelisting was successful
      const isNowWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
      if (isNowWhitelisted) {
        console.log("✅ WETH successfully whitelisted in Vault");
      } else {
        console.error("❌ WETH whitelisting failed despite successful transaction");
      }
    }
  } catch (error) {
    console.error(`❌ Error whitelisting WETH: ${error.message}`);
  }
  
  // STEP 4: VERIFY FINAL CONFIGURATION
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: VERIFYING FINAL CONFIGURATION");
  console.log("------------------------------------------------------");
  
  // Check token whitelisting in Vault
  try {
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    console.log(`Is WLD whitelisted: ${isWldWhitelisted}`);
    
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    console.log(`Is WETH whitelisted: ${isWethWhitelisted}`);
    
    if (isWldWhitelisted && isWethWhitelisted) {
      console.log("✅ Both tokens are successfully whitelisted");
    } else {
      console.warn("⚠️ Not all tokens are whitelisted");
    }
  } catch (error) {
    console.error(`❌ Error verifying configuration: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING PROCESS COMPLETE");
  console.log("======================================================");
  
  console.log("\nTo verify the complete deployment, run:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
