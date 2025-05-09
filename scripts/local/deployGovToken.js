const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, '..', '..', '.local-deployment.json');
  if (fs.existsSync(deploymentPath)) {
    return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  return {};
}

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, '..', '..', '.local-deployment.json');
  const existingData = await getDeploymentData();
  const updatedData = { ...existingData, ...data };
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);
}

async function main() {
  try {
    console.log("Deploying GMX governance tokens to local Hardhat network...");
    
    // Get the deployer account from hardhat config
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    // Deploy GMX token
    console.log("Deploying GMX token...");
    const GMX = await ethers.getContractFactory("GMX");
    const gmx = await GMX.deploy();
    await gmx.deployed();
    console.log(`GMX token deployed at: ${gmx.address}`);
    
    // Deploy esGMX (Escrowed GMX) token for staking rewards
    console.log("Deploying EsGMX token...");
    const EsGMX = await ethers.getContractFactory("EsGMX");
    const esGmx = await EsGMX.deploy();
    await esGmx.deployed();
    console.log(`EsGMX token deployed at: ${esGmx.address}`);
    
    // Set deployer as a minter first
    console.log("Setting deployer as a minter...");
    await gmx.setMinter(deployer.address, true);
    console.log("Deployer is now a minter");
    
    // Mint initial tokens to deployer
    console.log(`Minting tokens to ${deployer.address}`);
    
    // Mint initial supply - 10 million tokens with 18 decimals
    const initialSupply = ethers.utils.parseUnits("10000000", 18);
    await gmx.mint(deployer.address, initialSupply);
    
    console.log(`Minted ${ethers.utils.formatUnits(initialSupply, 18)} GMX to ${deployer.address}`);
    
    // Save token addresses
    await saveDeploymentData({
      GMX: gmx.address,
      EsGMX: esGmx.address
    });
    
    console.log("\nGovernance Token Deployment Successful!");
    console.log("---------------------------------------");
    console.log(`GMX token: ${gmx.address}`);
    console.log(`EsGMX token: ${esGmx.address}`);
    console.log("\nNext steps:");
    console.log("1. Set up staking and reward distribution if needed");
    console.log("2. Run deployment validation script");
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
