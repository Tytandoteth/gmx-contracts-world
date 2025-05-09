const { ethers } = require("hardhat");
const { getDeploymentData, getTimelockActionsData, saveTimelockActionsData, executeTimelockAction } = require("./timelockHelpers");

async function main() {
  console.log("Executing Timelock actions for World Chain...");
  
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
    process.exit(1);
  }
  
  // Execute all executable Timelock actions
  console.log("Executing all executable Timelock actions...");
  
  // Get actions data
  const actionsData = await getTimelockActionsData();
  
  const now = Math.floor(Date.now() / 1000);
  let executed = 0;
  let stillPending = 0;
  
  for (const [actionId, actionInfo] of Object.entries(actionsData.pendingActions)) {
    if (actionInfo.timestamp <= now) {
      console.log(`\nExecuting action: ${actionInfo.description}`);
      
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
    } else {
      stillPending++;
      const waitTimeSeconds = actionInfo.timestamp - now;
      const hours = Math.floor(waitTimeSeconds / 3600);
      const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
      const seconds = waitTimeSeconds % 60;
      
      console.log(`\nAction still pending: ${actionInfo.description}`);
      console.log(`Wait time remaining: ${hours}h ${minutes}m ${seconds}s`);
      console.log(`Will be executable after: ${new Date(actionInfo.timestamp * 1000)}`);
    }
  }
  
  // Save updated actions data
  await saveTimelockActionsData(actionsData);
  
  // Summary
  console.log("\n=== Execution Summary ===");
  console.log(`Executed ${executed} actions`);
  console.log(`Still pending: ${stillPending} actions`);
  
  if (stillPending > 0) {
    console.log("\nRun this script again after the pending actions become executable.");
  } else if (executed === 0 && stillPending === 0) {
    console.log("\nNo pending actions found. Create actions first with createAllTimelockActions.js");
  } else if (executed > 0 && stillPending === 0) {
    console.log("\nAll actions have been executed successfully!");
    console.log("Run validateDeploymentWorld.js to verify the deployment.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
