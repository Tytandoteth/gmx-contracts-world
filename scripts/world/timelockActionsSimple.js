const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Simple Timelock Manager for World Chain Governance");
  
  const [admin] = await ethers.getSigners();
  console.log(`Using admin: ${admin.address}`);
  
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
  
  // Encode function calls for required actions
  console.log("\nCreating Timelock actions...");
  
  // 1. Create action to set router in vault
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Use command line args to determine action
  const args = process.argv.slice(2);
  const command = args[args.length - 1]; // The last argument should be the command
  
  if (command === 'create') {
    await createAllActions(timelock, vault, vaultPriceFeed, deploymentData);
  } else if (command === 'list') {
    await listPendingActions(timelock);
  } else if (command === 'execute') {
    await executeAllActions(timelock);
  } else {
    console.log("Usage:");
    console.log("  npx hardhat run scripts/world/timelockActionsSimple.js --network worldchain create");
    console.log("  npx hardhat run scripts/world/timelockActionsSimple.js --network worldchain list");
    console.log("  npx hardhat run scripts/world/timelockActionsSimple.js --network worldchain execute");
  }
}

// Create all the required actions
async function createAllActions(timelock, vault, vaultPriceFeed, deploymentData) {
  console.log("Creating all required governance actions...");
  
  // 1. Set Router in Vault
  const vaultInterface = new ethers.utils.Interface([
    "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external"
  ]);
  
  // Get current values
  const usdg = await vault.usdg();
  const priceFeed = await vault.priceFeed();
  const liquidationFeeUsd = await vault.liquidationFeeUsd();
  const fundingRateFactor = await vault.fundingRateFactor();
  const stableFundingRateFactor = await vault.stableFundingRateFactor();
  
  // Encode initialize call with new router
  const setRouterData = vaultInterface.encodeFunctionData("initialize", [
    deploymentData.Router,
    usdg,
    priceFeed,
    liquidationFeeUsd,
    fundingRateFactor,
    stableFundingRateFactor
  ]);
  
  // Create action identifier
  const setRouterActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setRouter", vault.address, setRouterData]
    )
  );
  
  // Schedule the action
  console.log("Scheduling setRouter action...");
  try {
    const tx = await timelock.scheduleAction(
      vault.address,
      0, // value
      setRouterData,
      setRouterActionId,
      0 // buffer override, 0 means use default
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("setRouter action scheduled successfully");
  } catch (error) {
    console.error("Error scheduling setRouter action:", error.message);
  }
  
  // 2. Create Price Feed actions
  const vaultPriceFeedInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
  ]);
  
  // WLD Price Feed
  const wldPriceFeedData = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    true // isStable
  ]);
  
  const wldPriceFeedActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setWLDPriceFeed", vaultPriceFeed.address, wldPriceFeedData]
    )
  );
  
  // Schedule the action
  console.log("Scheduling WLD price feed action...");
  try {
    const tx = await timelock.scheduleAction(
      vaultPriceFeed.address,
      0, // value
      wldPriceFeedData,
      wldPriceFeedActionId,
      0 // buffer override
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("WLD price feed action scheduled successfully");
  } catch (error) {
    console.error("Error scheduling WLD price feed action:", error.message);
  }
  
  // WWORLD Price Feed
  const wworldPriceFeedData = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    deploymentData.MockPriceFeeds.WWORLD,
    8, // decimals
    false // isStable
  ]);
  
  const wworldPriceFeedActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setWWORLDPriceFeed", vaultPriceFeed.address, wworldPriceFeedData]
    )
  );
  
  // Schedule the action
  console.log("Scheduling WWORLD price feed action...");
  try {
    const tx = await timelock.scheduleAction(
      vaultPriceFeed.address,
      0, // value
      wworldPriceFeedData,
      wworldPriceFeedActionId,
      0 // buffer override
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("WWORLD price feed action scheduled successfully");
  } catch (error) {
    console.error("Error scheduling WWORLD price feed action:", error.message);
  }
  
  // 3. Create Whitelist Token actions
  const whitelistInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ]);
  
  // Whitelist WLD
  const wldWhitelistData = whitelistInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    true, // isStable
    false // isShortable
  ]);
  
  const wldWhitelistActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["whitelistWLD", vault.address, wldWhitelistData]
    )
  );
  
  // Schedule the action
  console.log("Scheduling WLD whitelist action...");
  try {
    const tx = await timelock.scheduleAction(
      vault.address,
      0, // value
      wldWhitelistData,
      wldWhitelistActionId,
      0 // buffer override
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("WLD whitelist action scheduled successfully");
  } catch (error) {
    console.error("Error scheduling WLD whitelist action:", error.message);
  }
  
  // Whitelist WWORLD
  const wworldWhitelistData = whitelistInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    false, // isStable
    true // isShortable
  ]);
  
  const wworldWhitelistActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["whitelistWWORLD", vault.address, wworldWhitelistData]
    )
  );
  
  // Schedule the action
  console.log("Scheduling WWORLD whitelist action...");
  try {
    const tx = await timelock.scheduleAction(
      vault.address,
      0, // value
      wworldWhitelistData,
      wworldWhitelistActionId,
      0 // buffer override
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("WWORLD whitelist action scheduled successfully");
  } catch (error) {
    console.error("Error scheduling WWORLD whitelist action:", error.message);
  }
  
  console.log("\nAll actions have been scheduled successfully!");
  console.log("Run the 'list' command to see the status of actions.");
  console.log("After the delay period (24 hours), run the 'execute' command to execute the actions.");
}

