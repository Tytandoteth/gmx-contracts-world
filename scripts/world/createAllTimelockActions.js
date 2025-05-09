const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { getDeploymentData, getTimelockActionsData, saveTimelockActionsData, 
        createSetRouterAction, createSetPriceFeedAction, createWhitelistTokenAction } = require("./timelockHelpers");

async function main() {
  console.log("Creating all required Timelock actions for World Chain...");
  
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
  
  // Get existing actions data
  const actionsData = await getTimelockActionsData();
  
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
  console.log("All Timelock actions created and saved successfully!");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
