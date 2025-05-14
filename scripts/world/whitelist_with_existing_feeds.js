const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Gas options to avoid estimation errors
const gasOptions = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 5000000
};

async function main() {
  console.log("=".repeat(80));
  console.log("GMX V1 Token Whitelisting with Existing Price Feeds - World Chain");
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
  
  console.log(`\nContract Addresses:`);
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  
  // Test tokens
  const testTokens = deploymentData.TestDeployment.tokens;
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // Step 1: Analyze the existing price feed setup
  console.log("\nStep 1: Analyzing existing price feed setup...");
  
  const vaultPriceFeedAbi = [
    "function priceFeeds(address _token) external view returns (address)",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)",
    "function getLatestPrimaryPrice(address _token) external view returns (uint256)",
    "function adjustmentBasisPoints(address _token) external view returns (uint256)",
    "function isAdjustmentAdditive(address _token) external view returns (bool)",
    "function setAdjustment(address _token, bool _isAdditive, uint256 _adjustmentBps) external"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Analyze each token's price feed
  const tokenPriceInfo = {};
  
  for (const [symbol, token] of Object.entries(testTokens)) {
    console.log(`\nAnalyzing price feed for ${symbol}...`);
    
    try {
      // Check existing price feed address
      const priceFeedAddress = await vaultPriceFeed.priceFeeds(token.address);
      console.log(`- Price feed address: ${priceFeedAddress}`);
      
      // Check if there are adjustments
      const adjustmentBps = await vaultPriceFeed.adjustmentBasisPoints(token.address);
      const isAdjustmentAdditive = await vaultPriceFeed.isAdjustmentAdditive(token.address);
      console.log(`- Adjustment: ${isAdjustmentAdditive ? '+' : '-'}${adjustmentBps} bps`);
      
      // Try to get the primary price
      let price;
      let priceActive = false;
      try {
        price = await vaultPriceFeed.getLatestPrimaryPrice(token.address);
        priceActive = true;
        console.log(`- Primary price: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
      } catch (error) {
        console.log(`- No primary price available ❌: ${error.message.slice(0, 100)}...`);
      }
      
      // Try to get the full price
      try {
        const fullPrice = await vaultPriceFeed.getPrice(token.address, true, false, false);
        priceActive = true;
        console.log(`- Full price: ${ethers.utils.formatUnits(fullPrice, 30)} USD ✅`);
      } catch (error) {
        console.log(`- No full price available ❌: ${error.message.slice(0, 100)}...`);
      }
      
      // Store information
      tokenPriceInfo[symbol] = {
        address: token.address,
        decimals: token.decimals,
        priceFeedAddress,
        priceActive,
        adjustmentBps
      };
    } catch (error) {
      console.error(`Error analyzing ${symbol}: ${error.message}`);
    }
  }
  
  // Step 2: Check if we can use existing price feeds
  console.log("\nStep 2: Verifying price data availability...");
  
  // Try setting price adjustments if needed
  for (const [symbol, info] of Object.entries(tokenPriceInfo)) {
    if (!info.priceActive && info.priceFeedAddress !== ethers.constants.AddressZero) {
      console.log(`\nAttempting to set adjustment for ${symbol}...`);
      
      try {
        // Set a 0% adjustment to trigger price feed activation
        const tx = await vaultPriceFeed.setAdjustment(
          info.address,
          true, // additive
          0,    // 0 basis points
          gasOptions
        );
        console.log(`- Adjustment transaction: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Adjustment set for ${symbol}`);
        
        // Try to get the price again
        try {
          const price = await vaultPriceFeed.getPrice(info.address, true, false, false);
          console.log(`- Price after adjustment: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
          tokenPriceInfo[symbol].priceActive = true;
        } catch (error) {
          console.log(`- Still no price available after adjustment ❌`);
        }
      } catch (error) {
        console.error(`❌ Error setting adjustment for ${symbol}: ${error.message.slice(0, 100)}...`);
      }
    } else if (info.priceActive) {
      console.log(`✅ ${symbol} already has active price data`);
    } else {
      console.log(`❌ ${symbol} has no price feed and cannot be activated`);
    }
  }
  
  // Step 3: Proceed with token whitelisting
  console.log("\nStep 3: Attempting token whitelisting...");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function priceFeed() external view returns (address)",
    "function approvedRouters(address _router) external view returns (bool)",
    "function setIsSwapEnabled(bool _isSwapEnabled) external",
    "function setUsdgAmount(address _token, uint256 _amount) external",
    "function totalTokenWeights() external view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Double-check that the vault is using the correct price feed
  const registeredPriceFeed = await vault.priceFeed();
  console.log(`- Vault price feed: ${registeredPriceFeed}`);
  console.log(`- VaultPriceFeed address: ${vaultPriceFeedAddress}`);
  console.log(`- Match: ${registeredPriceFeed.toLowerCase() === vaultPriceFeedAddress.toLowerCase()}`);
  
  // Verify existing token weights
  const totalTokenWeights = await vault.totalTokenWeights();
  console.log(`- Total token weights before whitelisting: ${totalTokenWeights}`);
  
  // Only whitelist tokens with active price data
  let totalWhitelistAttempts = 0;
  let successfulWhitelists = 0;
  
  // Set up token parameters
  const tokenConfigs = {
    TUSD: {
      weight: 10000,        // 10% allocation
      minProfitBps: 75,     // 0.75% min profit
      maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M max
      isStable: true,
      isShortable: false
    },
    TBTC: {
      weight: 20000,        // 20% allocation
      minProfitBps: 150,    // 1.5% min profit
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M max
      isStable: false,
      isShortable: true
    },
    TETH: {
      weight: 20000,        // 20% allocation
      minProfitBps: 150,    // 1.5% min profit
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M max
      isStable: false,
      isShortable: true
    }
  };
  
  // Try to whitelist each token that has active price data
  for (const [symbol, info] of Object.entries(tokenPriceInfo)) {
    if (!info.priceActive) {
      console.log(`\nSkipping ${symbol} whitelisting due to inactive price feed...`);
      continue;
    }
    
    console.log(`\nAttempting to whitelist ${symbol}...`);
    
    // Check if already whitelisted
    try {
      const isWhitelisted = await vault.whitelistedTokens(info.address);
      if (isWhitelisted) {
        console.log(`✅ ${symbol} is already whitelisted`);
        successfulWhitelists++;
        continue;
      }
    } catch (error) {
      console.log(`Error checking whitelist status: ${error.message.slice(0, 100)}...`);
    }
    
    // Get token config
    const config = tokenConfigs[symbol];
    
    // Try whitelisting with more debugging
    try {
      console.log(`Setting token config for ${symbol} with parameters:`);
      console.log(`- Decimals: ${info.decimals}`);
      console.log(`- Weight: ${config.weight}`);
      console.log(`- Min Profit Bps: ${config.minProfitBps}`);
      console.log(`- Max USDG Amount: ${ethers.utils.formatUnits(config.maxUsdgAmount, 18)}`);
      console.log(`- Is Stable: ${config.isStable}`);
      console.log(`- Is Shortable: ${config.isShortable}`);
      
      // First, let's try to estimate gas to get a better error message if available
      try {
        const gasEstimate = await vault.estimateGas.setTokenConfig(
          info.address,
          info.decimals,
          config.weight,
          config.minProfitBps,
          config.maxUsdgAmount,
          config.isStable,
          config.isShortable
        );
        console.log(`Gas estimation succeeded: ${gasEstimate.toString()}`);
      } catch (error) {
        console.log(`Gas estimation failed: ${error.message}`);
        
        // Check if the error message contains useful information
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("price feed")) {
          console.log("- Issue appears to be with price feed configuration");
        } else if (errorMsg.includes("invalid")) {
          console.log("- Issue appears to be with invalid parameters");
        } else if (errorMsg.includes("permission") || errorMsg.includes("gov")) {
          console.log("- Issue appears to be with permissions");
        }
      }
      
      // Try the actual whitelisting with higher gas
      const tx = await vault.setTokenConfig(
        info.address,
        info.decimals,
        config.weight,
        config.minProfitBps,
        config.maxUsdgAmount,
        config.isStable,
        config.isShortable,
        {
          gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
          gasLimit: 8000000 // Much higher gas limit for debugging
        }
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for the transaction with longer timeout
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Successfully whitelisted ${symbol}`);
        successfulWhitelists++;
      } else {
        console.log(`❌ Transaction completed but failed for ${symbol}`);
      }
      
      // Verify whitelisting status
      const isWhitelisted = await vault.whitelistedTokens(info.address);
      console.log(`- Verification: ${symbol} is${isWhitelisted ? '' : ' not'} whitelisted`);
      
      if (isWhitelisted) {
        const decimals = await vault.tokenDecimals(info.address);
        console.log(`- Registered decimals: ${decimals}`);
      }
    } catch (error) {
      console.error(`❌ Whitelisting failed for ${symbol}: ${error.message}`);
      
      // Analyze common error patterns in GMX V1
      if (error.message.includes("Price feed not found")) {
        console.log("  → Error due to missing price feed configuration");
      } else if (error.message.includes("Price not available")) {
        console.log("  → Error due to price not being available from feed");
      } else if (error.message.includes("unauthorized")) {
        console.log("  → Error due to permission issues");
      } else if (error.message.includes("Invalid")) {
        console.log("  → Error due to invalid parameter values");
      }
    }
    
    totalWhitelistAttempts++;
  }
  
  // Final report
  console.log("\n=== Final Whitelisting Report ===");
  console.log(`Total whitelist attempts: ${totalWhitelistAttempts}`);
  console.log(`Successful whitelists: ${successfulWhitelists}`);
  
  // Re-check total token weights
  const finalTokenWeights = await vault.totalTokenWeights();
  console.log(`Final total token weights: ${finalTokenWeights}`);
  
  if (finalTokenWeights.gt(0)) {
    console.log("✅ Token whitelisting partially or fully successful!");
  } else {
    console.log("❌ No tokens were successfully whitelisted");
  }
  
  console.log("\nNext steps based on results:");
  console.log("1. If whitelisting failed, consider examining deployed contract code");
  console.log("2. Verify contract deployment addresses and governance permissions");
  console.log("3. Consider using the standard deployment contracts instead of custom ones");
  console.log("4. Try direct integration with Oracle Keeper for frontend");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
