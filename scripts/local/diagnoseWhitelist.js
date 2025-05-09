const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function main() {
  console.log("Diagnosing token whitelisting issues on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get vault contract instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  console.log(`Vault address: ${deploymentData.Vault}`);
  
  // Check basic vault information
  try {
    const isInitialized = await vault.isInitialized();
    console.log(`Vault initialized: ${isInitialized}`);
    
    const usdgAddress = await vault.usdg();
    console.log(`USDG address: ${usdgAddress}`);
    console.log(`WLD address: ${deploymentData.WLD}`);
    console.log(`USDG matches WLD: ${usdgAddress.toLowerCase() === deploymentData.WLD.toLowerCase()}`);
    
    // Get governance info
    const gov = await vault.gov();
    console.log(`Vault governance: ${gov}`);
    console.log(`Deployer address: ${deployer.address}`);
    console.log(`Deployer is governor: ${gov.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (error) {
    console.error("Error checking basic vault info:", error.message);
  }
  
  // Try to redeploy a test contract to see if the issue is with the whitelist function
  console.log("\nDeploying test components to diagnose whitelist issues...");
  
  try {
    // Deploy a test Vault
    const VaultFactory = await ethers.getContractFactory("Vault");
    const testVault = await VaultFactory.deploy();
    await testVault.deployed();
    console.log(`Test Vault deployed at: ${testVault.address}`);
    
    // Deploy a test USDG (using WLD for simplicity)
    const TestUSDG = await ethers.getContractFactory("Token");
    const testUSDG = await TestUSDG.deploy("Test USDG", "TUSDG", 18);
    await testUSDG.deployed();
    console.log(`Test USDG deployed at: ${testUSDG.address}`);
    
    // Deploy a test VaultPriceFeed
    const VaultPriceFeedFactory = await ethers.getContractFactory("VaultPriceFeed");
    const testPriceFeed = await VaultPriceFeedFactory.deploy();
    await testPriceFeed.deployed();
    console.log(`Test VaultPriceFeed deployed at: ${testPriceFeed.address}`);
    
    // Initialize the test Vault
    const initTx = await testVault.initialize(
      ethers.constants.AddressZero, // Router - initialize with zero address
      testUSDG.address, // USDG
      testPriceFeed.address, // PriceFeed
      0, // liquidationFeeUsd
      0, // fundingRateFactor
      0  // stableFundingRateFactor
    );
    await initTx.wait();
    console.log("Test Vault initialized successfully");
    
    // Now try to whitelist tokens in the test Vault
    console.log("\nTesting token whitelisting on test Vault...");
    
    // Create a test token to whitelist
    const TestToken = await ethers.getContractFactory("Token");
    const testToken = await TestToken.deploy("Test Token", "TEST", 18);
    await testToken.deployed();
    console.log(`Test token deployed at: ${testToken.address}`);
    
    // Whitelist the test token
    try {
      console.log("Calling setTokenConfig on test Vault...");
      const whitelistTx = await testVault.setTokenConfig(
        testToken.address,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      );
      
      console.log(`Whitelist transaction sent: ${whitelistTx.hash}`);
      await whitelistTx.wait();
      console.log("Token successfully whitelisted on test Vault");
      
      // Check if token is whitelisted
      const isWhitelisted = await testVault.whitelistedTokens(testToken.address);
      console.log(`Test token whitelisted status: ${isWhitelisted}`);
      
      // SUCCESS - This means our whitelist function works correctly
      console.log("\nDIAGNOSIS: The setTokenConfig function works correctly in a fresh Vault.");
      console.log("This indicates the problem is with our actual deployed Vault contract.");
      console.log("Recommendation: Consider redeploying the Vault and core contracts.");
      
    } catch (whitelistError) {
      console.error("Error whitelisting test token:", whitelistError.message);
    }
    
  } catch (deployError) {
    console.error("Error deploying test contracts:", deployError.message);
  }
  
  // Let's check if the actual deployed vaultUtils contract has the right functions
  try {
    console.log("\nChecking VaultUtils...");
    const vaultUtils = await ethers.getContractAt("IVaultUtils", deploymentData.VaultUtils);
    console.log(`VaultUtils address: ${deploymentData.VaultUtils}`);
    
    // Try calling a function that should exist
    const functions = Object.keys(vaultUtils.interface.functions);
    console.log(`VaultUtils functions: ${functions.slice(0, 5).join(", ")}...`);
  } catch (vaultUtilsError) {
    console.error("Error checking VaultUtils:", vaultUtilsError.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
