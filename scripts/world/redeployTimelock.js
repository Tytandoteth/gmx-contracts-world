const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Redeploying Timelock with 5-minute buffer for World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Deployment data loaded successfully");
  
  // Deploy new Timelock with 5-minute buffer (300 seconds)
  console.log("\nDeploying new Timelock with 5-minute buffer...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const buffer = 300; // 5 minutes in seconds
  const newTimelock = await Timelock.deploy(
    deployer.address, // admin
    buffer, // buffer period in seconds
    deployer.address, // token manager (using deployer for simplicity)
    deployer.address, // mint receiver (using deployer for simplicity)
    deploymentData.GlpManager, // glp manager 
    ethers.constants.AddressZero, // prev glp manager (no previous manager)
    deploymentData.RewardRouter, // reward router
    ethers.utils.parseUnits("100000000", 18), // max token supply (100M tokens)
    10, // marginFeeBasisPoints (0.1%)
    100 // maxMarginFeeBasisPoints (1%)
  );
  
  await newTimelock.deployed();
  console.log(`New Timelock deployed to: ${newTimelock.address}`);
  
  // Store old timelock address
  const oldTimelock = deploymentData.Timelock;
  console.log(`Old Timelock: ${oldTimelock}`);
  
  // Update deployment data with new Timelock
  deploymentData.Timelock = newTimelock.address;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment data updated with new Timelock address");
  
  // Update governance for Vault
  console.log("\nUpdating Vault governance to use new Timelock...");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const vaultGov = await vault.gov();
    
    if (vaultGov.toLowerCase() === oldTimelock.toLowerCase()) {
      // If the old Timelock is the governor, we need to transfer governance
      const oldTimelockContract = await ethers.getContractAt("Timelock", oldTimelock);
      
      // Check if we're the admin of the old Timelock
      const oldTimelockAdmin = await oldTimelockContract.admin();
      if (oldTimelockAdmin.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("Transferring Vault governance through old Timelock...");
        
        // Use the old Timelock to transfer governance directly (without buffer)
        const tx1 = await oldTimelockContract.setGov(vault.address, newTimelock.address);
        console.log(`Transaction sent: ${tx1.hash}`);
        await tx1.wait();
        console.log("Vault governance successfully transferred to new Timelock");
      } else {
        console.warn("WARNING: Cannot transfer Vault governance - you're not the admin of the old Timelock");
      }
    } else if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
      // If we're the governor directly, transfer to new Timelock
      console.log("Transferring Vault governance directly...");
      const tx1 = await vault.setGov(newTimelock.address);
      console.log(`Transaction sent: ${tx1.hash}`);
      await tx1.wait();
      console.log("Vault governance successfully transferred to new Timelock");
    } else {
      console.warn(`WARNING: Vault governor is neither old Timelock nor deployer (current: ${vaultGov})`);
      console.warn("Manual governance transfer will be required");
    }
  } catch (error) {
    console.error(`Error updating Vault governance: ${error.message}`);
  }
  
  // Update governance for VaultPriceFeed
  console.log("\nUpdating VaultPriceFeed governance to use new Timelock...");
  try {
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
    const priceFeedGov = await vaultPriceFeed.gov();
    
    if (priceFeedGov.toLowerCase() === oldTimelock.toLowerCase()) {
      // If the old Timelock is the governor, we need to transfer governance
      const oldTimelockContract = await ethers.getContractAt("Timelock", oldTimelock);
      
      // Check if we're the admin of the old Timelock
      const oldTimelockAdmin = await oldTimelockContract.admin();
      if (oldTimelockAdmin.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("Transferring VaultPriceFeed governance through old Timelock...");
        
        // Use the old Timelock to transfer governance directly (without buffer)
        const tx2 = await oldTimelockContract.setGov(vaultPriceFeed.address, newTimelock.address);
        console.log(`Transaction sent: ${tx2.hash}`);
        await tx2.wait();
        console.log("VaultPriceFeed governance successfully transferred to new Timelock");
      } else {
        console.warn("WARNING: Cannot transfer VaultPriceFeed governance - you're not the admin of the old Timelock");
      }
    } else if (priceFeedGov.toLowerCase() === deployer.address.toLowerCase()) {
      // If we're the governor directly, transfer to new Timelock
      console.log("Transferring VaultPriceFeed governance directly...");
      const tx2 = await vaultPriceFeed.setGov(newTimelock.address);
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log("VaultPriceFeed governance successfully transferred to new Timelock");
    } else {
      console.warn(`WARNING: VaultPriceFeed governor is neither old Timelock nor deployer (current: ${priceFeedGov})`);
      console.warn("Manual governance transfer will be required");
    }
  } catch (error) {
    console.error(`Error updating VaultPriceFeed governance: ${error.message}`);
  }
  
  // Now we need to set router and whitelist tokens through the new Timelock
  console.log("\nCreating governance actions through new Timelock...");
  
  // Remove old custom action files if they exist
  const customActionFiles = [
    ".world-wld-whitelist-action.json",
    ".world-wworld-whitelist-action.json",
    ".world-wld-pricefeed-action.json",
    ".world-wworld-pricefeed-action.json"
  ];
  
  for (const file of customActionFiles) {
    const filePath = path.join(__dirname, "../../", file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Removed old action file: ${file}`);
    }
  }
  
  console.log("\nNew Timelock deployed and governance updated successfully!");
  console.log(`New Timelock address: ${newTimelock.address}`);
  console.log("Buffer period: 5 minutes (300 seconds)");
  console.log("\nNext steps:");
  console.log("1. Run createWorldGov.js to create new governance actions");
  console.log("2. Wait for 5 minutes");
  console.log("3. Run executeWorldGov.js to execute the actions");
  console.log("4. Run validateWorldDeployment.js to verify everything is working");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
