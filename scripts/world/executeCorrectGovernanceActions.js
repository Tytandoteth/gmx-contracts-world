const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Executing Timelock governance actions for World Chain...");
  
  const [admin] = await ethers.getSigners();
  console.log(`Using admin account: ${admin.address}`);
  
  // Get deployment data
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  
  // Get the current timelock admin
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== admin.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to execute actions.");
    process.exit(1);
  }
  
  // Get instances of the contracts we'll need
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  console.log("\nExecuting pending governance actions...");
  let executedCount = 0;
  
  // 1. Execute VaultPriceFeed token configurations
  console.log("\n1. Executing price feed configurations...");
  
  // WLD price feed
  console.log("Setting WLD price feed...");
  try {
    // Generate the action hash that was created with signalVaultSetTokenConfig
    const wldPriceFeedAction = ethers.utils.solidityKeccak256(
      ["string", "address", "address", "address", "uint256", "bool"],
      [
        "vaultSetTokenConfig", 
        deploymentData.VaultPriceFeed,
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8,
        true
      ]
    );
    
    // Check if the action is pending and executable
    const wldActionTimestamp = await timelock.pendingActions(wldPriceFeedAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (wldActionTimestamp.isZero()) {
      console.log("WLD price feed action not found or already executed");
    } else if (wldActionTimestamp.gt(now)) {
      const waitTime = wldActionTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`WLD price feed action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx = await timelock.vaultSetTokenConfig(
        deploymentData.VaultPriceFeed,
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8,
        true
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD price feed action executed successfully");
      executedCount++;
    }
  } catch (error) {
    console.error(`Error executing WLD price feed action: ${error.message}`);
  }
  
  // WWORLD price feed
  console.log("\nSetting WWORLD price feed...");
  try {
    // Generate the action hash that was created with signalVaultSetTokenConfig
    const wworldPriceFeedAction = ethers.utils.solidityKeccak256(
      ["string", "address", "address", "address", "uint256", "bool"],
      [
        "vaultSetTokenConfig", 
        deploymentData.VaultPriceFeed,
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8,
        false
      ]
    );
    
    // Check if the action is pending and executable
    const wworldActionTimestamp = await timelock.pendingActions(wworldPriceFeedAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (wworldActionTimestamp.isZero()) {
      console.log("WWORLD price feed action not found or already executed");
    } else if (wworldActionTimestamp.gt(now)) {
      const waitTime = wworldActionTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`WWORLD price feed action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx = await timelock.vaultSetTokenConfig(
        deploymentData.VaultPriceFeed,
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8,
        false
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD price feed action executed successfully");
      executedCount++;
    }
  } catch (error) {
    console.error(`Error executing WWORLD price feed action: ${error.message}`);
  }
  
  // 2. Execute token whitelist actions
  console.log("\n2. Executing token whitelist actions...");
  
  // WLD token whitelist
  console.log("Whitelisting WLD token...");
  try {
    // Generate the action hash that was created with signalVaultSetTokenConfig
    const wldWhitelistAction = ethers.utils.solidityKeccak256(
      ["string", "address", "address", "uint256", "uint256", "uint256", "uint256", "bool", "bool"],
      [
        "vaultSetTokenConfig", 
        deploymentData.Vault,
        deploymentData.WLD,
        18,
        10000,
        0,
        ethers.utils.parseUnits("1000000", 18).toString(),
        true,
        false
      ]
    );
    
    // Check if the action is pending and executable
    const wldWhitelistTimestamp = await timelock.pendingActions(wldWhitelistAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (wldWhitelistTimestamp.isZero()) {
      console.log("WLD whitelist action not found or already executed");
    } else if (wldWhitelistTimestamp.gt(now)) {
      const waitTime = wldWhitelistTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`WLD whitelist action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx = await timelock.vaultSetTokenConfig(
        deploymentData.Vault,
        deploymentData.WLD,
        18,
        10000,
        0,
        ethers.utils.parseUnits("1000000", 18),
        true,
        false
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD whitelist action executed successfully");
      executedCount++;
    }
  } catch (error) {
    console.error(`Error executing WLD whitelist action: ${error.message}`);
  }
  
  // WWORLD token whitelist
  console.log("\nWhitelisting WWORLD token...");
  try {
    // Generate the action hash that was created with signalVaultSetTokenConfig
    const wworldWhitelistAction = ethers.utils.solidityKeccak256(
      ["string", "address", "address", "uint256", "uint256", "uint256", "uint256", "bool", "bool"],
      [
        "vaultSetTokenConfig", 
        deploymentData.Vault,
        deploymentData.WWORLD,
        18,
        10000,
        0,
        ethers.utils.parseUnits("1000000", 18).toString(),
        false,
        true
      ]
    );
    
    // Check if the action is pending and executable
    const wworldWhitelistTimestamp = await timelock.pendingActions(wworldWhitelistAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (wworldWhitelistTimestamp.isZero()) {
      console.log("WWORLD whitelist action not found or already executed");
    } else if (wworldWhitelistTimestamp.gt(now)) {
      const waitTime = wworldWhitelistTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`WWORLD whitelist action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx = await timelock.vaultSetTokenConfig(
        deploymentData.Vault,
        deploymentData.WWORLD,
        18,
        10000,
        0,
        ethers.utils.parseUnits("1000000", 18),
        false,
        true
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD whitelist action executed successfully");
      executedCount++;
    }
  } catch (error) {
    console.error(`Error executing WWORLD whitelist action: ${error.message}`);
  }
  
  // 3. Verify Router setting
  console.log("\n3. Verifying Router setting in Vault...");
  const currentRouter = await vault.router();
  if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
    console.log("Router is correctly set in Vault");
  } else {
    console.log(`Router mismatch! Current: ${currentRouter}, Expected: ${deploymentData.Router}`);
    console.log("Please check the Router setting manually");
  }
  
  // Summary
  console.log("\n=== Execution Summary ===");
  console.log(`Executed: ${executedCount} actions`);
  
  if (executedCount > 0) {
    console.log("\nSome actions were executed successfully!");
    console.log("Run validateDeploymentWorld.js to verify the deployment.");
  } else {
    console.log("\nNo actions were executed. They may not be ready yet or have already been executed.");
    console.log("Wait for the buffer period to complete and try again.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
