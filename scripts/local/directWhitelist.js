const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function main() {
  console.log("Direct token whitelisting attempt on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get Vault contract
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  console.log(`Vault address: ${deploymentData.Vault}`);
  
  // Check governance
  const gov = await vault.gov();
  console.log(`Vault governor: ${gov}`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Is deployer governor? ${gov.toLowerCase() === deployer.address.toLowerCase()}`);
  
  if (gov.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("Error: Deployer is not the governor of the Vault");
    process.exit(1);
  }
  
  // Set up parameters for WLD token
  console.log("\nSetting up WLD token...");
  const wldToken = deploymentData.WLD;
  console.log(`WLD token address: ${wldToken}`);
  
  try {
    // Set up gas parameters to ensure the transaction doesn't fail
    const gasEstimate = await vault.estimateGas.setTokenConfig(
      wldToken,
      18, // decimals
      10000, // weight (100%)
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      true, // isStable
      false // isShortable
    );
    
    console.log(`Gas estimate for WLD: ${gasEstimate.toString()}`);
    
    // Add 30% buffer to gas estimate
    const gasLimit = gasEstimate.mul(130).div(100);
    
    // Execute with explicit gas limit
    const tx = await vault.setTokenConfig(
      wldToken,
      18, // decimals
      10000, // weight (100%)
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      true, // isStable
      false, // isShortable
      { gasLimit }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`WLD token successfully whitelisted`);
  } catch (error) {
    console.error(`Error whitelisting WLD:`, error.message);
    
    // Try a different approach if the first one fails
    console.log("\nTrying alternative approach for WLD...");
    try {
      // Check if token is already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(wldToken);
      if (isWhitelisted) {
        console.log("WLD token is already whitelisted. Skipping.");
      } else {
        // Try sending transaction with more gas and explicit nonce
        const nonce = await deployer.getTransactionCount();
        
        const txParams = {
          to: vault.address,
          data: vault.interface.encodeFunctionData("setTokenConfig", [
            wldToken,
            18, // decimals
            10000, // weight (100%)
            0, // minProfitBps
            ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
            true, // isStable
            false // isShortable
          ]),
          gasLimit: 5000000,
          nonce: nonce
        };
        
        const tx = await deployer.sendTransaction(txParams);
        console.log(`Raw transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`WLD token successfully whitelisted via raw transaction`);
      }
    } catch (innerError) {
      console.error(`Error in alternative approach for WLD:`, innerError.message);
    }
  }
  
  // Set up parameters for WETH token
  console.log("\nSetting up WETH token...");
  const wethToken = deploymentData.WETH;
  console.log(`WETH token address: ${wethToken}`);
  
  try {
    // Set up gas parameters to ensure the transaction doesn't fail
    const gasEstimate = await vault.estimateGas.setTokenConfig(
      wethToken,
      18, // decimals
      10000, // weight (100%)
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      false, // isStable
      true // isShortable
    );
    
    console.log(`Gas estimate for WETH: ${gasEstimate.toString()}`);
    
    // Add 30% buffer to gas estimate
    const gasLimit = gasEstimate.mul(130).div(100);
    
    // Execute with explicit gas limit
    const tx = await vault.setTokenConfig(
      wethToken,
      18, // decimals
      10000, // weight (100%)
      0, // minProfitBps
      ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
      false, // isStable
      true, // isShortable
      { gasLimit }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`WETH token successfully whitelisted`);
  } catch (error) {
    console.error(`Error whitelisting WETH:`, error.message);
    
    // Try a different approach if the first one fails
    console.log("\nTrying alternative approach for WETH...");
    try {
      // Check if token is already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(wethToken);
      if (isWhitelisted) {
        console.log("WETH token is already whitelisted. Skipping.");
      } else {
        // Try sending transaction with more gas and explicit nonce
        const nonce = await deployer.getTransactionCount();
        
        const txParams = {
          to: vault.address,
          data: vault.interface.encodeFunctionData("setTokenConfig", [
            wethToken,
            18, // decimals
            10000, // weight (100%)
            0, // minProfitBps
            ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
            false, // isStable
            true // isShortable
          ]),
          gasLimit: 5000000,
          nonce: nonce
        };
        
        const tx = await deployer.sendTransaction(txParams);
        console.log(`Raw transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`WETH token successfully whitelisted via raw transaction`);
      }
    } catch (innerError) {
      console.error(`Error in alternative approach for WETH:`, innerError.message);
    }
  }
  
  // Verify whitelist status
  console.log("\nVerifying token whitelist status...");
  const wldWhitelisted = await vault.whitelistedTokens(wldToken);
  const wethWhitelisted = await vault.whitelistedTokens(wethToken);
  
  console.log(`WLD token whitelisted: ${wldWhitelisted}`);
  console.log(`WETH token whitelisted: ${wethWhitelisted}`);
  
  if (wldWhitelisted && wethWhitelisted) {
    console.log("\nToken whitelisting completed successfully! ✅");
  } else {
    console.log("\nSome tokens could not be whitelisted. Please check the logs above for errors. ❌");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
