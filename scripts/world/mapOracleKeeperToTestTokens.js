const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Script to map Oracle Keeper production token prices to our test tokens
 * This creates a seamless connection between the Oracle Keeper and our test environment
 */
async function main() {
  console.log("======================================================");
  console.log("MAPPING ORACLE KEEPER PRICES TO TEST TOKENS");
  console.log("======================================================");
  
  // Load deployment data
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
  
  // Get the SimplePriceFeed address from test environment
  const simplePriceFeedAddress = deploymentData.TestEnvironment?.contracts?.SimplePriceFeed;
  
  if (!simplePriceFeedAddress) {
    console.error("❌ SimplePriceFeed address not found in test environment");
    process.exit(1);
  }
  
  console.log(`SimplePriceFeed address: ${simplePriceFeedAddress}`);
  
  // Get test token addresses
  const testTokens = deploymentData.TestEnvironment?.tokens || {};
  
  if (Object.keys(testTokens).length === 0) {
    console.error("❌ No test tokens found in deployment data");
    process.exit(1);
  }
  
  console.log("\nTest tokens:");
  for (const [symbol, info] of Object.entries(testTokens)) {
    console.log(`- ${symbol}: ${info.address}`);
  }
  
  // Connect to SimplePriceFeed contract
  const [signer] = await ethers.getSigners();
  console.log(`\nSigner address: ${signer.address}`);
  
  const simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", simplePriceFeedAddress, signer);
  
  // Oracle Keeper endpoint
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
    
    // Use fallback prices if Oracle Keeper request fails
    console.log("\nUsing fallback prices:");
    oraclePrices = {
      "WLD": 1.24,
      "WETH": 2481.08,
      "MAG": 0.00041212
    };
    console.log(JSON.stringify(oraclePrices, null, 2));
  }
  
  console.log("\n------------------------------------------------------");
  console.log("MAPPING PRODUCTION TOKEN PRICES TO TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Define mapping between production tokens and test tokens
  const tokenMapping = {
    "TUSD": "WLD",     // Map WLD price to TUSD
    "TBTC": "WETH",    // Map WETH price to TBTC (scaled)
    "TETH": "WETH"     // Map WETH price to TETH
  };
  
  // Create price mapping
  const testTokenPrices = {};
  
  for (const [testSymbol, productionSymbol] of Object.entries(tokenMapping)) {
    if (oraclePrices[productionSymbol]) {
      // Special case for TBTC - scale up the price significantly for BTC simulation
      if (testSymbol === "TBTC") {
        testTokenPrices[testSymbol] = oraclePrices[productionSymbol] * 12;
      } else {
        testTokenPrices[testSymbol] = oraclePrices[productionSymbol];
      }
      
      console.log(`Mapped ${productionSymbol} ($${oraclePrices[productionSymbol]}) to ${testSymbol} ($${testTokenPrices[testSymbol]})`);
    } else {
      console.log(`⚠️ No price found for ${productionSymbol}, cannot map to ${testSymbol}`);
      
      // Use default values as fallback
      if (testSymbol === "TUSD") testTokenPrices[testSymbol] = 1.0;
      if (testSymbol === "TBTC") testTokenPrices[testSymbol] = 30000.0;
      if (testSymbol === "TETH") testTokenPrices[testSymbol] = 2500.0;
      
      console.log(`Using fallback price for ${testSymbol}: $${testTokenPrices[testSymbol]}`);
    }
  }
  
  console.log("\n------------------------------------------------------");
  console.log("UPDATING TEST TOKEN PRICES IN SIMPLEPRICEFEED");
  console.log("------------------------------------------------------");
  
  // Update prices in SimplePriceFeed
  const successfulUpdates = [];
  
  for (const [symbol, price] of Object.entries(testTokenPrices)) {
    if (!testTokens[symbol]) {
      console.log(`⚠️ No address found for ${symbol}, skipping...`);
      continue;
    }
    
    const tokenAddress = testTokens[symbol].address;
    console.log(`\nUpdating ${symbol} price to $${price}...`);
    
    try {
      // Convert price to 30 decimals precision for GMX
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
      const tokenAddress = testTokens[symbol].address;
      
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
  console.log("PRICE MAPPING COMPLETE");
  console.log("======================================================");
  
  // Print summary
  console.log(`
Price Mapping Summary:
- Oracle Keeper: ${oracleKeeperUrl}
- SimplePriceFeed: ${simplePriceFeedAddress}
- Updated Tokens: ${successfulUpdates.join(', ')}

Token Mapping:
- WLD price → TUSD
- WETH price → TETH
- WETH price (scaled) → TBTC

This setup allows you to:
1. Use test tokens with real-time prices from the Oracle Keeper
2. Test the full GMX trading experience with realistic price movements
3. Update prices regularly with this script:
   npx hardhat run scripts/world/mapOracleKeeperToTestTokens.js --network worldchain

For frontend integration:
1. Connect to SimplePriceFeed at ${simplePriceFeedAddress}
2. Display test token prices in the UI
3. Allow trading with the test tokens you've deployed
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
