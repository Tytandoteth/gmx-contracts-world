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
  console.log("Deploying GMX core contracts on World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get existing deployment data
  const deploymentData = await getDeploymentData();
  console.log("Existing deployment data loaded");
  
  // Initialize deployment updates
  const deployments = {};
  
  // Check for WLD and WWORLD tokens
  if (!deploymentData.WLD) {
    console.error("WLD token not deployed. Please deploy WLD token first using deployWLD.js");
    process.exit(1);
  }
  console.log(`Using WLD token: ${deploymentData.WLD}`);
  
  if (!deploymentData.WWORLD) {
    console.error("WWORLD token not deployed. Please specify WWORLD address.");
    process.exit(1);
  }
  console.log(`Using WWORLD token: ${deploymentData.WWORLD}`);
  
  // ShortsTracker will be deployed after Vault since it needs the Vault address
  
  // Deploy Position Utils if not already deployed
  if (!deploymentData.PositionUtils) {
    console.log("Deploying PositionUtils...");
    const PositionUtils = await ethers.getContractFactory("PositionUtils");
    const positionUtils = await PositionUtils.deploy();
    await positionUtils.deployed();
    console.log(`PositionUtils deployed to: ${positionUtils.address}`);
    deployments.PositionUtils = positionUtils.address;
  } else {
    console.log(`Using existing PositionUtils: ${deploymentData.PositionUtils}`);
    deployments.PositionUtils = deploymentData.PositionUtils;
  }
  
  // Deploy VaultPriceFeed if not already deployed
  if (!deploymentData.VaultPriceFeed) {
    console.log("Deploying VaultPriceFeed...");
    const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
    const vaultPriceFeed = await VaultPriceFeed.deploy();
    await vaultPriceFeed.deployed();
    console.log(`VaultPriceFeed deployed to: ${vaultPriceFeed.address}`);
    deployments.VaultPriceFeed = vaultPriceFeed.address;
  } else {
    console.log(`Using existing VaultPriceFeed: ${deploymentData.VaultPriceFeed}`);
    deployments.VaultPriceFeed = deploymentData.VaultPriceFeed;
  }
  
  // Deploy Vault if not already deployed
  if (!deploymentData.Vault) {
    console.log("Deploying Vault...");
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    await vault.deployed();
    console.log(`Vault deployed to: ${vault.address}`);
    deployments.Vault = vault.address;
    
    // Initialize the Vault
    console.log("Initializing Vault...");
    const liquidationFeeUsd = ethers.utils.parseUnits("5", 30); // $5 in USD
    const fundingRateFactor = 100;
    const stableFundingRateFactor = 100;
    
    await vault.initialize(
      ethers.constants.AddressZero, // Router is set later
      deploymentData.WLD, // Use WLD as USDG
      deployments.VaultPriceFeed, // VaultPriceFeed
      liquidationFeeUsd,
      fundingRateFactor,
      stableFundingRateFactor
    );
    
    console.log("Vault initialized");
  } else {
    console.log(`Using existing Vault: ${deploymentData.Vault}`);
    deployments.Vault = deploymentData.Vault;
  }
  
  // Deploy ShortsTracker if not already deployed
  if (!deploymentData.ShortsTracker) {
    console.log("Deploying ShortsTracker...");
    const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
    const shortsTracker = await ShortsTracker.deploy(deployments.Vault);
    await shortsTracker.deployed();
    console.log(`ShortsTracker deployed to: ${shortsTracker.address}`);
    deployments.ShortsTracker = shortsTracker.address;
  } else {
    console.log(`Using existing ShortsTracker: ${deploymentData.ShortsTracker}`);
    deployments.ShortsTracker = deploymentData.ShortsTracker;
  }
  
  // Deploy VaultUtils if not already deployed
  if (!deploymentData.VaultUtils) {
    console.log("Deploying VaultUtils...");
    const VaultUtils = await ethers.getContractFactory("VaultUtils");
    const vaultUtils = await VaultUtils.deploy(deployments.Vault);
    await vaultUtils.deployed();
    console.log(`VaultUtils deployed to: ${vaultUtils.address}`);
    deployments.VaultUtils = vaultUtils.address;
    
    // Set VaultUtils in Vault
    const vault = await ethers.getContractAt("Vault", deployments.Vault);
    await vault.setVaultUtils(vaultUtils.address);
    console.log("VaultUtils set in Vault");
  } else {
    console.log(`Using existing VaultUtils: ${deploymentData.VaultUtils}`);
    deployments.VaultUtils = deploymentData.VaultUtils;
  }
  
  // Deploy Router if not already deployed
  if (!deploymentData.Router) {
    console.log("Deploying Router...");
    const Router = await ethers.getContractFactory("Router");
    // IMPORTANT: The Router constructor parameters order is (vault, usdg, weth)
    const router = await Router.deploy(
      deployments.Vault,
      deploymentData.WLD, // USDG (WLD)
      deploymentData.WWORLD // WETH (WWORLD)
    );
    await router.deployed();
    console.log(`Router deployed to: ${router.address}`);
    deployments.Router = router.address;
    
    // The Router is set in Vault during initialization, since Vault is already deployed we can't set it directly
    // For a fresh deployment, the Router would be initialized with the Vault later
    console.log("Note: For deployed Vaults, the Router must be set during initialization. Check Vault.router to verify the current router setting.");
    
    // Set Router as a handler for ShortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deployments.ShortsTracker);
    await shortsTracker.setHandler(router.address, true);
    console.log("Router set as handler for ShortsTracker");
  } else {
    console.log(`Using existing Router: ${deploymentData.Router}`);
    deployments.Router = deploymentData.Router;
  }
  
  // Deploy OrderBook if not already deployed
  if (!deploymentData.OrderBook) {
    console.log("Deploying OrderBook...");
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy();
    await orderBook.deployed();
    console.log(`OrderBook deployed to: ${orderBook.address}`);
    deployments.OrderBook = orderBook.address;
    
    // Initialize OrderBook
    await orderBook.initialize(
      deployments.Router,
      deployments.Vault,
      deploymentData.WWORLD, // WETH (WWORLD)
      deploymentData.WLD, // USDG (WLD)
      ethers.utils.parseUnits("5", 30), // minExecutionFee: 5 USD
      ethers.utils.parseUnits("10", 30) // minPurchaseTokenAmountUsd: 10 USD
    );
    console.log("OrderBook initialized");
  } else {
    console.log(`Using existing OrderBook: ${deploymentData.OrderBook}`);
    deployments.OrderBook = deploymentData.OrderBook;
  }
  
  // Deploy GlpManager if not already deployed
  if (!deploymentData.GlpManager) {
    console.log("Deploying GlpManager...");
    const GlpManager = await ethers.getContractFactory("GlpManager");
    const glpManager = await GlpManager.deploy(
      deployments.Vault,
      deploymentData.WLD, // USDG (WLD)
      deploymentData.WLD, // GLP (also using WLD)
      deployments.ShortsTracker, // ShortsTracker
      15 * 60 // cooldownDuration (15 minutes)
    );
    await glpManager.deployed();
    console.log(`GlpManager deployed to: ${glpManager.address}`);
    deployments.GlpManager = glpManager.address;
  } else {
    console.log(`Using existing GlpManager: ${deploymentData.GlpManager}`);
    deployments.GlpManager = deploymentData.GlpManager;
  }
  
  // Deploy PositionRouter if not already deployed
  if (!deploymentData.PositionRouter) {
    console.log("Deploying PositionRouter...");
    // Need to link the PositionUtils library
    const PositionRouter = await ethers.getContractFactory("PositionRouter", {
      libraries: {
        PositionUtils: deployments.PositionUtils
      }
    });
    const positionRouter = await PositionRouter.deploy(
      deployments.Vault,
      deployments.Router,
      deploymentData.WWORLD, // WETH (WWORLD)
      deployments.ShortsTracker, // ShortsTracker
      30, // depositFee (0.3%)
      ethers.utils.parseUnits("5", 30) // minExecutionFee: 5 USD
    );
    await positionRouter.deployed();
    console.log(`PositionRouter deployed to: ${positionRouter.address}`);
    deployments.PositionRouter = positionRouter.address;
    
    // Set callbacks
    await positionRouter.setCallbackGasLimit(3000000);
    console.log("PositionRouter callback gas limit set to 3,000,000");
    
    // Set PositionRouter as handler for ShortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deployments.ShortsTracker);
    await shortsTracker.setHandler(positionRouter.address, true);
    console.log("PositionRouter set as handler for ShortsTracker");
  } else {
    console.log(`Using existing PositionRouter: ${deploymentData.PositionRouter}`);
    deployments.PositionRouter = deploymentData.PositionRouter;
  }
  
  // Deploy PositionManager if not already deployed
  if (!deploymentData.PositionManager) {
    console.log("Deploying PositionManager...");
    // Need to link the PositionUtils library
    const PositionManager = await ethers.getContractFactory("PositionManager", {
      libraries: {
        PositionUtils: deployments.PositionUtils
      }
    });
    const positionManager = await PositionManager.deploy(
      deployments.Vault,
      deployments.Router,
      deployments.ShortsTracker, // ShortsTracker
      deploymentData.WWORLD, // WETH (WWORLD)
      30, // depositFee (0.3%)
      deployments.OrderBook // OrderBook
    );
    await positionManager.deployed();
    console.log(`PositionManager deployed to: ${positionManager.address}`);
    deployments.PositionManager = positionManager.address;
    
    // Set PositionManager as handler for ShortsTracker
    const shortsTracker = await ethers.getContractAt("ShortsTracker", deployments.ShortsTracker);
    await shortsTracker.setHandler(positionManager.address, true);
    console.log("PositionManager set as handler for ShortsTracker");
  } else {
    console.log(`Using existing PositionManager: ${deploymentData.PositionManager}`);
    deployments.PositionManager = deploymentData.PositionManager;
  }
  
  // Save all deployments
  await saveDeploymentData(deployments);
  
  console.log("\nGMX core contracts deployed successfully!");
  console.log("Next steps:");
  console.log("1. Deploy periphery contracts using deployPeripheryWorld.js");
  console.log("2. Set up price feeds using setupPriceFeedsWorld.js");
  console.log("3. Whitelist tokens using whitelistTokensWorld.js");
  console.log("4. Validate deployment using validateDeploymentWorld.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
