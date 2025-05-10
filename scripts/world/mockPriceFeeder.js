const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Setting up mock prices for development...");
  
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
  
  // For development, we'll use the mock price feeds
  console.log(`Connecting to WLD MockPriceFeed at ${deploymentData.MockPriceFeeds.WLD}...`);
  const wldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
  
  console.log(`Connecting to WWORLD MockPriceFeed at ${deploymentData.MockPriceFeeds.WWORLD}...`);
  const wworldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WWORLD);
  
  console.log(`Connecting to VaultPriceFeed at ${deploymentData.CustomVaultPriceFeed}...`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Update the mock prices
  console.log("Updating mock prices...");
  
  // Update WLD price (setting to $1.25)
  await wldPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1.25", 8));
  console.log("Set WLD price to $1.25");
  
  // Update WWORLD price (setting to $2.75)
  await wworldPriceFeed.setLatestAnswer(ethers.utils.parseUnits("2.75", 8));
  console.log("Set WWORLD price to $2.75");
  
  // Switch VaultPriceFeed to use the mock price feeds for easier development
  console.log("Switching VaultPriceFeed to use mock price feeds for development...");
  
  // Update VaultPriceFeed to use mock feeds
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WLD mock feed");
  
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WWORLD,
    deploymentData.MockPriceFeeds.WWORLD,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WWORLD mock feed");
  
  console.log("\nMock prices set up for development!");
  console.log("You can now use the custom deployment with predictable pricing for local testing.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
