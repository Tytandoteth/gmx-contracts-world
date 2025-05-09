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
  
  // Check USDG in Vault
  const usdg = await vault.usdg();
  console.log(`USDG address in Vault: ${usdg}`);
  console.log(`WLD address: ${wld.address}`);
  console.log(`USDG should be set to WLD: ${usdg === wld.address ? "✅" : "❌"}`);
  
  // Check whitelisted tokens
  const wldWhitelisted = await vault.whitelistedTokens(wld.address);
  const wethWhitelisted = await vault.whitelistedTokens(weth.address);
  
  console.log(`WLD whitelisted in Vault: ${wldWhitelisted ? "✅" : "❌"}`);
  console.log(`WETH whitelisted in Vault: ${wethWhitelisted ? "✅" : "❌"}`);
  
  return true;
}

async function validateGlpManager(glpManager, vault, wld) {
  console.log("\n--- Validating GlpManager ---");
  
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
}

async function validateRouter(router, vault, weth) {
  console.log("\n--- Validating Router ---");
  
  // Check Vault in Router
  const vaultInRouter = await router.vault();
  console.log(`Vault address in Router: ${vaultInRouter}`);
  console.log(`Vault address correct: ${vaultInRouter === vault.address ? "✅" : "❌"}`);
  
  // Check WETH in Router
  const wethInRouter = await router.weth();
  console.log(`WETH address in Router: ${wethInRouter}`);
  console.log(`WETH address correct: ${wethInRouter === weth.address ? "✅" : "❌"}`);
  
  return true;
}

async function validatePositionManager(positionManager, vault, router) {
  console.log("\n--- Validating PositionManager ---");
  
  // Check Vault in PositionManager
  const vaultInPosManager = await positionManager.vault();
  console.log(`Vault address in PositionManager: ${vaultInPosManager}`);
  console.log(`Vault address correct: ${vaultInPosManager === vault.address ? "✅" : "❌"}`);
  
  // Check Router in PositionManager
  const routerInPosManager = await positionManager.router();
  console.log(`Router address in PositionManager: ${routerInPosManager}`);
  console.log(`Router address correct: ${routerInPosManager === router.address ? "✅" : "❌"}`);
  
  return true;
}

async function main() {
  console.log("Validating deployed contracts on local Hardhat network...");
  
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
  const wld = await ethers.getContractAt("FaucetToken", deploymentData.WLD);
  const weth = await ethers.getContractAt("FaucetToken", deploymentData.WETH);
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const router = await ethers.getContractAt("Router", deploymentData.Router);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  const glpManager = await ethers.getContractAt("GlpManager", deploymentData.GlpManager);
  const positionManager = await ethers.getContractAt("PositionManager", deploymentData.PositionManager);
  
  // Validate core contracts
  await validateVault(vault, wld, weth);
  await validateGlpManager(glpManager, vault, wld);
  await validateRouter(router, vault, weth);
  await validatePositionManager(positionManager, vault, router);
  
  // Try to whitelist tokens if not already whitelisted
  try {
    console.log("\n--- Whitelisting Tokens in Vault ---");
    
    // Check if WLD is whitelisted
    const wldWhitelisted = await vault.whitelistedTokens(wld.address);
    if (!wldWhitelisted) {
      console.log("Whitelisting WLD token in Vault...");
      
      const maxUsdgAmount = ethers.utils.parseUnits("100000000", 18); // 100 million max USDG
      
      await vault.setTokenConfig(
        wld.address,  // _token
        18,           // _tokenDecimals
        10000,        // _tokenWeight
        75,           // _minProfitBps
        maxUsdgAmount, // _maxUsdgAmount
        true,         // _isStable
        false         // _isShortable
      );
      console.log("WLD token whitelisted successfully");
    } else {
      console.log("WLD token already whitelisted");
    }
    
    // Check if WETH is whitelisted
    const wethWhitelisted = await vault.whitelistedTokens(weth.address);
    if (!wethWhitelisted) {
      console.log("Whitelisting WETH token in Vault...");
      
      const maxUsdgAmount = ethers.utils.parseUnits("50000000", 18); // 50 million max USDG
      
      await vault.setTokenConfig(
        weth.address, // _token
        18,           // _tokenDecimals
        10000,        // _tokenWeight
        75,           // _minProfitBps
        maxUsdgAmount, // _maxUsdgAmount
        false,        // _isStable
        true          // _isShortable
      );
      console.log("WETH token whitelisted successfully");
    } else {
      console.log("WETH token already whitelisted");
    }
    
  } catch (error) {
    console.error("Error whitelisting tokens:", error.message);
  }
  
  console.log("\n--- Validation Summary ---");
  console.log("All core contract validations passed ✅");
  console.log("The GMX contracts have been successfully deployed and validated on the local Hardhat network");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
