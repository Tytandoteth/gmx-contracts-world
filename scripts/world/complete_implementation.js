const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Configuration constants
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";
const WORLD_CHAIN_RPC = "https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/";

// Gas options to avoid estimation errors
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 1000000
};

// Get deployment data
async function getCustomDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
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
    WLD: 1.30,
    WETH: 2540.00,
    MAG: 0.00038699
  };
}

// Convert price to GMX format with 30 decimals
function getPriceInGmxFormat(price) {
  return ethers.utils.parseUnits(price.toString(), 30);
}

// Logging helper
function logSection(title) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
}

// Main implementation function
async function main() {
  logSection("GMX V1 Complete Implementation on World Chain");
  console.log("Using RPC URL:", WORLD_CHAIN_RPC);
  
  // Get deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Fetch prices
  const prices = await fetchPrices();
  console.log("Using prices:", prices);
  
  // Contract addresses
  const simplePriceFeedAddress = customData.SimplePriceFeed;
  const vaultPriceFeedAddress = customData.CustomVaultPriceFeed;
  const vaultAddress = customData.CustomVault;
  
  if (!simplePriceFeedAddress || !vaultPriceFeedAddress || !vaultAddress) {
    console.error("Missing required contract addresses in deployment data");
    return;
  }
  
  // Test token information
  const testTokens = customData.TestDeployment.tokens;
  if (!testTokens) {
    console.error("Missing test token information in deployment data");
    return;
  }
  
  // Step 1: Configure SimplePriceFeed
  logSection("Step 1: Configure SimplePriceFeed");
  
  const simplePriceFeedAbi = [
    "function setPrice(address _token, uint256 _price) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Map of test tokens to their prices
  const tokenPriceMap = {
    TUSD: prices.WLD,   // TUSD price from WLD
    TETH: prices.WETH,  // TETH price from WETH
    TBTC: 40000         // TBTC price (fixed)
  };
  
  // Set prices in SimplePriceFeed
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      const tokenPrice = tokenPriceMap[symbol] || 1.0; // Default to $1 if no mapping
      const priceWithDecimals = getPriceInGmxFormat(tokenPrice);
      
      console.log(`Setting price for ${symbol} (${token.address}) to $${tokenPrice}...`);
      
      // Using setPrice instead of setPrices to avoid batch errors
      const tx = await simplePriceFeed.setPrice(token.address, priceWithDecimals, GAS_OPTIONS);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      try {
        await tx.wait();
        console.log(`✅ Price set successfully for ${symbol}`);
      } catch (error) {
        console.error(`❌ Transaction failed for ${symbol}: ${error.message}`);
        continue;
      }
      
      // Verify price
      try {
        const verifyPrice = await simplePriceFeed.getPrice(token.address);
        console.log(`Verified price for ${symbol}: $${ethers.utils.formatUnits(verifyPrice, 30)}`);
      } catch (error) {
        console.warn(`Could not verify price for ${symbol}: ${error.message}`);
      }
    } catch (error) {
      console.error(`Error setting price for ${symbol}:`, error.message);
    }
  }
  
  // Step 2: Configure VaultPriceFeed to use SimplePriceFeed
  logSection("Step 2: Configure VaultPriceFeed");
  
  const vaultPriceFeedAbi = [
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function priceFeeds(address _token) external view returns (address)",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Set price feeds in VaultPriceFeed
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      console.log(`Configuring price feed for ${symbol} (${token.address})...`);
      
      const tx = await vaultPriceFeed.setPriceFeed(token.address, simplePriceFeedAddress, GAS_OPTIONS);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      try {
        await tx.wait();
        console.log(`✅ Price feed configured successfully for ${symbol}`);
      } catch (error) {
        console.error(`❌ Transaction failed for ${symbol}: ${error.message}`);
        continue;
      }
      
      // Verify price feed
      try {
        const feed = await vaultPriceFeed.priceFeeds(token.address);
        console.log(`Verified price feed for ${symbol}: ${feed}`);
        
        // Check if we can get price
        const price = await vaultPriceFeed.getPrice(token.address, true, false, false);
        console.log(`Verified price from VaultPriceFeed for ${symbol}: $${ethers.utils.formatUnits(price, 30)}`);
      } catch (error) {
        console.warn(`Could not verify price feed for ${symbol}: ${error.message}`);
      }
    } catch (error) {
      console.error(`Error configuring price feed for ${symbol}:`, error.message);
    }
  }
  
  // Step 3: Whitelist tokens in Vault
  logSection("Step 3: Whitelist Tokens in Vault");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address) external view returns (bool)",
    "function tokenWeights(address) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Token configuration map
  const tokenConfigMap = {
    TUSD: {
      decimals: 18,
      weight: 10000,  // 10% weight
      minProfitBps: 75,  // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18),  // 50M max
      isStable: true,
      isShortable: false
    },
    TETH: {
      decimals: 18,
      weight: 20000,  // 20% weight
      minProfitBps: 150,  // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("100000000", 18),  // 100M max
      isStable: false,
      isShortable: true
    },
    TBTC: {
      decimals: 8,
      weight: 20000,  // 20% weight
      minProfitBps: 150,  // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18),  // 50M max
      isStable: false,
      isShortable: true
    }
  };
  
  // Whitelist tokens
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      // Check if already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      const currentWeight = await vault.tokenWeights(token.address);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`⏩ ${symbol} (${token.address}) is already whitelisted with weight ${currentWeight}`);
        continue;
      }
      
      // Get token configuration
      const config = tokenConfigMap[symbol];
      if (!config) {
        console.warn(`No configuration found for ${symbol}, skipping`);
        continue;
      }
      
      console.log(`Whitelisting ${symbol} (${token.address})...`);
      console.log(`Parameters: decimals=${config.decimals}, weight=${config.weight}, ` +
                 `minProfitBps=${config.minProfitBps}, isStable=${config.isStable}, isShortable=${config.isShortable}`);
      
      // Try whitelisting with generous gas
      const gasOptions = {
        gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
        gasLimit: 2000000  // Double the normal limit
      };
      
      const tx = await vault.setTokenConfig(
        token.address,
        config.decimals,
        config.weight,
        config.minProfitBps,
        config.maxUsdgAmount,
        config.isStable,
        config.isShortable,
        gasOptions
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      try {
        await tx.wait();
        console.log(`✅ ${symbol} has been successfully whitelisted!`);
      } catch (error) {
        console.error(`❌ Transaction failed for ${symbol}: ${error.message}`);
        continue;
      }
      
      // Verify whitelisting
      try {
        const verifyWhitelisted = await vault.whitelistedTokens(token.address);
        const verifyWeight = await vault.tokenWeights(token.address);
        console.log(`Verification: ${symbol} whitelisted=${verifyWhitelisted}, weight=${verifyWeight}`);
      } catch (error) {
        console.warn(`Could not verify whitelist status for ${symbol}: ${error.message}`);
      }
    } catch (error) {
      console.error(`Error whitelisting ${symbol}:`, error.message);
    }
  }
  
  // Step 4: Create environment variable file for frontend
  logSection("Step 4: Create Environment Variables for Frontend");
  
  const envContent = `# GMX V1 Environment Variables for World Chain
# Generated on ${new Date().toISOString()}

# Network Configuration
VITE_WORLD_RPC_URL="${WORLD_CHAIN_RPC}"
VITE_CHAIN_ID=480

# Oracle Keeper Configuration
VITE_ORACLE_KEEPER_URL="${ORACLE_KEEPER_URL}"
VITE_USE_PRODUCTION_PRICES=true

# Custom V1 Contract Addresses
VITE_VAULT_ADDRESS="${customData.CustomVault}"
VITE_ROUTER_ADDRESS="${customData.CustomRouter}"
VITE_POSITION_ROUTER_ADDRESS="${customData.CustomPositionRouter || ''}"
VITE_POSITION_MANAGER_ADDRESS="${customData.CustomPositionManager || ''}"
VITE_VAULT_PRICE_FEED_ADDRESS="${customData.CustomVaultPriceFeed || ''}"

# Test Token Addresses
VITE_TUSD_ADDRESS="${testTokens.TUSD?.address || ''}"
VITE_TETH_ADDRESS="${testTokens.TETH?.address || ''}"
VITE_TBTC_ADDRESS="${testTokens.TBTC?.address || ''}"

# Price Feed Configuration
VITE_SIMPLE_PRICE_FEED_ADDRESS="${customData.SimplePriceFeed || ''}"
`;

  const envFilePath = path.join(__dirname, "../../.env.world.custom");
  fs.writeFileSync(envFilePath, envContent);
  console.log(`Created environment file at: ${envFilePath}`);
  
  // Summary check
  logSection("Implementation Summary");
  
  // Check total token weights
  try {
    const totalWeights = await vault.totalTokenWeights();
    console.log(`Total token weights: ${totalWeights.toString()}`);
    
    if (totalWeights.gt(0)) {
      console.log("✅ At least some tokens have been successfully whitelisted!");
    } else {
      console.log("⚠️ No tokens have been whitelisted yet (totalTokenWeights = 0)");
    }
  } catch (error) {
    console.error("Error checking total token weights:", error.message);
  }
  
  // Final instructions
  logSection("Next Steps");
  console.log("1. Copy the generated .env.world.custom file to your frontend project");
  console.log("2. Run your frontend with these environment variables");
  console.log("3. Test token swaps and other GMX V1 functionalities");
  console.log("4. If issues persist, check contract logs and try manual verification");
}

// Execute implementation
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
