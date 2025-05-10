const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Starting RedStone configuration for custom deployment...");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    if (fs.existsSync(deploymentFilePath)) {
      const data = fs.readFileSync(deploymentFilePath, 'utf8');
      deploymentData = JSON.parse(data);
      console.log("Loaded custom deployment data");
    } else {
      console.error("Custom deployment file not found. Please run deployCustomPriceFeed.js first.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get deployer - this should be the governance account for custom deployment
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer (governance) address: ${deployer.address}`);
  
  // Get the RedStonePriceFeed contract instance
  console.log(`Connecting to RedStonePriceFeed at ${deploymentData.RedStonePriceFeed}...`);
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
  
  // Get the custom VaultPriceFeed contract instance
  console.log(`Connecting to custom VaultPriceFeed at ${deploymentData.CustomVaultPriceFeed}...`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Verify ownership of RedStonePriceFeed
  const owner = await redStonePriceFeed.owner();
  console.log(`RedStonePriceFeed owner address: ${owner}`);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: The connected account is not the owner of RedStonePriceFeed");
    console.error("This is unexpected as you should have deployed this contract.");
    process.exit(1);
  }
  
  // Define token symbols to configure
  const tokenSymbols = [
    { symbol: "WLD", decimals: 8 },
    { symbol: "ETH", decimals: 8 },
    { symbol: "BTC", decimals: 8 },
    { symbol: "USDC", decimals: 8 },
    { symbol: "USDT", decimals: 8 }
  ];
  
  // Configure token symbols in RedStonePriceFeed (set decimals)
  console.log("Configuring token decimals in RedStonePriceFeed...");
  
  for (const token of tokenSymbols) {
    try {
      // Check current decimals
      const currentDecimals = await redStonePriceFeed.getTokenDecimals(token.symbol);
      console.log(`${token.symbol} current decimals: ${currentDecimals}`);
      
      if (currentDecimals.toString() === token.decimals.toString()) {
        console.log(`✅ ${token.symbol} already has correct decimals (${currentDecimals})`);
      } else {
        // Set decimals for the token symbol
        console.log(`Setting ${token.symbol} decimals to ${token.decimals}...`);
        const tx = await redStonePriceFeed.setTokenDecimals(token.symbol, token.decimals);
        await tx.wait();
        console.log(`✅ Set decimals for ${token.symbol} to ${token.decimals}`);
      }
    } catch (error) {
      console.error(`Error configuring ${token.symbol}:`, error.message);
    }
  }
  
  // Verify the VaultPriceFeed is configured to use our RedStonePriceFeed
  console.log("\nVerifying VaultPriceFeed configuration for tokens...");
  
  // Map token addresses to symbols for verification
  const tokenAddresses = {
    "WLD": deploymentData.WLD,
    "WWORLD": deploymentData.WWORLD
  };
  
  for (const [symbol, address] of Object.entries(tokenAddresses)) {
    try {
      const priceFeed = await vaultPriceFeed.priceFeeds(address);
      console.log(`${symbol} (${address}) price feed: ${priceFeed}`);
      
      if (priceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase()) {
        console.log(`✅ ${symbol} using RedStonePriceFeed correctly`);
      } else {
        console.log(`❌ ${symbol} not using RedStonePriceFeed - reconfiguring...`);
        // Assuming we need to configure VaultPriceFeed for this token
        const tx = await vaultPriceFeed.setTokenConfig(
          address,                           // token address
          deploymentData.RedStonePriceFeed,  // price feed address
          8,                                 // price decimals
          symbol === "USDC" || symbol === "USDT"  // isStable - true for stablecoins
        );
        await tx.wait();
        console.log(`✅ Reconfigured ${symbol} to use RedStonePriceFeed`);
      }
    } catch (error) {
      console.error(`Error verifying ${symbol}:`, error.message);
    }
  }
  
  console.log("\nRedStone configuration completed for custom deployment!");
  console.log("You can now use your custom VaultPriceFeed with RedStone integration for development and testing.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Configuration failed:", error);
    process.exit(1);
  });
