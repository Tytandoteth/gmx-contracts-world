const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Recommended gas price and limit to avoid estimation issues
const gasOptions = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 5000000
};

async function main() {
  console.log("=".repeat(80));
  console.log("GMX V1 Price Feed Fix - World Chain");
  console.log("=".repeat(80));
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Get deployment data
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Contract addresses
  const vaultAddress = deploymentData.CustomVault;
  const vaultPriceFeedAddress = deploymentData.CustomVaultPriceFeed;
  const simplePriceFeedAddress = deploymentData.SimplePriceFeed;
  
  console.log(`\nContract Addresses:`);
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Test tokens
  const testTokens = deploymentData.TestDeployment.tokens;
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // 1. First, let's reset the SimplePriceFeed with correct prices
  console.log("\nStep 1: Setting prices in SimplePriceFeed...");
  
  const simplePriceFeedAbi = [
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Set prices for all test tokens (all in 1e30 format as per GMX V1 standard)
  const tokenAddresses = [];
  const tokenPrices = [];
  
  // Default prices for test tokens (in USD)
  const defaultPrices = {
    TUSD: 1.0,       // Stablecoin
    TBTC: 60000.0,   // Example BTC price
    TETH: 3000.0     // Example ETH price
  };
  
  Object.entries(testTokens).forEach(([symbol, token]) => {
    tokenAddresses.push(token.address);
    // Convert price to 1e30 format (GMX V1 standard)
    const price = ethers.utils.parseUnits(defaultPrices[symbol].toString(), 30);
    tokenPrices.push(price);
    console.log(`- Setting ${symbol} price: $${defaultPrices[symbol]} (${price.toString()})`);
  });
  
  try {
    // Set prices in SimplePriceFeed
    const setPricesTx = await simplePriceFeed.setPrices(
      tokenAddresses,
      tokenPrices,
      gasOptions
    );
    console.log(`SimplePriceFeed setPrices transaction: ${setPricesTx.hash}`);
    await setPricesTx.wait();
    console.log("✅ Prices set successfully in SimplePriceFeed");
    
    // Verify prices
    for (const [symbol, token] of Object.entries(testTokens)) {
      try {
        const price = await simplePriceFeed.getPrice(token.address);
        console.log(`- ${symbol} price in SimplePriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
      } catch (error) {
        console.error(`- Error getting ${symbol} price: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error setting prices in SimplePriceFeed: ${error.message}`);
    // Continue to next step regardless of error
  }
  
  // 2. Next, properly configure VaultPriceFeed to use SimplePriceFeed
  console.log("\nStep 2: Configuring VaultPriceFeed...");
  
  const vaultPriceFeedAbi = [
    "function gov() external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function priceFeeds(address _token) external view returns (address)",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)",
    "function setTokenConfig(address _token, bool _isStrictStable) external",
    "function isSecondaryPriceEnabled() external view returns (bool)",
    "function setSecondaryPriceEnabled(bool _isEnabled) external",
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Ensure secondary price is disabled (GMX specific)
  try {
    const isSecondaryEnabled = await vaultPriceFeed.isSecondaryPriceEnabled();
    if (isSecondaryEnabled) {
      console.log("- Disabling secondary price...");
      const setSecondaryTx = await vaultPriceFeed.setSecondaryPriceEnabled(false, gasOptions);
      await setSecondaryTx.wait();
      console.log("✅ Secondary price disabled");
    } else {
      console.log("✅ Secondary price already disabled");
    }
  } catch (error) {
    console.error(`❌ Error checking/setting secondary price: ${error.message}`);
  }
  
  // Configure price feeds for each token
  for (const [symbol, token] of Object.entries(testTokens)) {
    console.log(`\nConfiguring VaultPriceFeed for ${symbol}...`);
    
    try {
      // Check current price feed
      const currentFeed = await vaultPriceFeed.priceFeeds(token.address);
      console.log(`- Current price feed for ${symbol}: ${currentFeed}`);
      
      // Set price feed to SimplePriceFeed
      console.log(`- Setting price feed to SimplePriceFeed (${simplePriceFeedAddress})...`);
      const setPriceFeedTx = await vaultPriceFeed.setPriceFeed(
        token.address,
        simplePriceFeedAddress,
        gasOptions
      );
      console.log(`VaultPriceFeed setPriceFeed transaction: ${setPriceFeedTx.hash}`);
      await setPriceFeedTx.wait();
      console.log(`✅ Price feed set for ${symbol}`);
      
      // Set token config
      const isStablecoin = symbol === "TUSD";
      console.log(`- Setting token config (isStrictStable: ${isStablecoin})...`);
      const setTokenConfigTx = await vaultPriceFeed.setTokenConfig(
        token.address,
        isStablecoin,
        gasOptions
      );
      console.log(`VaultPriceFeed setTokenConfig transaction: ${setTokenConfigTx.hash}`);
      await setTokenConfigTx.wait();
      console.log(`✅ Token config set for ${symbol}`);
      
      // Verify price
      try {
        const price = await vaultPriceFeed.getPrice(token.address, true, false, false);
        console.log(`- ${symbol} price in VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
      } catch (error) {
        console.error(`- ❌ Error getting ${symbol} price from VaultPriceFeed: ${error.message}`);
      }
    } catch (error) {
      console.error(`❌ Error configuring price feed for ${symbol}: ${error.message}`);
    }
  }
  
  // 3. Prepare direct vault token whitelisting with correct decimals
  console.log("\nStep 3: Preparing for Vault token whitelisting...");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function totalTokenWeights() external view returns (uint256)",
    "function priceFeed() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Verify vault setup before attempting whitelisting
  const registeredPriceFeed = await vault.priceFeed();
  console.log(`- Vault registered price feed: ${registeredPriceFeed}`);
  console.log(`- Expected VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- Match: ${registeredPriceFeed.toLowerCase() === vaultPriceFeedAddress.toLowerCase()}`);
  
  const totalTokenWeights = await vault.totalTokenWeights();
  console.log(`- Total token weights before whitelisting: ${totalTokenWeights}`);
  
  console.log("\nPrice feed configuration complete. Ready for token whitelisting.");
  console.log("Proceed to run the whitelisting script after this fix is applied.");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
