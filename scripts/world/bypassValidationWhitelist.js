const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Script to whitelist tokens in the Vault with special handling to bypass price validation issues
 * This uses a temporary source to allow initial whitelisting
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH VALIDATION BYPASS");
  console.log("======================================================");
  
  // Configuration 
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
  
  // Connect to Vault and VaultPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO CONTRACTS");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  console.log(`SimplePriceFeed address: ${deploymentData.SimplePriceFeed}`);
  const simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", deploymentData.SimplePriceFeed);
  
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
      maxUsdgAmount: ethers.utils.parseUnits("1000000", 18), // $1M max USDG cap
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
      console.log("Continuing with default prices");
      currentPrices = { "WLD": 1.25, "WETH": 2500.00 };
      if (deploymentData.MAG) {
        currentPrices["MAG"] = 0.0004;
      }
    }
  } catch (error) {
    console.error(`❌ Error fetching prices from Oracle Keeper: ${error.message}`);
    console.log("Continuing with default prices");
    currentPrices = { "WLD": 1.25, "WETH": 2500.00 };
    if (deploymentData.MAG) {
      currentPrices["MAG"] = 0.0004;
    }
  }
  
  // Special step: Create a very simple "FastPriceFeed" for bootstrapping
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING TEMPORARY FAST PRICE FEED FOR BOOTSTRAPPING");
  console.log("------------------------------------------------------");
  
  const FastPriceFeed = await ethers.getContractFactory("FastPriceFeed");
  console.log("Deploying FastPriceFeed...");
  
  // Create the constructor parameter arrays
  const tokenAddresses = Object.values(tokens).map(token => token.address);
  const tokenPrecisions = Object.values(tokens).map(() => 10000); // Default precision for all tokens
  
  const fastPriceFeed = await FastPriceFeed.deploy(
    5 * 60, // _priceDuration (5 minutes)
    true, // _minBlockInterval
    250, // _maxDeviationBasisPoints (2.5%)
    deployer.address, // _fastPriceEvents
    deployer.address, // _tokenManager
    deployer.address // _positionRouter (not actually used here)
  );
  
  await fastPriceFeed.deployed();
  console.log(`✅ FastPriceFeed deployed to: ${fastPriceFeed.address}`);
  
  // Set tokens in FastPriceFeed
  console.log("\nConfiguring FastPriceFeed with token info...");
  await fastPriceFeed.setTokens(tokenAddresses, tokenPrecisions);
  console.log("✅ FastPriceFeed tokens configured");
  
  // Set deployer as price updater
  console.log("\nSetting price updater permissions...");
  await fastPriceFeed.setUpdater(deployer.address, true);
  console.log("✅ FastPriceFeed updater configured");
  
  // Set initial prices in FastPriceFeed
  console.log("\nSetting initial prices in FastPriceFeed...");
  
  const prices = [];
  const timestamps = [];
  
  for (const [symbol, token] of Object.entries(tokens)) {
    if (currentPrices[symbol]) {
      // Convert to price precision used by FastPriceFeed (30 decimals)
      const price = ethers.utils.parseUnits(
        currentPrices[symbol].toString(),
        30
      );
      
      // Set individual price first (as a backup)
      await fastPriceFeed.setPrice(token.address, price);
      
      // Add to batch arrays
      prices.push(price);
      timestamps.push(Math.floor(Date.now() / 1000)); // Current timestamp
      
      console.log(`${symbol}: $${currentPrices[symbol]} → ${price.toString()}`);
    }
  }
  
  // Set all prices in batch
  await fastPriceFeed.setPrices(tokenAddresses, prices, Math.floor(Date.now() / 1000));
  console.log("✅ FastPriceFeed prices set");
  
  // Update VaultPriceFeed to use FastPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING VAULTPRICEFEED TO USE BOOTSTRAP PRICE SOURCE");
  console.log("------------------------------------------------------");
  
  // Enable fast price feeds in VaultPriceFeed (temporary measure)
  console.log("\nEnabling fast price usage in VaultPriceFeed...");
  await vaultPriceFeed.setMaxStrictPriceDeviation(1000); // 10% max deviation
  await vaultPriceFeed.setPriceSampleSpace(1); // Simplest sampling
  await vaultPriceFeed.setSecondaryPriceFeed(fastPriceFeed.address);
  await vaultPriceFeed.setIsAmmEnabled(false); // Disable AMM price source
  await vaultPriceFeed.setIsSecondaryPriceEnabled(true); // Enable secondary price source
  console.log("✅ VaultPriceFeed configured to use FastPriceFeed");
  
  // Update VaultPriceFeed to use FastPriceFeed for each token
  for (const [symbol, token] of Object.entries(tokens)) {
    try {
      console.log(`\nUpdating VaultPriceFeed for ${symbol}...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        token.address,
        fastPriceFeed.address, // Use FastPriceFeed temporarily
        30, // priceDecimals - FastPriceFeed uses 30 decimals
        symbol === "MAG" ? false : false // isStrictStable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ VaultPriceFeed updated for ${symbol}`);
    } catch (error) {
      console.error(`❌ Error updating VaultPriceFeed for ${symbol}: ${error.message}`);
    }
  }
  
  // Whitelist tokens
  console.log("\n------------------------------------------------------");
  console.log("WHITELISTING TOKENS USING BOOTSTRAP PRICE SOURCE");
  console.log("------------------------------------------------------");
  
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    if (tokenConfig.isWhitelisted) {
      console.log(`${tokenSymbol} is already whitelisted, skipping...`);
      continue;
    }
    
    console.log(`\nWhitelisting ${tokenSymbol}...`);
    
    try {
      // Use fixed gas limits to prevent estimation issues
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
      console.log(`✅ Successfully whitelisted ${tokenSymbol}`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenSymbol}: ${error.message}`);
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
  
  // Revert VaultPriceFeed to use SimplePriceFeed (if tokens were whitelisted successfully)
  if (allWhitelisted) {
    console.log("\n------------------------------------------------------");
    console.log("REVERTING TO SIMPLE PRICE FEED FOR PRODUCTION USE");
    console.log("------------------------------------------------------");
    
    // Revert to SimplePriceFeed for each token
    for (const [symbol, token] of Object.entries(tokens)) {
      try {
        console.log(`\nReverting VaultPriceFeed for ${symbol} to use SimplePriceFeed...`);
        const tx = await vaultPriceFeed.setTokenConfig(
          token.address,
          deploymentData.SimplePriceFeed, // Revert to SimplePriceFeed
          30, // priceDecimals
          symbol === "MAG" ? false : false // isStrictStable
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        await tx.wait();
        console.log(`✅ VaultPriceFeed configuration reverted for ${symbol}`);
      } catch (error) {
        console.error(`❌ Error reverting VaultPriceFeed for ${symbol}: ${error.message}`);
      }
    }
    
    // Disable fast price usage
    console.log("\nDisabling fast price usage in VaultPriceFeed...");
    await vaultPriceFeed.setIsSecondaryPriceEnabled(false);
    console.log("✅ Fast price usage disabled");
  }
  
  // Update deployment data file with FastPriceFeed (for reference)
  try {
    deploymentData.FastPriceFeed = fastPriceFeed.address;
    
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n✅ Updated deployment data file with FastPriceFeed address");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING PROCESS COMPLETE");
  console.log("======================================================");
  
  console.log(`
Token Whitelisting Summary:
- FastPriceFeed: ${fastPriceFeed.address} (Temporary bootstrap solution)
- SimplePriceFeed: ${deploymentData.SimplePriceFeed} (For long-term use)

Next steps:
1. Verify the complete deployment with:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   
2. Test the trading functionality through the frontend

3. Ensure regular price updates are happening via:
   - SimplePriceFeed.updatePrices() function
   - Oracle Keeper endpoint: ${ORACLE_KEEPER_URL}
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
