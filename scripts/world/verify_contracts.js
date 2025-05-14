const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Verifying Contracts on World Chain Explorer ===\n");
  
  // Address of our newly deployed SimplePriceFeed
  const simplePriceFeedAddress = "0x7e402dE1894f3dCed30f9bECBc51aD08F2016095";
  
  // Load deployment data to check existing contracts
  console.log("Loading deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const contracts = {
    "SimplePriceFeed (New)": simplePriceFeedAddress,
    "Vault": customDeployment.CustomVault,
    "VaultPriceFeed": customDeployment.CustomVaultPriceFeed,
    "Router": customDeployment.CustomRouter,
    "PositionRouter": customDeployment.PositionRouter,
    "PositionManager": customDeployment.PositionManager,
    "OrderBook": customDeployment.OrderBook
  };
  
  console.log("\nContracts to verify:");
  Object.entries(contracts).forEach(([name, address]) => {
    console.log(`- ${name}: ${address}`);
  });
  
  // Verify our newly deployed SimplePriceFeed
  console.log("\n--- Verifying SimplePriceFeed ---");
  
  try {
    await run("verify:verify", {
      address: simplePriceFeedAddress,
      contract: "contracts/core/SimplePriceFeed.sol:SimplePriceFeed",
      constructorArguments: []
    });
    console.log("✅ SimplePriceFeed verification submitted successfully");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ SimplePriceFeed is already verified");
    } else {
      console.error(`❌ SimplePriceFeed verification failed: ${error.message}`);
    }
  }
  
  // Guidance for verifying other contracts
  console.log("\n--- Verifying Other Contracts ---");
  console.log("To verify other existing contracts, you'll need:");
  console.log("1. The original contract source code");
  console.log("2. The exact constructor arguments used during deployment");
  console.log("3. The exact compiler version and settings");
  
  console.log("\nFor each contract, run a command like:");
  console.log(`npx hardhat verify --network worldchain CONTRACT_ADDRESS CONSTRUCTOR_ARG1 CONSTRUCTOR_ARG2...`);
  
  console.log("\nExample for Vault:");
  console.log(`npx hardhat verify --network worldchain ${customDeployment.CustomVault} --contract contracts/core/Vault.sol:Vault`);
  
  console.log("\n=== Verification Process Complete ===");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
