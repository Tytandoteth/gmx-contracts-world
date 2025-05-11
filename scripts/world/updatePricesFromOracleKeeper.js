const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Script to fetch prices from Oracle Keeper and update the SimplePriceFeed contract
 * This creates the integration between off-chain Oracle Keeper and on-chain price feeds
 */
async function main() {
  console.log("======================================================");
  console.log("UPDATING PRICES FROM ORACLE KEEPER");
  console.log("======================================================");
  
  // Load deployment data to get contract addresses
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded deployment data");
  } catch (error) {
    console.error("❌ Error loading deployment data:", error);
    process.exit(1);
  }
  
  // Get the SimplePriceFeed address
  const simplePriceFeedAddress = deploymentData.TestEnvironment?.contracts?.SimplePriceFeed 
    || deploymentData.SimplePriceFeed;
    
  if (!simplePriceFeedAddress) {
    console.error("❌ SimplePriceFeed address not found in deployment data");
    process.exit(1);
  }
  
  console.log(`SimplePriceFeed address: ${simplePriceFeedAddress}`);
  
  // Get the test token addresses
  const testTokens = deploymentData.TestEnvironment?.tokens || {};
  const tokenAddresses = {};
  
  // Create a mapping of token symbols to addresses
  if (Object.keys(testTokens).length > 0) {
    console.log("\nUsing test tokens from recent deployment:");
    for (const [symbol, info] of Object.entries(testTokens)) {
      tokenAddresses[symbol] = info.address;
      console.log(`- ${symbol}: ${info.address}`);
    }
  } else {
    // Fallback to production tokens if test tokens aren't available
    console.log("\nNo test tokens found, using production tokens:");
    
    if (deploymentData.WLD) {
      tokenAddresses["WLD"] = deploymentData.WLD;
      console.log(`- WLD: ${deploymentData.WLD}`);
    }
    
    if (deploymentData.WETH) {
      tokenAddresses["WETH"] = deploymentData.WETH;
      console.log(`- WETH: ${deploymentData.WETH}`);
    }
    
    if (deploymentData.MAG) {
      tokenAddresses["MAG"] = deploymentData.MAG;
      console.log(`- MAG: ${deploymentData.MAG}`);
    }
  }
  
  if (Object.keys(tokenAddresses).length === 0) {
    console.error("❌ No token addresses found");
    process.exit(1);
  }
  
  // Connect to SimplePriceFeed contract
  const [signer] = await ethers.getSigners();
  console.log(`\nSigner address: ${signer.address}`);
  
  const simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", simplePriceFeedAddress, signer);
  
  // Oracle Keeper endpoint for direct prices
  const oracleKeeperUrl = "https://oracle-keeper.kevin8396.workers.dev/direct-prices";
  
  console.log("\n------------------------------------------------------");
  console.log("FETCHING PRICES FROM ORACLE KEEPER");
  console.log("------------------------------------------------------");
  
  let oraclePrices;
  
  try {
    console.log(`Fetching prices from: ${oracleKeeperUrl}`);
    const response = await axios.get(oracleKeeperUrl);
    
    if (response.data && response.data.prices) {
      oraclePrices = response.data.prices;
      console.log(`\nOracle Keeper prices (${response.data.timestamp}):`);
      console.log(JSON.stringify(oraclePrices, null, 2));
      console.log(`Source: ${response.data.source}`);
    } else {
      throw new Error("Invalid response format from Oracle Keeper");
    }
  } catch (error) {
    console.error(`❌ Error fetching prices from Oracle Keeper: ${error.message}`);
    
    // Use fallback emergency prices if Oracle Keeper request fails
    console.log("\nUsing fallback emergency prices:");
    oraclePrices = {
      "WLD": 1.24,
      "WETH": 2481.08,
      "MAG": 0.00041212,
      "TUSD": 1.0,
      "TBTC": 30000.0,
      "TETH": 2500.0
    };
    console.log(JSON.stringify(oraclePrices, null, 2));
  }
  
  console.log("\n------------------------------------------------------");
  console.log("UPDATING PRICES IN SIMPLEPRICEFEED CONTRACT");
  console.log("------------------------------------------------------");
  
  // Update prices in SimplePriceFeed contract
  const successfulUpdates = [];
  
  for (const [symbol, tokenAddress] of Object.entries(tokenAddresses)) {
    // Skip tokens that don't have a price from Oracle Keeper
    if (!oraclePrices[symbol]) {
      console.log(`⚠️ No price found for ${symbol}, skipping...`);
      continue;
    }
    
    const price = oraclePrices[symbol];
    console.log(`\nUpdating ${symbol} price to $${price}...`);
    
    try {
      // Convert price to contract format (30 decimals)
      const priceWithPrecision = ethers.utils.parseUnits(price.toString(), 30);
      
      // Update price in SimplePriceFeed
      const tx = await simplePriceFeed.updatePrice(tokenAddress, priceWithPrecision);
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ Successfully updated ${symbol} price to $${price}`);
      successfulUpdates.push(symbol);
    } catch (error) {
      console.error(`❌ Failed to update ${symbol} price: ${error.message}`);
    }
  }
  
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING PRICE UPDATES");
  console.log("------------------------------------------------------");
  
  // Verify prices were updated correctly
  for (const symbol of successfulUpdates) {
    try {
      const tokenAddress = tokenAddresses[symbol];
      
      // Get the current timestamp
      const timestamp = await simplePriceFeed.lastUpdatedTimestamps(tokenAddress);
      const formattedTimestamp = new Date(timestamp.toNumber() * 1000).toISOString();
      
      // Get the current price
      const price = await simplePriceFeed.prices(tokenAddress);
      const formattedPrice = ethers.utils.formatUnits(price, 30);
      
      console.log(`${symbol} price: $${formattedPrice} (updated at ${formattedTimestamp})`);
    } catch (error) {
      console.error(`Error verifying ${symbol} price: ${error.message}`);
    }
  }
  
  console.log("\n======================================================");
  console.log("PRICE UPDATE COMPLETE");
  console.log("======================================================");
  
  // Summary of what was done
  console.log(`
Price Update Summary:
- Oracle Keeper: ${oracleKeeperUrl}
- SimplePriceFeed: ${simplePriceFeedAddress}
- Updated Tokens: ${successfulUpdates.join(', ')}

Next Steps:
1. Set up a cron job or scheduled task to run this script regularly:
   npx hardhat run scripts/world/updatePricesFromOracleKeeper.js --network worldchain

2. Frontend can now display prices from both sources:
   - Direct from Oracle Keeper API for UI display
   - On-chain from SimplePriceFeed for contract interactions

3. To test the Oracle Keeper integration with the frontend:
   - Use the updated SimplePriceFeed contract
   - Verify that prices are properly synchronized
  `);
}

// Check if axios is installed, if not provide installation instructions
try {
  require('axios');
} catch (e) {
  console.error("\nERROR: axios package is required for this script.");
  console.error("Please install it by running: npm install axios");
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
