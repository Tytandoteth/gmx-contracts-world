const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Setting up mock prices for WLD and WETH...");
  
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
  
  // Connect to mock price feeds
  console.log(`Connecting to WLD MockPriceFeed at ${deploymentData.MockPriceFeeds.WLD}...`);
  const wldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
  
  console.log(`Connecting to WETH MockPriceFeed at ${deploymentData.MockPriceFeeds.WETH}...`);
  const wethPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WETH);
  
  console.log(`Connecting to VaultPriceFeed at ${deploymentData.CustomVaultPriceFeed}...`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Update mock prices
  console.log("Updating mock prices...");
  
  // Update WLD price (setting to $1.25)
  await wldPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1.25", 8));
  console.log("Set WLD price to $1.25");
  
  // Update WETH price (setting to $1750)
  await wethPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1750", 8));
  console.log("Set WETH price to $1750");
  
  // Switch VaultPriceFeed to use mock price feeds
  console.log("Switching VaultPriceFeed to use mock price feeds...");
  
  // Update VaultPriceFeed for WLD
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WLD mock feed");
  
  // Update VaultPriceFeed for WETH
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,
    deploymentData.MockPriceFeeds.WETH,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WETH mock feed");
  
  console.log("\nMock prices set up for development!");
  console.log("You can now use the custom deployment with predictable pricing for WLD and WETH.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Setup failed:", error);
    process.exit(1);
  });