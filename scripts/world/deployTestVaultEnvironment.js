const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script to deploy a simplified test environment for GMX on World Chain
 * - Deploys test tokens
 * - Creates mock price feeds
 * - Deploys a custom vault with relaxed validation
 * - Configures everything for testing
 * 
 * This script focuses on the Oracle Keeper integration without strict validations
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING SIMPLIFIED TEST ENVIRONMENT FOR GMX");
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
  const testDeployment = {
    tokens: {},
    priceFeeds: {},
    contracts: {}
  };
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Deploy tokens and mint initial supply
  for (const tokenConfig of testTokens) {
    console.log(`\nDeploying ${tokenConfig.name} (${tokenConfig.symbol})...`);
    
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();
    await token.deployed();
    
    console.log(`Token deployed to: ${token.address}`);
    
    // Mint initial supply
    console.log(`Minting ${ethers.utils.formatUnits(tokenConfig.initialSupply, tokenConfig.decimals)} tokens to deployer...`);
    await token.mint(deployer.address, tokenConfig.initialSupply);
    
    // Store deployment info
    testDeployment.tokens[tokenConfig.symbol] = {
      address: token.address,
      decimals: tokenConfig.decimals,
      initialSupply: tokenConfig.initialSupply.toString()
    };
    
    console.log(`✅ ${tokenConfig.symbol} deployed and minted`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING MOCK PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  // Deploy individual mock price feeds
  for (const tokenConfig of testTokens) {
    console.log(`\nDeploying price feed for ${tokenConfig.symbol}...`);
    
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(tokenConfig.price);
    await priceFeed.deployed();
    
    console.log(`Price feed deployed to: ${priceFeed.address}`);
    
    // Store deployment info
    testDeployment.priceFeeds[tokenConfig.symbol] = {
      address: priceFeed.address,
      price: tokenConfig.price.toString()
    };
    
    console.log(`✅ ${tokenConfig.symbol} price feed deployed with price $${ethers.utils.formatUnits(tokenConfig.price, 8)}`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING SIMPLIFIED TEST VAULT ENVIRONMENT");
  console.log("------------------------------------------------------");
  
  // Deploy a simplified test environment
  
  // 1. Deploy USDG token for the Vault
  console.log("\nDeploying USDG token...");
  const USDG = await ethers.getContractFactory("USDG");
  const usdg = await USDG.deploy("USD GMX", "USDG");
  await usdg.deployed();
  console.log(`USDG deployed to: ${usdg.address}`);
  testDeployment.contracts.USDG = usdg.address;
  
  // 2. Deploy Vault Price Feed (simpler than the production one)
  console.log("\nDeploying VaultPriceFeed...");
  const VaultPriceFeed = await ethers.getContractFactory("VaultPriceFeed");
  const vaultPriceFeed = await VaultPriceFeed.deploy();
  await vaultPriceFeed.deployed();
  console.log(`VaultPriceFeed deployed to: ${vaultPriceFeed.address}`);
  testDeployment.contracts.VaultPriceFeed = vaultPriceFeed.address;
  
  // Configure price feeds in the VaultPriceFeed
  console.log("\nConfiguring price feeds in VaultPriceFeed...");
  for (const tokenConfig of testTokens) {
    const tokenAddress = testDeployment.tokens[tokenConfig.symbol].address;
    const priceFeedAddress = testDeployment.priceFeeds[tokenConfig.symbol].address;
    
    await vaultPriceFeed.setTokenConfig(
      tokenAddress,
      priceFeedAddress,
      8, // decimals - MockPriceFeed uses 8 decimals
      tokenConfig.isStable
    );
    
    console.log(`✅ ${tokenConfig.symbol} price feed configured in VaultPriceFeed`);
  }
  
  // 3. Deploy Vault
  console.log("\nDeploying Test Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();
  console.log(`Test Vault deployed to: ${vault.address}`);
  testDeployment.contracts.Vault = vault.address;
  
  // 4. Initialize Vault with minimal configuration
  console.log("\nInitializing Vault...");
  await vault.initialize(
    usdg.address,           // _usdg
    vaultPriceFeed.address, // _priceFeed
    ethers.utils.parseUnits("5", 30), // _liquidationFeeUsd (5 USD with 30 decimals)
    0,                      // _fundingRatePerHour (0 for testing)
    ethers.utils.parseUnits("1000000", 30)  // _maxUsdgAmount (1M)
  );
  console.log("✅ Vault initialized");
  
  // 5. Set Vault permissions
  console.log("\nSetting Vault permissions...");
  await vault.setIsLeverageEnabled(true);
  console.log("✅ Leverage trading enabled");
  
  await vault.setGov(deployer.address);
  console.log("✅ Governance set to deployer");
  
  // 6. Set up USDG for the Vault
  console.log("\nSetting up USDG for Vault...");
  await usdg.addVault(vault.address);
  console.log("✅ USDG configured with Vault");
  
  // 7. Whitelist tokens in the Vault with simplified validation
  console.log("\n------------------------------------------------------");
  console.log("WHITELISTING TOKENS IN TEST VAULT");
  console.log("------------------------------------------------------");
  
  for (const tokenConfig of testTokens) {
    console.log(`\nWhitelisting ${tokenConfig.symbol}...`);
    const tokenAddress = testDeployment.tokens[tokenConfig.symbol].address;
    
    try {
      // Set token configuration
      await vault.setTokenConfig(
        tokenAddress,
        tokenConfig.decimals,
        tokenConfig.weight,
        tokenConfig.minProfitBps,
        tokenConfig.maxUsdgAmount,
        tokenConfig.isStable,
        tokenConfig.isShortable
      );
      
      console.log(`✅ ${tokenConfig.symbol} whitelisted in Vault`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenConfig.symbol}: ${error.message}`);
      
      // Try with fixed gas parameters as a fallback
      try {
        console.log(`Retrying with fixed gas parameters...`);
        
        await vault.setTokenConfig(
          tokenAddress,
          tokenConfig.decimals,
          tokenConfig.weight,
          tokenConfig.minProfitBps,
          tokenConfig.maxUsdgAmount,
          tokenConfig.isStable,
          tokenConfig.isShortable,
          { gasLimit: 5000000 }
        );
        
        console.log(`✅ ${tokenConfig.symbol} whitelisted in Vault (with fixed gas)`);
      } catch (retryError) {
        console.error(`❌ Retry failed for ${tokenConfig.symbol}: ${retryError.message}`);
      }
    }
  }
  
  // 8. Deploy Router
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING AUXILIARY CONTRACTS");
  console.log("------------------------------------------------------");
  
  console.log("\nDeploying Router...");
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(vault.address, usdg.address, ethers.constants.AddressZero);
  await router.deployed();
  console.log(`Router deployed to: ${router.address}`);
  testDeployment.contracts.Router = router.address;
  
  // 9. Deploy Position Router (for leveraged trading)
  console.log("\nDeploying PositionRouter...");
  const PositionRouter = await ethers.getContractFactory("PositionRouter");
  const positionRouter = await PositionRouter.deploy(vault.address, router.address, ethers.constants.AddressZero, ethers.constants.AddressZero, 0);
  await positionRouter.deployed();
  console.log(`PositionRouter deployed to: ${positionRouter.address}`);
  testDeployment.contracts.PositionRouter = positionRouter.address;
  
  // 10. Deploy OrderBook
  console.log("\nDeploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy();
  await orderBook.deployed();
  console.log(`OrderBook deployed to: ${orderBook.address}`);
  testDeployment.contracts.OrderBook = orderBook.address;
  
  // Initialize OrderBook
  await orderBook.initialize(
    router.address,
    vault.address,
    ethers.constants.AddressZero, // referral storage
    ethers.utils.parseEther("0.01") // minimal execution fee, 0.01 ETH
  );
  console.log("✅ OrderBook initialized");
  
  // 11. Deploy SimplePriceFeed for Oracle Keeper integration
  console.log("\nDeploying SimplePriceFeed for Oracle Keeper integration...");
  const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed");
  const simplePriceFeed = await SimplePriceFeed.deploy();
  await simplePriceFeed.deployed();
  console.log(`SimplePriceFeed deployed to: ${simplePriceFeed.address}`);
  testDeployment.contracts.SimplePriceFeed = simplePriceFeed.address;
  
  // Configure SimplePriceFeed with test token prices
  for (const tokenConfig of testTokens) {
    const tokenAddress = testDeployment.tokens[tokenConfig.symbol].address;
    const price = ethers.utils.parseUnits(
      ethers.utils.formatUnits(tokenConfig.price, 8), 
      30  // Convert to GMX 30-decimal format
    );
    
    await simplePriceFeed.setLatestAnswer(tokenAddress, price);
    console.log(`✅ ${tokenConfig.symbol} price set in SimplePriceFeed: $${ethers.utils.formatUnits(price, 30)}`);
  }
  
  // 12. Integrate SimplePriceFeed with VaultPriceFeed
  console.log("\nIntegrating SimplePriceFeed with VaultPriceFeed for Oracle Keeper integration...");
  await vaultPriceFeed.setSecondaryPriceFeed(simplePriceFeed.address);
  console.log("✅ SimplePriceFeed set as secondary price feed");
  
  // Validate deployment
  console.log("\n------------------------------------------------------");
  console.log("VALIDATING TEST DEPLOYMENT");
  console.log("------------------------------------------------------");
  
  // Verify token whitelisting
  let allWhitelisted = true;
  
  for (const tokenConfig of testTokens) {
    const tokenAddress = testDeployment.tokens[tokenConfig.symbol].address;
    const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
    
    console.log(`${tokenConfig.symbol} is whitelisted: ${isWhitelisted}`);
    
    if (!isWhitelisted) {
      allWhitelisted = false;
    } else {
      // Test price feed
      try {
        const price = await vaultPriceFeed.getPrice(tokenAddress, true, true, true);
        console.log(`${tokenConfig.symbol} price: $${ethers.utils.formatUnits(price, 30)}`);
      } catch (error) {
        console.error(`Error getting price for ${tokenConfig.symbol}: ${error.message}`);
      }
    }
  }
  
  if (allWhitelisted) {
    console.log("\n✅ All tokens successfully whitelisted in the test Vault");
  } else {
    console.log("\n⚠️ Not all tokens were successfully whitelisted");
  }
  
  // Update deployment data
  console.log("\n------------------------------------------------------");
  console.log("UPDATING DEPLOYMENT DATA");
  console.log("------------------------------------------------------");
  
  deploymentData.TestEnvironment = testDeployment;
  
  try {
    fs.writeFileSync(
      deploymentFilePath, 
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("✅ Updated deployment data file with test environment details");
  } catch (error) {
    console.error(`❌ Error updating deployment data file: ${error.message}`);
  }
  
  console.log("\n======================================================");
  console.log("TEST ENVIRONMENT DEPLOYMENT COMPLETE");
  console.log("======================================================");
  
  // Create a summary of deployment addresses
  const addressSummary = {
    // Core contracts
    Vault: testDeployment.contracts.Vault,
    Router: testDeployment.contracts.Router,
    PositionRouter: testDeployment.contracts.PositionRouter,
    OrderBook: testDeployment.contracts.OrderBook,
    
    // Oracle
    VaultPriceFeed: testDeployment.contracts.VaultPriceFeed,
    SimplePriceFeed: testDeployment.contracts.SimplePriceFeed,
    
    // Tokens
    USDG: testDeployment.contracts.USDG
  };
  
  // Add test tokens to summary
  for (const [symbol, info] of Object.entries(testDeployment.tokens)) {
    addressSummary[symbol] = info.address;
  }
  
  console.log(`
Test Environment Summary:

Core Contracts:
- Vault: ${addressSummary.Vault}
- Router: ${addressSummary.Router}
- PositionRouter: ${addressSummary.PositionRouter}
- OrderBook: ${addressSummary.OrderBook}

Oracle System:
- VaultPriceFeed: ${addressSummary.VaultPriceFeed}
- SimplePriceFeed: ${addressSummary.SimplePriceFeed} (for Oracle Keeper integration)

Tokens:
- USDG: ${addressSummary.USDG}
${Object.entries(testDeployment.tokens).map(([symbol, info]) => `- ${symbol}: ${info.address}`).join('\n')}

Next Steps:
1. Update the frontend to use these test addresses
2. Connect SimplePriceFeed to Oracle Keeper for real-time price updates
3. Test swaps and leveraged trading functionality
4. For full frontend testing, you can use these test tokens instead of production tokens

For Oracle Keeper Integration:
1. Use the deployed SimplePriceFeed: ${testDeployment.contracts.SimplePriceFeed}
2. Oracle Keeper should call setLatestAnswer() for each token with updated prices
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
