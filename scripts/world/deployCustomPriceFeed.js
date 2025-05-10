const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const fs = require('fs');
const path = require('path');

// This script deploys a parallel set of GMX contracts where you have full governance control
// The goal is to create a workaround for the inaccessible governance address

async function main() {
  // Define deployment file path - using a separate file to avoid conflicts
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData = {};
  
  try {
    if (fs.existsSync(deploymentFilePath)) {
      const data = fs.readFileSync(deploymentFilePath, 'utf8');
      deploymentData = JSON.parse(data);
      console.log("Loaded existing custom deployment data");
    }
  } catch (error) {
    console.error("Error loading deployment data:", error);
    deploymentData = {};
  }
  
  // Get deployer address - this will be the governance address for all contracts
  const [deployer] = await ethers.getSigners();
  console.log("Deployer (Governance):", deployer.address);
  
  const { AddressZero } = ethers.constants;
  
  // First deploy or use existing tokens
  console.log("Setting up tokens...");
  
  // You can either deploy new tokens or use existing ones from the main deployment
  // Option 1: Use existing tokens from the main deployment
  let useExistingTokens = false;
  
  if (useExistingTokens) {
    try {
      const mainDeployment = JSON.parse(fs.readFileSync('.world-deployment.json'));
      deploymentData.WLD = mainDeployment.WLD;
      deploymentData.WWORLD = mainDeployment.WWORLD;
      console.log("Using existing tokens from main deployment");
      console.log("WLD:", deploymentData.WLD);
      console.log("WWORLD:", deploymentData.WWORLD);
    } catch (error) {
      console.error("Error loading main deployment data, will deploy new tokens:", error.message);
      useExistingTokens = false;
    }
  }
  
  // Option 2: Deploy new tokens if needed
  if (!useExistingTokens) {
    if (!deploymentData.WLD) {
      console.log("Deploying WLD token...");
      const WLD = await ethers.getContractFactory("MintableBaseToken");
      const wldToken = await WLD.deploy("WLD Token", "WLD", 0);
      await wldToken.deployed();
      deploymentData.WLD = wldToken.address;
      console.log("WLD deployed at:", wldToken.address);
      
      // Set deployer as minter
      await wldToken.setMinter(deployer.address, true);
      console.log("Set deployer as minter for WLD");
      
      // Mint some tokens for testing
      await wldToken.mint(deployer.address, expandDecimals(1000000, 18));
      console.log("Minted 1,000,000 WLD tokens to deployer");
    } else {
      console.log("Using existing WLD token:", deploymentData.WLD);
    }
    
    if (!deploymentData.WWORLD) {
      console.log("Deploying WWORLD token...");
      const WWORLD = await ethers.getContractFactory("MintableBaseToken");
      const wworldToken = await WWORLD.deploy("WWORLD Token", "WWORLD", 0);
      await wworldToken.deployed();
      deploymentData.WWORLD = wworldToken.address;
      console.log("WWORLD deployed at:", wworldToken.address);
      
      // Set deployer as minter
      await wworldToken.setMinter(deployer.address, true);
      console.log("Set deployer as minter for WWORLD");
      
      // Mint some tokens for testing
      await wworldToken.mint(deployer.address, expandDecimals(1000000, 18));
      console.log("Minted 1,000,000 WWORLD tokens to deployer");
    } else {
      console.log("Using existing WWORLD token:", deploymentData.WWORLD);
    }
  }
  
  // Deploy VaultPriceFeed with direct deployer governance
  console.log("\nDeploying custom VaultPriceFeed...");
  const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
  const vaultPriceFeed = await VaultPriceFeed.deploy();
  await vaultPriceFeed.deployed();
  deploymentData.CustomVaultPriceFeed = vaultPriceFeed.address;
  console.log("Custom VaultPriceFeed deployed at:", vaultPriceFeed.address);
  
  // Deploy RedStonePriceFeed (if needed)
  if (!deploymentData.RedStonePriceFeed) {
    console.log("Deploying RedStonePriceFeed...");
    const RedStonePriceFeed = await ethers.getContractFactory("RedStonePriceFeed");
    const redStonePriceFeed = await RedStonePriceFeed.deploy();
    await redStonePriceFeed.deployed();
    deploymentData.RedStonePriceFeed = redStonePriceFeed.address;
    console.log("RedStonePriceFeed deployed at:", redStonePriceFeed.address);
  } else {
    console.log("Using existing RedStonePriceFeed:", deploymentData.RedStonePriceFeed);
  }
  
  // Deploy or reuse mock price feeds for testing
  if (!deploymentData.MockPriceFeeds) {
    console.log("Deploying mock price feeds...");
    deploymentData.MockPriceFeeds = {};
    
    // Deploy WLD Price Feed
    const WldPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wldPriceFeed = await WldPriceFeed.deploy(toUsd(1));
    await wldPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WLD = wldPriceFeed.address;
    console.log("WLD price feed deployed at:", wldPriceFeed.address);
    
    // Deploy WWORLD Price Feed
    const WworldPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wworldPriceFeed = await WworldPriceFeed.deploy(toUsd(2));
    await wworldPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WWORLD = wworldPriceFeed.address;
    console.log("WWORLD price feed deployed at:", wworldPriceFeed.address);
  } else {
    console.log("Using existing mock price feeds");
  }
  
  // Configure price feeds in the VaultPriceFeed
  console.log("Configuring price feeds in custom VaultPriceFeed...");
  
  // Option 1: Configure using RedStonePriceFeed
  const useRedStone = true;
  
  if (useRedStone) {
    console.log("Configuring RedStonePriceFeed for tokens...");
    
    // Set token configurations
    const tokenConfigs = [
      { 
        symbol: "WLD", 
        tokenAddress: deploymentData.WLD, 
        priceDecimals: 8, 
        isStableToken: false 
      },
      { 
        symbol: "WWORLD", 
        tokenAddress: deploymentData.WWORLD, 
        priceDecimals: 8, 
        isStableToken: false 
      }
    ];
    
    for (const token of tokenConfigs) {
      console.log(`Setting RedStonePriceFeed for ${token.symbol}...`);
      await vaultPriceFeed.setTokenConfig(
        token.tokenAddress,
        deploymentData.RedStonePriceFeed,
        token.priceDecimals,
        token.isStableToken
      );
      console.log(`✅ RedStonePriceFeed set for ${token.symbol}`);
    }
  } else {
    // Option 2: Configure using MockPriceFeeds
    console.log("Configuring MockPriceFeeds for tokens...");
    
    await vaultPriceFeed.setTokenConfig(
      deploymentData.WLD,
      deploymentData.MockPriceFeeds.WLD,
      8, // decimals
      false // isStable
    );
    console.log("WLD MockPriceFeed configured");
    
    await vaultPriceFeed.setTokenConfig(
      deploymentData.WWORLD,
      deploymentData.MockPriceFeeds.WWORLD,
      8, // decimals
      false // isStable
    );
    console.log("WWORLD MockPriceFeed configured");
  }
  
  // Deploy custom Vault
  console.log("Deploying custom Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();
  deploymentData.CustomVault = vault.address;
  console.log("Custom Vault deployed at:", vault.address);
  
  // Deploy USDG for custom setup
  if (!deploymentData.CustomUSDG) {
    console.log("Deploying custom USDG...");
    const USDG = await ethers.getContractFactory("USDG");
    const usdg = await USDG.deploy(vault.address);
    await usdg.deployed();
    deploymentData.CustomUSDG = usdg.address;
    console.log("Custom USDG deployed at:", usdg.address);
  } else {
    console.log("Using existing custom USDG:", deploymentData.CustomUSDG);
  }
  
  // Deploy custom Router
  console.log("Deploying custom Router...");
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(vault.address, deploymentData.CustomUSDG, AddressZero);
  await router.deployed();
  deploymentData.CustomRouter = router.address;
  console.log("Custom Router deployed at:", router.address);
  
  // Deploy custom VaultUtils
  console.log("Deploying custom VaultUtils...");
  const VaultUtils = await ethers.getContractFactory("VaultUtils");
  const vaultUtils = await VaultUtils.deploy(vault.address);
  await vaultUtils.deployed();
  deploymentData.CustomVaultUtils = vaultUtils.address;
  console.log("Custom VaultUtils deployed at:", vaultUtils.address);
  
  // Set VaultUtils in custom Vault
  await vault.setVaultUtils(vaultUtils.address);
  console.log("VaultUtils set in custom Vault");
  
  // Initialize custom Vault
  console.log("Initializing custom Vault...");
  await vault.initialize(
    router.address, // router
    deploymentData.CustomUSDG, // usdg
    vaultPriceFeed.address, // priceFeed - using our custom VaultPriceFeed with RedStone integration
    toUsd(5), // liquidationFeeUsd
    100, // fundingRateFactor
    100 // stableFundingRateFactor
  );
  console.log("Custom Vault initialized with custom VaultPriceFeed");
  
  // Save deployment data
  try {
    fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
    console.log(`Deployment data saved to ${deploymentFilePath}`);
  } catch (error) {
    console.error("Error saving deployment data:", error);
  }
  
  console.log("\n======= CUSTOM DEPLOYMENT SUMMARY =======");
  console.log(`Deployer (Governance): ${deployer.address}`);
  console.log(`Custom VaultPriceFeed: ${deploymentData.CustomVaultPriceFeed}`);
  console.log(`RedStonePriceFeed: ${deploymentData.RedStonePriceFeed}`);
  console.log(`Custom Vault: ${deploymentData.CustomVault}`);
  console.log(`Custom Router: ${deploymentData.CustomRouter}`);
  console.log("=========================================");
  console.log("\nYou now have a parallel GMX setup where you control the governance.");
  console.log("This can be used for development and testing with RedStone integration.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
