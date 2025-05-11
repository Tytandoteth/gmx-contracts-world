const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to fix issues identified during verification:
 * 1. Whitelist WLD and WETH tokens in the Vault
 */
async function main() {
  console.log("======================================================");
  console.log("FIXING VERIFICATION ISSUES");
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
  
  console.log("\n------------------------------------------------------");
  console.log("ISSUE 1: WHITELISTING TOKENS IN THE VAULT");
  console.log("------------------------------------------------------");
  
  try {
    console.log("Getting Vault contract...");
    const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
    
    // Whitelist WLD token for trading
    console.log("\nWhitelisting WLD token...");
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    
    if (!isWldWhitelisted) {
      console.log("Setting WLD token configuration...");
      
      const tx = await vault.setTokenConfig(
        deploymentData.WLD,  // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      
      await tx.wait();
      console.log("✅ WLD token successfully whitelisted");
    } else {
      console.log("✅ WLD token is already whitelisted");
    }
    
    // Whitelist WETH token for trading
    console.log("\nWhitelisting WETH token...");
    const isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
    
    if (!isWethWhitelisted) {
      console.log("Setting WETH token configuration...");
      
      const tx = await vault.setTokenConfig(
        deploymentData.WETH, // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      );
      
      await tx.wait();
      console.log("✅ WETH token successfully whitelisted");
    } else {
      console.log("✅ WETH token is already whitelisted");
    }
    
  } catch (error) {
    console.error(`❌ Error fixing token whitelisting: ${error.message}`);
    process.exit(1);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("ISSUE 2: UPDATING VERIFICATION SCRIPT FOR WETH");
  console.log("------------------------------------------------------");
  
  // This is a fix for the verification script, not an on-chain action
  console.log("Note: The verification script has been updated to use the correct contract name for WETH.");
  console.log("The updated script will be created as verifyCompleteDeploymentFixed.js");
  
  console.log("\n======================================================");
  console.log("FIX COMPLETE");
  console.log("======================================================");
  
  console.log("\nRun the following command to verify the fixed deployment:");
  console.log("npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Failed to fix issues:", error);
    process.exit(1);
  });
