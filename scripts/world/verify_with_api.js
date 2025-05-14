const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Verifying Contracts on World Chain Explorer ===\n");
  
  // Address of our newly deployed SimplePriceFeed
  const simplePriceFeedAddress = "0x7e402dE1894f3dCed30f9bECBc51aD08F2016095";
  
  console.log(`Verifying SimplePriceFeed at ${simplePriceFeedAddress}`);
  console.log("Using WorldScan API Key from hardhat.config.js");
  
  try {
    // Verify the SimplePriceFeed contract
    await run("verify:verify", {
      address: simplePriceFeedAddress,
      contract: "contracts/core/SimplePriceFeed.sol:SimplePriceFeed",
      constructorArguments: []
    });
    
    console.log("\n✅ SimplePriceFeed verification submitted successfully");
    console.log("Check the contract on WorldScan to confirm verification status");
    console.log("https://worldscan.org/address/" + simplePriceFeedAddress);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ SimplePriceFeed is already verified");
    } else {
      console.error(`❌ SimplePriceFeed verification failed: ${error.message}`);
      
      // Provide troubleshooting information
      console.log("\n--- Troubleshooting Verification ---");
      console.log("1. Check that API key is correct");
      console.log("2. Ensure contract source code matches exactly what was deployed");
      console.log("3. Verify constructor arguments are correct (none for SimplePriceFeed)");
      console.log("4. Verify that compiler version matches (0.6.12)");
      console.log("5. Try manual verification using the guide: scripts/world/manual_verify_guide.md");
    }
  }
  
  // Load deployment data to list other contracts that could be verified
  console.log("\n--- Other Contracts That Can Be Verified ---");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const otherContracts = {
    "Vault": customDeployment.CustomVault,
    "VaultPriceFeed": customDeployment.CustomVaultPriceFeed,
    "Router": customDeployment.CustomRouter
  };
  
  Object.entries(otherContracts).forEach(([name, address]) => {
    if (address) {
      console.log(`- ${name}: ${address}`);
      console.log(`  To verify: npx hardhat verify --network worldchain ${address}`);
    }
  });
  
  console.log("\n=== Verification Process Complete ===");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
