const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, '..', '..', '.world-deployment.json');
  if (fs.existsSync(deploymentPath)) {
    return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  return {};
}

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, '..', '..', '.world-deployment.json');
  const existingData = await getDeploymentData();
  const updatedData = { ...existingData, ...data };
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);
}

async function main() {
  try {
    console.log("Deploying GMX core contracts to World Chain...");
    
    // Get the deployer account from hardhat config
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    // Get the previously deployed WLD token address
    const deploymentData = await getDeploymentData();
    const wldTokenAddress = deploymentData.WLD;
    if (!wldTokenAddress) {
      throw new Error("WLD token address not found. Please deploy WLD token first.");
    }
    console.log(`Using WLD token at: ${wldTokenAddress}`);
    
    // Deploy Vault
    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    await vault.deployed();
    console.log(`Vault deployed at: ${vault.address}`);
    
    // Save Vault address immediately to help with subsequent deployments
    await saveDeploymentData({
      Vault: vault.address
    });
    console.log("Vault address saved to deployment data");
    
    // Deploy a simple token to use as wrapped native (WETH-equivalent)
    console.log("Deploying Wrapped Native Token...");
    const FaucetToken = await ethers.getContractFactory("FaucetToken");
    const weth = await FaucetToken.deploy("Wrapped WORLD", "WWORLD", 18, ethers.utils.parseUnits("1000000", 18));
    await weth.deployed();
    console.log(`WWORLD token deployed at: ${weth.address}`);
    
    // Save token address
    await saveDeploymentData({
      WWORLD: weth.address
    });
    console.log("WWORLD token address saved to deployment data");

    // Deploy price feed for vault
    console.log("Deploying VaultPriceFeed...");
    const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
    const priceFeed = await VaultPriceFeed.deploy();
    await priceFeed.deployed();
    console.log(`VaultPriceFeed deployed at: ${priceFeed.address}`);
    
    // Deploy Router
    console.log("Deploying Router...");
    const Router = await ethers.getContractFactory("Router");
    const router = await Router.deploy(vault.address, wldTokenAddress, weth.address);
    await router.deployed();
    console.log(`Router deployed at: ${router.address}`);
    
    // Deploy VaultUtils
    console.log("Deploying VaultUtils...");
    const VaultUtils = await ethers.getContractFactory("VaultUtils");
    const vaultUtils = await VaultUtils.deploy(vault.address);
    await vaultUtils.deployed();
    console.log(`VaultUtils deployed at: ${vaultUtils.address}`);
    
    // Deploy ShortsTracker first (needed for GlpManager)
    console.log("Deploying ShortsTracker...");
    const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
    const shortsTracker = await ShortsTracker.deploy(vault.address);
    await shortsTracker.deployed();
    console.log(`ShortsTracker deployed at: ${shortsTracker.address}`);
    
    // Save ShortsTracker address
    await saveDeploymentData({
      ShortsTracker: shortsTracker.address
    });
    
    // Deploy GlpManager using WLD as both the USDG and GLP token
    console.log("Deploying GlpManager...");
    const GlpManager = await ethers.getContractFactory("GlpManager");
    const glpManager = await GlpManager.deploy(
      vault.address,           // _vault
      wldTokenAddress,         // _usdg (using WLD)
      wldTokenAddress,         // _glp (using WLD)
      shortsTracker.address,   // _shortsTracker
      24 * 60 * 60             // _cooldownDuration - 24 hours
    );
    await glpManager.deployed();
    console.log(`GlpManager deployed at: ${glpManager.address}`);
    
    // Initialize Vault
    console.log("Initializing Vault...");
    const maxUsdgAmount = ethers.utils.parseUnits("5", 30); // 5 billion
    await vault.initialize(
      router.address, // router
      wldTokenAddress, // usdg (using WLD as the stable token)
      vaultUtils.address, // vaultUtils
      priceFeed.address, // priceFeed
      glpManager.address, // liquidityManager
      maxUsdgAmount // maxUsdgAmount
    );
    console.log("Vault initialized successfully");
    
    // ShortsTracker has already been deployed above
    
    // Deploy PositionUtils library first
    console.log("Deploying PositionUtils library...");
    const PositionUtils = await ethers.getContractFactory("PositionUtils");
    const positionUtils = await PositionUtils.deploy();
    await positionUtils.deployed();
    console.log(`PositionUtils library deployed at: ${positionUtils.address}`);
    
    // Save library address
    await saveDeploymentData({
      PositionUtils: positionUtils.address
    });
    
    // Deploy PositionRouter with library linking
    console.log("Deploying PositionRouter...");
    const positionRouterArtifact = await ethers.getContractFactory(
      "PositionRouter",
      {
        libraries: {
          PositionUtils: positionUtils.address
        }
      }
    );
    
    const maxGlobalLongSizeUsd = ethers.utils.parseUnits("1", 30); // 1 billion
    const positionRouter = await positionRouterArtifact.deploy(
      vault.address,
      router.address,
      weth.address,
      shortsTracker.address,
      30, // execution fee basis points
      maxGlobalLongSizeUsd
    );
    await positionRouter.deployed();
    console.log(`PositionRouter deployed at: ${positionRouter.address}`);
    
    // Deploy PositionManager with library linking
    console.log("Deploying PositionManager...");
    const positionManagerArtifact = await ethers.getContractFactory(
      "PositionManager",
      {
        libraries: {
          PositionUtils: positionUtils.address
        }
      }
    );
    
    // Format parameters properly to avoid BigNumber issues
    const depositFeesBasisPoints = 30;
    
    console.log("Parameters for PositionManager deployment:");
    console.log("Vault:", vault.address);
    console.log("Router:", router.address);
    console.log("ShortsTracker:", shortsTracker.address);
    console.log("WETH:", weth.address);
    console.log("Deposit Fee Basis Points:", depositFeesBasisPoints);
    console.log("Max Global Long Size USD:", ethers.utils.formatUnits(maxGlobalLongSizeUsd, 30));
    
    // Deploy OrderBook first (before PositionManager)
    console.log("Deploying OrderBook...");
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy();
    await orderBook.deployed();
    console.log(`OrderBook deployed at: ${orderBook.address}`);

    // Save OrderBook address
    await saveDeploymentData({
      OrderBook: orderBook.address
    });
    
    // Now deploy PositionManager with OrderBook address
    try {
      console.log("Parameters for PositionManager deployment updated:");
      console.log("OrderBook:", orderBook.address);
      
      const positionManager = await positionManagerArtifact.deploy(
        vault.address,
        router.address, 
        shortsTracker.address,
        weth.address,
        depositFeesBasisPoints,
        orderBook.address  // Add OrderBook address as the 6th parameter
      );
      
      await positionManager.deployed();
      console.log(`PositionManager deployed at: ${positionManager.address}`);
      
      // Save PositionManager address
      await saveDeploymentData({
        PositionManager: positionManager.address
      });
    } catch (error) {
      console.error("Error deploying PositionManager:", error.message);
      throw error;
    }
    await orderBook.deployed();
    console.log(`OrderBook deployed at: ${orderBook.address}`);
    
    // Save all deployed contract addresses
    await saveDeploymentData({
      Vault: vault.address,
      WWORLD: weth.address,
      VaultPriceFeed: priceFeed.address,
      Router: router.address,
      VaultUtils: vaultUtils.address,
      GlpManager: glpManager.address,
      ShortsTracker: shortsTracker.address,
      PositionRouter: positionRouter.address,
      PositionManager: positionManager.address,
      OrderBook: orderBook.address
    });
    
    console.log("\nCore Contracts Deployment Successful!");
    console.log("------------------------------------");
    console.log(`WLD Token: ${wldTokenAddress}`);
    console.log(`Vault: ${vault.address}`);
    console.log(`Router: ${router.address}`);
    console.log(`GlpManager: ${glpManager.address}`);
    console.log(`PositionRouter: ${positionRouter.address}`);
    console.log(`PositionManager: ${positionManager.address}`);
    console.log(`OrderBook: ${orderBook.address}`);
    console.log("\nNext steps:");
    console.log("1. Deploy periphery contracts with: npx hardhat run scripts/worldchain/deployPeriphery.js --network worldchain");
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
