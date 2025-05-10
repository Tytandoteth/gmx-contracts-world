const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Testing RedStone integration with custom deployment...");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("Loaded custom deployment data");
  } catch (error) {
    console.error("Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Connect to contracts
  console.log(`Connecting to RedStonePriceFeed at ${deploymentData.RedStonePriceFeed}...`);
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
  
  console.log(`Connecting to VaultPriceFeed at ${deploymentData.CustomVaultPriceFeed}...`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  console.log(`Connecting to Vault at ${deploymentData.CustomVault}...`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Define tokens to test
  const tokens = [
    { symbol: "WLD", address: deploymentData.WLD },
    { symbol: "WWORLD", address: deploymentData.WWORLD }
  ];
  
  // Test getting prices through VaultPriceFeed
  console.log("\n--- Testing VaultPriceFeed prices ---");
  for (const token of tokens) {
    try {
      // Use the Vault's getMaxPrice function which uses VaultPriceFeed
      const maxPrice = await vault.getMaxPrice(token.address);
      console.log(`${token.symbol} max price: ${ethers.utils.formatUnits(maxPrice, 30)} USD`);
      
      const minPrice = await vault.getMinPrice(token.address);
      console.log(`${token.symbol} min price: ${ethers.utils.formatUnits(minPrice, 30)} USD`);
    } catch (error) {
      console.error(`Error getting ${token.symbol} price from Vault:`, error.message);
      
      // Fallback to direct VaultPriceFeed call
      try {
        const price = await vaultPriceFeed.getPrice(token.address, false, true, false);
        console.log(`${token.symbol} price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
      } catch (innerError) {
        console.error(`Error getting ${token.symbol} price from VaultPriceFeed:`, innerError.message);
      }
    }
  }
  
  // Try to get prices directly from RedStonePriceFeed
  console.log("\n--- Testing direct RedStonePriceFeed prices ---");
  const symbols = ["WLD", "ETH", "BTC", "USDC"];
  
  for (const symbol of symbols) {
    try {
      // Note: This may fail in a normal test environment without RedStone data in the calldata
      // This is expected as RedStone requires special transaction formatting
      const price = await redStonePriceFeed.getLatestPrice(symbol);
      console.log(`${symbol} price from RedStonePriceFeed: ${ethers.utils.formatUnits(price, 8)} USD`);
    } catch (error) {
      console.log(`${symbol}: Could not get direct price from RedStonePriceFeed (expected without RedStone wrapping)`);
      console.log(`Error: ${error.message.substring(0, 100)}...`);
    }
  }
  
  console.log("\nPrice testing completed!");
  console.log("Note: Direct RedStonePriceFeed calls are expected to fail in a test environment");
  console.log("To use RedStone in production, your frontend needs to use the RedStone SDK wrapper.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
  });
