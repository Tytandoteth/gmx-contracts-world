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
  console.log("Whitelisting tokens in Vault on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Check if we have governance access
  const gov = await vault.gov();
  console.log(`Vault governance address: ${gov}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  console.log("\nAttempting to whitelist tokens...");
  
  if (gov.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("Deployer is not the governance of the Vault. Checking if Timelock is the governor...");
    
    if (gov.toLowerCase() !== deploymentData.Timelock.toLowerCase()) {
      console.error("Neither deployer nor Timelock is the governance of the Vault. Cannot whitelist tokens.");
      process.exit(1);
    }
    
    console.log("Timelock is the governance. Will use Timelock to whitelist tokens.");
    // Get Timelock instance
    const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
    
    // Check if deployer has admin rights on the Timelock
    const admin = await timelock.admin();
    console.log(`Timelock admin address: ${admin}`);
    if (admin.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("Deployer is not the admin of the Timelock. Cannot whitelist tokens through Timelock.");
      process.exit(1);
    }
    
    // Use Timelock to whitelist tokens
    console.log("Using Timelock to whitelist tokens in Vault...");
    
    // First, whitelist WLD token
    console.log(`Whitelisting WLD token (${deploymentData.WLD})...`);
    
    // Set token config for WLD
    // Parameters: token, tokenDecimals, tokenWeight, minProfitBps, maxUsdgAmount, isStable, isShortable
    // Note: For WLD, we'll set it as a stablecoin
    const wldDecimals = 18;
    const wldWeight = 10000; // 100% weight
    const wldMinProfitBps = 0;
    const wldMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max
    const wldIsStable = true;
    const wldIsShortable = false;
    
    // Execute setTokenConfig directly if we have governance access
    try {
      const tx = await vault.setTokenConfig(
        deploymentData.WLD,
        wldDecimals,
        wldWeight,
        wldMinProfitBps,
        wldMaxUsdgAmount,
        wldIsStable,
        wldIsShortable
      );
      
      console.log(`WLD token configuration transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD token successfully whitelisted in Vault");
    } catch (error) {
      console.error("Error whitelisting WLD token:", error.message);
    }
    
    // Next, whitelist WETH token
    console.log(`Whitelisting WETH token (${deploymentData.WETH})...`);
    
    // Set token config for WETH
    // Parameters: token, tokenDecimals, tokenWeight, minProfitBps, maxUsdgAmount, isStable, isShortable
    const wethDecimals = 18;
    const wethWeight = 10000; // 100% weight
    const wethMinProfitBps = 0;
    const wethMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max
    const wethIsStable = false;
    const wethIsShortable = true;
    
    try {
      const tx = await vault.setTokenConfig(
        deploymentData.WETH,
        wethDecimals,
        wethWeight,
        wethMinProfitBps,
        wethMaxUsdgAmount,
        wethIsStable,
        wethIsShortable
      );
      
      console.log(`WETH token configuration transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WETH token successfully whitelisted in Vault");
    } catch (error) {
      console.error("Error whitelisting WETH token:", error.message);
    }
  } else {
    console.log("Deployer has direct governance access. Whitelisting tokens directly...");
    
    // First, whitelist WLD token
    console.log(`Whitelisting WLD token (${deploymentData.WLD})...`);
    
    // Set token config for WLD
    // Parameters: token, tokenDecimals, tokenWeight, minProfitBps, maxUsdgAmount, isStable, isShortable
    // Note: For WLD, we'll set it as a stablecoin
    const wldDecimals = 18;
    const wldWeight = 10000; // 100% weight
    const wldMinProfitBps = 0;
    const wldMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max
    const wldIsStable = true;
    const wldIsShortable = false;
    
    console.log("Checking Vault interface...");
    // Get the function signature to confirm it exists
    const vaultFunctions = Object.keys(vault.interface.functions);
    console.log("Available functions in Vault:", vaultFunctions.filter(f => f.includes("setToken")));
    
    // Execute setTokenConfig directly
    try {
      console.log("Attempting to call setTokenConfig with parameters:");
      console.log({
        token: deploymentData.WLD,
        decimals: wldDecimals,
        weight: wldWeight,
        minProfitBps: wldMinProfitBps,
        maxUsdgAmount: wldMaxUsdgAmount.toString(),
        isStable: wldIsStable,
        isShortable: wldIsShortable
      });
      
      const tx = await vault.setTokenConfig(
        deploymentData.WLD,
        wldDecimals,
        wldWeight,
        wldMinProfitBps,
        wldMaxUsdgAmount,
        wldIsStable,
        wldIsShortable
      );
      
      console.log(`WLD token configuration transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD token successfully whitelisted in Vault");
    } catch (error) {
      console.error("Error whitelisting WLD token:", error.message);
    }
    
    // Next, whitelist WETH token
    console.log(`Whitelisting WETH token (${deploymentData.WETH})...`);
    
    // Set token config for WETH
    // Parameters: token, tokenDecimals, tokenWeight, minProfitBps, maxUsdgAmount, isStable, isShortable
    const wethDecimals = 18;
    const wethWeight = 10000; // 100% weight
    const wethMinProfitBps = 0;
    const wethMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max
    const wethIsStable = false;
    const wethIsShortable = true;
    
    try {
      const tx = await vault.setTokenConfig(
        deploymentData.WETH,
        wethDecimals,
        wethWeight,
        wethMinProfitBps,
        wethMaxUsdgAmount,
        wethIsStable,
        wethIsShortable
      );
      
      console.log(`WETH token configuration transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WETH token successfully whitelisted in Vault");
    } catch (error) {
      console.error("Error whitelisting WETH token:", error.message);
    }
  }
  
  // Verify whitelist status
  console.log("\nVerifying token whitelist status...");
  
  const wldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
  console.log(`WLD token whitelisted: ${wldWhitelisted}`);
  
  const wethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
  console.log(`WETH token whitelisted: ${wethWhitelisted}`);
  
  if (wldWhitelisted && wethWhitelisted) {
    console.log("\nToken whitelisting completed successfully! ✅");
  } else {
    console.log("\nSome tokens could not be whitelisted. Please check the logs above for errors. ❌");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
