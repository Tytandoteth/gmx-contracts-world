const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log("Deploying WLD token to World Chain...");
    
    // Get the deployer account from hardhat config
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    // Deploy WLD token
    console.log("Deploying World ID (WLD) token...");
    const FaucetToken = await ethers.getContractFactory("FaucetToken");
    
    // Deploy with 18 decimals and 1 million tokens initial supply
    const initialSupply = ethers.utils.parseUnits("1000000", 18);
    const wld = await FaucetToken.deploy("World ID", "WLD", 18, initialSupply);
    
    await wld.deployed();
    console.log(`WLD token deployed at: ${wld.address}`);
    
    // Enable faucet functionality
    console.log("Enabling faucet functionality...");
    const enableFaucetTx = await wld.enableFaucet();
    await enableFaucetTx.wait();
    console.log("Faucet enabled");
    
    // Save the deployment address
    const deploymentData = {
      WLD: wld.address
    };
    
    const deploymentPath = path.join(__dirname, '..', '..', '.world-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log(`Deployment data saved to ${deploymentPath}`);
    
    console.log("\nDeployment Successful!");
    console.log("----------------------");
    console.log(`WLD Token: ${wld.address}`);
    console.log("\nNext steps:");
    console.log("1. Deploy core contracts with: npx hardhat run scripts/worldchain/deployCore.js --network worldchain");
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
