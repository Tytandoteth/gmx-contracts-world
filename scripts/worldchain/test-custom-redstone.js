// Script to test the RedStonePriceFeed integration with custom VaultPriceFeed
const { ethers } = require("hardhat");

// Custom deployment addresses
const CUSTOM_ADDRESSES = {
  redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
  vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
  vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
  tokens: {
    wld: "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652",
    wworld: "0xE1a9E792851b22A808639cf8e75D0A4025333f4B"
  }
};

// Tokens to test
const TEST_TOKENS = [
  { symbol: "WLD", address: CUSTOM_ADDRESSES.tokens.wld },
  { symbol: "ETH", address: ethers.constants.AddressZero }, // Just testing the price feed
  { symbol: "BTC", address: ethers.constants.AddressZero }, // Just testing the price feed
  { symbol: "WWORLD", address: CUSTOM_ADDRESSES.tokens.wworld }
];

async function main() {
  console.log("Starting RedStonePriceFeed integration test...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Tester address: ${deployer.address}`);
  
  try {
    // Connect to RedStonePriceFeed
    console.log("\n--- Testing RedStonePriceFeed Directly ---");
    const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", CUSTOM_ADDRESSES.redStonePriceFeed);
    
    // Test contract ownership and permissions
    const owner = await redStonePriceFeed.owner();
    console.log(`RedStonePriceFeed owner: ${owner}`);
    
    // Test getting token decimals
    console.log("\nTesting getTokenDecimals():");
    for (const token of TEST_TOKENS) {
      try {
        const decimals = await redStonePriceFeed.getTokenDecimals(token.symbol);
        console.log(`${token.symbol} decimals: ${decimals}`);
      } catch (error) {
        console.error(`Error getting decimals for ${token.symbol}:`, error.message);
      }
    }
    
    // Test getting latest prices
    console.log("\nTesting getLatestPrice():");
    for (const token of TEST_TOKENS) {
      try {
        const price = await redStonePriceFeed.getLatestPrice(token.symbol);
        console.log(`${token.symbol} price: ${price.toString()} (${ethers.utils.formatUnits(price, 8)} USD)`);
      } catch (error) {
        console.error(`Error getting price for ${token.symbol}:`, error.message);
      }
    }
    
    // Test batch price fetching
    try {
      console.log("\nTesting getLatestPrices():");
      const symbols = TEST_TOKENS.map(t => t.symbol);
      const prices = await redStonePriceFeed.getLatestPrices(symbols);
      
      for (let i = 0; i < symbols.length; i++) {
        console.log(`${symbols[i]} price: ${prices[i].toString()} (${ethers.utils.formatUnits(prices[i], 8)} USD)`);
      }
    } catch (error) {
      console.error("Error getting batch prices:", error.message);
    }

    // Connect to VaultPriceFeed
    console.log("\n--- Testing VaultPriceFeed Integration ---");
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", CUSTOM_ADDRESSES.vaultPriceFeed);
    
    // Check if RedStonePriceFeed is set for tokens
    console.log("\nChecking price feed configuration in VaultPriceFeed:");
    for (const token of TEST_TOKENS) {
      if (token.address === ethers.constants.AddressZero) continue;
      
      try {
        const priceFeed = await vaultPriceFeed.priceFeeds(token.address);
        const isPriceFeedSet = priceFeed.toLowerCase() === CUSTOM_ADDRESSES.redStonePriceFeed.toLowerCase();
        
        console.log(`${token.symbol} (${token.address}):`);
        console.log(`  Price Feed: ${priceFeed}`);
        console.log(`  Using RedStonePriceFeed: ${isPriceFeedSet ? "✅ Yes" : "❌ No"}`);
        
        // If price feed is set, try to get price from VaultPriceFeed
        if (isPriceFeedSet) {
          const price = await vaultPriceFeed.getPrice(token.address, false, true, false);
          console.log(`  Price from VaultPriceFeed: ${price.toString()} (${ethers.utils.formatUnits(price, 30)} USD)`);
        }
      } catch (error) {
        console.error(`Error checking price feed for ${token.symbol}:`, error.message);
      }
    }
    
    console.log("\nTest completed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
  });
