const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  
  // Load deployment data
  const officialDeploymentPath = path.join(__dirname, '../../.world-deployment.json');
  const timelockDeploymentPath = path.join(__dirname, '../../.world-timelock-deployment.json');
  
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
  
  console.log("Loaded deployment data");
  
  // Get contract instances
  const oldTimelock = await ethers.getContractAt("Timelock", officialDeployment.Timelock);
  const vault = await ethers.getContractAt("Vault", officialDeployment.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", officialDeployment.VaultPriceFeed);
  
  // Check current governance
  const vaultGov = await vault.gov();
  console.log(`Vault current governor: ${vaultGov}`);
  
  const priceFeedGov = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed current governor: ${priceFeedGov}`);
  
  const newTimelock = timelockDeployment.Timelock;
  console.log(`New Timelock (5min buffer): ${newTimelock}`);
  
  // Signal governance transfers using the old Timelock
  if (vaultGov.toLowerCase() === officialDeployment.Timelock.toLowerCase()) {
    console.log("\nSignaling Vault governance transfer...");
    const tx1 = await oldTimelock.signalSetGov(vault.address, newTimelock);
    console.log(`Transaction sent: ${tx1.hash}`);
    await tx1.wait();
    console.log("Vault governance transfer signaled");
    
    // Store the action details to a file for later execution
    const vaultGovAction = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setGov", vault.address, newTimelock]
      )
    );
    
    fs.writeFileSync(
      path.join(__dirname, '../../.world-vault-gov-action.json'),
      JSON.stringify({
        target: vault.address,
        action: vaultGovAction,
        description: "Transfer Vault governance to new Timelock"
      }, null, 2)
    );
    console.log("Vault governance action data saved for later execution");
  } else {
    console.log("\nSkipping Vault governance transfer - not governed by old Timelock");
  }
  
  if (priceFeedGov.toLowerCase() === officialDeployment.Timelock.toLowerCase()) {
    console.log("\nSignaling VaultPriceFeed governance transfer...");
    const tx2 = await oldTimelock.signalSetGov(vaultPriceFeed.address, newTimelock);
    console.log(`Transaction sent: ${tx2.hash}`);
    await tx2.wait();
    console.log("VaultPriceFeed governance transfer signaled");
    
    // Store the action details to a file for later execution
    const priceFeedGovAction = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setGov", vaultPriceFeed.address, newTimelock]
      )
    );
    
    fs.writeFileSync(
      path.join(__dirname, '../../.world-pricefeed-gov-action.json'),
      JSON.stringify({
        target: vaultPriceFeed.address,
        action: priceFeedGovAction,
        description: "Transfer VaultPriceFeed governance to new Timelock"
      }, null, 2)
    );
    console.log("VaultPriceFeed governance action data saved for later execution");
  } else {
    console.log("\nSkipping VaultPriceFeed governance transfer - not governed by old Timelock");
  }
  
  console.log("\nSignaling completed!");
  console.log("\nNext steps:");
  console.log("1. Wait for the old Timelock buffer period to elapse (24 hours from now)");
  console.log("2. Run executeGovTransfer.js to execute the governance transfers");
  console.log("3. Create and execute new governance actions using the new 5-minute Timelock");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
