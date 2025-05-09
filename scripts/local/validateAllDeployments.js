const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found. Please deploy contracts first.");
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Deployment data is empty. Please deploy contracts first.");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

async function validateVault(vault, wld, weth) {
  console.log("\n--- Validating Vault ---");
  
  try {
    // Check USDG in Vault
    const usdg = await vault.usdg();
    console.log(`USDG address in Vault: ${usdg}`);
    console.log(`WLD address: ${wld.address}`);
    console.log(`USDG should be set to WLD: ${usdg === wld.address ? "✅" : "❌"}`);
    
    // Check whitelisted tokens
    try {
      const wldWhitelisted = await vault.whitelistedTokens(wld.address);
      const wethWhitelisted = await vault.whitelistedTokens(weth.address);
      
      console.log(`WLD whitelisted in Vault: ${wldWhitelisted ? "✅" : "❌"}`);
      console.log(`WETH whitelisted in Vault: ${wethWhitelisted ? "✅" : "❌"}`);
    } catch (error) {
      console.log("Error checking whitelisted tokens:", error.message);
    }
    
    return true;
  } catch (error) {
    console.error("Error validating Vault:", error.message);
    return false;
  }
}

async function validatePriceFeeds(vaultPriceFeed, vault, wld, weth) {
  console.log("\n--- Validating Price Feeds ---");
  
  try {
    // Try to get price feed addresses for tokens
    try {
      const wldPriceFeed = await vaultPriceFeed.priceFeeds(wld.address);
      console.log(`WLD price feed: ${wldPriceFeed}`);
      console.log(`WLD has price feed: ${wldPriceFeed !== ethers.constants.AddressZero ? "✅" : "❌"}`);
      
      const wethPriceFeed = await vaultPriceFeed.priceFeeds(weth.address);
      console.log(`WETH price feed: ${wethPriceFeed}`);
      console.log(`WETH has price feed: ${wethPriceFeed !== ethers.constants.AddressZero ? "✅" : "❌"}`);
    } catch (error) {
      console.log("Error checking price feeds:", error.message);
    }
    
    // Try to get prices for tokens
    try {
      const includeAmmPrice = true;
      const maximise = true;
      const wldPrice = await vaultPriceFeed.getPrice(wld.address, maximise, includeAmmPrice, false);
      console.log(`WLD price: ${ethers.utils.formatUnits(wldPrice, 30)}`);
      
      const wethPrice = await vaultPriceFeed.getPrice(weth.address, maximise, includeAmmPrice, false);
      console.log(`WETH price: ${ethers.utils.formatUnits(wethPrice, 30)}`);
    } catch (error) {
      console.log("Error getting prices from VaultPriceFeed:", error.message);
    }
    
    return true;
  } catch (error) {
    console.error("Error validating price feeds:", error.message);
    return false;
  }
}

async function validateGMXTokens(gmx, esGmx, deployer) {
  console.log("\n--- Validating GMX Tokens ---");
  
  try {
    // Check GMX token info
    const gmxName = await gmx.name();
    const gmxSymbol = await gmx.symbol();
    const gmxDecimals = await gmx.decimals();
    const gmxTotalSupply = await gmx.totalSupply();
    
    console.log(`GMX Token Name: ${gmxName}`);
    console.log(`GMX Token Symbol: ${gmxSymbol}`);
    console.log(`GMX Token Decimals: ${gmxDecimals}`);
    console.log(`GMX Total Supply: ${ethers.utils.formatUnits(gmxTotalSupply, gmxDecimals)}`);
    
    // Check if deployer has GMX tokens
    const gmxBalance = await gmx.balanceOf(deployer.address);
    console.log(`Deployer GMX Balance: ${ethers.utils.formatUnits(gmxBalance, gmxDecimals)}`);
    console.log(`Deployer has GMX tokens: ${gmxBalance.gt(0) ? "✅" : "❌"}`);
    
    // Check if deployer is a minter
    try {
      const isMinter = await gmx.isMinter(deployer.address);
      console.log(`Deployer is a GMX minter: ${isMinter ? "✅" : "❌"}`);
    } catch (error) {
      console.log("Error checking minter status:", error.message);
    }
    
    // Check EsGMX token info
    const esGmxName = await esGmx.name();
    const esGmxSymbol = await esGmx.symbol();
    const esGmxDecimals = await esGmx.decimals();
    
    console.log(`\nEsGMX Token Name: ${esGmxName}`);
    console.log(`EsGMX Token Symbol: ${esGmxSymbol}`);
    console.log(`EsGMX Token Decimals: ${esGmxDecimals}`);
    
    return true;
  } catch (error) {
    console.error("Error validating GMX tokens:", error.message);
    return false;
  }
}

