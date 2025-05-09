const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  // Define deployment file path
  const deploymentFilePath = path.join(__dirname, '../../.world-timelock-deployment.json');
  let deploymentData = {};
  
  try {
    if (fs.existsSync(deploymentFilePath)) {
      const data = fs.readFileSync(deploymentFilePath, 'utf8');
      deploymentData = JSON.parse(data);
      console.log("Loaded existing deployment data");
    }
  } catch (error) {
    console.error("Error loading deployment data:", error);
    deploymentData = {};
  }
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const { AddressZero } = ethers.constants;
  
  // Load existing deployment data from official .world-deployment.json
  const existingDeploymentPath = path.join(__dirname, '../../.world-deployment.json');
  let existingDeployment = {};
  
  try {
    if (fs.existsSync(existingDeploymentPath)) {
      const data = fs.readFileSync(existingDeploymentPath, 'utf8');
      existingDeployment = JSON.parse(data);
      console.log("Loaded existing official deployment data");
      
      // Copy relevant contract addresses to our deployment data
      deploymentData.Vault = existingDeployment.Vault;
      deploymentData.Router = existingDeployment.Router;
      deploymentData.VaultPriceFeed = existingDeployment.VaultPriceFeed;
      deploymentData.OrderBook = existingDeployment.OrderBook;
      deploymentData.PositionRouter = existingDeployment.PositionRouter;
      deploymentData.WLD = existingDeployment.WLD;
      deploymentData.WWORLD = existingDeployment.WWORLD;
      
      console.log("Using existing contracts from official deployment:");
      console.log("- Vault:", deploymentData.Vault);
      console.log("- VaultPriceFeed:", deploymentData.VaultPriceFeed);
      console.log("- WLD:", deploymentData.WLD);
      console.log("- WWORLD:", deploymentData.WWORLD);
    }
  } catch (error) {
    console.error("Error loading existing deployment:", error);
  }
  
  // Deploy new Timelock with 5-minute buffer
  console.log("\nDeploying new Timelock with 5-minute buffer...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const buffer = 300; // 5 minutes in seconds
  
  // Get necessary parameters from existing deployment
  // For missing values, use the deployer address or zero address
  const glpManager = existingDeployment.GlpManager || deployer.address;
  
  const timelock = await Timelock.deploy(
    deployer.address, // admin
    buffer, // buffer period in seconds
    deployer.address, // token manager
    deployer.address, // mint receiver
    glpManager, // glp manager
    AddressZero, // prev glp manager (none)
    existingDeployment.Router || AddressZero, // router
    ethers.utils.parseUnits("100000000", 18), // max token supply (100M tokens)
    10, // marginFeeBasisPoints (0.1%)
    100 // maxMarginFeeBasisPoints (1%)
  );
  await timelock.deployed();
  deploymentData.Timelock = timelock.address;
  deploymentData.TimelockBuffer = buffer;
  console.log("New Timelock deployed at:", timelock.address);
  console.log("Buffer period: 5 minutes (300 seconds)");
  
  // Save deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\nNew Timelock deployment data saved to:", deploymentFilePath);
  
  console.log("\nDeployment Summary:");
  console.log("- New Timelock (5min buffer):", deploymentData.Timelock);
  console.log("- Old Timelock:", existingDeployment.Timelock);
  
  console.log("\nNext steps:");
  console.log("1. To transfer governance from the deployer to the new Timelock:");
  console.log(`   await vault.setGov("${deploymentData.Timelock}");`);
  console.log(`   await vaultPriceFeed.setGov("${deploymentData.Timelock}");`);
  console.log("2. Or to transfer governance from the old Timelock to the new one, create a governance action:");
  console.log(`   Use the old Timelock's signalSetGov method for each contract`);
  console.log("3. Wait for the buffer period of the old Timelock to pass");
  console.log("4. Execute the governance transfer");
  console.log("5. Create and execute governance actions with the new 5-minute Timelock");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
