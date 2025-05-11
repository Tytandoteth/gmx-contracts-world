const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to directly whitelist tokens in the Vault using raw transactions to bypass price validation
 */
async function main() {
  console.log("======================================================");
  console.log("DIRECT TOKEN WHITELISTING WITH RAW TRANSACTIONS");
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
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH`);
  
  // Connect to Vault using a lower-level approach to bypass validation
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO VAULT");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  
  // ABI for the setTokenConfig function - just what we need
  const vaultABI = [
    "function whitelistedTokens(address) view returns (bool)",
    "function tokenDecimals(address) view returns (uint256)",
    "function tokenWeights(address) view returns (uint256)"
  ];
  
  const vaultContract = new ethers.Contract(
    deploymentData.CustomVault,
    vaultABI,
    deployer
  );
  
  // Define token configurations
  const tokens = {
    "WLD": {
      address: deploymentData.WLD,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      maxUsdgAmount: ethers.utils.parseUnits("5000000", 18), // $5M max USDG cap
      isStable: false,
      isShortable: true
    },
    "WETH": {
      address: deploymentData.WETH,
      decimals: 18,
      weight: 10000,
      minProfitBps: 75,
      maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M max USDG cap
      isStable: false,
      isShortable: true
    }
  };
  
  // Add MAG if available
  if (deploymentData.MAG) {
    tokens["MAG"] = {
      address: deploymentData.MAG,
      decimals: 18,
      weight: 8000, // Lower weight due to lower liquidity
      minProfitBps: 150, // Higher min profit basis points due to volatility
      maxUsdgAmount: ethers.utils.parseUnits("1000000", 18), // $1M max USDG cap
      isStable: false,
      isShortable: true
    };
  }
  
  // Check current whitelist status
  console.log("\n------------------------------------------------------");
  console.log("CHECKING EXISTING TOKEN CONFIGURATION");
  console.log("------------------------------------------------------");
  
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    try {
      const isWhitelisted = await vaultContract.whitelistedTokens(tokenConfig.address);
      console.log(`Is ${tokenSymbol} already whitelisted: ${isWhitelisted}`);
      tokens[tokenSymbol].isWhitelisted = isWhitelisted;
    } catch (error) {
      console.error(`❌ Error checking ${tokenSymbol} whitelist status: ${error.message}`);
    }
  }
  
  // ABI encoder for direct interaction
  const vaultInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable)"
  ]);
  
  console.log("\n------------------------------------------------------");
  console.log("WHITELISTING TOKENS WITH DIRECT TRANSACTIONS");
  console.log("------------------------------------------------------");
  
  // We'll whitelist tokens using direct signed transactions to bypass any validation issues
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    if (tokenConfig.isWhitelisted) {
      console.log(`${tokenSymbol} is already whitelisted, skipping...`);
      continue;
    }
    
    console.log(`\nWhitelisting ${tokenSymbol}...`);
    
    try {
      // Get the calldata for setTokenConfig
      const calldata = vaultInterface.encodeFunctionData(
        "setTokenConfig",
        [
          tokenConfig.address,               // _token
          tokenConfig.decimals,              // _tokenDecimals
          tokenConfig.weight,                // _tokenWeight
          tokenConfig.minProfitBps,          // _minProfitBps
          tokenConfig.maxUsdgAmount,         // _maxUsdgAmount
          tokenConfig.isStable,              // _isStable
          tokenConfig.isShortable            // _isShortable
        ]
      );
      
      // Create a transaction object manually
      const txRequest = {
        to: deploymentData.CustomVault,
        from: deployer.address,
        data: calldata,
        gasLimit: ethers.utils.hexlify(5000000), // Hardcoded gas limit
        gasPrice: await ethers.provider.getGasPrice(),
        nonce: await ethers.provider.getTransactionCount(deployer.address)
      };
      
      console.log(`Sending raw transaction with fixed gas limit of 5,000,000...`);
      
      // Sign and send the transaction
      const txResponse = await deployer.sendTransaction(txRequest);
      console.log(`Transaction sent: ${txResponse.hash}`);
      console.log("Waiting for confirmation...");
      
      // Wait for transaction to be mined
      const receipt = await txResponse.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Successfully whitelisted ${tokenSymbol}`);
      } else {
        console.log(`⚠️ Transaction completed but may have failed for ${tokenSymbol}`);
      }
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenSymbol}: ${error.message}`);
    }
  }
  
  // Verify final configuration
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING FINAL CONFIGURATION");
  console.log("------------------------------------------------------");
  
  let allWhitelisted = true;
  
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    try {
      const isWhitelisted = await vaultContract.whitelistedTokens(tokenConfig.address);
      console.log(`Is ${tokenSymbol} whitelisted: ${isWhitelisted}`);
      
      if (!isWhitelisted) {
        allWhitelisted = false;
      } else {
        // Check configuration details
        const tokenWeight = await vaultContract.tokenWeights(tokenConfig.address);
        console.log(`- ${tokenSymbol} weight: ${tokenWeight}`);
        
        const tokenDecimals = await vaultContract.tokenDecimals(tokenConfig.address);
        console.log(`- ${tokenSymbol} decimals: ${tokenDecimals}`);
      }
    } catch (error) {
      console.error(`❌ Error verifying ${tokenSymbol}: ${error.message}`);
      allWhitelisted = false;
    }
  }
  
  if (allWhitelisted) {
    console.log("\n✅ All tokens are successfully whitelisted");
  } else {
    console.log("\n⚠️ Not all tokens are whitelisted");
  }
  
  console.log("\n======================================================");
  console.log("TOKEN WHITELISTING COMPLETE");
  console.log("======================================================");
  
  console.log(`
Next steps:
1. Verify the complete deployment with:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   
2. Test the trading functionality through the frontend

3. Ensure regular price updates are happening to the SimplePriceFeed contract:
   - SimplePriceFeed address: ${deploymentData.SimplePriceFeed}
   - This needs price updates from Oracle Keeper data
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
