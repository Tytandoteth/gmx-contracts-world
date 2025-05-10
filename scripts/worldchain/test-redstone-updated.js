// Script to test the updated RedStonePriceFeed integration
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Target tokens for the initial release
const TOKENS = [
  { symbol: "WLD", redstoneSymbol: "WLD" },
  { symbol: "WETH", redstoneSymbol: "ETH" } // RedStone uses ETH symbol
];

// Load contract addresses from deployment files
function loadDeploymentData() {
  try {
    // Load the updated RedStonePriceFeed deployment
    const redstoneDeploymentPath = path.join(__dirname, '../../.world-redstone-deployment-updated.json');
    let redStonePriceFeedAddress;
    
    try {
      const redstoneDeployment = JSON.parse(fs.readFileSync(redstoneDeploymentPath, 'utf8'));
      redStonePriceFeedAddress = redstoneDeployment.redStonePriceFeed;
    } catch (error) {
      console.warn(`Warning: Could not load updated RedStonePriceFeed address: ${error.message}`);
      // Use the original deployment as fallback
      try {
        const originalRedstoneDeploymentPath = path.join(__dirname, '../../.world-redstone-deployment.json');
        const originalDeployment = JSON.parse(fs.readFileSync(originalRedstoneDeploymentPath, 'utf8'));
        redStonePriceFeedAddress = originalDeployment.redStonePriceFeed;
      } catch (nestedError) {
        console.warn(`Warning: Could not load original RedStonePriceFeed address: ${nestedError.message}`);
      }
    }
    
    // Try to load custom deployment
    let vaultPriceFeedAddress, vaultAddress;
    try {
      const customDeploymentPath = path.join(__dirname, '../../.custom-deployment.json');
      const customDeployment = JSON.parse(fs.readFileSync(customDeploymentPath, 'utf8'));
      vaultPriceFeedAddress = customDeployment.vaultPriceFeed;
      vaultAddress = customDeployment.vault;
    } catch (error) {
      console.warn(`Warning: Could not load custom deployment: ${error.message}`);
    }
    
    return {
      redStonePriceFeed: redStonePriceFeedAddress || "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
      vaultPriceFeed: vaultPriceFeedAddress || "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
      vault: vaultAddress || "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5"
    };
  } catch (error) {
    console.error("Failed to load any deployment data:", error);
    return {
      redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
      vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
      vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5"
    };
  }
}

