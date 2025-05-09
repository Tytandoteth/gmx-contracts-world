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

// Main function
async function main() {
  console.log("Whitelisting tokens in Vault on World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Check for required contracts
  if (!deploymentData.Vault) {
    console.error("Vault not deployed. Please deploy core contracts first using deployCoreWorld.js");
    process.exit(1);
  }
  
  // Get Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Check governance status
  const gov = await vault.gov();
  console.log(`Vault governance address: ${gov}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  // Check if deployer is the governor
  const isDeployerGov = gov.toLowerCase() === deployer.address.toLowerCase();
  
  // Check if Timelock is the governor
  const isTimelockGov = deploymentData.Timelock && gov.toLowerCase() === deploymentData.Timelock.toLowerCase();
  
  console.log(`Deployer is governor: ${isDeployerGov}`);
  console.log(`Timelock is governor: ${isTimelockGov}`);
  
  if (!isDeployerGov && !isTimelockGov) {
    console.error("Neither deployer nor Timelock is the governance of the Vault. Cannot whitelist tokens.");
    process.exit(1);
  }
  
  // Whitelist WLD token
  console.log(`\nAttempting to whitelist WLD token (${deploymentData.WLD})...`);
  
  // Set token config for WLD
  const wldDecimals = 18;
  const wldWeight = 10000; // 100% weight
  const wldMinProfitBps = 0;
  const wldMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max supply for WLD as USDG
  const wldIsStable = true;
  const wldIsShortable = false;
  
  try {
    if (isDeployerGov) {
      // If the deployer is the governor, whitelist the token directly
      console.log("Whitelisting WLD token directly...");
      
      // Whitelist WLD token
      const tx = await vault.setTokenConfig(
        deploymentData.WLD,
        wldDecimals,
        wldWeight,
        wldMinProfitBps,
        wldMaxUsdgAmount,
        wldIsStable,
        wldIsShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD token successfully whitelisted in Vault");
    } else {
      // If Timelock is the governor, provide instructions to whitelist the token through Timelock
      console.log("Timelock is the governor. You need to execute the whitelist through the Timelock contract.");
      console.log("Execute the following through Timelock:");
      console.log(`vault.setTokenConfig(${deploymentData.WLD}, ${wldDecimals}, ${wldWeight}, ${wldMinProfitBps}, ${wldMaxUsdgAmount}, ${wldIsStable}, ${wldIsShortable})`);
    }
  } catch (error) {
    console.error("Error whitelisting WLD token:", error.message);
  }
  
  // Whitelist WWORLD token
  console.log(`\nAttempting to whitelist WWORLD token (${deploymentData.WWORLD})...`);
  
  // Set token config for WWORLD
  const wworldDecimals = 18;
  const wworldWeight = 10000; // 100% weight
  const wworldMinProfitBps = 0;
  const wworldMaxUsdgAmount = ethers.utils.parseUnits("1000000", 18); // 1 million max
  const wworldIsStable = false;
  const wworldIsShortable = true;
  
  try {
    if (isDeployerGov) {
      // If the deployer is the governor, whitelist the token directly
      console.log("Whitelisting WWORLD token directly...");
      
      // Whitelist WWORLD token
      const tx = await vault.setTokenConfig(
        deploymentData.WWORLD,
        wworldDecimals,
        wworldWeight,
        wworldMinProfitBps,
        wworldMaxUsdgAmount,
        wworldIsStable,
        wworldIsShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD token successfully whitelisted in Vault");
    } else {
      // If Timelock is the governor, provide instructions to whitelist the token through Timelock
      console.log("Timelock is the governor. You need to execute the whitelist through the Timelock contract.");
      console.log("Execute the following through Timelock:");
      console.log(`vault.setTokenConfig(${deploymentData.WWORLD}, ${wworldDecimals}, ${wworldWeight}, ${wworldMinProfitBps}, ${wworldMaxUsdgAmount}, ${wworldIsStable}, ${wworldIsShortable})`);
    }
  } catch (error) {
    console.error("Error whitelisting WWORLD token:", error.message);
  }
  
  // Check if tokens were whitelisted
  console.log("\nVerifying token whitelist status...");
  
  try {
    // Check WLD token
    const wldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    console.log(`WLD token whitelisted: ${wldWhitelisted}`);
    
    // Check WWORLD token
    const wworldWhitelisted = await vault.whitelistedTokens(deploymentData.WWORLD);
    console.log(`WWORLD token whitelisted: ${wworldWhitelisted}`);
    
    // Get whitelisted token count
    const whitelistedCount = await vault.whitelistedTokenCount();
    console.log(`Total whitelisted tokens: ${whitelistedCount}`);
    
    if (whitelistedCount.toNumber() > 0) {
      console.log("Getting whitelisted token details...");
      
      for (let i = 0; i < Math.min(whitelistedCount.toNumber(), 10); i++) {
        const token = await vault.allWhitelistedTokens(i);
        
        if (token.toLowerCase() === deploymentData.WLD.toLowerCase()) {
          console.log(`Token ${i}: WLD (${token})`);
        } else if (token.toLowerCase() === deploymentData.WWORLD.toLowerCase()) {
          console.log(`Token ${i}: WWORLD (${token})`);
        } else {
          console.log(`Token ${i}: ${token}`);
        }
      }
    }
  } catch (error) {
    console.error("Error verifying whitelist status:", error.message);
  }
  
  console.log("\nToken whitelisting process completed!");
  console.log("Next step: Validate deployment using validateDeploymentWorld.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
