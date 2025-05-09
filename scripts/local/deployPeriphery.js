const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  let deploymentData = {};
  if (fs.existsSync(deploymentPath)) {
    const fileContent = fs.readFileSync(deploymentPath, "utf8");
    if (fileContent) {
      deploymentData = JSON.parse(fileContent);
    }
  }
  
  // Merge new data
  deploymentData = { ...deploymentData, ...data };
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment data saved to", deploymentPath);
  return deploymentData;
}

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found. Please deploy core contracts first.");
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Deployment data is empty. Please deploy core contracts first.");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

async function main() {
  console.log("Deploying GMX periphery contracts to local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Load deployment data
  const deploymentData = await getDeploymentData();
  
  // Check for required contract addresses
  const requiredContracts = ['Vault', 'Router', 'WETH', 'PositionRouter', 'PositionManager', 'WLD'];
  for (const contract of requiredContracts) {
    if (!deploymentData[contract]) {
      console.error(`${contract} address not found in deployment data. Please deploy all core contracts first.`);
      process.exit(1);
    }
  }
  
  console.log("Required contract addresses found in deployment data");
  const { Vault: vaultAddress, Router: routerAddress, WETH: wethAddress, WLD: wldAddress } = deploymentData;
  
  // Deploy Timelock
  console.log("Deploying Timelock...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const buffer = 24 * 60 * 60; // 24 hours
  const maxTokenSupply = ethers.utils.parseUnits("100000000", 18); // 100 million tokens max supply
  const marginFeeBasisPoints = 50; // 0.5%
  const maxMarginFeeBasisPoints = 500; // 5%
  
  console.log("Timelock parameters:");
  console.log("Admin:", deployer.address);
  console.log("Buffer:", buffer);
  console.log("Max Token Supply:", ethers.utils.formatUnits(maxTokenSupply, 18));
  
  const timelock = await Timelock.deploy(
    deployer.address, // _admin
    buffer, // _buffer
    deployer.address, // _tokenManager
    deployer.address, // _mintReceiver
    deploymentData.GlpManager, // _glpManager
    ethers.constants.AddressZero, // _prevGlpManager
    ethers.constants.AddressZero, // _rewardRouter
    maxTokenSupply, // _maxTokenSupply
    marginFeeBasisPoints, // _marginFeeBasisPoints
    maxMarginFeeBasisPoints // _maxMarginFeeBasisPoints
  );
  
  await timelock.deployed();
  console.log(`Timelock deployed at: ${timelock.address}`);
  
  // Deploy RewardRouter
  console.log("Deploying RewardRouter...");
  const RewardRouter = await ethers.getContractFactory("RewardRouter");
  const rewardRouter = await RewardRouter.deploy();
  await rewardRouter.deployed();
  console.log(`RewardRouter deployed at: ${rewardRouter.address}`);
  
  // Deploy RewardReader
  console.log("Deploying RewardReader...");
  const RewardReader = await ethers.getContractFactory("RewardReader");
  const rewardReader = await RewardReader.deploy();
  await rewardReader.deployed();
  console.log(`RewardReader deployed at: ${rewardReader.address}`);
  
  // Save periphery contract addresses
  await saveDeploymentData({
    Timelock: timelock.address,
    RewardRouter: rewardRouter.address,
    RewardReader: rewardReader.address
  });
  
  console.log("All periphery contracts deployed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
