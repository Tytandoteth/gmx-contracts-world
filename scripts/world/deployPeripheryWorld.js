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

// Main deployment function
async function main() {
  console.log("Deploying GMX periphery contracts on World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get existing deployment data
  const deploymentData = await getDeploymentData();
  console.log("Existing deployment data loaded");
  
  // Check for required core contracts
  if (!deploymentData.Vault || !deploymentData.Router || !deploymentData.GlpManager) {
    console.error("Core contracts not deployed. Please deploy core contracts first using deployCoreWorld.js");
    process.exit(1);
  }
  
  // Initialize deployment updates
  const deployments = {};
  
  // Deploy GMX token if not already deployed
  if (!deploymentData.GMX) {
    console.log("Deploying GMX token...");
    const initialSupply = ethers.utils.parseUnits("10000000", 18); // 10 million GMX
    const MintableBaseToken = await ethers.getContractFactory("MintableBaseToken");
    const gmx = await MintableBaseToken.deploy("GMX", "GMX", initialSupply);
    await gmx.deployed();
    
    // Initial supply is minted to the contract creator during deployment
    
    console.log(`GMX token deployed to: ${gmx.address}`);
    console.log(`Initial supply: ${ethers.utils.formatUnits(initialSupply, 18)} GMX`);
    console.log(`GMX token minted to deployer: ${deployer.address}`);
    
    deployments.GMX = gmx.address;
  } else {
    console.log(`Using existing GMX token: ${deploymentData.GMX}`);
    deployments.GMX = deploymentData.GMX;
  }
  
  // Deploy EsGMX token if not already deployed
  if (!deploymentData.EsGMX) {
    console.log("Deploying EsGMX token...");
    const initialEsGmxSupply = ethers.utils.parseUnits("10000000", 18); // 10 million esGMX
    const MintableBaseToken = await ethers.getContractFactory("MintableBaseToken");
    const esGmx = await MintableBaseToken.deploy("Escrowed GMX", "esGMX", initialEsGmxSupply);
    await esGmx.deployed();
    
    console.log(`EsGMX token deployed to: ${esGmx.address}`);
    console.log(`Initial supply: ${ethers.utils.formatUnits(initialEsGmxSupply, 18)} esGMX`);
    deployments.EsGMX = esGmx.address;
  } else {
    console.log(`Using existing EsGMX token: ${deploymentData.EsGMX}`);
    deployments.EsGMX = deploymentData.EsGMX;
  }
  
  // Deploy Timelock if not already deployed
  if (!deploymentData.Timelock) {
    console.log("Deploying Timelock...");
    const Timelock = await ethers.getContractFactory("Timelock");
    
    // Buffer of 24 hours
    const buffer = 24 * 60 * 60;
    
    // Long buffer of 7 days
    const longBuffer = 7 * 24 * 60 * 60;
    
    const timelock = await Timelock.deploy(
      deployer.address, // admin
      buffer, // buffer
      deploymentData.WLD, // token address for tokenManager
      deployer.address, // mintReceiver - set to deployer initially
      deploymentData.GlpManager, // glpManager
      ethers.constants.AddressZero, // prevGlpManager - no previous manager
      ethers.constants.AddressZero, // rewardRouter - will be set later
      ethers.utils.parseUnits("10000000", 18), // maxTokenSupply - 10 million
      30, // marginFeeBasisPoints - 0.3%
      100 // maxMarginFeeBasisPoints - 1%
    );
    await timelock.deployed();
    
    // The buffer is already set in the constructor
    // Note: there's no setMaxLeverageBuffer function in the Timelock contract
    
    console.log(`Timelock deployed to: ${timelock.address}`);
    console.log(`Buffer: ${buffer} seconds (${buffer/3600} hours)`);
    console.log(`Long buffer: ${longBuffer} seconds (${longBuffer/3600} hours)`);
    
    deployments.Timelock = timelock.address;
    
    // Set the Timelock as governor for Vault, VaultPriceFeed, and GlpManager
    if (deploymentData.Vault) {
      console.log("Setting Timelock as governor for Vault...");
      const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
      await vault.setGov(timelock.address);
      console.log("Timelock set as Vault governor");
    }
    
    if (deploymentData.VaultPriceFeed) {
      console.log("Setting Timelock as governor for VaultPriceFeed...");
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
      await vaultPriceFeed.setGov(timelock.address);
      console.log("Timelock set as VaultPriceFeed governor");
    }
    
    if (deploymentData.GlpManager) {
      console.log("Setting Timelock as governor for GlpManager...");
      const glpManager = await ethers.getContractAt("GlpManager", deploymentData.GlpManager);
      await glpManager.setGov(timelock.address);
      console.log("Timelock set as GlpManager governor");
    }
  } else {
    console.log(`Using existing Timelock: ${deploymentData.Timelock}`);
    deployments.Timelock = deploymentData.Timelock;
  }
  
  // Deploy RewardRouter if not already deployed
  if (!deploymentData.RewardRouter) {
    console.log("Deploying RewardRouter...");
    const RewardRouter = await ethers.getContractFactory("RewardRouter");
    const rewardRouter = await RewardRouter.deploy();
    await rewardRouter.deployed();
    console.log(`RewardRouter deployed to: ${rewardRouter.address}`);
    
    // Initialize RewardRouter
    await rewardRouter.initialize(
      deploymentData.WWORLD, // _weth
      deployments.GMX, // _gmx
      deployments.EsGMX, // _esGmx
      ethers.constants.AddressZero, // _bnGmx - not used in this setup
      deploymentData.WLD, // _glp - using WLD for glp
      ethers.constants.AddressZero, // _stakedGmxTracker - will be deployed later
      ethers.constants.AddressZero, // _bonusGmxTracker - will be deployed later
      ethers.constants.AddressZero, // _feeGmxTracker - will be deployed later
      ethers.constants.AddressZero, // _feeGlpTracker - will be deployed later
      ethers.constants.AddressZero, // _stakedGlpTracker - will be deployed later
      deploymentData.GlpManager // _glpManager
    );
    
    console.log("RewardRouter initialized");
    deployments.RewardRouter = rewardRouter.address;
  } else {
    console.log(`Using existing RewardRouter: ${deploymentData.RewardRouter}`);
    deployments.RewardRouter = deploymentData.RewardRouter;
  }
  
  // Deploy RewardReader if not already deployed
  if (!deploymentData.RewardReader) {
    console.log("Deploying RewardReader...");
    const RewardReader = await ethers.getContractFactory("RewardReader");
    const rewardReader = await RewardReader.deploy();
    await rewardReader.deployed();
    console.log(`RewardReader deployed to: ${rewardReader.address}`);
    deployments.RewardReader = rewardReader.address;
  } else {
    console.log(`Using existing RewardReader: ${deploymentData.RewardReader}`);
    deployments.RewardReader = deploymentData.RewardReader;
  }
  
  // Save all deployments
  await saveDeploymentData(deployments);
  
  console.log("\nGMX periphery contracts deployed successfully!");
  console.log("Next steps:");
  console.log("1. Set up price feeds using setupPriceFeedsWorld.js");
  console.log("2. Whitelist tokens using whitelistTokensWorld.js");
  console.log("3. Validate deployment using validateDeploymentWorld.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
