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
  
  // Verify governance
  const govAddress = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governance address: ${govAddress}`);
  
  if (govAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: The connected account is not the governance of the custom VaultPriceFeed");
    process.exit(1);
  }
  
  // Configure RedStonePriceFeed
  console.log("Configuring RedStonePriceFeed...");
  
  // Define tokens to configure in RedStonePriceFeed
  const tokenConfigs = [
    { 
      symbol: "WLD", 
      redstoneSymbol: "WLD",
      tokenAddress: deploymentData.WLD
    },
    { 
      symbol: "WWORLD", 
      redstoneSymbol: "WORLD",  // Adjust this to match the actual RedStone symbol if different
      tokenAddress: deploymentData.WWORLD
    }
  ];
  
  // Add additional tokens if needed (ETH, BTC, etc.)
  const additionalTokens = [
    {
      symbol: "ETH",
      redstoneSymbol: "ETH"
    },
    {
      symbol: "BTC",
      redstoneSymbol: "BTC"
    },
    {
      symbol: "USDC",
      redstoneSymbol: "USDC"
    }
  ];
  
  // Configure token symbols in RedStonePriceFeed
  for (const token of tokenConfigs) {
    console.log(`Configuring ${token.symbol} in RedStonePriceFeed...`);
    
    try {
      // Check if already configured
      const currentSymbol = await redStonePriceFeed.symbols(token.tokenAddress);
      if (currentSymbol !== "" && currentSymbol !== ethers.constants.HashZero) {
        console.log(`${token.symbol} already configured with symbol: ${currentSymbol}`);
      } else {
        // Set the RedStone symbol for this token
        const tx = await redStonePriceFeed.setSymbol(token.tokenAddress, token.redstoneSymbol);
        await tx.wait();
        console.log(`✅ Set RedStone symbol ${token.redstoneSymbol} for ${token.symbol}`);
      }
    } catch (error) {
      console.error(`Error configuring ${token.symbol}:`, error.message);
    }
  }
  
  // Configure RedStone data service details if needed
  // Note: The actual configuration depends on the RedStonePriceFeed implementation
  // You might need to adjust this based on your contract's actual functions
  
  try {
    // Example: Set RedStone data service ID
    // If your RedStonePriceFeed contract has these functions:
    console.log("Configuring RedStone data service...");
    
    // Check if the contract has the setDataServiceId function
    if (typeof redStonePriceFeed.setDataServiceId === "function") {
      await redStonePriceFeed.setDataServiceId("redstone-main-demo");
      console.log("✅ Set RedStone data service ID to 'redstone-main-demo'");
    }
    
    // Check if the contract has the setUniqueSignersThreshold function
    if (typeof redStonePriceFeed.setUniqueSignersThreshold === "function") {
      await redStonePriceFeed.setUniqueSignersThreshold(1);
      console.log("✅ Set RedStone unique signers threshold to 1");
    }
    
    // Check if the contract has functions to configure other settings
    // Add more configuration as needed based on your RedStonePriceFeed implementation
    
  } catch (error) {
    console.error("Error configuring RedStone data service:", error.message);
    console.log("This may be normal if your RedStonePriceFeed doesn't have these functions.");
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
