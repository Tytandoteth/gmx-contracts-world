const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Script to deploy and configure SimplePriceFeed for GMX on World Chain
 * This leverages the Oracle Keeper's CoinGecko integration
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING SIMPLE PRICE FEED FOR GMX ON WORLD CHAIN");
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
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 1: DEPLOYING SIMPLE PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Deploy SimplePriceFeed
  const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed");
  console.log("Deploying SimplePriceFeed...");
  const simplePriceFeed = await SimplePriceFeed.deploy();
  await simplePriceFeed.deployed();
  
  console.log(`✅ SimplePriceFeed deployed to: ${simplePriceFeed.address}`);
  
  // Fetch current prices from Oracle Keeper
  console.log("\n------------------------------------------------------");
  console.log("STEP 2: FETCHING CURRENT PRICES FROM ORACLE KEEPER");
  console.log("------------------------------------------------------");
  
  let currentPrices = {};
  let hasValidPrices = false;
  
  try {
    console.log(`Fetching prices from: ${ORACLE_KEEPER_URL}`);
    const response = await axios.get(ORACLE_KEEPER_URL);
    
    if (response.data && response.data.prices) {
      currentPrices = response.data.prices;
      console.log("Current prices from Oracle Keeper:");
      console.log(JSON.stringify(currentPrices, null, 2));
      console.log(`Price source: ${response.data.source}`);
      console.log(`Last updated: ${response.data.lastUpdated}`);
      hasValidPrices = true;
    } else {
      console.error("❌ Error: Invalid response format from Oracle Keeper");
      console.log("Response data:", response.data);
    }
  } catch (error) {
    console.error(`❌ Error fetching prices from Oracle Keeper: ${error.message}`);
    console.log("Will continue with setup, but prices will need to be manually updated later");
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 3: CONFIGURING PRICE FEED WITH CURRENT PRICES");
  console.log("------------------------------------------------------");
  
  // Set up token addresses and prices
  const tokens = {
    "WLD": deploymentData.WLD,
    "WETH": deploymentData.WETH
  };
  
  // Add MAG if available
  if (deploymentData.MAG) {
    tokens["MAG"] = deploymentData.MAG;
  }
  
  // Update prices if we have valid data from Oracle Keeper
  if (hasValidPrices) {
    const tokenAddresses = [];
    const tokenPrices = [];
    
    // Convert to arrays for batch update
    for (const [symbol, address] of Object.entries(tokens)) {
      if (currentPrices[symbol]) {
        // Convert price to PRICE_PRECISION (10^30)
        // Oracle price is in USD with standard precision
        const price = ethers.utils.parseUnits(
          currentPrices[symbol].toString(),
          30
        );
        
        tokenAddresses.push(address);
        tokenPrices.push(price);
        
        console.log(`${symbol}: $${currentPrices[symbol]} → ${price.toString()} (with 10^30 precision)`);
      } else {
        console.log(`⚠️ No price available for ${symbol}`);
      }
    }
    
    if (tokenAddresses.length > 0) {
      try {
        console.log("\nUpdating prices in SimplePriceFeed...");
        const tx = await simplePriceFeed.updatePrices(tokenAddresses, tokenPrices);
        console.log(`Transaction sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        await tx.wait();
        console.log("✅ Prices updated successfully");
      } catch (error) {
        console.error(`❌ Error updating prices: ${error.message}`);
      }
    } else {
      console.log("❌ No valid prices to update");
    }
  } else {
    console.log("⚠️ Skipping price updates due to missing data from Oracle Keeper");
    console.log("You will need to manually update prices later using the updatePrices function");
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 4: UPDATING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  // Connect to VaultPriceFeed
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Update VaultPriceFeed to use SimplePriceFeed
  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      console.log(`\nUpdating VaultPriceFeed for ${symbol}...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        address,
        simplePriceFeed.address,
        30, // priceDecimals - using full 30 decimals precision
        symbol === "MAG" ? false : false // isStrictStable - set to false for all tokens initially
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ VaultPriceFeed updated for ${symbol}`);
    } catch (error) {
      console.error(`❌ Error updating VaultPriceFeed for ${symbol}: ${error.message}`);
    }
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STEP 5: VERIFYING CONFIGURATION");
  console.log("------------------------------------------------------");
  
  // Verify price feed configuration
  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      console.log(`\nVerifying price feed for ${symbol}:`);
      
      // Check if the VaultPriceFeed is using the SimplePriceFeed
      const priceFeed = await vaultPriceFeed.priceFeeds(address);
      console.log(`- Price feed address: ${priceFeed}`);
      
      if (priceFeed.toLowerCase() === simplePriceFeed.address.toLowerCase()) {
        console.log(`✅ ${symbol} is using SimplePriceFeed`);
      } else {
        console.log(`⚠️ ${symbol} is NOT using SimplePriceFeed`);
      }
      
      // Check if we have a price in SimplePriceFeed
      if (hasValidPrices && currentPrices[symbol]) {
        try {
          const price = await simplePriceFeed.prices(address);
          console.log(`- Stored price: ${ethers.utils.formatUnits(price, 30)}`);
          
          const lastUpdated = await simplePriceFeed.lastUpdatedTimestamps(address);
          const lastUpdatedDate = new Date(lastUpdated.toNumber() * 1000);
          console.log(`- Last updated: ${lastUpdatedDate.toISOString()}`);
        } catch (error) {
          console.error(`❌ Error checking price for ${symbol}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error verifying ${symbol}: ${error.message}`);
    }
  }
  
  // Update deployment data file
  try {
    deploymentData.SimplePriceFeed = simplePriceFeed.address;
    
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n✅ Updated deployment data file with SimplePriceFeed address");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("SIMPLE PRICE FEED DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log(`
Key Contract Address:
- SimplePriceFeed: ${simplePriceFeed.address}

Next steps:
1. Run the token whitelisting script:
   npx hardhat run scripts/world/whitelistTokensCoinGecko.js --network worldchain
   
2. Verify the complete deployment:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   
3. Set up a price update job to regularly fetch prices from the Oracle Keeper
   and update them in the SimplePriceFeed contract via:
   - updatePrice(address token, uint256 price) for single token updates
   - updatePrices(address[] tokens, uint256[] prices) for batch updates

Note: The SimplePriceFeed is using the Oracle Keeper's CoinGecko integration.
You'll need to regularly update prices either manually or through an automation
service until the Witnet Oracle integration is fully completed.
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
