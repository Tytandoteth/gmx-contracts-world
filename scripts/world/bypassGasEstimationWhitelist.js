const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * This script bypasses gas estimation completely by using hardcoded transaction parameters
 * It's useful when transactions fail during the estimation phase but would succeed if executed
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TOKENS WITH BYPASS GAS ESTIMATION");
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
  console.log(`Deployer balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  
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
  
  // Whitelist WLD if needed using complete bypass of gas estimation
  if (!isWldWhitelisted) {
    console.log("\n------------------------------------------------------");
    console.log("WHITELISTING WLD TOKEN WITH COMPLETE BYPASS");
    console.log("------------------------------------------------------");
    
    try {
      console.log("Preparing whitelist transaction for WLD...");
      
      // Get the current nonce
      const nonce = await deployer.getTransactionCount();
      console.log(`Current nonce: ${nonce}`);
      
      // Encode the function call data
      const encodedData = vault.interface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,  // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      ]);
      
      // Get current gas price with a small premium
      const gasPrice = (await ethers.provider.getGasPrice()).mul(12).div(10); // 1.2x current gas price
      console.log(`Using gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
      
      // Create a transaction object with all parameters specified
      const txData = {
        to: deploymentData.CustomVault,
        from: deployer.address,
        nonce: nonce,
        gasLimit: ethers.BigNumber.from("5000000"), // Fixed high gas limit
        gasPrice: gasPrice,
        data: encodedData,
        chainId: 480 // World Chain
      };
      
      console.log("Sending raw transaction...");
      
      // Send the raw transaction
      const tx = await deployer.sendTransaction(txData);
      console.log(`Transaction sent: ${tx.hash}`);
      
      // Wait for transaction confirmation
      console.log("Waiting for confirmation...");
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log("✅ WLD token successfully whitelisted");
      } else {
        console.error("❌ Transaction executed but failed");
      }
    } catch (error) {
      console.error(`❌ Error whitelisting WLD: ${error.message}`);
    }
  }
  
  // Whitelist WETH if needed using complete bypass of gas estimation
  if (!isWethWhitelisted) {
    console.log("\n------------------------------------------------------");
    console.log("WHITELISTING WETH TOKEN WITH COMPLETE BYPASS");
    console.log("------------------------------------------------------");
    
    try {
      console.log("Preparing whitelist transaction for WETH...");
      
      // Get the current nonce (incremented if WLD transaction was sent)
      const nonce = await deployer.getTransactionCount();
      console.log(`Current nonce: ${nonce}`);
      
      // Encode the function call data
      const encodedData = vault.interface.encodeFunctionData("setTokenConfig", [
        deploymentData.WETH, // token
        18,                  // tokenDecimals
        10000,               // tokenWeight
        75,                  // minProfitBps (0.75%)
        0,                   // maxUsdgAmount
        false,               // isStable
        true                 // isShortable
      ]);
      
      // Get current gas price with a small premium
      const gasPrice = (await ethers.provider.getGasPrice()).mul(12).div(10); // 1.2x current gas price
      console.log(`Using gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
      
      // Create a transaction object with all parameters specified
      const txData = {
        to: deploymentData.CustomVault,
        from: deployer.address,
        nonce: nonce,
        gasLimit: ethers.BigNumber.from("5000000"), // Fixed high gas limit
        gasPrice: gasPrice,
        data: encodedData,
        chainId: 480 // World Chain
      };
      
      console.log("Sending raw transaction...");
      
      // Send the raw transaction
      const tx = await deployer.sendTransaction(txData);
      console.log(`Transaction sent: ${tx.hash}`);
      
      // Wait for transaction confirmation
      console.log("Waiting for confirmation...");
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log("✅ WETH token successfully whitelisted");
      } else {
        console.error("❌ Transaction executed but failed");
      }
    } catch (error) {
      console.error(`❌ Error whitelisting WETH: ${error.message}`);
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
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING ATTEMPT COMPLETE");
  console.log("======================================================");
  
  console.log(`
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