async function validateRouter(router, vault, weth) {
  console.log("\n--- Validating Router ---");
  
  try {
    // Check Vault in Router
    const vaultInRouter = await router.vault();
    console.log(`Vault address in Router: ${vaultInRouter}`);
    console.log(`Vault address correct: ${vaultInRouter === vault.address ? "✅" : "❌"}`);
    
    // Check WETH in Router
    const wethInRouter = await router.weth();
    console.log(`WETH address in Router: ${wethInRouter}`);
    console.log(`WETH address correct: ${wethInRouter === weth.address ? "✅" : "❌"}`);
    
    return true;
  } catch (error) {
    console.error("Error validating Router:", error.message);
    return false;
  }
}

async function validateGlpManager(glpManager, vault, wld) {
  console.log("\n--- Validating GlpManager ---");
  
  try {
    // Check Vault in GlpManager
    const vaultInGlpManager = await glpManager.vault();
    console.log(`Vault address in GlpManager: ${vaultInGlpManager}`);
    console.log(`Vault address correct: ${vaultInGlpManager === vault.address ? "✅" : "❌"}`);
    
    // Check USDG in GlpManager
    const usdgInGlpManager = await glpManager.usdg();
    console.log(`USDG address in GlpManager: ${usdgInGlpManager}`);
    console.log(`USDG should be WLD: ${usdgInGlpManager === wld.address ? "✅" : "❌"}`);
    
    // Check GLP in GlpManager
    const glpInGlpManager = await glpManager.glp();
    console.log(`GLP address in GlpManager: ${glpInGlpManager}`);
    console.log(`GLP should be WLD: ${glpInGlpManager === wld.address ? "✅" : "❌"}`);
    
    return true;
  } catch (error) {
    console.error("Error validating GlpManager:", error.message);
    return false;
  }
}

async function main() {
  console.log("Validating all deployed contracts on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Log each contract address
  console.log("\n--- Deployed Contract Addresses ---");
  Object.entries(deploymentData).forEach(([name, address]) => {
    console.log(`${name}: ${address}`);
  });
  
  // Get contract instances
  try {
    const wld = await ethers.getContractAt("FaucetToken", deploymentData.WLD);
    const weth = await ethers.getContractAt("FaucetToken", deploymentData.WETH);
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const router = await ethers.getContractAt("Router", deploymentData.Router);
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    const glpManager = await ethers.getContractAt("GlpManager", deploymentData.GlpManager);
    const gmx = await ethers.getContractAt("GMX", deploymentData.GMX);
    const esGmx = await ethers.getContractAt("EsGMX", deploymentData.EsGMX);
    
    // Validate each component
    const vaultValid = await validateVault(vault, wld, weth);
    const priceFedsValid = await validatePriceFeeds(vaultPriceFeed, vault, wld, weth);
    const gmxTokensValid = await validateGMXTokens(gmx, esGmx, deployer);
    const routerValid = await validateRouter(router, vault, weth);
    const glpManagerValid = await validateGlpManager(glpManager, vault, wld);
    
    // Overall validation summary
    console.log("\n--- Validation Summary ---");
    console.log(`Vault: ${vaultValid ? "✅" : "❌"}`);
    console.log(`Price Feeds: ${priceFedsValid ? "✅" : "❌"}`);
    console.log(`GMX Tokens: ${gmxTokensValid ? "✅" : "❌"}`);
    console.log(`Router: ${routerValid ? "✅" : "❌"}`);
    console.log(`GlpManager: ${glpManagerValid ? "✅" : "❌"}`);
    
    // Next steps
    console.log("\nNext Steps:");
    if (!vaultValid) console.log("- Fix issues with Vault configuration");
    if (!priceFedsValid) console.log("- Fix price feed configuration");
    if (!routerValid) console.log("- Fix Router configuration");
    if (!glpManagerValid) console.log("- Fix GlpManager configuration");
    
    console.log("\nSuccessfully validated all deployed contracts!");
    console.log("When you're satisfied with the local deployment, you can proceed with deploying on World Chain.");
  } catch (error) {
    console.error("Error validating contracts:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
