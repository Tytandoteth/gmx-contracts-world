// Script to configure the custom VaultPriceFeed with the updated RedStonePriceFeed
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Target tokens for the initial release
const TOKENS = [
  {
    symbol: "WLD",
    // This will be loaded from the deployment file
    address: "", 
    priceDecimals: 8,
    isStableToken: false
  },
  {
    symbol: "WETH",
    // This will be loaded from the deployment file
    address: "",
    priceDecimals: 8,
    isStableToken: false
  }
];

// Load the deployment files to get contract addresses
function loadDeploymentData() {
  try {
    // Load the updated RedStonePriceFeed deployment
    const redstoneDeploymentPath = path.join(__dirname, '../../.world-redstone-deployment-updated.json');
    const redstoneDeployment = JSON.parse(fs.readFileSync(redstoneDeploymentPath, 'utf8'));
    
    // Load the main GMX deployment with VaultPriceFeed and token addresses
    const mainDeploymentPath = path.join(__dirname, '../../.world-deployment.json');
    const mainDeployment = JSON.parse(fs.readFileSync(mainDeploymentPath, 'utf8'));
    
    // Load token addresses from the custom deployment
    const customDeploymentPath = path.join(__dirname, '../../.custom-deployment.json');
    const customDeployment = JSON.parse(fs.readFileSync(customDeploymentPath, 'utf8'));
    
    // Update token addresses
    TOKENS[0].address = customDeployment.tokens.wld;
    TOKENS[1].address = customDeployment.tokens.weth;
    
    return {
      redStonePriceFeed: redstoneDeployment.redStonePriceFeed,
      vaultPriceFeed: customDeployment.vaultPriceFeed,
      vault: customDeployment.vault
    };
  } catch (error) {
    console.error("Failed to load deployment data:", error);
    console.log("Creating default configuration with hardcoded addresses...");
    
    // Default to hardcoded addresses if files don't exist
    TOKENS[0].address = "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652"; // WLD
    TOKENS[1].address = "0xE1a9E792851b22A808639cf8e75D0A4025333f4B"; // WETH
    
    return {
      redStonePriceFeed: "", // Will be provided as a command-line argument
      vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
      vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5"
    };
  }
}

async function main() {
  console.log("Configuring VaultPriceFeed with the updated RedStonePriceFeed...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using address: ${deployer.address}`);
  
  // Load deployment addresses
  let addresses = loadDeploymentData();
  
  // Allow overriding the RedStonePriceFeed address from environment variable
  if (process.env.REDSTONE_ADDRESS) {
    addresses.redStonePriceFeed = process.env.REDSTONE_ADDRESS;
    console.log(`Using RedStonePriceFeed address from environment: ${addresses.redStonePriceFeed}`);
  }
  
  if (!addresses.redStonePriceFeed) {
    console.error("Error: RedStonePriceFeed address is required");
    console.log("Usage: npx hardhat run scripts/worldchain/configure-redstone-updated.js --network worldchain [redStonePriceFeedAddress]");
    process.exit(1);
  }
  
  console.log("Configuration Details:");
  console.log(`- RedStonePriceFeed: ${addresses.redStonePriceFeed}`);
  console.log(`- VaultPriceFeed: ${addresses.vaultPriceFeed}`);
  console.log("- Tokens:");
  TOKENS.forEach(token => {
    console.log(`  * ${token.symbol}: ${token.address}`);
  });
  
  try {
    // Connect to the VaultPriceFeed contract
    console.log("\nConnecting to VaultPriceFeed...");
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", addresses.vaultPriceFeed);
    
    // Check governance
    const govAddress = await vaultPriceFeed.gov();
    console.log(`VaultPriceFeed governance: ${govAddress}`);
    
    // Verify deployer has governance rights
    if (govAddress.toLowerCase() !== deployer.address.toLowerCase()) {
      console.warn(`WARNING: Your address (${deployer.address}) does not have governance rights on VaultPriceFeed.`);
      console.warn("You may not be able to configure the price feed.");
      
      // Ask for confirmation
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise(resolve => {
        readline.question("Do you want to continue anyway? (y/n): ", answer => {
          readline.close();
          if (answer.toLowerCase() !== 'y') {
            console.log("Configuration aborted.");
            process.exit(0);
          }
          resolve();
        });
      });
    }
    
    // Connect to the RedStonePriceFeed contract to verify it exists
    console.log("\nConnecting to RedStonePriceFeed...");
    const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", addresses.redStonePriceFeed);
    
    // Verify the RedStonePriceFeed has the required methods
    try {
      const supportedTokens = await redStonePriceFeed.getSupportedTokens();
      console.log("Supported tokens:", supportedTokens);
      
      const threshold = await redStonePriceFeed.getUniqueSignersThreshold();
      console.log(`Unique signers threshold: ${threshold}`);
    } catch (error) {
      console.warn("WARNING: RedStonePriceFeed may not have all required methods:", error.message);
      console.warn("Continuing with configuration anyway...");
    }
    
    // Configure VaultPriceFeed with RedStonePriceFeed for each token
    console.log("\nConfiguring tokens in VaultPriceFeed...");
    for (const token of TOKENS) {
      console.log(`Configuring ${token.symbol} (${token.address})...`);
      
      // Check current configuration
      const currentPriceFeed = await vaultPriceFeed.priceFeeds(token.address);
      console.log(`Current price feed for ${token.symbol}: ${currentPriceFeed}`);
      
      if (currentPriceFeed.toLowerCase() === addresses.redStonePriceFeed.toLowerCase()) {
        console.log(`✅ ${token.symbol} already configured with the updated RedStonePriceFeed.`);
        continue;
      }
      
      // Set token configuration in VaultPriceFeed
      console.log(`Setting ${token.symbol} to use RedStonePriceFeed...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        token.address,
        addresses.redStonePriceFeed,
        token.priceDecimals,
        token.isStableToken
      );
      
      // Wait for transaction confirmation
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ ${token.symbol} successfully configured to use RedStonePriceFeed.`);
    }
    
    console.log("\nConfiguration completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Run test-redstone-updated.js to verify the configuration");
    console.log("2. Update the interface environment variables to use the updated contract addresses");
  } catch (error) {
    console.error("Configuration failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
