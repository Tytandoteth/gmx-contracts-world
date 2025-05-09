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

// Get or initialize the timelock actions data
async function getTimelockActionsData() {
  const actionsPath = path.join(__dirname, "../../.world-timelock-actions.json");
  
  if (!fs.existsSync(actionsPath)) {
    return {
      pendingActions: {},
      executedActions: {}
    };
  }
  
  const fileContent = fs.readFileSync(actionsPath, "utf8");
  if (!fileContent) {
    return {
      pendingActions: {},
      executedActions: {}
    };
  }
  
  return JSON.parse(fileContent);
}

// Save timelock actions data
async function saveTimelockActionsData(actionsData) {
  const actionsPath = path.join(__dirname, "../../.world-timelock-actions.json");
  fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 2));
  console.log("Timelock actions data saved to", actionsPath);
}

// Create a timelock action for setting the router in vault
async function createSetRouterAction(timelock, vault, router) {
  console.log("\nCreating Timelock action for setting Router in Vault...");
  
  // Get ABI and encode the function call
  const vaultInterface = new ethers.utils.Interface([
    "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external"
  ]);
  
  // We get the current values to re-initialize with same params but our router
  const usdg = await vault.usdg();
  const priceFeed = await vault.priceFeed();
  const liquidationFeeUsd = await vault.liquidationFeeUsd();
  const fundingRateFactor = await vault.fundingRateFactor();
  const stableFundingRateFactor = await vault.stableFundingRateFactor();
  
  const data = vaultInterface.encodeFunctionData("initialize", [
    router,
    usdg,
    priceFeed,
    liquidationFeeUsd,
    fundingRateFactor,
    stableFundingRateFactor
  ]);
  
  // Create a timelock action to re-initialize the vault with the new router
  const action = ethers.utils.solidityKeccak256(
    ["string", "address", "address", "bytes"],
    ["setVaultRouter", timelock.address, vault.address, data]
  );
  
  // Check if the action is already scheduled
  const [actionTimestamp] = await timelock.pendingActions(action);
  if (actionTimestamp.gt(0)) {
    console.log("Action already scheduled at timestamp:", actionTimestamp.toString());
    return { action, data, timestamp: actionTimestamp };
  }
  
  // Schedule the action
  const tx = await timelock.scheduleAction(vault.address, 0, data, action, 0);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  
  // Get the timestamp when this action can be executed
  const [timestamp] = await timelock.pendingActions(action);
  console.log(`Action scheduled for execution after: ${new Date(timestamp.toNumber() * 1000)}`);
  
  return { action, data, timestamp };
}

// Create a timelock action for setting token config in vaultPriceFeed
async function createSetPriceFeedAction(timelock, vaultPriceFeed, token, priceFeed, decimals, isStable) {
  console.log(`\nCreating Timelock action for setting ${token} price feed...`);
  
  // Get ABI and encode the function call
  const vaultPriceFeedInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
  ]);
  
  const data = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    token,
    priceFeed,
    decimals,
    isStable
  ]);
  
  // Create a unique action identifier
  const action = ethers.utils.solidityKeccak256(
    ["string", "address", "address", "bytes"],
    [`setPriceFeed_${token}`, timelock.address, vaultPriceFeed.address, data]
  );
  
  // Check if the action is already scheduled
  const [actionTimestamp] = await timelock.pendingActions(action);
  if (actionTimestamp.gt(0)) {
    console.log("Action already scheduled at timestamp:", actionTimestamp.toString());
    return { action, data, timestamp: actionTimestamp };
  }
  
  // Schedule the action
  const tx = await timelock.scheduleAction(vaultPriceFeed.address, 0, data, action, 0);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  
  // Get the timestamp when this action can be executed
  const [timestamp] = await timelock.pendingActions(action);
  console.log(`Action scheduled for execution after: ${new Date(timestamp.toNumber() * 1000)}`);
  
  return { action, data, timestamp };
}

