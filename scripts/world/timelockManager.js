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

// Show help for command line arguments
function showHelp() {
  console.log("\nTimelockManager Usage:");
  console.log("  npx hardhat run scripts/world/timelockManager.js --network worldchain [command]");
  console.log("\nCommands:");
  console.log("  list                        - List all pending actions");
  console.log("  create-all                  - Create all required actions (router, price feeds, whitelist)");
  console.log("  create-router               - Create action to set router in vault");
  console.log("  create-pricefeeds           - Create actions to set price feeds");
  console.log("  create-whitelist            - Create actions to whitelist tokens");
  console.log("  execute [actionId]          - Execute a specific action by ID");
  console.log("  execute-all                 - Execute all executable actions");
  console.log("  help                        - Show this help message");
}

// Main function
async function main() {
  console.log("GMX Timelock Manager for World Chain");
  
  const [admin] = await ethers.getSigners();
  console.log(`Using admin: ${admin.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  
  // Get the current timelock admin
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== admin.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to create or execute actions.");
  }
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[args.length - 1]; // The last argument should be the command
  
  // Get existing actions data
  const actionsData = await getTimelockActionsData();
  
  // Process command
  if (command === 'list') {
    await listPendingActions(timelock);
  } 
  else if (command === 'create-all') {
    console.log("Creating all required Timelock actions...");
    
    // Create action to set router in vault
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const router = deploymentData.Router;
    const setRouterAction = await createSetRouterAction(timelock, vault, router);
    actionsData.pendingActions[setRouterAction.action] = {
      description: "Set Router in Vault",
      target: vault.address,
      value: 0,
      data: setRouterAction.data,
      timestamp: setRouterAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // Create actions to set price feeds
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // WLD price feed
    const wldPriceFeedAction = await createSetPriceFeedAction(
      timelock, 
      vaultPriceFeed,
      deploymentData.WLD, 
      deploymentData.MockPriceFeeds.WLD,
      8, // decimals
      true // isStable
    );
    actionsData.pendingActions[wldPriceFeedAction.action] = {
      description: "Set WLD Price Feed",
      target: vaultPriceFeed.address,
      value: 0,
      data: wldPriceFeedAction.data,
      timestamp: wldPriceFeedAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // WWORLD price feed
    const wworldPriceFeedAction = await createSetPriceFeedAction(
      timelock, 
      vaultPriceFeed,
      deploymentData.WWORLD, 
      deploymentData.MockPriceFeeds.WWORLD,
      8, // decimals
      false // isStable
    );
    actionsData.pendingActions[wworldPriceFeedAction.action] = {
      description: "Set WWORLD Price Feed",
      target: vaultPriceFeed.address,
      value: 0,
      data: wworldPriceFeedAction.data,
      timestamp: wworldPriceFeedAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // Create actions to whitelist tokens
    // WLD token
    const wldWhitelistAction = await createWhitelistTokenAction(
      timelock,
      vault,
      deploymentData.WLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      true, // isStable
      false // isShortable
    );
    actionsData.pendingActions[wldWhitelistAction.action] = {
      description: "Whitelist WLD Token",
      target: vault.address,
      value: 0,
      data: wldWhitelistAction.data,
      timestamp: wldWhitelistAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // WWORLD token
    const wworldWhitelistAction = await createWhitelistTokenAction(
      timelock,
      vault,
      deploymentData.WWORLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      false, // isStable
      true // isShortable
    );
    actionsData.pendingActions[wworldWhitelistAction.action] = {
      description: "Whitelist WWORLD Token",
      target: vault.address,
      value: 0,
      data: wworldWhitelistAction.data,
      timestamp: wworldWhitelistAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // Save actions data
    await saveTimelockActionsData(actionsData);
    
  }
  else if (command === 'create-router') {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const router = deploymentData.Router;
    const setRouterAction = await createSetRouterAction(timelock, vault, router);
    actionsData.pendingActions[setRouterAction.action] = {
      description: "Set Router in Vault",
      target: vault.address,
      value: 0,
      data: setRouterAction.data,
      timestamp: setRouterAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    await saveTimelockActionsData(actionsData);
  }
  else if (command === 'create-pricefeeds') {
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    
    // WLD price feed
    const wldPriceFeedAction = await createSetPriceFeedAction(
      timelock, 
      vaultPriceFeed,
      deploymentData.WLD, 
      deploymentData.MockPriceFeeds.WLD,
      8, // decimals
      true // isStable
    );
    actionsData.pendingActions[wldPriceFeedAction.action] = {
      description: "Set WLD Price Feed",
      target: vaultPriceFeed.address,
      value: 0,
      data: wldPriceFeedAction.data,
      timestamp: wldPriceFeedAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // WWORLD price feed
    const wworldPriceFeedAction = await createSetPriceFeedAction(
      timelock, 
      vaultPriceFeed,
      deploymentData.WWORLD, 
      deploymentData.MockPriceFeeds.WWORLD,
      8, // decimals
      false // isStable
    );
    actionsData.pendingActions[wworldPriceFeedAction.action] = {
      description: "Set WWORLD Price Feed",
      target: vaultPriceFeed.address,
      value: 0,
      data: wworldPriceFeedAction.data,
      timestamp: wworldPriceFeedAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    await saveTimelockActionsData(actionsData);
  }
  else if (command === 'create-whitelist') {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    
    // WLD token
    const wldWhitelistAction = await createWhitelistTokenAction(
      timelock,
      vault,
      deploymentData.WLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      true, // isStable
      false // isShortable
    );
    actionsData.pendingActions[wldWhitelistAction.action] = {
      description: "Whitelist WLD Token",
      target: vault.address,
      value: 0,
      data: wldWhitelistAction.data,
      timestamp: wldWhitelistAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // WWORLD token
    const wworldWhitelistAction = await createWhitelistTokenAction(
      timelock,
      vault,
      deploymentData.WWORLD, // token
      18, // decimals
      10000, // weight
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      false, // isStable
      true // isShortable
    );
    actionsData.pendingActions[wworldWhitelistAction.action] = {
      description: "Whitelist WWORLD Token",
      target: vault.address,
      value: 0,
      data: wworldWhitelistAction.data,
      timestamp: wworldWhitelistAction.timestamp.toNumber(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    await saveTimelockActionsData(actionsData);
  }
  else if (command.startsWith('execute-')) {
    const actionId = command.slice('execute-'.length);
    if (!actionsData.pendingActions[actionId]) {
      console.error(`Action ${actionId} not found`);
      process.exit(1);
    }
    
    const actionInfo = actionsData.pendingActions[actionId];
    console.log(`Executing action: ${actionInfo.description}`);
    
    const success = await executeTimelockAction(
      timelock,
      actionInfo.target,
      actionInfo.value,
      actionInfo.data,
      actionId
    );
    
    if (success) {
      // Move from pending to executed
      actionsData.executedActions[actionId] = {
        ...actionInfo,
        executedAt: Math.floor(Date.now() / 1000)
      };
      delete actionsData.pendingActions[actionId];
      await saveTimelockActionsData(actionsData);
    }
  }
  else if (command === 'execute-all') {
    console.log("Executing all executable Timelock actions...");
    
    const now = Math.floor(Date.now() / 1000);
    let executed = 0;
    
    for (const [actionId, actionInfo] of Object.entries(actionsData.pendingActions)) {
      if (actionInfo.timestamp <= now) {
        console.log(`Executing action: ${actionInfo.description}`);
        
        const success = await executeTimelockAction(
          timelock,
          actionInfo.target,
          actionInfo.value,
          actionInfo.data,
          actionId
        );
        
        if (success) {
          // Move from pending to executed
          actionsData.executedActions[actionId] = {
            ...actionInfo,
            executedAt: Math.floor(Date.now() / 1000)
          };
          delete actionsData.pendingActions[actionId];
          executed++;
        }
      }
    }
    
    console.log(`Executed ${executed} actions`);
    await saveTimelockActionsData(actionsData);
  }
  else {
    showHelp();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
