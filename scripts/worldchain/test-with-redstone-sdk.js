// Script to test the RedStonePriceFeed using the RedStone SDK
const { ethers } = require("hardhat");
const { WrapperBuilder } = require("@redstone-finance/evm-connector");

// Custom deployment addresses
const CUSTOM_ADDRESSES = {
  redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
  vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
};

// Tokens to test
const TEST_TOKENS = [
  { symbol: "WLD" },
  { symbol: "ETH" },
  { symbol: "BTC" },
  { symbol: "WWORLD" }
];

async function main() {
  console.log("Starting RedStonePriceFeed test with SDK...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Tester address: ${deployer.address}`);
  
  try {
    // Connect to RedStonePriceFeed
    const redStonePriceFeed = await ethers.getContractAt(
      "RedStonePriceFeed", 
      CUSTOM_ADDRESSES.redStonePriceFeed
    );
    
    // Wrap the contract with the RedStone data provider
    const wrappedContract = WrapperBuilder
      .wrapLite(redStonePriceFeed.connect(deployer))
      .usingPriceFeed("redstone-primary");
    
    // Test getting latest prices
    console.log("\nTesting getLatestPrice with RedStone SDK:");
    for (const token of TEST_TOKENS) {
      try {
        const price = await wrappedContract.getLatestPrice(token.symbol);
        console.log(`${token.symbol} price: ${price.toString()} (${ethers.utils.formatUnits(price, 8)} USD)`);
      } catch (error) {
        console.error(`Error getting price for ${token.symbol}:`, error.message);
      }
    }
    
    // Optionally test batch price fetching
    try {
      console.log("\nTesting getLatestPrices with RedStone SDK:");
      const symbols = TEST_TOKENS.map(t => t.symbol);
      const prices = await wrappedContract.getLatestPrices(symbols);
      
      for (let i = 0; i < symbols.length; i++) {
        console.log(`${symbols[i]} price: ${prices[i].toString()} (${ethers.utils.formatUnits(prices[i], 8)} USD)`);
      }
    } catch (error) {
      console.error("Error getting batch prices:", error.message);
    }
    
    console.log("\nRedStone SDK test completed!");
    
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
