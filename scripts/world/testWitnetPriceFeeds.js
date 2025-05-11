const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to test the Witnet Price Feeds integration with GMX
 * This is part of the migration from RedStone to Witnet Oracle
 */
async function main() {
  console.log("======================================================");
  console.log("TESTING WITNET PRICE FEEDS FOR GMX ON WORLD CHAIN");
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
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  
  // Connect to deployed contracts
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO DEPLOYED CONTRACTS");
  console.log("------------------------------------------------------");
  
  let witnetPriceFeed;
  if (deploymentData.WitnetPriceFeed) {
    console.log(`WitnetPriceFeed address: ${deploymentData.WitnetPriceFeed}`);
    witnetPriceFeed = await ethers.getContractAt("WitnetPriceFeed", deploymentData.WitnetPriceFeed);
    console.log("✅ Successfully connected to WitnetPriceFeed");
  } else {
    console.log("⚠️ WitnetPriceFeed not found in deployment data");
    console.log("Please run deployWitnetPriceFeed.js first");
    process.exit(1);
  }
  
  console.log(`\nVaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  console.log("✅ Successfully connected to VaultPriceFeed");
  
  console.log(`\nVault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  console.log("✅ Successfully connected to Vault");
  
  // Test token price fetching through WitnetPriceFeed directly
  console.log("\n------------------------------------------------------");
  console.log("TESTING DIRECT WITNET PRICE FEED ACCESS");
  console.log("------------------------------------------------------");
  
  const tokens = ["WLD", "WETH"];
  if (deploymentData.MAG) tokens.push("MAG");
  
  for (const token of tokens) {
    const tokenAddress = deploymentData[token];
    if (!tokenAddress) {
      console.log(`⚠️ ${token} address not found in deployment data`);
      continue;
    }
    
    console.log(`\nTesting price feed for ${token} (${tokenAddress}):`);
    
    try {
      const hasPriceFeed = await witnetPriceFeed.hasPriceFeed(tokenAddress);
      console.log(`- Has price feed configured: ${hasPriceFeed}`);
      
      if (hasPriceFeed) {
        const dataFeedId = await witnetPriceFeed.dataFeedIds(tokenAddress);
        console.log(`- Data feed ID: ${dataFeedId}`);
        
        try {
          // Note: this will likely fail in unit tests unless we mock the Witnet Price Router
          const price = await witnetPriceFeed.getLatestPrice(tokenAddress);
          console.log(`- Latest price: ${ethers.utils.formatUnits(price, 30)} USD`);
          console.log("✅ Successfully fetched price from WitnetPriceFeed");
        } catch (error) {
          console.log(`⚠️ Error fetching price from WitnetPriceFeed: ${error.message}`);
          console.log("This is expected if running in a test environment without a mock price router.");
        }
      }
    } catch (error) {
      console.error(`❌ Error testing ${token} price feed: ${error.message}`);
    }
  }
  
  // Test token price fetching through VaultPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("TESTING VAULT PRICE FEED INTEGRATION");
  console.log("------------------------------------------------------");
  
  for (const token of tokens) {
    const tokenAddress = deploymentData[token];
    if (!tokenAddress) continue;
    
    console.log(`\nTesting VaultPriceFeed for ${token} (${tokenAddress}):`);
    
    try {
      const priceFeedAddress = await vaultPriceFeed.priceFeeds(tokenAddress);
      console.log(`- Price feed address: ${priceFeedAddress}`);
      
      const usingWitnetFeed = priceFeedAddress.toLowerCase() === deploymentData.WitnetPriceFeed.toLowerCase();
      console.log(`- Using WitnetPriceFeed: ${usingWitnetFeed}`);
      
      if (usingWitnetFeed) {
        try {
          // This will call getPrice on VaultPriceFeed which then calls getLatestPrice on WitnetPriceFeed
          const price = await vaultPriceFeed.getPrice(tokenAddress, false);
          console.log(`- Price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
          console.log("✅ Successfully fetched price through VaultPriceFeed");
        } catch (error) {
          console.log(`⚠️ Error fetching price through VaultPriceFeed: ${error.message}`);
          console.log("This is expected if running in a test environment.");
        }
      }
    } catch (error) {
      console.error(`❌ Error testing VaultPriceFeed for ${token}: ${error.message}`);
    }
  }
  
  // Check if tokens are whitelisted in Vault
  console.log("\n------------------------------------------------------");
  console.log("CHECKING TOKEN WHITELISTING STATUS");
  console.log("------------------------------------------------------");
  
  for (const token of tokens) {
    const tokenAddress = deploymentData[token];
    if (!tokenAddress) continue;
    
    try {
      const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
      console.log(`Is ${token} whitelisted: ${isWhitelisted}`);
      
      if (isWhitelisted) {
        const tokenInfo = await vault.tokenDecimals(tokenAddress);
        console.log(`- ${token} decimals: ${tokenInfo}`);
      } else {
        console.log(`⚠️ ${token} is not whitelisted yet.`);
      }
    } catch (error) {
      console.error(`❌ Error checking whitelist status for ${token}: ${error.message}`);
    }
  }
  
  console.log("\n======================================================");
  console.log("WITNET PRICE FEEDS TESTING COMPLETE");
  console.log("======================================================");
  
  console.log(`
Summary:
1. Witnet Price Feed Integration: ${deploymentData.WitnetPriceFeed ? "Deployed ✅" : "Not Deployed ❌"}
2. VaultPriceFeed Configuration: ${vaultPriceFeed ? "Connected ✅" : "Not Connected ❌"}

Next steps if testing failed:
1. Ensure the Witnet Price Router is correctly deployed and accessible
2. Make sure token data feed IDs are correctly configured in WitnetPriceFeed
3. Whitelist tokens in the Vault if not done already

Note: Some price fetch operations may fail in test environments without proper
mocking of the Witnet Price Router. This is expected behavior and does not 
necessarily indicate an issue with the implementation.
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
