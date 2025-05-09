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
    return {};
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    return {};
  }
  
  return JSON.parse(fileContent);
}

async function main() {
  console.log("Deploying GMX core contracts to local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Get WLD token address from deployment data
  const deploymentData = await getDeploymentData();
  if (!deploymentData.WLD) {
    console.error("WLD token address not found. Please deploy WLD token first.");
    process.exit(1);
  }
  
  const wldTokenAddress = deploymentData.WLD;
  console.log(`Using WLD token at: ${wldTokenAddress}`);
  
  // Deploy Vault
  console.log("Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();
  console.log(`Vault deployed at: ${vault.address}`);
  
  // Save Vault address immediately
  await saveDeploymentData({
    Vault: vault.address
  });
  console.log("Vault address saved to deployment data");
  
  // Deploy Wrapped Native Token (WETH for local Hardhat network)
  console.log("Deploying Wrapped Native Token...");
  const FaucetToken = await ethers.getContractFactory("FaucetToken");
  const weth = await FaucetToken.deploy("Wrapped ETH", "WETH", 18, ethers.utils.parseEther("1000000"));
  await weth.deployed();
  console.log(`WETH token deployed at: ${weth.address}`);
  
  // Save WETH token address
  await saveDeploymentData({
    WETH: weth.address
  });
  console.log("WETH token address saved to deployment data");
  
  // Deploy VaultPriceFeed
  console.log("Deploying VaultPriceFeed...");
  const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
  const vaultPriceFeed = await VaultPriceFeed.deploy();
  await vaultPriceFeed.deployed();
  console.log(`VaultPriceFeed deployed at: ${vaultPriceFeed.address}`);
  
  // Deploy Router
  console.log("Deploying Router...");
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(vault.address, weth.address, wldTokenAddress);
  await router.deployed();
  console.log(`Router deployed at: ${router.address}`);
  
  // Deploy VaultUtils
  console.log("Deploying VaultUtils...");
  const VaultUtils = await ethers.getContractFactory("VaultUtils");
  const vaultUtils = await VaultUtils.deploy(vault.address);
  await vaultUtils.deployed();
  console.log(`VaultUtils deployed at: ${vaultUtils.address}`);
  
  // Deploy ShortsTracker
  console.log("Deploying ShortsTracker...");
  const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
  const shortsTracker = await ShortsTracker.deploy(vault.address);
  await shortsTracker.deployed();
  console.log(`ShortsTracker deployed at: ${shortsTracker.address}`);
  
  // Save ShortsTracker address
  await saveDeploymentData({
    ShortsTracker: shortsTracker.address
  });
  
  // Deploy GlpManager
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
  await vault.initialize(
    router.address,         // _router
    wldTokenAddress,        // _usdg
    vaultPriceFeed.address, // _priceFeed
    ethers.utils.parseUnits("5", 30),  // _liquidationFeeUsd - $5
    100,                    // _fundingRateFactor
    100                     // _stableFundingRateFactor
  );
  console.log("Vault initialized successfully");
  
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
  
  // Now deploy PositionManager with OrderBook address
  try {
    console.log("Deploying PositionManager...");
    console.log("Parameters for PositionManager deployment:");
    console.log("Vault:", vault.address);
    console.log("Router:", router.address);
    console.log("ShortsTracker:", shortsTracker.address);
    console.log("WETH:", weth.address);
    console.log("Deposit Fee Basis Points:", 30);
    console.log("OrderBook:", orderBook.address);
    
    const positionManagerArtifact = await ethers.getContractFactory(
      "PositionManager",
      {
        libraries: {
          PositionUtils: positionUtils.address
        }
      }
    );
    
    const positionManager = await positionManagerArtifact.deploy(
      vault.address,
      router.address, 
      shortsTracker.address,
      weth.address,
      30,  // deposit fee basis points
      orderBook.address  // orderBook address
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
  
  // Save all deployment addresses
  await saveDeploymentData({
    VaultPriceFeed: vaultPriceFeed.address,
    Router: router.address,
    VaultUtils: vaultUtils.address,
    GlpManager: glpManager.address,
    PositionRouter: positionRouter.address
  });
  
  console.log("All core contracts deployed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