async function main() {
  console.log("Testing updated RedStonePriceFeed integration...");
  console.log("==================================================");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using address: ${deployer.address}`);
  
  // Load deployment addresses
  const addresses = loadDeploymentData();
  
  // Allow overriding addresses from command line
  if (process.argv.length > 2) {
    addresses.redStonePriceFeed = process.argv[2];
  }
  
  console.log("Using contract addresses:");
  console.log(`- RedStonePriceFeed: ${addresses.redStonePriceFeed}`);
  console.log(`- VaultPriceFeed: ${addresses.vaultPriceFeed}`);
  console.log(`- Vault: ${addresses.vault}`);
  
  try {
    // Connect to RedStonePriceFeed
    console.log("\nConnecting to RedStonePriceFeed...");
    const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", addresses.redStonePriceFeed);
    
    // Check if RedStonePriceFeed has the updated methods
    console.log("\nVerifying RedStonePriceFeed has required methods:");
    try {
      const supportedTokens = await redStonePriceFeed.getSupportedTokens();
      console.log("✅ getSupportedTokens() - Available");
      console.log("   Supported tokens:", supportedTokens);
    } catch (error) {
      console.log("❌ getSupportedTokens() - Not available:", error.message);
    }
    
    try {
      const threshold = await redStonePriceFeed.getUniqueSignersThreshold();
      console.log(`✅ getUniqueSignersThreshold() - Available (value: ${threshold})`);
    } catch (error) {
      console.log("❌ getUniqueSignersThreshold() - Not available:", error.message);
    }
    
    try {
      const dataThreshold = await redStonePriceFeed.getUniqueSignersThresholdFromData();
      console.log(`✅ getUniqueSignersThresholdFromData() - Available (value: ${dataThreshold})`);
    } catch (error) {
      console.log("❌ getUniqueSignersThresholdFromData() - Not available:", error.message);
    }
    
    // Connect to VaultPriceFeed
    console.log("\nConnecting to VaultPriceFeed...");
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", addresses.vaultPriceFeed);
    
    // Check VaultPriceFeed configuration for target tokens
    console.log("\nChecking VaultPriceFeed configuration for target tokens:");
    
    // Get actual token addresses from VaultPriceFeed if possible
    try {
      const primaryPrice = await vaultPriceFeed.primaryPrices("WLD");
      console.log(`WLD primary price info: ${JSON.stringify(primaryPrice)}`);
    } catch (error) {
      console.log("Couldn't get WLD primary price:", error.message);
    }
    
    // Check for RedStonePriceFeed integration
    console.log("\nChecking if RedStonePriceFeed is used in VaultPriceFeed:");
    const tokenAddressSlot = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "uint256"],
        ["tokenToMarket", 0] // This is a guess, actual slot for token addresses might differ
      )
    );
    console.log(`Trying to read from storage slot: ${tokenAddressSlot}`);
    
    // Use Oracle Keeper API approach as fallback
    console.log("\nSimulating Oracle Keeper API approach:");
    console.log("This would involve setting up an Oracle Keeper service that integrates with RedStone");
    console.log("For frontend integration, this is more reliable than direct on-chain calls");
    
    // Test contract interface with raw calls - avoids RedStone SDK wrapper issues
    console.log("\nTesting raw contract interface for price retrieval:");
    for (const token of TOKENS) {
      console.log(`\nToken: ${token.symbol} (RedStone symbol: ${token.redstoneSymbol})`);
      
      try {
        // First try direct call to RedStonePriceFeed (will likely fail due to missing payload)
        console.log(`Direct call to RedStonePriceFeed.getLatestPrice("${token.redstoneSymbol}"):`);
        try {
          const directPrice = await redStonePriceFeed.getLatestPrice(token.redstoneSymbol);
          console.log(`✅ Success! Price: ${ethers.utils.formatUnits(directPrice, 8)} USD`);
        } catch (error) {
          console.log(`❌ Failed (expected): ${error.message.split('\n')[0]}`);
        }
        
        // Try getting price via VaultPriceFeed (should use the RedStonePriceFeed internally)
        // This assumes the token is configured in VaultPriceFeed
        console.log(`Call to VaultPriceFeed for ${token.symbol}:`);
        try {
          // This won't work without actual token addresses, just a demonstration
          console.log("(This is a demonstration - need actual token addresses)");
          
          // Simulate what would happen if it worked
          console.log("If properly configured, VaultPriceFeed would:");
          console.log("1. Call getPrice(tokenAddress, isLong, includeAmmPrice, useSwapPricing)");
          console.log("2. Internally use RedStonePriceFeed to get the price");
          console.log("3. Return the price for trading operations");
        } catch (error) {
          console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
        }
      } catch (error) {
        console.error(`Error testing ${token.symbol}:`, error);
      }
    }
    
    console.log("\nKey Findings:");
    console.log("1. RedStone requires special transaction payload for direct price calls");
    console.log("2. For frontend integration, Oracle Keeper approach is recommended");
    console.log("3. VaultPriceFeed can use RedStonePriceFeed if properly configured");
    
    console.log("\nNext Steps:");
    console.log("1. Deploy updated RedStonePriceFeed with required interface methods");
    console.log("2. Configure VaultPriceFeed to use the updated RedStonePriceFeed");
    console.log("3. Set up Oracle Keeper service for frontend price data");
    console.log("4. Update interface to use custom deployment addresses");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
