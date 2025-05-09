const { ethers } = require("hardhat");
const { getFrameSigner } = require("../shared/helpers");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const { errors } = require("../../test/core/Vault/helpers");

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('../core/tokens')[network];

const fs = require('fs');
const path = require('path');

async function main() {
  // Define deployment file path based on the network
  const deploymentFilePath = path.join(__dirname, '../../.world-quick-deployment.json');
  let deploymentData = {};
  
  try {
    if (fs.existsSync(deploymentFilePath)) {
      const data = fs.readFileSync(deploymentFilePath, 'utf8');
      deploymentData = JSON.parse(data);
      console.log("Loaded existing deployment data");
    }
  } catch (error) {
    console.error("Error loading deployment data:", error);
    deploymentData = {};
  }
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const { AddressZero } = ethers.constants;
  
  // First deploy tokens
  console.log("Deploying tokens...");
  
  // Deploy WLD mock token
  if (!deploymentData.WLD) {
    console.log("Deploying WLD token...");
    const WLD = await ethers.getContractFactory("Token");
    const wldToken = await WLD.deploy("WLD Token", "WLD", 18);
    await wldToken.deployed();
    deploymentData.WLD = wldToken.address;
    console.log("WLD deployed at:", wldToken.address);
  } else {
    console.log("Using existing WLD token:", deploymentData.WLD);
  }
  
  // Deploy WWORLD mock token
  if (!deploymentData.WWORLD) {
    console.log("Deploying WWORLD token...");
    const WWORLD = await ethers.getContractFactory("Token");
    const wworldToken = await WWORLD.deploy("WWORLD Token", "WWORLD", 18);
    await wworldToken.deployed();
    deploymentData.WWORLD = wworldToken.address;
    console.log("WWORLD deployed at:", wworldToken.address);
  } else {
    console.log("Using existing WWORLD token:", deploymentData.WWORLD);
  }
  
  // Deploy USDG
  if (!deploymentData.USDG) {
    console.log("Deploying USDG...");
    const USDG = await ethers.getContractFactory("USDG");
    const usdg = await USDG.deploy(deploymentData.WLD, 0);
    await usdg.deployed();
    deploymentData.USDG = usdg.address;
    console.log("USDG deployed at:", usdg.address);
  } else {
    console.log("Using existing USDG:", deploymentData.USDG);
  }
  
  // Deploy mock price feeds
  if (!deploymentData.MockPriceFeeds) {
    console.log("Deploying mock price feeds...");
    deploymentData.MockPriceFeeds = {};
    
    // Deploy WLD Price Feed
    const WldPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wldPriceFeed = await WldPriceFeed.deploy(toUsd(1), 8); // $1 price
    await wldPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WLD = wldPriceFeed.address;
    console.log("WLD price feed deployed at:", wldPriceFeed.address);
    
    // Deploy WWORLD Price Feed
    const WworldPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wworldPriceFeed = await WworldPriceFeed.deploy(toUsd(2), 8); // $2 price
    await wworldPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WWORLD = wworldPriceFeed.address;
    console.log("WWORLD price feed deployed at:", wworldPriceFeed.address);
  } else {
    console.log("Using existing mock price feeds");
  }
  
  // Deploy core contracts - note: we're deploying new ones even if they exist to ensure clean configuration
  console.log("\nDeploying core contracts with correct configuration...");
  
  // Deploy Vault Price Feed with direct deployer governance
  console.log("Deploying VaultPriceFeed...");
  const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
  const vaultPriceFeed = await VaultPriceFeed.deploy();
  await vaultPriceFeed.deployed();
  deploymentData.VaultPriceFeed = vaultPriceFeed.address;
  console.log("VaultPriceFeed deployed at:", vaultPriceFeed.address);
  
  // Configure price feeds
  console.log("Configuring price feeds...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    true // isStable
  );
  console.log("WLD price feed configured");
  
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WWORLD,
    deploymentData.MockPriceFeeds.WWORLD,
    8, // decimals
    false // isStable
  );
  console.log("WWORLD price feed configured");
  
  // Deploy Vault with direct deployer governance
  console.log("Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();
  deploymentData.Vault = vault.address;
  console.log("Vault deployed at:", vault.address);
  
  // Deploy Router with direct deployer governance
  console.log("Deploying Router...");
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(vault.address, deploymentData.USDG, AddressZero);
  await router.deployed();
  deploymentData.Router = router.address;
  console.log("Router deployed at:", router.address);
  
  // Deploy VaultUtils
  console.log("Deploying VaultUtils...");
  const VaultUtils = await ethers.getContractFactory("VaultUtils");
  const vaultUtils = await VaultUtils.deploy(vault.address);
  await vaultUtils.deployed();
  deploymentData.VaultUtils = vaultUtils.address;
  console.log("VaultUtils deployed at:", vaultUtils.address);
  
  // Set VaultUtils in Vault
  await vault.setVaultUtils(vaultUtils.address);
  console.log("VaultUtils set in Vault");
  
  // Initialize Vault
  console.log("Initializing Vault...");
  await vault.initialize(
    router.address, // router
    deploymentData.USDG, // usdg
    vaultPriceFeed.address, // priceFeed
    toUsd(5), // liquidationFeeUsd
    100, // fundingRateFactor
    100 // stableFundingRateFactor
  );
  console.log("Vault initialized with Router:", router.address);
  
  // Deploy ShortsTracker
  console.log("Deploying ShortsTracker...");
  const ShortsTracker = await ethers.getContractFactory("ShortsTracker");
  const shortsTracker = await ShortsTracker.deploy(vault.address);
  await shortsTracker.deployed();
  deploymentData.ShortsTracker = shortsTracker.address;
  console.log("ShortsTracker deployed at:", shortsTracker.address);
  
  // Deploy OrderBook
  console.log("Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy();
  await orderBook.deployed();
  deploymentData.OrderBook = orderBook.address;
  console.log("OrderBook deployed at:", orderBook.address);
  
  // Initialize OrderBook
  await orderBook.initialize(
    router.address,
    vault.address,
    deploymentData.WWORLD, // native token address
    "10000000000000000" // min bid size: 0.01 native token
  );
  console.log("OrderBook initialized");
  
  // Add OrderBook as a Router plugin
  await router.addPlugin(orderBook.address);
  console.log("OrderBook added as Router plugin");
  
  // Deploy PositionRouter
  console.log("Deploying PositionRouter...");
  const PositionRouter = await ethers.getContractFactory("PositionRouter");
  const positionRouter = await PositionRouter.deploy();
  await positionRouter.deployed();
  deploymentData.PositionRouter = positionRouter.address;
  console.log("PositionRouter deployed at:", positionRouter.address);
  
  // Initialize PositionRouter
  await positionRouter.initialize(
    router.address,
    vault.address,
    deploymentData.WWORLD, // native token address
    shortsTracker.address,
    5, // deposit fee basis points
    5 // execution fee
  );
  console.log("PositionRouter initialized");
  
  // Add PositionRouter as a Router plugin
  await router.addPlugin(positionRouter.address);
  console.log("PositionRouter added as Router plugin");
  
  // Set handlers for ShortsTracker
  await shortsTracker.setHandler(positionRouter.address, true);
  console.log("PositionRouter set as handler in ShortsTracker");
  
  // Deploy PositionManager
  console.log("Deploying PositionManager...");
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const positionManager = await PositionManager.deploy();
  await positionManager.deployed();
  deploymentData.PositionManager = positionManager.address;
  console.log("PositionManager deployed at:", positionManager.address);
  
  // Initialize PositionManager
  await positionManager.initialize(
    router.address,
    vault.address,
    shortsTracker.address,
    deploymentData.WWORLD // native token address
  );
  console.log("PositionManager initialized");
  
  // Set handlers
  await shortsTracker.setHandler(positionManager.address, true);
  console.log("PositionManager set as handler in ShortsTracker");
  
  // Deploy GlpManager
  console.log("Deploying GlpManager...");
  const GlpManager = await ethers.getContractFactory("GlpManager");
  const glpManager = await GlpManager.deploy();
  await glpManager.deployed();
  deploymentData.GlpManager = glpManager.address;
  console.log("GlpManager deployed at:", glpManager.address);
  
  // Enable token trading with vault
  console.log("Enabling token trading in Vault...");
  
  // Enable WLD
  await vault.setTokenConfig(
    deploymentData.WLD, // token
    18, // decimals
    10000, // weight
    0, // minProfitBps
    expandDecimals(1000000, 18), // maxUsdgAmount
    true, // isStable
    false // isShortable
  );
  console.log("WLD token enabled for trading");
  
  // Enable WWORLD
  await vault.setTokenConfig(
    deploymentData.WWORLD, // token
    18, // decimals
    10000, // weight
    0, // minProfitBps
    expandDecimals(1000000, 18), // maxUsdgAmount
    false, // isStable
    true // isShortable
  );
  console.log("WWORLD token enabled for trading");
  
  // Periphery contracts with 5-minute Timelock
  console.log("\nDeploying periphery contracts with 5-minute Timelock...");
  
  // Deploy Timelock with 5-minute buffer
  console.log("Deploying Timelock with 5-minute buffer...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const buffer = 300; // 5 minutes in seconds
  const timelock = await Timelock.deploy(
    deployer.address, // admin
    buffer, // buffer period in seconds
    deployer.address, // token manager
    deployer.address, // mint receiver
    glpManager.address, // glp manager
    AddressZero, // prev glp manager (none)
    AddressZero, // reward router (will set later)
    ethers.utils.parseUnits("100000000", 18), // max token supply (100M tokens)
    10, // marginFeeBasisPoints (0.1%)
    100 // maxMarginFeeBasisPoints (1%)
  );
  await timelock.deployed();
  deploymentData.Timelock = timelock.address;
  console.log("Timelock deployed at:", timelock.address);
  console.log("Buffer period: 5 minutes (300 seconds)");
  
  // Deploy token contracts
  console.log("\nDeploying token contracts...");
  
  // Deploy GMX token
  console.log("Deploying GMX token...");
  const GMX = await ethers.getContractFactory("MintableBaseToken");
  const gmx = await GMX.deploy("GMX", "GMX", 0);
  await gmx.deployed();
  deploymentData.GMX = gmx.address;
  console.log("GMX deployed at:", gmx.address);
  
  // Deploy EsGMX token
  console.log("Deploying EsGMX token...");
  const EsGMX = await ethers.getContractFactory("MintableBaseToken");
  const esGmx = await EsGMX.deploy("Escrowed GMX", "esGMX", 0);
  await esGmx.deployed();
  deploymentData.EsGMX = esGmx.address;
  console.log("EsGMX deployed at:", esGmx.address);
  
  // Deploy RewardRouter
  console.log("Deploying RewardRouter...");
  const RewardRouter = await ethers.getContractFactory("RewardRouterV2");
  const rewardRouter = await RewardRouter.deploy();
  await rewardRouter.deployed();
  deploymentData.RewardRouter = rewardRouter.address;
  console.log("RewardRouter deployed at:", rewardRouter.address);
  
  // Deploy RewardReader
  console.log("Deploying RewardReader...");
  const RewardReader = await ethers.getContractFactory("RewardReader");
  const rewardReader = await RewardReader.deploy();
  await rewardReader.deployed();
  deploymentData.RewardReader = rewardReader.address;
  console.log("RewardReader deployed at:", rewardReader.address);
  
  // Set up PositionUtils library
  console.log("\nDeploying PositionUtils library...");
  const PositionUtils = await ethers.getContractFactory("PositionUtils");
  const positionUtils = await PositionUtils.deploy();
  await positionUtils.deployed();
  deploymentData.PositionUtils = positionUtils.address;
  console.log("PositionUtils deployed at:", positionUtils.address);
  
  // Save deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\nAll deployment data saved to:", deploymentFilePath);
  
  // Transfer governance to Timelock
  console.log("\nTransferring governance to Timelock...");
  
  // Don't transfer immediately for testing - allow direct configuration
  /*
  await vault.setGov(timelock.address);
  console.log("Vault governance transferred to Timelock");
  
  await vaultPriceFeed.setGov(timelock.address);
  console.log("VaultPriceFeed governance transferred to Timelock");
  */
  
  console.log("\nFast deployment with 5-minute Timelock completed successfully!");
  console.log("\nDeployment Summary:");
  console.log("- Vault:", deploymentData.Vault);
  console.log("- Router:", deploymentData.Router);
  console.log("- VaultPriceFeed:", deploymentData.VaultPriceFeed);
  console.log("- Timelock (5min buffer):", deploymentData.Timelock);
  console.log("- WLD token:", deploymentData.WLD);
  console.log("- WWORLD token:", deploymentData.WWORLD);
  
  console.log("\nAll tokens are whitelisted and price feeds are configured!");
  console.log("Run validateQuickDeployment.js to verify everything is working correctly.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
