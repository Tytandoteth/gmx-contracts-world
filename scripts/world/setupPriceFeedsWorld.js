const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Get deployment data if it exists
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    return {};
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    return {};
  }
  
  return JSON.parse(fileContent);
}

// Save deployment data
async function saveDeploymentData(newDeployments) {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  const existingData = await getDeploymentData();
  
  const updatedData = { ...existingData, ...newDeployments };
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedData, null, 2));
  
  console.log("Deployment data saved to", deploymentPath);
}

// Main function
async function main() {
  console.log("Setting up price feeds for GMX contracts on World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get existing deployment data
  const deploymentData = await getDeploymentData();
  console.log("Existing deployment data loaded");
  
  // Check for required core contracts
  if (!deploymentData.Vault || !deploymentData.VaultPriceFeed) {
    console.error("Core contracts not deployed. Please deploy core contracts first using deployCoreWorld.js");
    process.exit(1);
  }
  
  // Check for required tokens
  if (!deploymentData.WLD || !deploymentData.WWORLD) {
    console.error("Required tokens not found. Please ensure WLD and WWORLD are specified in deployment data.");
    process.exit(1);
  }
  
  // Initialize deployment updates
  const deployments = {};
  
  // Set up mock price feeds for testing if not in production
  if (!deploymentData.MockPriceFeeds || !deploymentData.MockPriceFeeds.WLD || !deploymentData.MockPriceFeeds.WWORLD) {
    console.log("Deploying mock price feeds for testing...");
    deployments.MockPriceFeeds = {};
    
    // Deploy MockPriceFeed contract for WLD
    console.log("Deploying MockPriceFeed for WLD...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    
    // Deploy with price = $1, with 8 decimals (Chainlink standard)
    const wldPriceFeed = await MockPriceFeed.deploy(ethers.utils.parseUnits("1", 8));
    await wldPriceFeed.deployed();
    console.log(`WLD price feed deployed to: ${wldPriceFeed.address}`);
    deployments.MockPriceFeeds.WLD = wldPriceFeed.address;
    
    // Deploy MockPriceFeed contract for WWORLD
    console.log("Deploying MockPriceFeed for WWORLD...");
    
    // Deploy with price = $3000, with 8 decimals (Chainlink standard)
    // Adjust this price based on the actual WWORLD price if needed
    const worldPriceFeed = await MockPriceFeed.deploy(ethers.utils.parseUnits("3000", 8));
    await worldPriceFeed.deployed();
    console.log(`WWORLD price feed deployed to: ${worldPriceFeed.address}`);
    deployments.MockPriceFeeds.WWORLD = worldPriceFeed.address;
    
    // Save deployment data
    await saveDeploymentData(deployments);
  } else {
    console.log("Using existing mock price feeds:");
    console.log(`- WLD: ${deploymentData.MockPriceFeeds.WLD}`);
    console.log(`- WWORLD: ${deploymentData.MockPriceFeeds.WWORLD}`);
    deployments.MockPriceFeeds = deploymentData.MockPriceFeeds;
  }
  
  // Get the VaultPriceFeed contract
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Check if the current governor is the deployer or Timelock
  const currentGov = await vaultPriceFeed.gov();
  const isDeployerGov = currentGov.toLowerCase() === deployer.address.toLowerCase();
  const isTimelockGov = deploymentData.Timelock && currentGov.toLowerCase() === deploymentData.Timelock.toLowerCase();
  
  console.log(`VaultPriceFeed governor: ${currentGov}`);
  console.log(`Deployer is governor: ${isDeployerGov}`);
  console.log(`Timelock is governor: ${isTimelockGov}`);
  
  if (!isDeployerGov && !isTimelockGov) {
    console.error("Neither deployer nor Timelock is the governor of the VaultPriceFeed. Cannot set price feeds.");
    process.exit(1);
  }
  
  // Set up price feed for WLD token
  console.log(`\nSetting up price feed for WLD token...`);
  try {
    if (isDeployerGov) {
      // If deployer is the governor, we can set the price feed directly
      const tx = await vaultPriceFeed.setTokenConfig(
        deploymentData.WLD,
        deployments.MockPriceFeeds.WLD,
        8, // Chainlink price feeds use 8 decimals
        true // isStrictStable - WLD is a stablecoin
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD price feed successfully set");
    } else {
      console.log("Timelock is the governor. You will need to create a Timelock action to set WLD price feed.");
      console.log("Execute the following through Timelock:");
      console.log(`vaultPriceFeed.setTokenConfig(${deploymentData.WLD}, ${deployments.MockPriceFeeds.WLD}, 8, true)`);
    }
  } catch (error) {
    console.error("Error setting WLD price feed:", error.message);
  }
  
  // Set up price feed for WWORLD token
  console.log(`\nSetting up price feed for WWORLD token...`);
  try {
    if (isDeployerGov) {
      // If deployer is the governor, we can set the price feed directly
      const tx = await vaultPriceFeed.setTokenConfig(
        deploymentData.WWORLD,
        deployments.MockPriceFeeds.WWORLD,
        8, // Chainlink price feeds use 8 decimals
        false // isStrictStable - WWORLD is not a stablecoin
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD price feed successfully set");
    } else {
      console.log("Timelock is the governor. You will need to create a Timelock action to set WWORLD price feed.");
      console.log("Execute the following through Timelock:");
      console.log(`vaultPriceFeed.setTokenConfig(${deploymentData.WWORLD}, ${deployments.MockPriceFeeds.WWORLD}, 8, false)`);
    }
  } catch (error) {
    console.error("Error setting WWORLD price feed:", error.message);
  }
  
  // Check if price feeds were set correctly
  console.log("\nVerifying price feeds...");
  
  try {
    // Check WLD price feed
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD price feed address: ${wldPriceFeed}`);
    console.log(`WLD price feed correctly set: ${wldPriceFeed.toLowerCase() === deployments.MockPriceFeeds.WLD.toLowerCase()}`);
    
    // Check WWORLD price feed
    const worldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WWORLD);
    console.log(`WWORLD price feed address: ${worldPriceFeed}`);
    console.log(`WWORLD price feed correctly set: ${worldPriceFeed.toLowerCase() === deployments.MockPriceFeeds.WWORLD.toLowerCase()}`);
    
    // Try getting prices
    const wldPrice = await vaultPriceFeed.getPrice(deploymentData.WLD, false, true, true);
    console.log(`WLD price: $${ethers.utils.formatUnits(wldPrice, 30)}`);
    
    const worldPrice = await vaultPriceFeed.getPrice(deploymentData.WWORLD, false, true, true);
    console.log(`WWORLD price: $${ethers.utils.formatUnits(worldPrice, 30)}`);
  } catch (error) {
    console.error("Error verifying price feeds:", error.message);
  }
  
  console.log("\nPrice feed setup completed!");
  console.log("Next steps:");
  console.log("1. Whitelist tokens using whitelistTokensWorld.js");
  console.log("2. Validate deployment using validateDeploymentWorld.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
