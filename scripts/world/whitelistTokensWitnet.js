const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to whitelist tokens in the Vault using the Witnet Oracle integration
 * This script addresses the previous token whitelisting issues with RedStone
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH WITNET ORACLE INTEGRATION");
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
  
  // Verify Witnet deployment
  if (!deploymentData.WitnetPriceFeed) {
    console.error("❌ WitnetPriceFeed not found in deployment data");
    console.error("Please run deployWitnetPriceFeed.js first");
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  
  // Connect to Vault
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO VAULT");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Check token whitelist status
  console.log("\n------------------------------------------------------");
  console.log("CHECKING EXISTING TOKEN CONFIGURATION");
  console.log("------------------------------------------------------");
  
  const tokens = {
    "WLD": {
      address: deploymentData.WLD,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      isStable: false,
      isShortable: true
    },
    "WETH": {
      address: deploymentData.WETH,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      isStable: false,
      isShortable: true
    }
  };
  
  // Add MAG if available
  if (deploymentData.MAG) {
    tokens["MAG"] = {
      address: deploymentData.MAG,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      isStable: false,
      isShortable: true
    };
  }
  
  // Check current whitelist status
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    try {
      const isWhitelisted = await vault.whitelistedTokens(tokenConfig.address);
      console.log(`Is ${tokenSymbol} already whitelisted: ${isWhitelisted}`);
      tokens[tokenSymbol].isWhitelisted = isWhitelisted;
    } catch (error) {
      console.error(`❌ Error checking ${tokenSymbol} whitelist status: ${error.message}`);
      process.exit(1);
    }
  }
  
  // Whitelist tokens
  console.log("\n------------------------------------------------------");
  console.log("WHITELISTING TOKENS");
  console.log("------------------------------------------------------");
  
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    if (tokenConfig.isWhitelisted) {
      console.log(`${tokenSymbol} is already whitelisted, skipping...`);
      continue;
    }
    
    console.log(`\nWhitelisting ${tokenSymbol}...`);
    
    try {
      // This uses the setTokenConfig function of Vault
      // Unlike RedStone, Witnet doesn't require special transaction wrapping
      // for price validation during whitelisting
      const tx = await vault.setTokenConfig(
        tokenConfig.address,               // _token
        tokenConfig.decimals,              // _tokenDecimals
        tokenConfig.weight,                // _tokenWeight
        tokenConfig.minProfitBps,          // _minProfitBps
        tokenConfig.isStable,              // _isStable
        tokenConfig.isShortable            // _isShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ Successfully whitelisted ${tokenSymbol}`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenSymbol}: ${error.message}`);
      
      // If transaction failed due to gas estimation, try with fixed gas limit
      if (error.message.includes("gas") || error.message.includes("execution reverted")) {
        console.log(`\nRetrying ${tokenSymbol} whitelisting with fixed gas parameters...`);
        
        try {
          const gasLimit = 5000000; // Generous gas limit
          const gasPrice = await ethers.provider.getGasPrice();
          
          const tx = await vault.setTokenConfig(
            tokenConfig.address,
            tokenConfig.decimals,
            tokenConfig.weight,
            tokenConfig.minProfitBps,
            tokenConfig.isStable,
            tokenConfig.isShortable,
            { gasLimit, gasPrice }
          );
          
          console.log(`Transaction sent with fixed gas: ${tx.hash}`);
          console.log("Waiting for confirmation...");
          
          await tx.wait();
          console.log(`✅ Successfully whitelisted ${tokenSymbol} with fixed gas parameters`);
        } catch (retryError) {
          console.error(`❌ Retry failed for ${tokenSymbol}: ${retryError.message}`);
        }
      }
    }
  }
  
  // Verify final configuration
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING FINAL CONFIGURATION");
  console.log("------------------------------------------------------");
  
  let allWhitelisted = true;
  
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    try {
      const isWhitelisted = await vault.whitelistedTokens(tokenConfig.address);
      console.log(`Is ${tokenSymbol} whitelisted: ${isWhitelisted}`);
      
      if (!isWhitelisted) {
        allWhitelisted = false;
      } else {
        // Check configuration details
        const tokenWeight = await vault.tokenWeights(tokenConfig.address);
        console.log(`- ${tokenSymbol} weight: ${tokenWeight}`);
        
        const tokenDecimals = await vault.tokenDecimals(tokenConfig.address);
        console.log(`- ${tokenSymbol} decimals: ${tokenDecimals}`);
      }
    } catch (error) {
      console.error(`❌ Error verifying ${tokenSymbol}: ${error.message}`);
      allWhitelisted = false;
    }
  }
  
  if (allWhitelisted) {
    console.log("\n✅ All tokens are successfully whitelisted");
  } else {
    console.log("\n⚠️ Not all tokens are whitelisted");
  }
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING COMPLETE");
  console.log("======================================================");
  
  console.log(`
Next steps:
1. Verify the complete deployment with:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
2. Test the Oracle Keeper with Witnet integration
3. Update and test the frontend with the new oracle system

Note: The Witnet Oracle integration eliminates the need for special transaction
wrapping that was causing issues with the RedStone implementation. This makes
token whitelisting and price feed initialization much more straightforward.
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
