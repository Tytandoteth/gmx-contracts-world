const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  
  // Load deployment data
  const timelockDeploymentPath = path.join(__dirname, '../../.world-timelock-deployment.json');
  
  if (!fs.existsSync(timelockDeploymentPath)) {
    console.error("Timelock deployment data not found");
    process.exit(1);
  }
  
  const timelockDeployment = JSON.parse(fs.readFileSync(timelockDeploymentPath, 'utf8'));
  console.log("Loaded Timelock deployment data");
  
  // Get Timelock contract instance
  const newTimelock = await ethers.getContractAt("Timelock", timelockDeployment.Timelock);
  
  // Get Timelock info
  const admin = await newTimelock.admin();
  console.log(`Timelock admin: ${admin}`);
  
  const buffer = await newTimelock.buffer();
  console.log(`Timelock buffer: ${buffer} seconds (${buffer / 60} minutes)`);
  
  // Get pending actions
  let pendingActionsCount = 0;
  let executedActionsCount = 0;
  let failedActionsCount = 0;
  
  // We need to find the pending actions by checking events from the Timelock
  console.log("\nFetching scheduled calls from events...");
  
  const scheduledCallsFilter = newTimelock.filters.ScheduleCall();
  const scheduledEvents = await newTimelock.queryFilter(scheduledCallsFilter);
  
  console.log(`Found ${scheduledEvents.length} scheduled calls`);
  
  // For each scheduled call, try to execute it
  if (scheduledEvents.length > 0) {
    console.log("\nExecuting pending actions...");
    
    for (let i = 0; i < scheduledEvents.length; i++) {
      const event = scheduledEvents[i];
      
      // Extract call details from the event
      const { target, value, data, executeTime } = event.args;
      
      console.log(`\nAction ${i + 1}:`);
      console.log(`- Target: ${target}`);
      console.log(`- Data length: ${data.length} bytes`);
      console.log(`- Execute time: ${new Date(executeTime.toNumber() * 1000).toLocaleString()}`);
      
      // Check if the action is ready to be executed
      const currentTime = Math.floor(Date.now() / 1000);
      if (executeTime.toNumber() > currentTime) {
        const waitTime = executeTime.toNumber() - currentTime;
        console.log(`⏳ Action not ready for execution. Need to wait ${waitTime} more seconds (${waitTime / 60} minutes)`);
        pendingActionsCount++;
        continue;
      }
      
      // Try to execute the action
      try {
        console.log("Executing action...");
        const tx = await newTimelock.executeCall(target, value, data);
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Action executed successfully");
        executedActionsCount++;
      } catch (error) {
        console.error(`❌ Failed to execute action: ${error.message}`);
        
        // If it's already executed, count it as success
        if (error.message.includes("Timelock: action already executed")) {
          console.log("✅ Action was already executed");
          executedActionsCount++;
        } else {
          failedActionsCount++;
        }
      }
    }
  } else {
    console.log("\nNo scheduled calls found");
  }
  
  // Execution summary
  console.log("\n=== EXECUTION SUMMARY ===");
  console.log(`Total actions: ${scheduledEvents.length}`);
  console.log(`Executed: ${executedActionsCount}`);
  console.log(`Pending: ${pendingActionsCount}`);
  console.log(`Failed: ${failedActionsCount}`);
  
  if (pendingActionsCount > 0) {
    console.log("\nSome actions are not ready to be executed yet.");
    console.log(`Please wait for the buffer period (${buffer} seconds) to elapse and try again.`);
  }
  
  if (executedActionsCount > 0) {
    console.log("\nSuccessfully executed some actions!");
    console.log("Run validateWorldDeployment.js to verify the configuration");
  }
  
  if (failedActionsCount > 0) {
    console.log("\nSome actions failed to execute. Please check the logs for details.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
