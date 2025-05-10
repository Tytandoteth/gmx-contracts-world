// Direct deployment script for RedStonePriceFeed
// This script uses ethers directly without the helpers

const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("Starting RedStonePriceFeed deployment using direct ethers...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Display balance
  const balance = await deployer.getBalance();
  console.log(`Deployer balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Compile the contract (implicit with hardhat)
  console.log("Compiling RedStonePriceFeed...");
  const RedStonePriceFeed = await ethers.getContractFactory("RedStonePriceFeed");
  
  // Deploy the contract
  console.log("Deploying RedStonePriceFeed...");
  const redStonePriceFeed = await RedStonePriceFeed.deploy();
  await redStonePriceFeed.deployed();
  
  console.log(`RedStonePriceFeed deployed to: ${redStonePriceFeed.address}`);
  
  // Define token configurations
  const tokenConfigs = [
    { symbol: "WLD", decimals: 18 },
    { symbol: "ETH", decimals: 18 },
    { symbol: "BTC", decimals: 8 },
    { symbol: "USDC", decimals: 6 },
    { symbol: "USDT", decimals: 6 }
  ];
  
  // Configure token decimals
  console.log("Configuring token decimals...");
  for (const token of tokenConfigs) {
    console.log(`Setting decimals for ${token.symbol} to ${token.decimals}`);
    const tx = await redStonePriceFeed.setTokenDecimals(token.symbol, token.decimals);
    await tx.wait();
    console.log(`✅ Decimals set for ${token.symbol}`);
  }
  
  // Save deployment information
  const deploymentData = {
    redStonePriceFeed: redStonePriceFeed.address,
    network: network.name,
    deployer: deployer.address,
    tokens: tokenConfigs.map(t => t.symbol),
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    '.world-redstone-deployment.json',
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("Deployment completed successfully!");
  console.log("Deployment data saved to .world-redstone-deployment.json");
  
  return {
    redStonePriceFeed: redStonePriceFeed.address
  };
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
