const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy test tokens for GMX on World Chain
 * Using the Token contract defined in the codebase correctly
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING TEST TOKENS FOR GMX ON WORLD CHAIN");
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
  
  // Deploy test tokens
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Define test tokens
  const testTokens = [
    { name: "Test USD", symbol: "TUSD", decimals: 18, initialSupply: ethers.utils.parseUnits("1000000", 18) },
    { name: "Test Bitcoin", symbol: "TBTC", decimals: 8, initialSupply: ethers.utils.parseUnits("1000", 8) },
    { name: "Test Ethereum", symbol: "TETH", decimals: 18, initialSupply: ethers.utils.parseUnits("10000", 18) }
  ];
  
  const deployedTokens = {};
  
  // Deploy each token - Note: Token constructor in the codebase doesn't accept parameters
  // We need to deploy and then set properties using available methods
  for (const token of testTokens) {
    console.log(`\nDeploying ${token.name} (${token.symbol})...`);
    
    // Deploy token without parameters - Token contract doesn't accept constructor params
    const Token = await ethers.getContractFactory("Token");
    const tokenContract = await Token.deploy();
    await tokenContract.deployed();
    
    console.log(`Token deployed to: ${tokenContract.address}`);
    
    // Mint initial supply
    console.log(`Minting ${ethers.utils.formatUnits(token.initialSupply, token.decimals)} tokens to deployer...`);
    await tokenContract.mint(deployer.address, token.initialSupply);
    
    // Save token info
    deployedTokens[token.symbol] = {
      address: tokenContract.address,
      decimals: token.decimals,
      initialSupply: token.initialSupply.toString()
    };
    
    console.log(`✅ ${token.name} (${token.symbol}) deployed and minted to: ${tokenContract.address}`);
  }
  
  // Deploy mock price feed for test tokens
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING MOCK PRICE FEED FOR TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Deploy a mock price feed contract with initial price (will be overridden per token later)
  // MockPriceFeed constructor requires an initial price value
  const initialPrice = ethers.utils.parseUnits("1", 30); // $1 with 30 decimals precision
  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  const mockPriceFeed = await MockPriceFeed.deploy(initialPrice);
  await mockPriceFeed.deployed();
  
  console.log(`✅ MockPriceFeed deployed to: ${mockPriceFeed.address}`);
  
  // Set prices for test tokens
  console.log("\n------------------------------------------------------");
  console.log("SETTING MOCK PRICES FOR TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Define mock prices (with 30 decimals of precision as per GMX standard)
  const prices = {
    "TUSD": ethers.utils.parseUnits("1", 30), // $1
    "TBTC": ethers.utils.parseUnits("30000", 30), // $30,000
    "TETH": ethers.utils.parseUnits("2500", 30) // $2,500
  };
  
  // Set prices in mock price feed
  for (const [symbol, tokenInfo] of Object.entries(deployedTokens)) {
    console.log(`Setting price for ${symbol}: $${ethers.utils.formatUnits(prices[symbol], 30)}`);
    // We need to send price as a parameter, not with token address
    const tx = await mockPriceFeed.setPrice(prices[symbol]);
    await tx.wait();
    console.log(`Set price for ${symbol} to $${ethers.utils.formatUnits(prices[symbol], 30)}`);
  }
  
  console.log("✅ Mock prices set successfully");
  
  // Connect to VaultPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING VAULT PRICE FEED FOR TEST TOKENS");
  console.log("------------------------------------------------------");
  
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Configure VaultPriceFeed to use MockPriceFeed for test tokens
  for (const [symbol, tokenInfo] of Object.entries(deployedTokens)) {
    try {
      console.log(`\nConfiguring VaultPriceFeed for ${symbol}...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        tokenInfo.address,
        mockPriceFeed.address,
        30, // priceDecimals - Mock uses 30 decimals
        symbol === "TUSD" // isStrictStable - Only TUSD is stable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ VaultPriceFeed configured for ${symbol}`);
    } catch (error) {
      console.error(`❌ Error configuring VaultPriceFeed for ${symbol}: ${error.message}`);
    }
  }
  
  // Whitelist tokens in Vault
  console.log("\n------------------------------------------------------");
  console.log("WHITELISTING TEST TOKENS IN VAULT");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Token settings for Vault
  const tokenSettings = {
    "TUSD": {
      weight: 15000,
      minProfitBps: 50,
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18), // $50M max USDG cap
      isStable: true,
      isShortable: false
    },
    "TBTC": {
      weight: 10000,
      minProfitBps: 150,
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M max USDG cap
      isStable: false,
      isShortable: true
    },
    "TETH": {
      weight: 10000,
      minProfitBps: 150,
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M max USDG cap
      isStable: false,
      isShortable: true
    }
  };
  
  // Whitelist each token in Vault
  for (const [symbol, tokenInfo] of Object.entries(deployedTokens)) {
    try {
      console.log(`\nWhitelisting ${symbol} in Vault...`);
      const setting = tokenSettings[symbol];
      
      const tx = await vault.setTokenConfig(
        tokenInfo.address,
        tokenInfo.decimals,
        setting.weight,
        setting.minProfitBps,
        setting.maxUsdgAmount,
        setting.isStable,
        setting.isShortable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ ${symbol} whitelisted in Vault`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${symbol}: ${error.message}`);
      
      // If there's an error, try with fixed gas parameters
      try {
        console.log(`\nRetrying with fixed gas parameters...`);
        const setting = tokenSettings[symbol];
        
        const gasLimit = 5000000; // Generous gas limit
        const gasPrice = await ethers.provider.getGasPrice();
        
        const tx = await vault.setTokenConfig(
          tokenInfo.address,
          tokenInfo.decimals,
          setting.weight,
          setting.minProfitBps,
          setting.maxUsdgAmount,
          setting.isStable,
          setting.isShortable,
          { gasLimit, gasPrice }
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        await tx.wait();
        console.log(`✅ ${symbol} whitelisted in Vault (with fixed gas)`);
      } catch (retryError) {
        console.error(`❌ Retry failed: ${retryError.message}`);
      }
    }
  }
  
  // Verify Vault configuration
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING VAULT CONFIGURATION");
  console.log("------------------------------------------------------");
  
  let allWhitelisted = true;
  
  for (const [symbol, tokenInfo] of Object.entries(deployedTokens)) {
    try {
      const isWhitelisted = await vault.whitelistedTokens(tokenInfo.address);
      console.log(`Is ${symbol} whitelisted: ${isWhitelisted}`);
      
      if (!isWhitelisted) {
        allWhitelisted = false;
      } else {
        // Check configuration details
        const tokenWeight = await vault.tokenWeights(tokenInfo.address);
        console.log(`- ${symbol} weight: ${tokenWeight}`);
        
        const tokenDecimals = await vault.tokenDecimals(tokenInfo.address);
        console.log(`- ${symbol} decimals: ${tokenDecimals}`);
      }
    } catch (error) {
      console.error(`❌ Error verifying ${symbol}: ${error.message}`);
      allWhitelisted = false;
    }
  }
  
  if (allWhitelisted) {
    console.log("\n✅ All test tokens are successfully whitelisted");
  } else {
    console.log("\n⚠️ Not all test tokens are whitelisted");
  }
  
  // Update deployment data
  console.log("\n------------------------------------------------------");
  console.log("UPDATING DEPLOYMENT DATA");
  console.log("------------------------------------------------------");
  
  // Add test tokens to deployment data
  deploymentData.TestTokens = deployedTokens;
  deploymentData.MockPriceFeed = mockPriceFeed.address;
  
  try {
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("✅ Updated deployment data file with test tokens");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("TEST TOKENS DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log(`
Test Token Addresses:
${Object.entries(deployedTokens).map(([symbol, info]) => `- ${symbol}: ${info.address}`).join('\n')}

MockPriceFeed: ${mockPriceFeed.address}

Next steps:
1. Verify the complete deployment with:
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   
2. Test the frontend interface using these test tokens:
   - Update frontend to use test token addresses
   - Test swaps, leverage trading, etc.
   
3. For frontend testing, mint test tokens to your test accounts:
   - Use the mint() function on each token contract
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
