// Script to configure the custom RedStonePriceFeed with the custom VaultPriceFeed
// This script is designed to work with your custom deployment

const { ethers } = require("hardhat");
const fs = require('fs');

// Custom deployment addresses - Update these with your actual values
const CUSTOM_ADDRESSES = {
  redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
  vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
  vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
  router: "0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b",
  tokens: {
    wld: "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652",
    wworld: "0xE1a9E792851b22A808639cf8e75D0A4025333f4B",
    // Add other token addresses as needed
  }
};

// Updated token configurations for the custom deployment
const TOKEN_CONFIGS = [
  { 
    symbol: "WLD", 
    tokenAddress: ethers.utils.getAddress(CUSTOM_ADDRESSES.tokens.wld), 
    priceDecimals: 8, 
    isStableToken: false 
  },
  { 
    symbol: "WWORLD", 
    tokenAddress: ethers.utils.getAddress(CUSTOM_ADDRESSES.tokens.wworld), 
    priceDecimals: 8, 
    isStableToken: false 
  }
  // Add other tokens as needed
];

async function main() {
  console.log("Starting RedStonePriceFeed configuration for custom deployment...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Connect to the contracts
  console.log("Connecting to custom VaultPriceFeed and RedStonePriceFeed...");
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", CUSTOM_ADDRESSES.vaultPriceFeed);
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", CUSTOM_ADDRESSES.redStonePriceFeed);
  
  // Verify governance (should be your address for the custom deployment)
  const govAddress = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governance address: ${govAddress}`);
  
  if (govAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.warn(`Warning: Your address (${deployer.address}) is not the governance of VaultPriceFeed (${govAddress})`);
    console.log("Proceeding anyway, but commands may fail if you don't have permissions");
  }
  
  // Check available methods on RedStonePriceFeed to debug the issue
  console.log("Checking RedStonePriceFeed interface...");
  
  try {
    // Try to get supported tokens - this will help debug what methods are available
    console.log("Attempting to call getTokenDecimals() for 'WLD'...");
    const wldDecimals = await redStonePriceFeed.getTokenDecimals("WLD");
    console.log(`WLD decimals: ${wldDecimals}`);
  } catch (error) {
    console.log(`Error calling getTokenDecimals: ${error.message}`);
    console.log("This suggests the contract doesn't have this method or it's called differently");
  }
  
  // Configure VaultPriceFeed with RedStonePriceFeed for each token
  console.log("\nConfiguring price feeds in custom VaultPriceFeed...");
  for (const token of TOKEN_CONFIGS) {
    try {
      console.log(`Setting price feed for ${token.symbol} (${token.tokenAddress})...`);
      
      // Check if the token already has a price feed
      const currentPriceFeed = await vaultPriceFeed.priceFeeds(token.tokenAddress);
      console.log(`Current price feed for ${token.symbol}: ${currentPriceFeed}`);
      
      if (currentPriceFeed.toLowerCase() === CUSTOM_ADDRESSES.redStonePriceFeed.toLowerCase()) {
        console.log(`✅ ${token.symbol} already using RedStonePriceFeed`);
        continue;
      }
      
      // Set the token configuration
      console.log(`Calling setTokenConfig for ${token.symbol}...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        token.tokenAddress,
        CUSTOM_ADDRESSES.redStonePriceFeed,
        token.priceDecimals,
        token.isStableToken
      );
      
      await tx.wait();
      console.log(`✅ Price feed set for ${token.symbol}`);
    } catch (error) {
      console.error(`Error setting price feed for ${token.symbol}:`, error.message);
    }
  }
  
  // Save the configuration
  const configData = {
    custom: {
      vaultPriceFeedAddress: CUSTOM_ADDRESSES.vaultPriceFeed,
      redStonePriceFeedAddress: CUSTOM_ADDRESSES.redStonePriceFeed,
      vaultAddress: CUSTOM_ADDRESSES.vault,
      routerAddress: CUSTOM_ADDRESSES.router,
      tokens: TOKEN_CONFIGS.reduce((acc, token) => {
        acc[token.symbol] = {
          address: token.tokenAddress,
          priceFeed: CUSTOM_ADDRESSES.redStonePriceFeed,
          priceDecimals: token.priceDecimals,
          isStableToken: token.isStableToken
        };
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    }
  };
  
  fs.writeFileSync(
    '.custom-redstone-config.json',
    JSON.stringify(configData, null, 2)
  );
  
  console.log("\nConfiguration completed!");
  console.log("Custom deployment configuration saved to .custom-redstone-config.json");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Configuration failed:", error);
    process.exit(1);
  });
