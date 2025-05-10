// Simple verification script for RedStone integration
const { ethers } = require("hardhat");

async function main() {
  console.log("Verifying RedStone Integration");
  console.log("==============================");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using address: ${deployer.address}`);
  
  // RedStonePriceFeed contract address - use the updated one
  const redStonePriceFeedAddress = "0x345bc48E1370fa399D0A6611669726aAC676DBB3";
  console.log(`RedStonePriceFeed address: ${redStonePriceFeedAddress}`);
  
  // Connect to the RedStonePriceFeed contract
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", redStonePriceFeedAddress);
  
  // Test the contract interface methods
  console.log("\nTesting contract interface methods:");
  
  try {
    const threshold = await redStonePriceFeed.getUniqueSignersThreshold();
    console.log(`✅ getUniqueSignersThreshold(): ${threshold}`);
  } catch (error) {
    console.log(`❌ getUniqueSignersThreshold failed: ${error.message}`);
  }
  
  try {
    const supportedTokens = await redStonePriceFeed.getSupportedTokens();
    console.log(`✅ getSupportedTokens(): ${supportedTokens.join(", ")}`);
  } catch (error) {
    console.log(`❌ getSupportedTokens failed: ${error.message}`);
  }
  
  try {
    const dataThreshold = await redStonePriceFeed.getUniqueSignersThresholdFromData();
    console.log(`✅ getUniqueSignersThresholdFromData(): ${dataThreshold}`);
  } catch (error) {
    console.log(`❌ getUniqueSignersThresholdFromData failed: ${error.message}`);
  }
  
  // Connect to VaultPriceFeed to check configuration
  console.log("\nChecking VaultPriceFeed configuration:");
  
  const vaultPriceFeedAddress = "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf";
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", vaultPriceFeedAddress);
  
  // Test the WLD token configuration
  const wldAddress = "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652";
  try {
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(wldAddress);
    console.log(`WLD price feed: ${wldPriceFeed}`);
    
    if (wldPriceFeed.toLowerCase() === redStonePriceFeedAddress.toLowerCase()) {
      console.log("✅ WLD correctly configured to use RedStonePriceFeed");
    } else {
      console.log(`❌ WLD using different price feed: ${wldPriceFeed}`);
    }
  } catch (error) {
    console.log(`❌ Failed to get WLD price feed: ${error.message}`);
  }
  
  // Test the WETH token configuration
  const wethAddress = "0xE1a9E792851b22A808639cf8e75D0A4025333f4B";
  try {
    const wethPriceFeed = await vaultPriceFeed.priceFeeds(wethAddress);
    console.log(`WETH price feed: ${wethPriceFeed}`);
    
    if (wethPriceFeed.toLowerCase() === redStonePriceFeedAddress.toLowerCase()) {
      console.log("✅ WETH correctly configured to use RedStonePriceFeed");
    } else {
      console.log(`❌ WETH using different price feed: ${wethPriceFeed}`);
    }
  } catch (error) {
    console.log(`❌ Failed to get WETH price feed: ${error.message}`);
  }
  
  console.log("\nVerification completed!");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
