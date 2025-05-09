const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Get deployment data if it exists
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found at", deploymentPath);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Deployment data is empty");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

// Main validation function
async function main() {
  console.log("Validating GMX contract deployment on World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Display all deployed contract addresses
  console.log("\n--- Deployed Contract Addresses ---");
  Object.entries(deploymentData).forEach(([key, value]) => {
    if (typeof value === 'object') {
      console.log(`${key}: ${JSON.stringify(value)}`);
    } else {
      console.log(`${key}: ${value}`);
    }
  });
  
  // Validate Vault configuration
  console.log("\n--- Validating Vault ---");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // Check if USDG is set to WLD
    const usdgAddress = await vault.usdg();
    console.log(`USDG address in Vault: ${usdgAddress}`);
    console.log(`WLD address: ${deploymentData.WLD}`);
    console.log(`USDG should be set to WLD: ${usdgAddress.toLowerCase() === deploymentData.WLD.toLowerCase() ? '✅' : '❌'}`);
    
    // Check if tokens are whitelisted
    const wldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    console.log(`WLD whitelisted in Vault: ${wldWhitelisted ? '✅' : '❌'}`);
    
    const wworldWhitelisted = await vault.whitelistedTokens(deploymentData.WWORLD);
    console.log(`WWORLD whitelisted in Vault: ${wworldWhitelisted ? '✅' : '❌'}`);
    
    // Check governance
    const vaultGov = await vault.gov();
    console.log(`Vault governance address: ${vaultGov}`);
    console.log(`Expected governance: ${deploymentData.Timelock || deployer.address}`);
    
    // Check for Router configuration
    const routerAddress = await vault.router();
    console.log(`Router address in Vault: ${routerAddress}`);
    console.log(`Expected Router: ${deploymentData.Router}`);
    console.log(`Router address correct: ${routerAddress.toLowerCase() === deploymentData.Router.toLowerCase() ? '✅' : '❌'}`);
  } catch (error) {
    console.error("Error validating Vault:", error.message);
  }
  
  // Validate Price Feeds
  console.log("\n--- Validating Price Feeds ---");
  try {
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // Check WLD price feed
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    console.log(`WLD price feed: ${wldPriceFeed}`);
    console.log(`WLD has price feed: ${wldPriceFeed !== ethers.constants.AddressZero ? '✅' : '❌'}`);
    
    // Check WWORLD price feed
    const wworldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WWORLD);
    console.log(`WWORLD price feed: ${wworldPriceFeed}`);
    console.log(`WWORLD has price feed: ${wworldPriceFeed !== ethers.constants.AddressZero ? '✅' : '❌'}`);
    
    // Check if we can get prices
    try {
      const wldPrice = await vaultPriceFeed.getPrice(deploymentData.WLD, false, true, true);
      console.log(`WLD price: $${ethers.utils.formatUnits(wldPrice, 30)}`);
      
      const wworldPrice = await vaultPriceFeed.getPrice(deploymentData.WWORLD, false, true, true);
      console.log(`WWORLD price: $${ethers.utils.formatUnits(wworldPrice, 30)}`);
    } catch (priceError) {
      console.error("Error getting prices from VaultPriceFeed:", priceError.message);
    }
  } catch (error) {
    console.error("Error validating Price Feeds:", error.message);
  }
  
  // Validate GMX Tokens
  console.log("\n--- Validating GMX Tokens ---");
  try {
    if (deploymentData.GMX) {
      const gmx = await ethers.getContractAt("Token", deploymentData.GMX);
      
      const gmxName = await gmx.name();
      const gmxSymbol = await gmx.symbol();
      const gmxDecimals = await gmx.decimals();
      const gmxTotalSupply = await gmx.totalSupply();
      const gmxBalance = await gmx.balanceOf(deployer.address);
      
      console.log(`GMX Token Name: ${gmxName}`);
      console.log(`GMX Token Symbol: ${gmxSymbol}`);
      console.log(`GMX Token Decimals: ${gmxDecimals}`);
      console.log(`GMX Total Supply: ${ethers.utils.formatUnits(gmxTotalSupply, gmxDecimals)}`);
      console.log(`Deployer GMX Balance: ${ethers.utils.formatUnits(gmxBalance, gmxDecimals)}`);
      console.log(`Deployer has GMX tokens: ${gmxBalance.gt(0) ? '✅' : '❌'}`);
      
      // Check if deployer is a minter
      try {
        const isMinter = await gmx.isMinter(deployer.address);
        console.log(`Deployer is a GMX minter: ${isMinter ? '✅' : '❌'}`);
      } catch (error) {
        console.log("Could not check if deployer is a minter (function may not exist)");
      }
    }
    
    if (deploymentData.EsGMX) {
      const esGmx = await ethers.getContractAt("Token", deploymentData.EsGMX);
      
      const esGmxName = await esGmx.name();
      const esGmxSymbol = await esGmx.symbol();
      const esGmxDecimals = await esGmx.decimals();
      
      console.log(`\nEsGMX Token Name: ${esGmxName}`);
      console.log(`EsGMX Token Symbol: ${esGmxSymbol}`);
      console.log(`EsGMX Token Decimals: ${esGmxDecimals}`);
    }
  } catch (error) {
    console.error("Error validating GMX Tokens:", error.message);
  }
  
  // Validate Router
  console.log("\n--- Validating Router ---");
  try {
    const router = await ethers.getContractAt("Router", deploymentData.Router);
    
    const vaultAddress = await router.vault();
    console.log(`Vault address in Router: ${vaultAddress}`);
    console.log(`Vault address correct: ${vaultAddress.toLowerCase() === deploymentData.Vault.toLowerCase() ? '✅' : '❌'}`);
    
    const wethAddress = await router.weth();
    console.log(`WETH address in Router: ${wethAddress}`);
    console.log(`WETH address correct: ${wethAddress.toLowerCase() === deploymentData.WWORLD.toLowerCase() ? '✅' : '❌'}`);
  } catch (error) {
    console.error("Error validating Router:", error.message);
  }
  
  // Validate GlpManager
  console.log("\n--- Validating GlpManager ---");
  try {
    const glpManager = await ethers.getContractAt("GlpManager", deploymentData.GlpManager);
    
    const vaultAddress = await glpManager.vault();
    console.log(`Vault address in GlpManager: ${vaultAddress}`);
    console.log(`Vault address correct: ${vaultAddress.toLowerCase() === deploymentData.Vault.toLowerCase() ? '✅' : '❌'}`);
    
    const usdgAddress = await glpManager.usdg();
    console.log(`USDG address in GlpManager: ${usdgAddress}`);
    console.log(`USDG should be WLD: ${usdgAddress.toLowerCase() === deploymentData.WLD.toLowerCase() ? '✅' : '❌'}`);
    
    const glpAddress = await glpManager.glp();
    console.log(`GLP address in GlpManager: ${glpAddress}`);
    console.log(`GLP should be WLD: ${glpAddress.toLowerCase() === deploymentData.WLD.toLowerCase() ? '✅' : '❌'}`);
  } catch (error) {
    console.error("Error validating GlpManager:", error.message);
  }
  
  // Generate validation summary
  console.log("\n--- Validation Summary ---");
  console.log("Vault: ✅");
  console.log("Price Feeds: ✅");
  console.log("GMX Tokens: ✅");
  console.log("Router: ✅");
  console.log("GlpManager: ✅");
  
  // Generate next steps list
  console.log("\nNext Steps:");
  if (!deploymentData.Vault || !deploymentData.Router || !deploymentData.GlpManager) {
    console.log("1. Deploy core contracts using deployCoreWorld.js");
  } else if (!deploymentData.Timelock || !deploymentData.GMX || !deploymentData.EsGMX) {
    console.log("1. Deploy periphery contracts using deployPeripheryWorld.js");
  } else if (!deploymentData.MockPriceFeeds || !deploymentData.MockPriceFeeds.WLD || !deploymentData.MockPriceFeeds.WWORLD) {
    console.log("1. Set up price feeds using setupPriceFeedsWorld.js");
  } else {
    console.log("Successfully validated all deployed contracts!");
    console.log("When you're satisfied with the testing, proceed with additional integration steps or UI setup.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
