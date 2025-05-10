/**
 * This script demonstrates how to use the RedStone SDK with your GMX custom deployment
 * It shows how to properly wrap contract calls to include RedStone price data
 * 
 * To run this script:
 * npx hardhat run scripts/worldchain/test-redstone-integration.js --network worldchain
 */

const { ethers } = require("hardhat");
const { WrapperBuilder } = require("@redstone-finance/evm-connector");

// Custom deployment addresses
const ADDRESSES = {
  redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
  vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf", 
  vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5"
};

// Tokens to test
const TOKENS = [
  { symbol: "WLD", address: "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652" },
  { symbol: "ETH", address: ethers.constants.AddressZero }, // Just for price testing
  { symbol: "BTC", address: ethers.constants.AddressZero }  // Just for price testing
];

// ABI for RedStonePriceFeed
const REDSTONE_PRICE_FEED_ABI = [
  "function getLatestPrice(string memory symbol) public view returns (uint256)",
  "function getLatestPrices(string[] memory symbols) public view returns (uint256[] memory)",
  "function getTokenDecimals(string memory symbol) public view returns (uint8)"
];

async function main() {
  console.log("Testing RedStone integration with GMX on World Chain");
  console.log("=================================================");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using address: ${deployer.address}`);
  
  try {
    // Connect to RedStonePriceFeed contract
    console.log(`\nConnecting to RedStonePriceFeed at ${ADDRESSES.redStonePriceFeed}`);
    const redStonePriceFeed = new ethers.Contract(
      ADDRESSES.redStonePriceFeed,
      REDSTONE_PRICE_FEED_ABI,
      deployer
    );
    
    // Test direct contract calls - these will likely fail with "CalldataMustHaveValidPayload"
    console.log("\nTesting direct contract calls (these may fail - expected behavior):");
    try {
      console.log(`Attempting to call getLatestPrice("WLD") directly...`);
      const directPrice = await redStonePriceFeed.getLatestPrice("WLD");
      console.log(`✓ Direct call succeeded! WLD price: ${ethers.utils.formatUnits(directPrice, 8)}`);
    } catch (error) {
      console.log(`✗ Direct call failed as expected: ${error.message.split('\n')[0]}`);
      console.log("This is normal - RedStone requires wrapped calls with price data");
    }
    
    // Using different RedStone wrapper patterns to test compatibility
    console.log("\nTesting RedStone wrapper patterns:");
    
    // =====================================================
    // Pattern 1: Basic wrapper with authorizedSigners only
    // =====================================================
    try {
      console.log("\n1. Testing basic wrapper with authorizedSigners:");
      const wrappedContract1 = WrapperBuilder
        .wrap(redStonePriceFeed)
        .usingDataService({
          dataServiceId: "redstone-primary-prod",
          authorizedSigners: ["0x0C39486f770B26F5527BBBf942726537986Cd7eb"]
        });
      
      const wldPrice1 = await wrappedContract1.getLatestPrice("WLD");
      console.log(`✓ WLD price: ${ethers.utils.formatUnits(wldPrice1, 8)} USD`);
    } catch (error) {
      console.log(`✗ Pattern 1 failed: ${error.message.split('\n')[0]}`);
    }
    
    // =====================================================
    // Pattern 2: Using dataPackagesIds
    // =====================================================
    try {
      console.log("\n2. Testing wrapper with dataPackagesIds:");
      const wrappedContract2 = WrapperBuilder
        .wrap(redStonePriceFeed)
        .usingDataService({
          dataServiceId: "redstone-primary-prod",
          dataPackagesIds: ["price-feed"],
          authorizedSigners: ["0x0C39486f770B26F5527BBBf942726537986Cd7eb"]
        });
      
      const wldPrice2 = await wrappedContract2.getLatestPrice("WLD");
      console.log(`✓ WLD price: ${ethers.utils.formatUnits(wldPrice2, 8)} USD`);
    } catch (error) {
      console.log(`✗ Pattern 2 failed: ${error.message.split('\n')[0]}`);
    }
    
    // =====================================================
    // Pattern 3: Using uniqueSignersCount
    // =====================================================
    try {
      console.log("\n3. Testing wrapper with uniqueSignersCount:");
      const wrappedContract3 = WrapperBuilder
        .wrap(redStonePriceFeed)
        .usingDataService({
          dataServiceId: "redstone-primary-prod",
          uniqueSignersCount: 1,
          authorizedSigners: ["0x0C39486f770B26F5527BBBf942726537986Cd7eb"]
        });
      
      const wldPrice3 = await wrappedContract3.getLatestPrice("WLD");
      console.log(`✓ WLD price: ${ethers.utils.formatUnits(wldPrice3, 8)} USD`);
    } catch (error) {
      console.log(`✗ Pattern 3 failed: ${error.message.split('\n')[0]}`);
    }
    
    // Get the working pattern based on previous tests
    console.log("\nUsing the working wrapper pattern to test all tokens:");
    
    // Use the pattern that worked (or try all if none worked yet)
    const workingPattern = async () => {
      // Try each pattern until one works
      try {
        const wrapper = WrapperBuilder
          .wrap(redStonePriceFeed)
          .usingDataService({
            dataServiceId: "redstone-primary-prod",
            authorizedSigners: ["0x0C39486f770B26F5527BBBf942726537986Cd7eb"],
            uniqueSignersCount: 1
          });
          
        return wrapper;
      } catch (error) {
        console.error("All wrapper patterns failed:", error);
        throw error;
      }
    };
    
    // Get a working wrapper
    const wrappedContract = await workingPattern();
    
    // Test all tokens
    console.log("\nTesting all token prices:");
    for (const token of TOKENS) {
      try {
        const price = await wrappedContract.getLatestPrice(token.symbol);
        console.log(`${token.symbol} price: ${ethers.utils.formatUnits(price, 8)} USD`);
      } catch (error) {
        console.error(`Failed to get price for ${token.symbol}:`, error.message);
      }
    }
    
    // Test batch price retrieval
    try {
      console.log("\nTesting batch price retrieval:");
      const symbols = TOKENS.map(t => t.symbol);
      const prices = await wrappedContract.getLatestPrices(symbols);
      
      for (let i = 0; i < symbols.length; i++) {
        console.log(`${symbols[i]} price: ${ethers.utils.formatUnits(prices[i], 8)} USD`);
      }
    } catch (error) {
      console.error("Failed to get batch prices:", error.message);
    }
    
    console.log("\nIntegration test completed!");
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
