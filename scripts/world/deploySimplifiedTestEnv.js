const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Simplified script to deploy GMX test environment
 * Creates test tokens and configures a minimal setup for frontend integration
 * Avoids ENS and other complex operations that can fail on World Chain
 */
async function main() {
  console.log("======================================================");
  console.log("DEPLOYING MINIMAL TEST ENVIRONMENT FOR GMX");
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
      price: ethers.utils.parseUnits("1", 8) // $1 with 8 decimals
    },
    { 
      name: "Test Bitcoin", 
      symbol: "TBTC", 
      decimals: 8, 
      initialSupply: ethers.utils.parseUnits("1000", 8),
      price: ethers.utils.parseUnits("30000", 8) // $30,000 with 8 decimals
    },
    { 
      name: "Test Ethereum", 
      symbol: "TETH", 
      decimals: 18, 
      initialSupply: ethers.utils.parseUnits("10000", 18),
      price: ethers.utils.parseUnits("2500", 8) // $2,500 with 8 decimals
    }
  ];
  
  // Results container
  const testEnv = {
    tokens: {},
    priceFeeds: {},
    contracts: {}
  };
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING AND CONFIGURING TEST TOKENS");
  console.log("------------------------------------------------------");
  
  // Deploy test tokens
  for (const tokenConfig of testTokens) {
    console.log(`\nDeploying ${tokenConfig.name} (${tokenConfig.symbol})...`);
    
    // Deploy token contract
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();
    await token.deployed();
    
    console.log(`Token deployed to: ${token.address}`);
    
    // Mint initial supply
    console.log(`Minting ${ethers.utils.formatUnits(tokenConfig.initialSupply, tokenConfig.decimals)} tokens to deployer...`);
    await token.mint(deployer.address, tokenConfig.initialSupply);
    
    // Store token info
    testEnv.tokens[tokenConfig.symbol] = {
      address: token.address,
      decimals: tokenConfig.decimals,
      initialSupply: tokenConfig.initialSupply.toString()
    };
    
    console.log(`✅ ${tokenConfig.symbol} deployed and minted`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING MOCK PRICE FEEDS");
  console.log("------------------------------------------------------");
  
  // Deploy price feeds for each token
  for (const tokenConfig of testTokens) {
    console.log(`\nDeploying price feed for ${tokenConfig.symbol}...`);
    
    // Deploy a mock price feed with initial price
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(tokenConfig.price);
    await priceFeed.deployed();
    
    // Store price feed info
    testEnv.priceFeeds[tokenConfig.symbol] = {
      address: priceFeed.address,
      price: tokenConfig.price.toString()
    };
    
    console.log(`✅ ${tokenConfig.symbol} price feed deployed at ${priceFeed.address} with price $${ethers.utils.formatUnits(tokenConfig.price, 8)}`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("DEPLOYING SIMPLEPRICEFEED FOR ORACLE KEEPER INTEGRATION");
  console.log("------------------------------------------------------");
  
  // Deploy SimplePriceFeed for Oracle Keeper integration
  const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed");
  const simplePriceFeed = await SimplePriceFeed.deploy();
  await simplePriceFeed.deployed();
  testEnv.contracts.SimplePriceFeed = simplePriceFeed.address;
  
  console.log(`SimplePriceFeed deployed to: ${simplePriceFeed.address}`);
  
  // Set initial prices in SimplePriceFeed
  for (const tokenConfig of testTokens) {
    const tokenAddress = testEnv.tokens[tokenConfig.symbol].address;
    
    // Convert 8 decimal price to 30 decimals for GMX standard
    const price30Decimals = ethers.utils.parseUnits(
      ethers.utils.formatUnits(tokenConfig.price, 8),
      30
    );
    
    await simplePriceFeed.updatePrice(tokenAddress, price30Decimals);
    console.log(`✅ Set ${tokenConfig.symbol} price in SimplePriceFeed: $${ethers.utils.formatUnits(price30Decimals, 30)}`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("STORING ORIGINAL CONTRACT ADDRESSES FOR FRONTEND");
  console.log("------------------------------------------------------");
  
  // We'll store the original contract addresses that we want to use with our test tokens
  if (deploymentData.CustomVault) {
    testEnv.contracts.Vault = deploymentData.CustomVault;
    console.log(`Using existing Vault: ${testEnv.contracts.Vault}`);
  }
  
  if (deploymentData.CustomRouter) {
    testEnv.contracts.Router = deploymentData.CustomRouter;
    console.log(`Using existing Router: ${testEnv.contracts.Router}`);
  }
  
  if (deploymentData.CustomPositionRouter) {
    testEnv.contracts.PositionRouter = deploymentData.CustomPositionRouter;
    console.log(`Using existing PositionRouter: ${testEnv.contracts.PositionRouter}`);
  }
  
  if (deploymentData.CustomOrderBook) {
    testEnv.contracts.OrderBook = deploymentData.CustomOrderBook;
    console.log(`Using existing OrderBook: ${testEnv.contracts.OrderBook}`);
  }
  
  // Update deployment data file
  console.log("\n------------------------------------------------------");
  console.log("UPDATING DEPLOYMENT DATA FILE");
  console.log("------------------------------------------------------");
  
  deploymentData.TestEnvironment = testEnv;
  
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
  console.log("TEST ENVIRONMENT SETUP COMPLETE");
  console.log("======================================================");
  
  console.log(`
Test Environment Summary:

Test Tokens:
${Object.entries(testEnv.tokens).map(([symbol, info]) => `- ${symbol}: ${info.address} (${ethers.utils.formatUnits(info.initialSupply, testTokens.find(t => t.symbol === symbol).decimals)} tokens minted)`).join('\n')}

Price Feeds:
${Object.entries(testEnv.priceFeeds).map(([symbol, info]) => 
  `- ${symbol}: ${info.address} ($${ethers.utils.formatUnits(info.price, 8)})`).join('\n')}

Oracle Keeper Integration:
- SimplePriceFeed: ${testEnv.contracts.SimplePriceFeed}

Next Steps:
1. Update frontend to use SimplePriceFeed for direct Oracle Keeper integration
2. Connect the Oracle Keeper to update prices in SimplePriceFeed via setLatestAnswer()
3. The Oracle Keeper endpoint is available at: https://oracle-keeper.kevin8396.workers.dev/direct-prices
4. For testing, mint these test tokens to your test accounts using the mint() function

Important Notes:
- These test tokens can be used with the existing deployed contracts
- Frontend should display prices from Oracle Keeper directly while waiting for contract integration
- Tokens can be minted on demand for testing purposes
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
