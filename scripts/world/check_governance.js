const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Checking Governance Permissions for GMX V1 Contracts ===\n");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Load custom deployment data
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get contract addresses
  const vaultAddress = customDeployment.CustomVault;
  const vaultPriceFeedAddress = customDeployment.CustomVaultPriceFeed;
  const simplePriceFeedAddress = customDeployment.SimplePriceFeed;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Check governance for VaultPriceFeed
  console.log("\n--- Checking VaultPriceFeed Governance ---");
  
  const vaultPriceFeedAbi = [
    "function gov() external view returns (address)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  try {
    const vaultPriceFeedGov = await vaultPriceFeed.gov();
    console.log(`- VaultPriceFeed governor: ${vaultPriceFeedGov}`);
    console.log(`- Is your account the governor? ${vaultPriceFeedGov.toLowerCase() === deployer.address.toLowerCase() ? 'YES ✅' : 'NO ❌'}`);
  } catch (error) {
    console.log(`- Could not get VaultPriceFeed governor: ${error.message}`);
  }
  
  // Check governance for Vault
  console.log("\n--- Checking Vault Governance ---");
  
  const vaultAbi = [
    "function gov() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  try {
    const vaultGov = await vault.gov();
    console.log(`- Vault governor: ${vaultGov}`);
    console.log(`- Is your account the governor? ${vaultGov.toLowerCase() === deployer.address.toLowerCase() ? 'YES ✅' : 'NO ❌'}`);
  } catch (error) {
    console.log(`- Could not get Vault governor: ${error.message}`);
  }
  
  // Check SimplePriceFeed governance
  console.log("\n--- Checking SimplePriceFeed Governance ---");
  
  const simplePriceFeedAbi = [
    "function gov() external view returns (address)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  try {
    const simplePriceFeedGov = await simplePriceFeed.gov();
    console.log(`- SimplePriceFeed governor: ${simplePriceFeedGov}`);
    console.log(`- Is your account the governor? ${simplePriceFeedGov.toLowerCase() === deployer.address.toLowerCase() ? 'YES ✅' : 'NO ❌'}`);
  } catch (error) {
    console.log(`- Could not get SimplePriceFeed governor: ${error.message}`);
  }
  
  // Options based on findings
  console.log("\n=== Options Based on Governance Status ===");
  console.log("1. If you are NOT the governor of VaultPriceFeed:");
  console.log("   - You need to contact the current governor to update the price feed");
  console.log("   - Or deploy a fresh set of contracts where you are the governor");
  
  console.log("\n2. If you ARE the governor but transactions still fail:");
  console.log("   - The contract might have additional checks beyond governance");
  console.log("   - There might be an initialization issue or a code flaw");
  console.log("   - Consider checking for time-locks or multi-sig requirements");
  
  console.log("\n3. Alternative Solution:");
  console.log("   - Instead of configuring existing contracts, deploy a complete new set");
  console.log("   - Use scripts/world/deployCustom.js with modifications to ensure you're the governor");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
