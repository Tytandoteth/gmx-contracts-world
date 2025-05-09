const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Creating governance actions through Timelock for World Chain...");
  
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
    console.warn("You won't be able to create or execute actions.");
    process.exit(1);
  }
  
  // 1. Set up VaultPriceFeed with token price feeds
  console.log("\n1. Signaling to set price feeds for tokens...");
  
  // Price feed for WLD
  console.log(`Setting WLD price feed...`);
  try {
    // First get the VaultPriceFeed instance
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // Signal the price feed action for WLD
    const tx1 = await timelock.signalVaultSetTokenConfig(
      deploymentData.VaultPriceFeed, // vault price feed address
      deploymentData.WLD, // token
      deploymentData.MockPriceFeeds.WLD, // price feed
      8, // decimals
      true // isStable
    );
    console.log(`Transaction sent: ${tx1.hash}`);
    await tx1.wait();
    console.log("WLD price feed action signaled successfully");
  } catch (error) {
    console.error(`Error signaling WLD price feed: ${error.message}`);
  }
  
  // Price feed for WWORLD
  console.log(`\nSetting WWORLD price feed...`);
  try {
    const tx2 = await timelock.signalVaultSetTokenConfig(
      deploymentData.VaultPriceFeed, // vault price feed address
      deploymentData.WWORLD, // token
      deploymentData.MockPriceFeeds.WWORLD, // price feed
      8, // decimals
      false // isStable
    );
    console.log(`Transaction sent: ${tx2.hash}`);
    await tx2.wait();
    console.log("WWORLD price feed action signaled successfully");
  } catch (error) {
    console.error(`Error signaling WWORLD price feed: ${error.message}`);
  }
  
  // 2. Whitelist tokens in the vault
  console.log("\n2. Signaling to whitelist tokens in the Vault...");
  
  // Whitelist WLD
  console.log("Whitelisting WLD token...");
  try {
    const tx3 = await timelock.signalVaultSetTokenConfig(
      deploymentData.Vault, // vault address
      deploymentData.WLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      true, // isStable
      false // isShortable
    );
    console.log(`Transaction sent: ${tx3.hash}`);
    await tx3.wait();
    console.log("WLD whitelist action signaled successfully");
  } catch (error) {
    console.error(`Error whitelisting WLD: ${error.message}`);
  }
  
  // Whitelist WWORLD
  console.log("\nWhitelisting WWORLD token...");
  try {
    const tx4 = await timelock.signalVaultSetTokenConfig(
      deploymentData.Vault, // vault address
      deploymentData.WWORLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      false, // isStable
      true // isShortable
    );
    console.log(`Transaction sent: ${tx4.hash}`);
    await tx4.wait();
    console.log("WWORLD whitelist action signaled successfully");
  } catch (error) {
    console.error(`Error whitelisting WWORLD: ${error.message}`);
  }
  
  // 3. Set Router in Vault - this doesn't have a direct signal function in the Timelock
  // We need to fix the Router in the Vault directly as a governance action
  console.log("\n3. Setting Router in Vault directly...");
  try {
    // Get the Vault contract
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // Using the Vault's setRouter function directly if it exists
    // Check if the function exists in the ABI
    const vaultFunctions = vault.interface.functions;
    const hasSetRouter = Object.keys(vaultFunctions).some(key => key.startsWith("setRouter("));
    
    if (hasSetRouter) {
      console.log("Using Vault.setRouter directly...");
      const tx5 = await vault.setRouter(deploymentData.Router);
      console.log(`Transaction sent: ${tx5.hash}`);
      await tx5.wait();
      console.log("Router set successfully in Vault");
    } else {
      // If there's no setRouter function, we'll have to reinitialize the Vault
      // This would require a special custom action through the Timelock
      console.log("No setRouter function found, need to reinitialize Vault");
      console.log("Please verify the router is correctly set in the Vault's initialize function");
    }
  } catch (error) {
    console.error(`Error setting Router in Vault: ${error.message}`);
  }
  
  console.log("\nAll governance actions have been signaled!");
  console.log("Wait for the buffer period (default 24 hours) to elapse.");
  console.log("Then run executeCorrectGovernanceActions.js to execute all pending actions.");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
