const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Function to get deployment data
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found at", deploymentPath);
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

// Execute pending governance actions
async function main() {
  console.log("Executing pending governance actions for World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to execute governance actions.");
    process.exit(1);
  }
  
  // 1. Execute Vault Price Feed action if it was signaled
  console.log("\n1. Executing Vault Price Feed action...");
  try {
    // Generate the action hash that was created with signalSetPriceFeed
    const priceFeedAction = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setPriceFeed", deploymentData.Vault, deploymentData.VaultPriceFeed]
      )
    );
    
    const priceFeedTimestamp = await timelock.pendingActions(priceFeedAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (priceFeedTimestamp.isZero()) {
      console.log("Vault Price Feed action not found or already executed");
    } else if (priceFeedTimestamp.gt(now)) {
      const waitTime = priceFeedTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`Vault Price Feed action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx1 = await timelock.setPriceFeed(
        deploymentData.Vault,
        deploymentData.VaultPriceFeed
      );
      console.log(`Transaction sent: ${tx1.hash}`);
      await tx1.wait();
      console.log("Vault Price Feed action executed successfully");
    }
  } catch (error) {
    console.error(`Error executing Vault Price Feed action: ${error.message}`);
  }
  
  // 2. Execute custom token whitelist actions if they were created
  console.log("\n2. Executing custom token whitelist actions...");
  
  // WLD whitelist action
  const wldActionPath = path.join(__dirname, "../../.world-wld-whitelist-action.json");
  if (fs.existsSync(wldActionPath)) {
    try {
      const wldAction = JSON.parse(fs.readFileSync(wldActionPath, "utf8"));
      console.log("Found WLD whitelist action, executing...");
      
      const vault = await ethers.getContractAt("Vault", wldAction.target);
      const tx2 = await vault.setTokenConfig(
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      );
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log("WLD token whitelist action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wldActionPath);
    } catch (error) {
      console.error(`Error executing WLD whitelist action: ${error.message}`);
    }
  } else {
    console.log("No WLD whitelist action found");
  }
  
  // WWORLD whitelist action
  const wworldActionPath = path.join(__dirname, "../../.world-wworld-whitelist-action.json");
  if (fs.existsSync(wworldActionPath)) {
    try {
      const wworldAction = JSON.parse(fs.readFileSync(wworldActionPath, "utf8"));
      console.log("Found WWORLD whitelist action, executing...");
      
      const vault = await ethers.getContractAt("Vault", wworldAction.target);
      const tx3 = await vault.setTokenConfig(
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      );
      console.log(`Transaction sent: ${tx3.hash}`);
      await tx3.wait();
      console.log("WWORLD token whitelist action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wworldActionPath);
    } catch (error) {
      console.error(`Error executing WWORLD whitelist action: ${error.message}`);
    }
  } else {
    console.log("No WWORLD whitelist action found");
  }
  
  // 3. Execute custom price feed actions if they were created
  console.log("\n3. Executing custom price feed actions...");
  
  // WLD price feed action
  const wldPriceFeedPath = path.join(__dirname, "../../.world-wld-pricefeed-action.json");
  if (fs.existsSync(wldPriceFeedPath)) {
    try {
      const wldPriceFeedAction = JSON.parse(fs.readFileSync(wldPriceFeedPath, "utf8"));
      console.log("Found WLD price feed action, executing...");
      
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", wldPriceFeedAction.target);
      const tx4 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      );
      console.log(`Transaction sent: ${tx4.hash}`);
      await tx4.wait();
      console.log("WLD price feed action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wldPriceFeedPath);
    } catch (error) {
      console.error(`Error executing WLD price feed action: ${error.message}`);
    }
  } else {
    console.log("No WLD price feed action found");
  }
  
  // WWORLD price feed action
  const wworldPriceFeedPath = path.join(__dirname, "../../.world-wworld-pricefeed-action.json");
  if (fs.existsSync(wworldPriceFeedPath)) {
    try {
      const wworldPriceFeedAction = JSON.parse(fs.readFileSync(wworldPriceFeedPath, "utf8"));
      console.log("Found WWORLD price feed action, executing...");
      
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", wworldPriceFeedAction.target);
      const tx5 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      );
      console.log(`Transaction sent: ${tx5.hash}`);
      await tx5.wait();
      console.log("WWORLD price feed action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wworldPriceFeedPath);
    } catch (error) {
      console.error(`Error executing WWORLD price feed action: ${error.message}`);
    }
  } else {
    console.log("No WWORLD price feed action found");
  }
  
  // 4. Verify Router in Vault
  console.log("\n4. Verifying Router in Vault...");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const currentRouter = await vault.router();
    if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      console.log(`✅ Router correctly set in Vault: ${currentRouter}`);
    } else {
      console.log(`❌ Router mismatch! Current: ${currentRouter}, Expected: ${deploymentData.Router}`);
      console.log("You may need to manually fix the Router");
    }
  } catch (error) {
    console.error(`Error checking Router: ${error.message}`);
  }
  
  // 5. Verify token whitelisting
  console.log("\n5. Verifying token whitelisting...");
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  try {
    const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
    if (isWldWhitelisted) {
      console.log(`✅ WLD token is properly whitelisted`);
    } else {
      console.log(`❌ WLD token is not whitelisted!`);
    }
    
    const isWworldWhitelisted = await vault.whitelistedTokens(deploymentData.WWORLD);
    if (isWworldWhitelisted) {
      console.log(`✅ WWORLD token is properly whitelisted`);
    } else {
      console.log(`❌ WWORLD token is not whitelisted!`);
    }
  } catch (error) {
    console.error(`Error verifying token whitelisting: ${error.message}`);
  }
  
  // 6. Verify price feeds
  console.log("\n6. Verifying price feeds...");
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  try {
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    if (wldPriceFeed.toLowerCase() === deploymentData.MockPriceFeeds.WLD.toLowerCase()) {
      console.log(`✅ WLD price feed is properly configured`);
    } else {
      console.log(`❌ WLD price feed mismatch! Current: ${wldPriceFeed}, Expected: ${deploymentData.MockPriceFeeds.WLD}`);
    }
    
    const wworldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WWORLD);
    if (wworldPriceFeed.toLowerCase() === deploymentData.MockPriceFeeds.WWORLD.toLowerCase()) {
      console.log(`✅ WWORLD price feed is properly configured`);
    } else {
      console.log(`❌ WWORLD price feed mismatch! Current: ${wworldPriceFeed}, Expected: ${deploymentData.MockPriceFeeds.WWORLD}`);
    }
  } catch (error) {
    console.error(`Error verifying price feeds: ${error.message}`);
  }
  
  console.log("\nExecution of governance actions completed!");
  console.log("Run a full validation script to ensure everything is properly configured.");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