// List all pending actions
async function listPendingActions(timelock) {
  console.log("Pending Timelock actions:");
  
  // Define the action IDs we expect to see
  const actionIds = [
    {
      id: "setRouter",
      description: "Set Router in Vault"
    },
    {
      id: "setWLDPriceFeed",
      description: "Set WLD Price Feed"
    },
    {
      id: "setWWORLDPriceFeed",
      description: "Set WWORLD Price Feed"
    },
    {
      id: "whitelistWLD",
      description: "Whitelist WLD Token"
    },
    {
      id: "whitelistWWORLD",
      description: "Whitelist WWORLD Token"
    }
  ];
  
  const now = Math.floor(Date.now() / 1000);
  let readyToExecute = 0;
  let stillPending = 0;
  
  for (const action of actionIds) {
    const actionId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "bytes"],
        [action.id, action.target || "0x0000000000000000000000000000000000000000", "0x"]
      )
    );
    
    try {
      const timestamp = await timelock.pendingActions(actionId);
      
      if (timestamp.eq(0)) {
        console.log(`✅ ${action.description}: Already executed or not scheduled`);
      } else if (timestamp.lte(now)) {
        console.log(`🟢 ${action.description}: Ready to execute! (Scheduled for ${new Date(timestamp.toNumber() * 1000)})`);
        readyToExecute++;
      } else {
        const waitTimeSeconds = timestamp.toNumber() - now;
        const hours = Math.floor(waitTimeSeconds / 3600);
        const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
        const seconds = waitTimeSeconds % 60;
        
        console.log(`⏳ ${action.description}: Wait time remaining: ${hours}h ${minutes}m ${seconds}s`);
        console.log(`   (Executable after: ${new Date(timestamp.toNumber() * 1000)})`);
        stillPending++;
      }
    } catch (error) {
      console.log(`❌ ${action.description}: Error checking status: ${error.message}`);
    }
  }
  
  console.log(`\nSummary: ${readyToExecute} actions ready to execute, ${stillPending} actions still pending`);
  
  if (readyToExecute > 0) {
    console.log("Run the 'execute' command to execute the ready actions.");
  }
}

