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

async function main() {
  console.log("Setting up prices for tokens...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Let's whitelist the tokens in the vault directly without relying on price feeds for local testing
  console.log("Attempting to whitelist tokens in the vault...");
  
  // First, check if we need to modify useSwapPricing flag in vault
  try {
    await vault.setUseSwapPricing(true);
    console.log("Enabled swap pricing in vault for local testing");
  } catch (error) {
    console.log("Could not set useSwapPricing flag:", error.message);
  }
  
  // Try to set token configs directly in vault
  try {
    const wldToken = deploymentData.WLD;
    const wethToken = deploymentData.WETH;
    
    console.log("Whitelisting WLD token...");
    
    // Try to whitelist WLD token
    await vault.setTokenConfig(
      wldToken,         // _token
      18,               // _tokenDecimals
      10000,            // _tokenWeight
      75,               // _minProfitBps
      ethers.utils.parseUnits("100000000", 18), // _maxUsdgAmount (100M)
      true,             // _isStable
      false             // _isShortable
    );
    console.log("WLD token whitelisted successfully");
    
    console.log("Whitelisting WETH token...");
    
    // Try to whitelist WETH token
    await vault.setTokenConfig(
      wethToken,        // _token
      18,               // _tokenDecimals
      10000,            // _tokenWeight
      75,               // _minProfitBps
      ethers.utils.parseUnits("100000000", 18), // _maxUsdgAmount (100M)
      false,            // _isStable
      true              // _isShortable
    );
    console.log("WETH token whitelisted successfully");
    
    // Set token prices directly if needed
    try {
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
      
      // Try to set prices directly (if the function exists)
      // This is for local testing only, but might not be available
      console.log("Setting prices directly via VaultPriceFeed (if supported)...");
      
      try {
        // Check if we can set prices directly
        if (typeof vaultPriceFeed.setAdjustment === 'function') {
          // Set WLD price to $1
          await vaultPriceFeed.setAdjustment(
            wldToken,
            false, // _isAdditive
            0      // _adjustmentBps (no adjustment)
          );
          console.log("Set WLD price adjustment");
          
          // Set WETH price to $3000 (adjust by +299900%)
          await vaultPriceFeed.setAdjustment(
            wethToken,
            true,  // _isAdditive
            2999000 // _adjustmentBps (+299900% for $3000)
          );
          console.log("Set WETH price adjustment");
        }
      } catch (error) {
        console.log("Error setting price adjustments:", error.message);
      }
    } catch (error) {
      console.log("Error setting direct prices:", error.message);
    }
  } catch (error) {
    console.error("Error whitelisting tokens:", error.message);
  }
  
  // Re-check if tokens are now whitelisted
  try {
    const wldToken = deploymentData.WLD;
    const wethToken = deploymentData.WETH;
    
    const wldWhitelisted = await vault.whitelistedTokens(wldToken);
    const wethWhitelisted = await vault.whitelistedTokens(wethToken);
    
    console.log(`WLD token whitelisted: ${wldWhitelisted ? "✅" : "❌"}`);
    console.log(`WETH token whitelisted: ${wethWhitelisted ? "✅" : "❌"}`);
    
    if (wldWhitelisted && wethWhitelisted) {
      console.log("Both tokens are now whitelisted successfully!");
    }
  } catch (error) {
    console.error("Error checking whitelist status:", error.message);
  }
  
  console.log("Token setup completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
