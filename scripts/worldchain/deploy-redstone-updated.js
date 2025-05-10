// Script to deploy the updated RedStonePriceFeed contract
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying updated RedStonePriceFeed contract...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  
  // Deploy the RedStonePriceFeed contract
  const RedStonePriceFeed = await ethers.getContractFactory("RedStonePriceFeed");
  const redStonePriceFeed = await RedStonePriceFeed.deploy();
  
  await redStonePriceFeed.deployed();
  
  console.log(`RedStonePriceFeed deployed to: ${redStonePriceFeed.address}`);
  
  // Save the deployment information
  const deploymentData = {
    network: network.name,
    redStonePriceFeed: redStonePriceFeed.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "updated" // Mark this as the updated version
  };
  
  // Create the deployment file path
  const deploymentFilePath = path.join(__dirname, '../../.world-redstone-deployment-updated.json');
  
  // Save the deployment data to a file
  fs.writeFileSync(
    deploymentFilePath,
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log(`Deployment information saved to ${deploymentFilePath}`);
  console.log("\nNext steps:");
  console.log("1. Verify the contract on the block explorer");
  console.log("2. Run configure-redstone-updated.js to configure the VaultPriceFeed with the new RedStonePriceFeed");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
