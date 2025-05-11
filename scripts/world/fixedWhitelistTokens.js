const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Updated script for whitelisting tokens in the Vault using RedStone SDK
 * Based on the latest @redstone-finance/evm-connector API
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH REDSTONE SDK (FIXED VERSION)");
  console.log("======================================================");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded custom deployment data");
  } catch (error) {
    console.error("❌ Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  
  console.log("\n------------------------------------------------------");
  console.log("CHECKING REDSTONE SDK VERSION");
  console.log("------------------------------------------------------");
  
  try {
    // Import the package dynamically to check its exports
    const redstoneConnector = require("@redstone-finance/evm-connector");
    console.log(`RedStone SDK loaded successfully`);
    
    // Check what's available in the package
    console.log("Available exports:", Object.keys(redstoneConnector));
    
    // Determine which API to use based on what's available
    const useNewApi = !!redstoneConnector.RedstoneConsumerBase;
    const useWrapper = !!redstoneConnector.WrapperBuilder;
    
    console.log(`Using new RedstoneConsumerBase API: ${useNewApi}`);
    console.log(`Using WrapperBuilder API: ${useWrapper}`);
    
    // Connect to Vault
    console.log("\n------------------------------------------------------");
    console.log("CONNECTING TO VAULT");
    console.log("------------------------------------------------------");
    
    console.log(`Vault address: ${deploymentData.CustomVault}`);
    const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
    
    // Check if tokens are already whitelisted
    console.log("\n------------------------------------------------------");
    console.log("CHECKING EXISTING TOKEN CONFIGURATION");
    console.log("------------------------------------------------------");
    
    let isWldWhitelisted = false;
    let isWethWhitelisted = false;
    
    try {
      isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
      console.log(`Is WLD already whitelisted: ${isWldWhitelisted}`);
    } catch (error) {
      console.warn(`Error checking WLD whitelist status: ${error.message}`);
    }
    
    try {
      isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
      console.log(`Is WETH already whitelisted: ${isWethWhitelisted}`);
    } catch (error) {
      console.warn(`Error checking WETH whitelist status: ${error.message}`);
    }
    
    // Force whitelist WLD if needed (using higher gas limit)
    if (!isWldWhitelisted) {
      console.log("\n------------------------------------------------------");
      console.log("WHITELISTING WLD TOKEN WITH FORCE METHOD");
      console.log("------------------------------------------------------");
      
      // Since RedStone wrapping is having issues, we'll use a direct approach with manual gas limits
      try {
        console.log("Setting WLD token configuration in Vault with manual gas limit...");
        
        // Prepare the transaction with higher gas limit
        const tx = await vault.setTokenConfig(
          deploymentData.WLD,  // token
          18,                  // tokenDecimals
          10000,               // tokenWeight
          75,                  // minProfitBps (0.75%)
          0,                   // maxUsdgAmount
          false,               // isStable
          true,                // isShortable
          { gasLimit: 5000000 } // Force higher gas limit to bypass estimation
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ WLD token successfully whitelisted");
      } catch (error) {
        console.error(`❌ Error whitelisting WLD: ${error.message}`);
        console.log("Trying alternative approach with different parameters...");
        
        try {
          // Try an alternative approach with different gas settings
          const tx = await vault.setTokenConfig(
            deploymentData.WLD,
            18,
            10000,
            75,
            0,
            false,
            true,
            { 
              gasLimit: 7000000,
              gasPrice: ethers.utils.parseUnits("1.5", "gwei")
            }
          );
          
          console.log(`Transaction sent: ${tx.hash}`);
          await tx.wait();
          console.log("✅ WLD token successfully whitelisted with alternative approach");
        } catch (secondError) {
          console.error(`❌ Alternative approach also failed: ${secondError.message}`);
        }
      }
    }
    
    // Force whitelist WETH if needed (using higher gas limit)
    if (!isWethWhitelisted) {
      console.log("\n------------------------------------------------------");
      console.log("WHITELISTING WETH TOKEN WITH FORCE METHOD");
      console.log("------------------------------------------------------");
      
      try {
        console.log("Setting WETH token configuration in Vault with manual gas limit...");
        
        // Prepare the transaction with higher gas limit
        const tx = await vault.setTokenConfig(
          deploymentData.WETH, // token
          18,                  // tokenDecimals
          10000,               // tokenWeight
          75,                  // minProfitBps (0.75%)
          0,                   // maxUsdgAmount
          false,               // isStable
          true,                // isShortable
          { gasLimit: 5000000 } // Force higher gas limit to bypass estimation
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ WETH token successfully whitelisted");
      } catch (error) {
        console.error(`❌ Error whitelisting WETH: ${error.message}`);
        console.log("Trying alternative approach with different parameters...");
        
        try {
          // Try an alternative approach with different gas settings
          const tx = await vault.setTokenConfig(
            deploymentData.WETH,
            18,
            10000,
            75,
            0,
            false,
            true,
            { 
              gasLimit: 7000000,
              gasPrice: ethers.utils.parseUnits("1.5", "gwei")
            }
          );
          
          console.log(`Transaction sent: ${tx.hash}`);
          await tx.wait();
          console.log("✅ WETH token successfully whitelisted with alternative approach");
        } catch (secondError) {
          console.error(`❌ Alternative approach also failed: ${secondError.message}`);
        }
      }
    }
    
    // Verify final configuration
    console.log("\n------------------------------------------------------");
    console.log("VERIFYING FINAL CONFIGURATION");
    console.log("------------------------------------------------------");
    
    try {
      isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
      isWethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
      
      console.log(`Is WLD whitelisted: ${isWldWhitelisted}`);
      console.log(`Is WETH whitelisted: ${isWethWhitelisted}`);
      
      if (isWldWhitelisted && isWethWhitelisted) {
        console.log("✅ Both tokens are successfully whitelisted");
      } else {
        console.warn("⚠️ Not all tokens are whitelisted");
      }
    } catch (error) {
      console.error(`❌ Error verifying configuration: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ Error with RedStone SDK: ${error.message}`);
    console.error("Make sure you have installed the package with: npm install @redstone-finance/evm-connector");
  }
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING ATTEMPT COMPLETE");
  console.log("======================================================");
  
  console.log(`
Note: If whitelisting failed using the force method, there might be fundamental issues 
with the token configuration or price feeds. Please ensure that:

1. VaultPriceFeed is correctly configured to use RedStonePriceFeed
2. Price feeds are returning valid values
3. Oracle Keeper is properly configured and operational

Next steps:
1. Verify the deployment with:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
2. Configure and deploy the Oracle Keeper
3. Integrate the frontend with contract addresses and Oracle Keeper
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
