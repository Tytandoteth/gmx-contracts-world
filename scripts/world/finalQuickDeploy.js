const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const fs = require('fs');
const path = require('path');

async function main() {
  // Define deployment file path
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
  
  // Deploy WLD mock token if not already deployed
  if (!deploymentData.WLD) {
    console.log("Deploying WLD token...");
    const WLD = await ethers.getContractFactory("MintableBaseToken");
    const wldToken = await WLD.deploy("WLD Token", "WLD", 0); // Initial supply can be 0
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
  
  // Deploy WWORLD mock token if not already deployed
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
  
  // Deploy USDG if not already deployed
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
  
  // Deploy mock price feeds if not already deployed
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
  
  // Deploy VaultPriceFeed with direct deployer governance
  console.log("\nDeploying VaultPriceFeed...");
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
  
  // Deploy Timelock with 5-minute buffer
  console.log("\nDeploying Timelock with 5-minute buffer...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const buffer = 300; // 5 minutes in seconds
  const timelock = await Timelock.deploy(
    deployer.address, // admin
    buffer, // buffer period in seconds
    deployer.address, // token manager
    deployer.address, // mint receiver
    deployer.address, // glp manager (temporarily using deployer)
    AddressZero, // prev glp manager (none)
    AddressZero, // reward router (will set later if needed)
    ethers.utils.parseUnits("100000000", 18), // max token supply (100M tokens)
    10, // marginFeeBasisPoints (0.1%)
    100 // maxMarginFeeBasisPoints (1%)
  );
  await timelock.deployed();
  deploymentData.Timelock = timelock.address;
  console.log("Timelock deployed at:", timelock.address);
  console.log("Buffer period: 5 minutes (300 seconds)");
  
  // Save deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log("\nCore deployment data saved to:", deploymentFilePath);
  
  console.log("\nFast deployment with 5-minute Timelock completed successfully!");
  console.log("\nDeployment Summary:");
  console.log("- Vault:", deploymentData.Vault);
  console.log("- Router:", deploymentData.Router);
  console.log("- VaultPriceFeed:", deploymentData.VaultPriceFeed);
  console.log("- Timelock (5min buffer):", deploymentData.Timelock);
  console.log("- WLD token:", deploymentData.WLD);
  console.log("- WWORLD token:", deploymentData.WWORLD);
  
  console.log("\nImportant notes:");
  console.log("1. All tokens are properly whitelisted in the Vault");
  console.log("2. All price feeds are correctly configured");
  console.log("3. The Router is correctly set up with the Vault");
  console.log("4. OrderBook and PositionRouter plugins are enabled");
  console.log("5. The Timelock has a 5-minute buffer for quick governance actions");
  
  console.log("\nThe deployment is ready for immediate use, no need to wait for timelock periods.");
  console.log("Run validateQuickDeployment.js to verify everything is working correctly.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
