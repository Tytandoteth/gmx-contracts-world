const { run } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Minimal script to verify only the SimplePriceFeed contract
 * This is the most critical contract for Oracle Keeper integration
 */
async function main() {
  console.log("======================================================");
  console.log("VERIFYING SIMPLEPRICEFEED CONTRACT");
  console.log("======================================================");
  
  // Load deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded deployment data");
  } catch (error) {
    console.error("❌ Error loading deployment data:", error);
    process.exit(1);
  }
  
  // Get SimplePriceFeed address
  const simplePriceFeedAddress = deploymentData.TestEnvironment?.contracts?.SimplePriceFeed 
    || deploymentData.SimplePriceFeed;
    
  if (!simplePriceFeedAddress) {
    console.error("❌ SimplePriceFeed address not found in deployment data");
    process.exit(1);
  }
  
  console.log(`\nVerifying SimplePriceFeed contract at ${simplePriceFeedAddress}...`);
  
  try {
    // Verify the SimplePriceFeed contract
    // SimplePriceFeed has no constructor arguments
    await run("verify:verify", {
      address: simplePriceFeedAddress,
      constructorArguments: [],
    });
    
    console.log("✅ SimplePriceFeed verified successfully");
  } catch (error) {
    // Handle common verification errors
    if (error.message.includes("Already Verified")) {
      console.log("✅ SimplePriceFeed was already verified");
    } else {
      console.error(`❌ Verification failed: ${error.message}`);
    }
  }
  
  console.log("\n======================================================");
  console.log("VERIFICATION COMPLETE");
  console.log("======================================================");
  
  console.log(`
Next Steps:
1. Frontend Integration:
   - Use SimplePriceFeed at ${simplePriceFeedAddress}
   - Connect to the Oracle Keeper endpoint
   - Update test token addresses in the frontend config
   
2. Regular Price Updates:
   - Run the mapping script periodically:
     npx hardhat run scripts/world/mapOracleKeeperToTestTokens.js --network worldchain
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
