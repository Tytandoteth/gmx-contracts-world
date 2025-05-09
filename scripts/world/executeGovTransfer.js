const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  
  // Load deployment data
  const officialDeploymentPath = path.join(__dirname, '../../.world-deployment.json');
  const timelockDeploymentPath = path.join(__dirname, '../../.world-timelock-deployment.json');
  const vaultGovActionPath = path.join(__dirname, '../../.world-vault-gov-action.json');
  const priceFeedGovActionPath = path.join(__dirname, '../../.world-pricefeed-gov-action.json');
  
  if (!fs.existsSync(officialDeploymentPath)) {
    console.error("Official deployment data not found");
    process.exit(1);
  }
  
  if (!fs.existsSync(timelockDeploymentPath)) {
    console.error("Timelock deployment data not found");
    process.exit(1);
  }
  
  const officialDeployment = JSON.parse(fs.readFileSync(officialDeploymentPath, 'utf8'));
  const timelockDeployment = JSON.parse(fs.readFileSync(timelockDeploymentPath, 'utf8'));
  
  // Load action data if available
  let vaultGovAction = null;
  let priceFeedGovAction = null;
  
  if (fs.existsSync(vaultGovActionPath)) {
    vaultGovAction = JSON.parse(fs.readFileSync(vaultGovActionPath, 'utf8'));
    console.log("Loaded Vault governance action data");
  }
  
  if (fs.existsSync(priceFeedGovActionPath)) {
    priceFeedGovAction = JSON.parse(fs.readFileSync(priceFeedGovActionPath, 'utf8'));
    console.log("Loaded VaultPriceFeed governance action data");
  }
  
  // Get contract instances
  const oldTimelock = await ethers.getContractAt("Timelock", officialDeployment.Timelock);
  const vault = await ethers.getContractAt("Vault", officialDeployment.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", officialDeployment.VaultPriceFeed);
  
  // Get current status
  const oldTimelockBuffer = await oldTimelock.buffer();
  console.log(`Old Timelock buffer: ${oldTimelockBuffer} seconds (${oldTimelockBuffer / 3600} hours)`);
  
  const vaultGov = await vault.gov();
  console.log(`Vault current governor: ${vaultGov}`);
  
  const priceFeedGov = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed current governor: ${priceFeedGov}`);
  
  const newTimelock = timelockDeployment.Timelock;
  console.log(`New Timelock (5min buffer): ${newTimelock}`);
  
  // Execute governance transfers
  if (vaultGovAction) {
    console.log("\nExecuting Vault governance transfer...");
    try {
      // Check if the action is ready to be executed
      const isPendingAction = await oldTimelock.pendingActions(vaultGovAction.action);
      if (!isPendingAction) {
        console.log("Error: Vault governance action is not pending. Make sure you've signaled the action using signalGovTransfer.js");
      } else {
        const tx1 = await oldTimelock.setGov(vault.address, newTimelock);
        console.log(`Transaction sent: ${tx1.hash}`);
        await tx1.wait();
        console.log("Vault governance transfer executed");
        
        // Verify the transfer
        const newVaultGov = await vault.gov();
        if (newVaultGov.toLowerCase() === newTimelock.toLowerCase()) {
          console.log("✅ Vault governance successfully transferred to new Timelock");
        } else {
          console.log(`❌ Vault governance transfer failed. Current governor: ${newVaultGov}`);
        }
      }
    } catch (error) {
      console.error(`Error executing Vault governance transfer: ${error.message}`);
      console.log("This may be because the buffer period (24 hours) has not elapsed yet.");
      console.log("Please wait for the full buffer period and try again.");
    }
  } else {
    console.log("\nSkipping Vault governance transfer - no action data found");
  }
  
  if (priceFeedGovAction) {
    console.log("\nExecuting VaultPriceFeed governance transfer...");
    try {
      // Check if the action is ready to be executed
      const isPendingAction = await oldTimelock.pendingActions(priceFeedGovAction.action);
      if (!isPendingAction) {
        console.log("Error: VaultPriceFeed governance action is not pending. Make sure you've signaled the action using signalGovTransfer.js");
      } else {
        const tx2 = await oldTimelock.setGov(vaultPriceFeed.address, newTimelock);
        console.log(`Transaction sent: ${tx2.hash}`);
        await tx2.wait();
        console.log("VaultPriceFeed governance transfer executed");
        
        // Verify the transfer
        const newPriceFeedGov = await vaultPriceFeed.gov();
        if (newPriceFeedGov.toLowerCase() === newTimelock.toLowerCase()) {
          console.log("✅ VaultPriceFeed governance successfully transferred to new Timelock");
        } else {
          console.log(`❌ VaultPriceFeed governance transfer failed. Current governor: ${newPriceFeedGov}`);
        }
      }
    } catch (error) {
      console.error(`Error executing VaultPriceFeed governance transfer: ${error.message}`);
      console.log("This may be because the buffer period (24 hours) has not elapsed yet.");
      console.log("Please wait for the full buffer period and try again.");
    }
  } else {
    console.log("\nSkipping VaultPriceFeed governance transfer - no action data found");
  }
  
  console.log("\nExecution completed!");
  console.log("\nNext steps:");
  console.log("1. Create new governance actions for whitelist tokens and set price feeds");
  console.log("2. Wait for the new 5-minute buffer period");
  console.log("3. Execute the actions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