// Execute all executable actions
async function executeAllActions(timelock) {
  console.log("Executing all available Timelock actions...");
  
  // Define the action IDs and their targets/data
  const actions = [
    {
      id: "setRouter",
      description: "Set Router in Vault",
      target: null, // Will be set later
      data: null // Will be set later
    },
    {
      id: "setWLDPriceFeed",
      description: "Set WLD Price Feed",
      target: null,
      data: null
    },
    {
      id: "setWWORLDPriceFeed",
      description: "Set WWORLD Price Feed",
      target: null,
      data: null
    },
    {
      id: "whitelistWLD",
      description: "Whitelist WLD Token",
      target: null,
      data: null
    },
    {
      id: "whitelistWWORLD",
      description: "Whitelist WWORLD Token",
      target: null,
      data: null
    }
  ];
  
  // Extract deployment data to get addresses
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get contract instances
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Create interfaces for encoding
  const vaultInterface = new ethers.utils.Interface([
    "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external",
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ]);
  
  const vaultPriceFeedInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
  ]);
  
  // Get current Vault values
  const usdg = await vault.usdg();
  const priceFeed = await vault.priceFeed();
  const liquidationFeeUsd = await vault.liquidationFeeUsd();
  const fundingRateFactor = await vault.fundingRateFactor();
  const stableFundingRateFactor = await vault.stableFundingRateFactor();
  
  // Prepare all the data
  actions[0].target = vault.address;
  actions[0].data = vaultInterface.encodeFunctionData("initialize", [
    deploymentData.Router,
    usdg,
    priceFeed,
    liquidationFeeUsd,
    fundingRateFactor,
    stableFundingRateFactor
  ]);
  
  actions[1].target = vaultPriceFeed.address;
  actions[1].data = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    true // isStable
  ]);
  
  actions[2].target = vaultPriceFeed.address;
  actions[2].data = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    deploymentData.MockPriceFeeds.WWORLD,
    8, // decimals
    false // isStable
  ]);
  
  actions[3].target = vault.address;
  actions[3].data = vaultInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    true, // isStable
    false // isShortable
  ]);
  
  actions[4].target = vault.address;
  actions[4].data = vaultInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    false, // isStable
    true // isShortable
  ]);
  
  const now = Math.floor(Date.now() / 1000);
  let executed = 0;
  
  for (const action of actions) {
    const actionId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "bytes"],
        [action.id, action.target, action.data]
      )
    );
    
    try {
      const timestamp = await timelock.pendingActions(actionId);
      
      if (timestamp.eq(0)) {
        console.log(`Action "${action.description}" has already been executed or was not scheduled`);
        continue;
      }
      
      if (timestamp.gt(now)) {
        const waitTimeSeconds = timestamp.toNumber() - now;
        const hours = Math.floor(waitTimeSeconds / 3600);
        const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
        const seconds = waitTimeSeconds % 60;
        
        console.log(`Action "${action.description}" is not yet executable. Wait time: ${hours}h ${minutes}m ${seconds}s`);
        continue;
      }
      
      // Action is executable, proceed
      console.log(`Executing action: ${action.description}...`);
      const tx = await timelock.executeAction(
        action.target,
        0, // value
        action.data,
        actionId
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Action "${action.description}" executed successfully!`);
      executed++;
    } catch (error) {
      console.error(`Error executing action "${action.description}": ${error.message}`);
    }
  }
  
  console.log(`\nExecution completed. ${executed} actions executed successfully.`);
  
  if (executed === actions.length) {
    console.log("\nAll governance actions have been executed successfully!");
    console.log("Run validateDeploymentWorld.js to verify the deployment.");
  } else if (executed === 0) {
    console.log("\nNo actions were executed. They may not be ready yet or have already been executed.");
    console.log("Run the 'list' command to check the status of actions.");
  } else {
    console.log("\nSome actions were executed successfully, but not all.");
    console.log("Run the 'list' command to check the status of remaining actions.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
