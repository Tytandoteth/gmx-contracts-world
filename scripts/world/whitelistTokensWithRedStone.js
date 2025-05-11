const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Import RedStone SDK 
// Note: You'll need to install this first: npm install @redstone-finance/evm-connector
const { WrapperBuilder } = require("@redstone-finance/evm-connector");

/**
 * Script to whitelist tokens in the Vault using RedStone SDK for price data wrapping
 * This approach resolves the issue with price validation during whitelisting
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH REDSTONE SDK");
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
  
  // Connect to Vault
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO VAULT");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Wrap Vault with RedStone data
  console.log("\nWrapping Vault with RedStone data...");
  const wrappedVault = WrapperBuilder
    .wrapLite(vault)
    .usingPriceFeed("redstone-main");
  
  // Check if tokens are already whitelisted
  console.log("\n------------------------------------------------------");
  console.log("CHECKING EXISTING TOKEN CONFIGURATION");
  console.log("------------------------------------------------------");
  
  let isWldWhitelisted = false;
  let isWethWhitelisted = false;
  
  try {
    isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    console.log(`Is WLD already whitelisted: ${isWldWhitelisted}`);
  } catch (error) {
    console.warn(`Error checking WLD whitelist status: ${error.message}`);
  }
  
  try {
    isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    console.log(`Is WETH already whitelisted: ${isWethWhitelisted}`);
  } catch (error) {
    console.warn(`Error checking WETH whitelist status: ${error.message}`);
  }
  
  // Whitelist WLD if needed
  if (!isWldWhitelisted) {
    console.log("\n------------------------------------------------------");
    console.log("WHITELISTING WLD TOKEN");
    console.log("------------------------------------------------------");
    
    try {
      console.log("Setting WLD token configuration in Vault...");
      const tx = await wrappedVault.setTokenConfig(
        deploymentData.WLD,  // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("✅ WLD token successfully whitelisted");
    } catch (error) {
      console.error(`❌ Error whitelisting WLD: ${error.message}`);
    }
  }
  
  // Whitelist WETH if needed
  if (!isWethWhitelisted) {
    console.log("\n------------------------------------------------------");
    console.log("WHITELISTING WETH TOKEN");
    console.log("------------------------------------------------------");
    
    try {
      console.log("Setting WETH token configuration in Vault...");
      const tx = await wrappedVault.setTokenConfig(
        deploymentData.WETH, // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("✅ WETH token successfully whitelisted");
    } catch (error) {
      console.error(`❌ Error whitelisting WETH: ${error.message}`);
    }
  }
  
  // Prepare for MAG token integration
  console.log("\n------------------------------------------------------");
  console.log("PREPARING FOR MAG TOKEN INTEGRATION");
  console.log("------------------------------------------------------");
  
  console.log("To add MAG token in the future:");
  console.log("1. Deploy MAG token contract if not already deployed");
  console.log("2. Update the Oracle Keeper to include MAG price ($2.50 in development)");
  console.log("3. Configure VaultPriceFeed for MAG");
  console.log("4. Use this same script with MAG token address to whitelist it");
  
  // Verify final configuration
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING FINAL CONFIGURATION");
  console.log("------------------------------------------------------");
  
  try {
    isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    
    console.log(`Is WLD whitelisted: ${isWldWhitelisted}`);
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
  console.log("TOKEN WHITELISTING COMPLETE");
  console.log("======================================================");
  
  console.log("\nNow that tokens are whitelisted, the GMX trading system is ready for integration with the frontend.");
  console.log("\nNext steps:");
  console.log("1. Integrate frontend with RedStone SDK");
  console.log("2. Configure frontend to use contract addresses from .world-custom-deployment.json");
  console.log("3. Test full trading flow with Oracle Keeper");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
