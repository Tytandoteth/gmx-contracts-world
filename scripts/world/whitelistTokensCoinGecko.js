const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Script to whitelist tokens in the Vault using prices from CoinGecko via Oracle Keeper
 * This is a simplified approach that doesn't require Witnet or RedStone integration
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH COINGECKO ORACLE INTEGRATION");
  console.log("======================================================");
  
  // Configuration - Oracle Keeper endpoint
  const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev/direct-prices";
  console.log(`Oracle Keeper URL: ${ORACLE_KEEPER_URL}`);
  
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
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  
  if (ethers.utils.formatEther(deployerBalance) < 0.01) {
    console.error("⚠️ Warning: Deployer balance is low. You might need more ETH to perform transactions.");
  }
  
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
      maxUsdgAmount: ethers.utils.parseUnits("5000000", 18), // $5M max USDG cap
      isStable: false,
      isShortable: true
    },
    "WETH": {
      address: deploymentData.WETH,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M max USDG cap
      isStable: false,
      isShortable: true
    }
  };
  
  // Add MAG if available
  if (deploymentData.MAG) {
    tokens["MAG"] = {
      address: deploymentData.MAG,
      decimals: 18,
      weight: 8000, // Lower weight due to lower liquidity
      minProfitBps: 150, // Higher min profit basis points due to volatility
      maxUsdgAmount: ethers.utils.parseUnits("1000000", 18), // $1M max USDG cap (lower cap due to lower liquidity)
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
  
  // Fetch current prices from Oracle Keeper
  console.log("\n------------------------------------------------------");
  console.log("FETCHING CURRENT PRICES FROM ORACLE KEEPER");
  console.log("------------------------------------------------------");
  
  let currentPrices = {};
  
  try {
    console.log(`Fetching prices from: ${ORACLE_KEEPER_URL}`);
    const response = await axios.get(ORACLE_KEEPER_URL);
    
    if (response.data && response.data.prices) {
      currentPrices = response.data.prices;
      console.log("Current prices from Oracle Keeper:");
      console.log(JSON.stringify(currentPrices, null, 2));
      console.log(`Price source: ${response.data.source}`);
      console.log(`Last updated: ${response.data.lastUpdated}`);
    } else {
      console.error("❌ Error: Invalid response format from Oracle Keeper");
      console.log("Response data:", response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error fetching prices from Oracle Keeper: ${error.message}`);
    console.log("Continuing with default price feed setup without price verification");
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
    
    // Price check (if available)
    if (currentPrices[tokenSymbol]) {
      console.log(`Current ${tokenSymbol} price: $${currentPrices[tokenSymbol]}`);
    } else {
      console.log(`⚠️ No price data available for ${tokenSymbol}. Proceeding anyway.`);
    }
    
    try {
      // This uses the setTokenConfig function of Vault
      const tx = await vault.setTokenConfig(
        tokenConfig.address,               // _token
        tokenConfig.decimals,              // _tokenDecimals
        tokenConfig.weight,                // _tokenWeight
        tokenConfig.minProfitBps,          // _minProfitBps
        tokenConfig.maxUsdgAmount,         // _maxUsdgAmount
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
            tokenConfig.maxUsdgAmount,
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
2. Test the trading functionality through the frontend
3. Monitor price feeds via the Oracle Keeper endpoint: ${ORACLE_KEEPER_URL}

Note: This configuration uses the Oracle Keeper with CoinGecko integration.
Token prices will be provided through the '/direct-prices' endpoint with no 
need for special transaction wrapping.
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
