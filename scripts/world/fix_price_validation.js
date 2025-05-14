const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Minimal gas settings to work with limited funds
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.1", "gwei"),
  gasLimit: 2000000
};

async function main() {
  console.log("\n=== GMX V1 Price Feed & Whitelisting Fix ===\n");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Load custom deployment data
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get contract addresses
  const vaultAddress = customDeployment.CustomVault;
  const vaultPriceFeedAddress = customDeployment.CustomVaultPriceFeed;
  const simplePriceFeedAddress = customDeployment.SimplePriceFeed;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Test tokens - only try with TUSD first
  const tusd = customDeployment.TestDeployment.tokens.TUSD;
  console.log(`\nWorking with TUSD token: ${tusd.address} (${tusd.decimals} decimals)`);
  
  // === Step 1: Set up SimplePriceFeed with proper prices ===
  console.log("\n--- Step 1: Setting up SimplePriceFeed ---");
  
  const simplePriceFeedAbi = [
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Try to get current price from SimplePriceFeed
  console.log("Checking if price is already set...");
  let simplePriceExists = false;
  
  try {
    const currentPrice = await simplePriceFeed.getPrice(tusd.address);
    console.log(`Current price in SimplePriceFeed: ${ethers.utils.formatUnits(currentPrice, 30)} USD`);
    if (currentPrice.gt(0)) {
      console.log("✅ Price already set in SimplePriceFeed");
      simplePriceExists = true;
    }
  } catch (error) {
    console.log("No price set in SimplePriceFeed yet");
  }
  
  // Set price in SimplePriceFeed if not already set
  if (!simplePriceExists) {
    try {
      const tokenAddresses = [tusd.address];
      const tokenPrices = [ethers.utils.parseUnits("1", 30)]; // $1.00 for TUSD
      
      console.log("Setting TUSD price to $1.00...");
      const tx = await simplePriceFeed.setPrices(tokenAddresses, tokenPrices, GAS_OPTIONS);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        console.log("✅ Price set successfully in SimplePriceFeed");
        
        // Verify the price was set
        const price = await simplePriceFeed.getPrice(tusd.address);
        console.log(`Verified price: ${ethers.utils.formatUnits(price, 30)} USD`);
        simplePriceExists = true;
      } else {
        console.log("❌ Transaction completed but failed");
      }
    } catch (error) {
      console.error(`❌ Failed to set price: ${error.message}`);
    }
  }
  
  if (!simplePriceExists) {
    console.log("⚠️ Could not set or verify price in SimplePriceFeed. Stopping here.");
    return;
  }
  
  // === Step 2: Configure VaultPriceFeed to use SimplePriceFeed ===
  console.log("\n--- Step 2: Configuring VaultPriceFeed ---");
  
  const vaultPriceFeedAbi = [
    "function priceFeeds(address _token) external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)",
    "function getMaxPrice(address _token) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Check current price feed for TUSD
  console.log("Checking current price feed configuration...");
  let feedProperlyConfigured = false;
  
  try {
    const currentFeed = await vaultPriceFeed.priceFeeds(tusd.address);
    console.log(`Current price feed for TUSD: ${currentFeed}`);
    
    if (currentFeed.toLowerCase() === simplePriceFeedAddress.toLowerCase()) {
      console.log("✅ VaultPriceFeed already configured to use SimplePriceFeed");
      feedProperlyConfigured = true;
    } else if (currentFeed !== ethers.constants.AddressZero) {
      console.log("⚠️ VaultPriceFeed is using a different price feed");
      
      // Try to get price from current feed configuration
      try {
        const price = await vaultPriceFeed.getMaxPrice(tusd.address);
        console.log(`Current price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
        console.log("✅ Current feed configuration is working!");
        feedProperlyConfigured = true;
      } catch (error) {
        console.log("❌ Current feed configuration not working properly");
      }
    }
  } catch (error) {
    console.log(`Error checking price feed: ${error.message}`);
  }
  
  // Set SimplePriceFeed as the price feed for TUSD if needed
  if (!feedProperlyConfigured) {
    try {
      console.log(`Setting SimplePriceFeed (${simplePriceFeedAddress}) as price feed for TUSD...`);
      const tx = await vaultPriceFeed.setPriceFeed(tusd.address, simplePriceFeedAddress, GAS_OPTIONS);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        console.log("✅ Price feed set successfully");
        
        // Verify the price feed is working
        try {
          const price = await vaultPriceFeed.getMaxPrice(tusd.address);
          console.log(`Verified price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
          feedProperlyConfigured = true;
        } catch (error) {
          console.log(`❌ Could not verify price after setting feed: ${error.message}`);
        }
      } else {
        console.log("❌ Transaction completed but failed");
      }
    } catch (error) {
      console.error(`❌ Failed to set price feed: ${error.message}`);
    }
  }
  
  if (!feedProperlyConfigured) {
    console.log("⚠️ Could not configure VaultPriceFeed properly. Stopping here.");
    return;
  }
  
  // === Step 3: Whitelist TUSD token in Vault ===
  console.log("\n--- Step 3: Whitelisting TUSD in Vault ---");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function getMaxPrice(address _token) external view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Check if TUSD is already whitelisted
  console.log("Checking if TUSD is already whitelisted...");
  let isWhitelisted = false;
  
  try {
    isWhitelisted = await vault.whitelistedTokens(tusd.address);
    if (isWhitelisted) {
      console.log("✅ TUSD is already whitelisted!");
      
      // Check token decimals
      const decimals = await vault.tokenDecimals(tusd.address);
      console.log(`TUSD registered decimals: ${decimals}`);
      console.log("No further action needed");
    } else {
      console.log("TUSD is not yet whitelisted");
    }
  } catch (error) {
    console.log(`Error checking whitelist status: ${error.message}`);
  }
  
  // Very important: First verify Vault can access price data
  if (!isWhitelisted) {
    console.log("\nVerifying Vault can access price data (critical for whitelisting)...");
    
    try {
      const price = await vault.getMaxPrice(tusd.address);
      console.log(`Vault reports TUSD price as: ${ethers.utils.formatUnits(price, 30)} USD`);
      console.log("✅ Vault can access price data!");
      
      // Now attempt to whitelist the token
      console.log("\nAttempting to whitelist TUSD...");
      
      try {
        // Token configuration
        const tokenConfig = {
          token: tusd.address,
          decimals: tusd.decimals,
          weight: 10000, // 10% weight
          minProfitBps: 75, // 0.75% min profit basis points
          maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M max USDG
          isStable: true,
          isShortable: false
        };
        
        const tx = await vault.setTokenConfig(
          tokenConfig.token,
          tokenConfig.decimals,
          tokenConfig.weight,
          tokenConfig.minProfitBps,
          tokenConfig.maxUsdgAmount,
          tokenConfig.isStable,
          tokenConfig.isShortable,
          GAS_OPTIONS
        );
        
        console.log(`Transaction submitted: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          console.log("✅ TUSD successfully whitelisted!");
          
          // Verify whitelisting
          isWhitelisted = await vault.whitelistedTokens(tusd.address);
          console.log(`TUSD whitelist status: ${isWhitelisted ? "Whitelisted" : "Not whitelisted"}`);
          
          if (isWhitelisted) {
            // Check token decimals
            const decimals = await vault.tokenDecimals(tusd.address);
            console.log(`TUSD registered decimals: ${decimals}`);
          }
        } else {
          console.log("❌ Transaction completed but failed");
        }
      } catch (error) {
        console.error(`❌ Whitelisting failed: ${error.message}`);
      }
    } catch (error) {
      console.log(`❌ Vault cannot access price data: ${error.message}`);
      console.log("\nThis is the critical error blocking token whitelisting!");
      console.log("The transaction is reverting because the price feed validation fails at the end of setTokenConfig()");
    }
  }
  
  // === Step 4: Summary and Frontend Integration ===
  console.log("\n--- Step 4: Summary and Frontend Integration ---");
  
  if (isWhitelisted) {
    console.log("✅ TUSD is whitelisted and ready for use!");
    console.log("\nFrontend Integration:");
    console.log("1. Use the custom deployment contract addresses");
    console.log("2. Create a .env file with the following contents:");
    console.log(`VITE_WORLD_RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/`);
    console.log(`VITE_VAULT_ADDRESS=${vaultAddress}`);
    console.log(`VITE_ROUTER_ADDRESS=${customDeployment.CustomRouter}`);
    console.log("3. Implement direct Oracle Keeper integration for additional price data");
  } else {
    console.log("⚠️ TUSD whitelisting could not be completed");
    console.log("\nRecommended Frontend Approach:");
    console.log("1. Implement read-only UI connected to custom deployment contracts");
    console.log("2. Use Oracle Keeper for price data display");
    console.log("3. Show 'Coming Soon' for trading functionality");
    console.log("4. Try to diagnose VaultPriceFeed and SimplePriceFeed integration");
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
