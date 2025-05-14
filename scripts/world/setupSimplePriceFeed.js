const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Oracle Keeper URL
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";

// Get custom deployment data
async function getCustomDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Custom deployment file not found: .world-custom-deployment.json");
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Custom deployment file is empty");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

// Fetch prices from Oracle Keeper
async function fetchPrices() {
  try {
    const response = await axios.get(`${ORACLE_KEEPER_URL}/direct-prices`);
    if (response.data && response.data.prices) {
      console.log("Prices fetched from Oracle Keeper:", response.data.prices);
      return response.data.prices;
    }
  } catch (error) {
    console.warn("Error fetching prices from Oracle Keeper:", error.message);
  }
  
  // Use fallback prices if API call fails
  console.warn("Using fallback prices for tokens");
  return {
    WLD: 1.24,
    WETH: 2481.08,
    MAG: 0.00041212
  };
}

// Get price in the format expected by GMX (30 decimals)
function getPriceInGmxFormat(price) {
  // GMX uses 30 decimals for prices
  return ethers.utils.parseUnits(price.toString(), 30);
}

// Main function
async function main() {
  console.log("Setting up SimplePriceFeed for custom deployment on World Chain...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the CustomVault and SimplePriceFeed addresses
  if (!customData.CustomVault) {
    console.error("Custom Vault address not found in deployment data.");
    process.exit(1);
  }
  
  if (!customData.SimplePriceFeed) {
    console.error("SimplePriceFeed address not found in deployment data.");
    process.exit(1);
  }
  
  if (!customData.CustomVaultPriceFeed) {
    console.error("CustomVaultPriceFeed address not found in deployment data.");
    process.exit(1);
  }
  
  // Get Oracle Keeper prices
  const prices = await fetchPrices();
  console.log("Using prices:", prices);
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Load SimplePriceFeed contract
  const simplePriceFeedAbi = [
    "function owner() external view returns (address)",
    "function setPrice(address _token, uint256 _price) external",
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    customData.SimplePriceFeed,
    simplePriceFeedAbi,
    deployer
  );
  
  // Load VaultPriceFeed contract (to set SimplePriceFeed as the primary feed)
  const vaultPriceFeedAbi = [
    "function owner() external view returns (address)",
    "function priceFeeds(address _token) external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    customData.CustomVaultPriceFeed,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Get test tokens
  const testTokens = customData.TestDeployment.tokens;
  const testTokenAddresses = Object.entries(testTokens).map(([symbol, data]) => data.address);
  console.log("Test token addresses:", testTokenAddresses);
  
  // Check SimplePriceFeed ownership
  try {
    const owner = await simplePriceFeed.owner();
    console.log(`SimplePriceFeed owner: ${owner}`);
    
    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
    console.log(`Current account is owner: ${isOwner}`);
    
    if (!isOwner) {
      console.warn("WARNING: Current account is not the owner. Transactions may fail.");
    }
  } catch (error) {
    console.error("Error checking SimplePriceFeed ownership:", error.message);
  }
  
  // Check VaultPriceFeed ownership
  try {
    const owner = await vaultPriceFeed.owner();
    console.log(`VaultPriceFeed owner: ${owner}`);
    
    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
    console.log(`Current account is owner: ${isOwner}`);
    
    if (!isOwner) {
      console.warn("WARNING: Current account is not the owner. Transactions may fail.");
    }
  } catch (error) {
    console.error("Error checking VaultPriceFeed ownership:", error.message);
  }
  
  // Create price mapping for test tokens
  const tokenPrices = [];
  const tokens = [];
  
  // Map prices to test tokens (TUSD = WLD, TETH = WETH)
  if (testTokens.TUSD && prices.WLD) {
    tokens.push(testTokens.TUSD.address);
    tokenPrices.push(getPriceInGmxFormat(prices.WLD));
    console.log(`Set TUSD price to ${prices.WLD} USD (WLD price)`);
  }
  
  if (testTokens.TETH && prices.WETH) {
    tokens.push(testTokens.TETH.address);
    tokenPrices.push(getPriceInGmxFormat(prices.WETH));
    console.log(`Set TETH price to ${prices.WETH} USD (WETH price)`);
  }
  
  if (testTokens.TBTC) {
    // Use a fixed price for TBTC (BTC equivalent)
    const btcPrice = 40000; // Default BTC price if not available
    tokens.push(testTokens.TBTC.address);
    tokenPrices.push(getPriceInGmxFormat(btcPrice));
    console.log(`Set TBTC price to ${btcPrice} USD (default BTC price)`);
  }
  
  // Set prices in SimplePriceFeed contract
  try {
    console.log("Setting prices in SimplePriceFeed...");
    const tx = await simplePriceFeed.setPrices(tokens, tokenPrices);
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Prices set successfully in SimplePriceFeed");
    
    // Verify prices were set correctly
    for (let i = 0; i < tokens.length; i++) {
      const price = await simplePriceFeed.getPrice(tokens[i]);
      console.log(`Verified price for ${tokens[i]}: ${ethers.utils.formatUnits(price, 30)} USD`);
    }
  } catch (error) {
    console.error("❌ Error setting prices in SimplePriceFeed:", error.message);
  }
  
  // Set SimplePriceFeed as the primary feed for each token in VaultPriceFeed
  console.log("\nSetting SimplePriceFeed as primary feed for tokens in VaultPriceFeed...");
  for (const token of tokens) {
    try {
      // Check current price feed
      const currentFeed = await vaultPriceFeed.priceFeeds(token);
      if (currentFeed.toLowerCase() === customData.SimplePriceFeed.toLowerCase()) {
        console.log(`SimplePriceFeed is already set for ${token}`);
        continue;
      }
      
      console.log(`Setting SimplePriceFeed for ${token}...`);
      const tx = await vaultPriceFeed.setPriceFeed(token, customData.SimplePriceFeed);
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ SimplePriceFeed set as primary feed for ${token}`);
      
      // Verify price feed was set
      const updatedFeed = await vaultPriceFeed.priceFeeds(token);
      console.log(`Verified price feed for ${token}: ${updatedFeed}`);
      
      // Verify price can be retrieved from VaultPriceFeed
      const price = await vaultPriceFeed.getPrice(token, true, true, false);
      console.log(`Verified price from VaultPriceFeed for ${token}: ${ethers.utils.formatUnits(price, 30)} USD`);
    } catch (error) {
      console.error(`❌ Error setting price feed for ${token}:`, error.message);
    }
  }
  
  console.log("\nSimplePriceFeed setup completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
