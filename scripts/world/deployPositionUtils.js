const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy PositionUtils library
 * This is required before we can deploy PositionRouter
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING POSITION UTILS LIBRARY");
  console.log("======================================================");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded custom deployment data");
  } catch (error) {
    console.error("❌ Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  
  // Deploy PositionUtils
  console.log("\nDeploying PositionUtils library...");
  const PositionUtils = await ethers.getContractFactory("PositionUtils");
  const positionUtils = await PositionUtils.deploy();
  await positionUtils.deployed();
  deploymentData.CustomPositionUtils = positionUtils.address;
  console.log(`✅ PositionUtils deployed at: ${positionUtils.address}`);
  
  // Save updated deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("✅ Deployment data updated successfully");
  
  console.log("\n======================================================");
  console.log("POSITION UTILS DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log("\nYou can now proceed with deploying PositionRouter and other remaining contracts.");
  console.log("Run: npx hardhat run scripts/world/deployRemainingContractsStep2.js --network worldchain");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