// Create a timelock action for whitelisting a token in the vault
async function createWhitelistTokenAction(timelock, vault, token, decimals, weight, minProfitBps, maxUsdgAmount, isStable, isShortable) {
  console.log(`\nCreating Timelock action for whitelisting ${token}...`);
  
  // Get ABI and encode the function call
  const vaultInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ]);
  
  const data = vaultInterface.encodeFunctionData("setTokenConfig", [
    token,
    decimals,
    weight,
    minProfitBps,
    maxUsdgAmount,
    isStable,
    isShortable
  ]);
  
  // Create a unique action identifier
  const action = ethers.utils.solidityKeccak256(
    ["string", "address", "address", "bytes"],
    [`whitelistToken_${token}`, timelock.address, vault.address, data]
  );
  
  // Check if the action is already scheduled
  const [actionTimestamp] = await timelock.pendingActions(action);
  if (actionTimestamp.gt(0)) {
    console.log("Action already scheduled at timestamp:", actionTimestamp.toString());
    return { action, data, timestamp: actionTimestamp };
  }
  
  // Schedule the action
  const tx = await timelock.scheduleAction(vault.address, 0, data, action, 0);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  
  // Get the timestamp when this action can be executed
  const [timestamp] = await timelock.pendingActions(action);
  console.log(`Action scheduled for execution after: ${new Date(timestamp.toNumber() * 1000)}`);
  
  return { action, data, timestamp };
}

// Execute a pending timelock action
async function executeTimelockAction(timelock, target, value, data, action) {
  console.log(`\nExecuting Timelock action: ${action}...`);
  
  // First check if the action is executable
  const [timestamp] = await timelock.pendingActions(action);
  
  if (timestamp.eq(0)) {
    console.error("Action not found or already executed");
    return false;
  }
  
  const now = Math.floor(Date.now() / 1000);
  if (timestamp.gt(now)) {
    const waitTimeSeconds = timestamp.toNumber() - now;
    const hours = Math.floor(waitTimeSeconds / 3600);
    const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
    const seconds = waitTimeSeconds % 60;
    
    console.error(`Action is not yet executable. Wait time remaining: ${hours}h ${minutes}m ${seconds}s`);
    return false;
  }
  
  // Execute the action
  try {
    const tx = await timelock.executeAction(target, value, data, action);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("Action executed successfully!");
    return true;
  } catch (error) {
    console.error("Error executing action:", error.message);
    return false;
  }
}

// List all pending timelock actions
async function listPendingActions(timelock) {
  console.log("\nListing all pending Timelock actions...");
  
  // Get the actions from our saved data
  const actionsData = await getTimelockActionsData();
  
  if (Object.keys(actionsData.pendingActions).length === 0) {
    console.log("No pending actions found");
    return;
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // Check each pending action
  for (const [actionId, actionInfo] of Object.entries(actionsData.pendingActions)) {
    // Check if it's still pending
    const [timestamp] = await timelock.pendingActions(actionId);
    
    if (timestamp.eq(0)) {
      // Action was executed or cancelled
      console.log(`Action ${actionInfo.description} was executed or cancelled`);
      
      // Move to executed
      actionsData.executedActions[actionId] = {
        ...actionInfo,
        executedAt: now
      };
      
      delete actionsData.pendingActions[actionId];
    } else {
      // Calculate remaining time
      const waitTimeSeconds = timestamp.toNumber() - now;
      if (waitTimeSeconds <= 0) {
        console.log(`✅ ${actionInfo.description}`);
        console.log(`   Ready to execute! (Scheduled for ${new Date(timestamp.toNumber() * 1000)})`);
      } else {
        const hours = Math.floor(waitTimeSeconds / 3600);
        const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
        const seconds = waitTimeSeconds % 60;
        
        console.log(`⏳ ${actionInfo.description}`);
        console.log(`   Wait time remaining: ${hours}h ${minutes}m ${seconds}s`);
        console.log(`   (Executable after: ${new Date(timestamp.toNumber() * 1000)})`);
      }
    }
  }
  
  // Save updated actions data
  await saveTimelockActionsData(actionsData);
}

module.exports = {
  getDeploymentData,
  getTimelockActionsData,
  saveTimelockActionsData,
  createSetRouterAction,
  createSetPriceFeedAction,
  createWhitelistTokenAction,
  executeTimelockAction,
  listPendingActions
};
