const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy test tokens and individual price feeds for GMX on World Chain
 * Each token gets its own dedicated MockPriceFeed instance for proper price simulation
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING TEST TOKENS WITH INDIVIDUAL PRICE FEEDS");
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
  
  // Define test tokens
  const testTokens = [
    { 
      name: "Test USD", 
      symbol: "TUSD", 
      decimals: 18, 
      initialSupply: ethers.utils.parseUnits("1000000", 18),
      price: ethers.utils.parseUnits("1", 8), // $1 with 8 decimals (Chainlink format)
      isStable: true,
      isShortable: false,
      weight: 15000,
      minProfitBps: 50,
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18) // $50M max USDG cap
    },
    { 
      name: "Test Bitcoin", 
      symbol: "TBTC", 
      decimals: 8, 
      initialSupply: ethers.utils.parseUnits("1000", 8),
      price: ethers.utils.parseUnits("30000", 8), // $30,000 with 8 decimals
      isStable: false,
      isShortable: true,
      weight: 10000,
      minProfitBps: 150,
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18) // $30M max USDG cap
    },
    { 
      name: "Test Ethereum", 
      symbol: "TETH", 
      decimals: 18, 
      initialSupply: ethers.utils.parseUnits("10000", 18),
      price: ethers.utils.parseUnits("2500", 8), // $2,500 with 8 decimals
      isStable: false,
      isShortable: true,
      weight: 10000,
      minProfitBps: 150,
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18) // $30M max USDG cap
    }
  ];
  
  // Results container
  const deploymentResults = {
    tokens: {},
    priceFeeds: {}
  };
  
  // Deploy tokens and price feeds
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING TOKENS AND INDIVIDUAL PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  for (const tokenConfig of testTokens) {
    console.log(`\nDeploying ${tokenConfig.name} (${tokenConfig.symbol})...`);
    
    // Deploy token
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();
    await token.deployed();
    
    console.log(`Token deployed to: ${token.address}`);
    
    // Mint initial supply
    console.log(`Minting ${ethers.utils.formatUnits(tokenConfig.initialSupply, tokenConfig.decimals)} tokens to deployer...`);
    await token.mint(deployer.address, tokenConfig.initialSupply);
    
    // Deploy dedicated price feed for this token
    console.log(`Deploying price feed for ${tokenConfig.symbol} with price $${ethers.utils.formatUnits(tokenConfig.price, 8)}...`);
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(tokenConfig.price);
    await priceFeed.deployed();
    
    console.log(`${tokenConfig.symbol} price feed deployed to: ${priceFeed.address}`);
    
    // Store deployment info
    deploymentResults.tokens[tokenConfig.symbol] = {
      address: token.address,
      decimals: tokenConfig.decimals,
      initialSupply: tokenConfig.initialSupply.toString()
    };
    
    deploymentResults.priceFeeds[tokenConfig.symbol] = {
      address: priceFeed.address,
      price: tokenConfig.price.toString()
    };
  }
  
  // Configure VaultPriceFeed
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING VAULT PRICE FEED");
  console.log("------------------------------------------------------");
  
  console.log(`VaultPriceFeed address: ${deploymentData.CustomVaultPriceFeed}`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Setup price feeds
  for (const tokenConfig of testTokens) {
    try {
      console.log(`\nConfiguring VaultPriceFeed for ${tokenConfig.symbol}...`);
      
      const tokenAddress = deploymentResults.tokens[tokenConfig.symbol].address;
      const priceFeedAddress = deploymentResults.priceFeeds[tokenConfig.symbol].address;
      
      console.log(`Token: ${tokenAddress}`);
      console.log(`Price Feed: ${priceFeedAddress}`);
      
      const tx = await vaultPriceFeed.setTokenConfig(
        tokenAddress,
        priceFeedAddress,
        8, // decimals - MockPriceFeed uses 8 decimals (like Chainlink)
        tokenConfig.isStable
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ VaultPriceFeed configured for ${tokenConfig.symbol}`);
    } catch (error) {
      console.error(`❌ Error configuring VaultPriceFeed for ${tokenConfig.symbol}: ${error.message}`);
    }
  }
  
  // Configure Vault with tokens
  console.log("\n------------------------------------------------------");
  console.log("CONFIGURING TOKENS IN VAULT");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  
  // Whitelist tokens in Vault
  for (const tokenConfig of testTokens) {
    const tokenSymbol = tokenConfig.symbol;
    const tokenAddress = deploymentResults.tokens[tokenSymbol].address;
    
    try {
      console.log(`\nWhitelisting ${tokenSymbol} in Vault...`);
      
      // Additional fixed gas parameters to ensure transaction goes through
      const gasLimit = 5000000;
      const gasPrice = await ethers.provider.getGasPrice();
      
      const tx = await vault.setTokenConfig(
        tokenAddress,
        tokenConfig.decimals,
        tokenConfig.weight,
        tokenConfig.minProfitBps,
        tokenConfig.maxUsdgAmount,
        tokenConfig.isStable,
        tokenConfig.isShortable,
        { gasLimit, gasPrice }
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      console.log(`✅ ${tokenSymbol} whitelisted in Vault`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenSymbol}: ${error.message}`);
    }
  }
  
  // Verify Vault configuration
  console.log("\n------------------------------------------------------");
  console.log("VERIFYING VAULT CONFIGURATION");
  console.log("------------------------------------------------------");
  
  let allWhitelisted = true;
  
  for (const tokenConfig of testTokens) {
    const tokenSymbol = tokenConfig.symbol;
    const tokenAddress = deploymentResults.tokens[tokenSymbol].address;
    
    try {
      const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
      console.log(`Is ${tokenSymbol} whitelisted: ${isWhitelisted}`);
      
      if (!isWhitelisted) {
        allWhitelisted = false;
      } else {
        // Check configuration details
        const tokenWeight = await vault.tokenWeights(tokenAddress);
        console.log(`- ${tokenSymbol} weight: ${tokenWeight}`);
        
        const tokenDecimals = await vault.tokenDecimals(tokenAddress);
        console.log(`- ${tokenSymbol} decimals: ${tokenDecimals}`);
        
        // Also test price feed
        try {
          const price = await vaultPriceFeed.getPrice(tokenAddress, true, true, true);
          console.log(`- ${tokenSymbol} price: $${ethers.utils.formatUnits(price, 30)}`);
        } catch (error) {
          console.error(`  ❌ Error getting price for ${tokenSymbol}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error verifying ${tokenSymbol}: ${error.message}`);
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
  
  deploymentData.TestDeployment = deploymentResults;
  
  try {
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("✅ Updated deployment data file with test tokens and price feeds");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("TEST DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  console.log(`
Test Token Addresses:
${Object.entries(deploymentResults.tokens).map(([symbol, info]) => `- ${symbol}: ${info.address}`).join('\n')}

Price Feed Addresses:
${Object.entries(deploymentResults.priceFeeds).map(([symbol, info]) => `- ${symbol}: ${info.address} ($${ethers.utils.formatUnits(info.price, 8)})`).join('\n')}

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
