const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Conservative gas settings
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 3000000
};

async function main() {
  console.log("\n=== GMX V1 Price Feed System Rebuild ===\n");
  
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
  const routerAddress = customDeployment.CustomRouter;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  console.log(`- Router: ${routerAddress}`);
  
  // Get test tokens
  const testTokens = customDeployment.TestDeployment.tokens;
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // Approach: Start from zero - read the complete state of contracts
  // and rebuild the price feed structure
  
  // We'll focus on TUSD first, then extend to other tokens if successful
  const tusd = testTokens.TUSD;
  
  // Stage 1: Full diagnostic of contract states
  console.log("\n=== STAGE 1: FULL DIAGNOSTIC ===");
  
  // 1.1 SimplePriceFeed diagnostic
  console.log("\n--- SimplePriceFeed Diagnostic ---");
  
  const simplePriceFeedAbi = [
    "function owner() external view returns (address)",
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  try {
    // Check SimplePriceFeed owner
    const spfOwner = await simplePriceFeed.owner();
    console.log(`SimplePriceFeed owner: ${spfOwner}`);
    console.log(`Are you the owner? ${spfOwner.toLowerCase() === deployer.address.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check if TUSD price exists
    try {
      const tusdPrice = await simplePriceFeed.getPrice(tusd.address);
      console.log(`TUSD price in SimplePriceFeed: ${ethers.utils.formatUnits(tusdPrice, 30)} USD`);
    } catch (error) {
      console.log(`No TUSD price in SimplePriceFeed: ${error.message.slice(0, 100)}...`);
    }
  } catch (error) {
    console.error(`Error diagnosing SimplePriceFeed: ${error.message}`);
  }
  
  // 1.2 VaultPriceFeed diagnostic
  console.log("\n--- VaultPriceFeed Diagnostic ---");
  
  const vaultPriceFeedAbi = [
    "function gov() external view returns (address)",
    "function isInitialized() external view returns (bool)",
    "function priceFeeds(address _token) external view returns (address)",
    "function strictStableTokens(address _token) external view returns (bool)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function setIsAmmEnabled(bool _isEnabled) external",
    "function setIsSecondaryPriceEnabled(bool _isEnabled) external",
    "function setTokenConfig(address _token, bool _isStrictStable) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)",
    "function getMaxPrice(address _token) external view returns (uint256)",
    "function getMinPrice(address _token) external view returns (uint256)",
    "function isAmmEnabled() external view returns (bool)",
    "function isSecondaryPriceEnabled() external view returns (bool)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  try {
    // Check VaultPriceFeed governance
    const vpfGov = await vaultPriceFeed.gov();
    console.log(`VaultPriceFeed gov: ${vpfGov}`);
    console.log(`Are you the governor? ${vpfGov.toLowerCase() === deployer.address.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check if initialized
    const vpfInitialized = await vaultPriceFeed.isInitialized();
    console.log(`VaultPriceFeed initialized: ${vpfInitialized ? 'Yes ✅' : 'No ❌'}`);
    
    // Check AMM and secondary price settings
    const isAmmEnabled = await vaultPriceFeed.isAmmEnabled();
    console.log(`AMM enabled: ${isAmmEnabled ? 'Yes' : 'No'}`);
    
    const isSecondaryPriceEnabled = await vaultPriceFeed.isSecondaryPriceEnabled();
    console.log(`Secondary price enabled: ${isSecondaryPriceEnabled ? 'Yes' : 'No'}`);
    
    // Check TUSD price feed
    const tusdPriceFeed = await vaultPriceFeed.priceFeeds(tusd.address);
    console.log(`TUSD price feed in VaultPriceFeed: ${tusdPriceFeed}`);
    console.log(`Is SimplePriceFeed? ${tusdPriceFeed.toLowerCase() === simplePriceFeedAddress.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check if TUSD is strict stable
    const isStrictStable = await vaultPriceFeed.strictStableTokens(tusd.address);
    console.log(`TUSD is strict stable: ${isStrictStable ? 'Yes' : 'No'}`);
    
    // Try to get TUSD price from VaultPriceFeed
    try {
      const tusdMaxPrice = await vaultPriceFeed.getMaxPrice(tusd.address);
      console.log(`TUSD max price in VaultPriceFeed: ${ethers.utils.formatUnits(tusdMaxPrice, 30)} USD ✅`);
    } catch (error) {
      console.log(`Could not get TUSD max price from VaultPriceFeed: ${error.message.slice(0, 100)}... ❌`);
    }
    
    try {
      const tusdMinPrice = await vaultPriceFeed.getMinPrice(tusd.address);
      console.log(`TUSD min price in VaultPriceFeed: ${ethers.utils.formatUnits(tusdMinPrice, 30)} USD ✅`);
    } catch (error) {
      console.log(`Could not get TUSD min price from VaultPriceFeed: ${error.message.slice(0, 100)}... ❌`);
    }
  } catch (error) {
    console.error(`Error diagnosing VaultPriceFeed: ${error.message}`);
  }
  
  // 1.3 Vault diagnostic
  console.log("\n--- Vault Diagnostic ---");
  
  const vaultAbi = [
    "function gov() external view returns (address)",
    "function isInitialized() external view returns (bool)",
    "function inManagerMode() external view returns (bool)",
    "function isSwapEnabled() external view returns (bool)",
    "function isLeverageEnabled() external view returns (bool)",
    "function priceFeed() external view returns (address)",
    "function router() external view returns (address)",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function tokenWeights(address _token) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)",
    "function allWhitelistedTokens(uint256 _index) external view returns (address)",
    "function stableTokens(address _token) external view returns (bool)",
    "function shortableTokens(address _token) external view returns (bool)",
    "function getMaxPrice(address _token) external view returns (uint256)",
    "function getMinPrice(address _token) external view returns (uint256)",
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  try {
    // Check Vault governance
    const vaultGov = await vault.gov();
    console.log(`Vault gov: ${vaultGov}`);
    console.log(`Are you the governor? ${vaultGov.toLowerCase() === deployer.address.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check if initialized
    const vaultInitialized = await vault.isInitialized();
    console.log(`Vault initialized: ${vaultInitialized ? 'Yes ✅' : 'No ❌'}`);
    
    // Check modes
    const inManagerMode = await vault.inManagerMode();
    console.log(`Manager mode: ${inManagerMode ? 'Yes' : 'No'}`);
    
    const isSwapEnabled = await vault.isSwapEnabled();
    console.log(`Swap enabled: ${isSwapEnabled ? 'Yes' : 'No'}`);
    
    const isLeverageEnabled = await vault.isLeverageEnabled();
    console.log(`Leverage enabled: ${isLeverageEnabled ? 'Yes' : 'No'}`);
    
    // Check price feed
    const vaultPriceFeedRegistered = await vault.priceFeed();
    console.log(`Vault price feed: ${vaultPriceFeedRegistered}`);
    console.log(`Matches VaultPriceFeed? ${vaultPriceFeedRegistered.toLowerCase() === vaultPriceFeedAddress.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check router
    const vaultRouter = await vault.router();
    console.log(`Vault router: ${vaultRouter}`);
    console.log(`Matches Router? ${vaultRouter.toLowerCase() === routerAddress.toLowerCase() ? 'Yes ✅' : 'No ❌'}`);
    
    // Check TUSD whitelist status
    const tusdWhitelisted = await vault.whitelistedTokens(tusd.address);
    console.log(`TUSD whitelisted: ${tusdWhitelisted ? 'Yes ✅' : 'No ❌'}`);
    
    // Check token weights
    const totalWeights = await vault.totalTokenWeights();
    console.log(`Total token weights: ${totalWeights}`);
    
    if (tusdWhitelisted) {
      // Check TUSD configuration
      const tusdDecimals = await vault.tokenDecimals(tusd.address);
      console.log(`TUSD decimals in Vault: ${tusdDecimals}`);
      
      const tusdWeight = await vault.tokenWeights(tusd.address);
      console.log(`TUSD weight: ${tusdWeight}`);
      
      const tusdStable = await vault.stableTokens(tusd.address);
      console.log(`TUSD is stable: ${tusdStable ? 'Yes' : 'No'}`);
      
      const tusdShortable = await vault.shortableTokens(tusd.address);
      console.log(`TUSD is shortable: ${tusdShortable ? 'Yes' : 'No'}`);
    }
    
    // Try to get TUSD price from Vault
    try {
      const tusdMaxPrice = await vault.getMaxPrice(tusd.address);
      console.log(`TUSD max price in Vault: ${ethers.utils.formatUnits(tusdMaxPrice, 30)} USD ✅`);
    } catch (error) {
      console.log(`Could not get TUSD max price from Vault: ${error.message.slice(0, 100)}... ❌`);
    }
  } catch (error) {
    console.error(`Error diagnosing Vault: ${error.message}`);
  }
  
  // Stage 2: Implement the fix based on diagnostic results
  console.log("\n=== STAGE 2: IMPLEMENTING FIX ===");
  
  // 2.1 First fix SimplePriceFeed
  console.log("\n--- Fixing SimplePriceFeed ---");
  
  let simplePriceFeedFixed = false;
  
  try {
    // Try to get current TUSD price
    let tusdCurrentPrice;
    try {
      tusdCurrentPrice = await simplePriceFeed.getPrice(tusd.address);
      console.log(`Current TUSD price: ${ethers.utils.formatUnits(tusdCurrentPrice, 30)} USD`);
      
      if (tusdCurrentPrice.gt(0)) {
        console.log("✅ TUSD price already set in SimplePriceFeed");
        simplePriceFeedFixed = true;
      }
    } catch (error) {
      console.log("No TUSD price set in SimplePriceFeed yet");
    }
    
    if (!simplePriceFeedFixed) {
      console.log("Setting TUSD price in SimplePriceFeed...");
      
      const tokenAddresses = [tusd.address];
      const tokenPrices = [ethers.utils.parseUnits("1", 30)]; // $1.00 for TUSD
      
      const tx = await simplePriceFeed.setPrices(tokenAddresses, tokenPrices, GAS_OPTIONS);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        console.log("✅ TUSD price set successfully");
        
        // Verify the price was set
        try {
          const newPrice = await simplePriceFeed.getPrice(tusd.address);
          console.log(`Verified TUSD price: ${ethers.utils.formatUnits(newPrice, 30)} USD`);
          simplePriceFeedFixed = true;
        } catch (error) {
          console.log(`❌ Could not verify price after setting: ${error.message}`);
        }
      } else {
        console.log("❌ Transaction completed but failed");
      }
    }
  } catch (error) {
    console.error(`Error fixing SimplePriceFeed: ${error.message}`);
  }
  
  if (!simplePriceFeedFixed) {
    console.log("❌ Could not fix SimplePriceFeed. Stopping here.");
    return;
  }
  
  // 2.2 Next fix VaultPriceFeed
  console.log("\n--- Fixing VaultPriceFeed ---");
  
  let vaultPriceFeedFixed = false;
  
  try {
    // Check if TUSD price feed is already set correctly
    const currentFeed = await vaultPriceFeed.priceFeeds(tusd.address);
    
    if (currentFeed.toLowerCase() === simplePriceFeedAddress.toLowerCase()) {
      console.log("✅ TUSD price feed already set to SimplePriceFeed");
      
      // Try to get price to verify it's working
      try {
        const price = await vaultPriceFeed.getMaxPrice(tusd.address);
        console.log(`TUSD price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
        console.log("✅ VaultPriceFeed already properly configured");
        vaultPriceFeedFixed = true;
      } catch (error) {
        console.log("❌ Price feed set but not working properly");
      }
    }
    
    if (!vaultPriceFeedFixed) {
      // Fix VaultPriceFeed settings
      console.log("Configuring VaultPriceFeed...");
      
      // Step 1: Disable AMM and secondary price if enabled
      if (await vaultPriceFeed.isAmmEnabled()) {
        console.log("Disabling AMM...");
        const tx1 = await vaultPriceFeed.setIsAmmEnabled(false, GAS_OPTIONS);
        await tx1.wait();
        console.log("✅ AMM disabled");
      }
      
      if (await vaultPriceFeed.isSecondaryPriceEnabled()) {
        console.log("Disabling secondary price...");
        const tx2 = await vaultPriceFeed.setIsSecondaryPriceEnabled(false, GAS_OPTIONS);
        await tx2.wait();
        console.log("✅ Secondary price disabled");
      }
      
      // Step 2: Set TUSD price feed to SimplePriceFeed
      console.log(`Setting TUSD price feed to SimplePriceFeed (${simplePriceFeedAddress})...`);
      const tx3 = await vaultPriceFeed.setPriceFeed(tusd.address, simplePriceFeedAddress, GAS_OPTIONS);
      await tx3.wait();
      console.log("✅ TUSD price feed set");
      
      // Step 3: Configure TUSD as strict stable
      console.log("Setting TUSD as strict stable...");
      const tx4 = await vaultPriceFeed.setTokenConfig(tusd.address, true, GAS_OPTIONS);
      await tx4.wait();
      console.log("✅ TUSD configured as strict stable");
      
      // Verify price feed is now working
      try {
        const maxPrice = await vaultPriceFeed.getMaxPrice(tusd.address);
        console.log(`TUSD max price after fix: ${ethers.utils.formatUnits(maxPrice, 30)} USD`);
        
        const minPrice = await vaultPriceFeed.getMinPrice(tusd.address);
        console.log(`TUSD min price after fix: ${ethers.utils.formatUnits(minPrice, 30)} USD`);
        
        vaultPriceFeedFixed = true;
        console.log("✅ VaultPriceFeed successfully fixed");
      } catch (error) {
        console.log(`❌ VaultPriceFeed still not working after fix: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error fixing VaultPriceFeed: ${error.message}`);
  }
  
  if (!vaultPriceFeedFixed) {
    console.log("❌ Could not fix VaultPriceFeed. Stopping here.");
    return;
  }
  
  // 2.3 Finally whitelist TUSD in Vault
  console.log("\n--- Whitelisting TUSD in Vault ---");
  
  try {
    // Check if TUSD is already whitelisted
    const alreadyWhitelisted = await vault.whitelistedTokens(tusd.address);
    
    if (alreadyWhitelisted) {
      console.log("✅ TUSD is already whitelisted in Vault");
    } else {
      console.log("Whitelisting TUSD...");
      
      // First, verify Vault can get price data
      try {
        const vaultPrice = await vault.getMaxPrice(tusd.address);
        console.log(`TUSD price from Vault: ${ethers.utils.formatUnits(vaultPrice, 30)} USD`);
        console.log("✅ Vault can access price data");
        
        // Now whitelist TUSD
        console.log("Sending whitelist transaction...");
        
        const tx = await vault.setTokenConfig(
          tusd.address,       // token
          tusd.decimals,      // decimals
          10000,              // weight (10%)
          75,                 // minProfitBps (0.75%)
          ethers.utils.parseUnits("10000000", 18), // maxUsdgAmount ($10M)
          true,               // isStable
          false,              // isShortable
          GAS_OPTIONS
        );
        
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          console.log("✅ TUSD successfully whitelisted!");
          
          // Verify token is whitelisted and properly configured
          const isWhitelisted = await vault.whitelistedTokens(tusd.address);
          console.log(`TUSD is whitelisted: ${isWhitelisted ? 'Yes ✅' : 'No ❌'}`);
          
          if (isWhitelisted) {
            const decimals = await vault.tokenDecimals(tusd.address);
            console.log(`TUSD decimals in Vault: ${decimals}`);
            
            const weight = await vault.tokenWeights(tusd.address);
            console.log(`TUSD weight: ${weight}`);
            
            const isStable = await vault.stableTokens(tusd.address);
            console.log(`TUSD is stable: ${isStable ? 'Yes' : 'No'}`);
          }
        } else {
          console.log("❌ Transaction completed but failed");
        }
      } catch (error) {
        console.log(`❌ Vault cannot access price data: ${error.message}`);
        console.log("Transaction will likely fail because the price feed validation at the end of setTokenConfig() will fail");
      }
    }
  } catch (error) {
    console.error(`Error whitelisting TUSD: ${error.message}`);
  }
  
  // Stage 3: If successful with TUSD, try other tokens
  console.log("\n=== STAGE 3: EXTENDING TO OTHER TOKENS ===");
  
  // Check if TUSD is whitelisted to determine if we should proceed
  const tusdWhitelisted = await vault.whitelistedTokens(tusd.address);
  
  if (!tusdWhitelisted) {
    console.log("❌ TUSD whitelisting was not successful. Not proceeding with other tokens.");
    return;
  }
  
  // Process other tokens
  const otherTokens = {
    TBTC: {
      ...testTokens.TBTC,
      price: ethers.utils.parseUnits("60000", 30), // $60,000 for BTC
      weight: 20000, // 20%
      minProfitBps: 150, // 1.5%
      isStable: false,
      isShortable: true
    },
    TETH: {
      ...testTokens.TETH,
      price: ethers.utils.parseUnits("3000", 30), // $3,000 for ETH
      weight: 20000, // 20%
      minProfitBps: 150, // 1.5%
      isStable: false,
      isShortable: true
    }
  };
  
  for (const [symbol, token] of Object.entries(otherTokens)) {
    console.log(`\n--- Processing ${symbol} ---`);
    
    try {
      // 1. Set price in SimplePriceFeed
      console.log(`Setting ${symbol} price in SimplePriceFeed...`);
      const setPriceTx = await simplePriceFeed.setPrices(
        [token.address],
        [token.price],
        GAS_OPTIONS
      );
      await setPriceTx.wait();
      console.log(`✅ ${symbol} price set in SimplePriceFeed`);
      
      // 2. Configure in VaultPriceFeed
      console.log(`Configuring ${symbol} in VaultPriceFeed...`);
      
      // Set price feed
      const setPriceFeedTx = await vaultPriceFeed.setPriceFeed(
        token.address,
        simplePriceFeedAddress,
        GAS_OPTIONS
      );
      await setPriceFeedTx.wait();
      console.log(`✅ ${symbol} price feed set`);
      
      // Set token config
      const setTokenConfigTx = await vaultPriceFeed.setTokenConfig(
        token.address,
        token.isStable, // isStrictStable
        GAS_OPTIONS
      );
      await setTokenConfigTx.wait();
      console.log(`✅ ${symbol} configured in VaultPriceFeed`);
      
      // 3. Verify price is accessible
      const price = await vaultPriceFeed.getMaxPrice(token.address);
      console.log(`${symbol} price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD`);
      
      // 4. Whitelist in Vault
      console.log(`Whitelisting ${symbol} in Vault...`);
      const whitelistTx = await vault.setTokenConfig(
        token.address,
        token.decimals,
        token.weight,
        token.minProfitBps,
        ethers.utils.parseUnits("30000000", 18), // $30M max for TBTC/TETH
        token.isStable,
        token.isShortable,
        GAS_OPTIONS
      );
      
      await whitelistTx.wait();
      console.log(`✅ ${symbol} successfully whitelisted!`);
      
      // Verify
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      console.log(`${symbol} is whitelisted: ${isWhitelisted ? 'Yes ✅' : 'No ❌'}`);
    } catch (error) {
      console.error(`Error processing ${symbol}: ${error.message}`);
    }
  }
  
  // Stage 4: Final verification
  console.log("\n=== STAGE 4: FINAL VERIFICATION ===");
  
  try {
    // Check total token weights
    const totalWeights = await vault.totalTokenWeights();
    console.log(`Total token weights: ${totalWeights}`);
    
    if (totalWeights.gt(0)) {
      console.log("✅ Token weights configured successfully");
    } else {
      console.log("❌ No token weights set");
    }
    
    // Check each token's status
    console.log("\nToken Status:");
    
    for (const [symbol, token] of Object.entries({...testTokens})) {
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      console.log(`- ${symbol}: ${isWhitelisted ? '✅ Whitelisted' : '❌ Not whitelisted'}`);
      
      if (isWhitelisted) {
        const weight = await vault.tokenWeights(token.address);
        console.log(`  Weight: ${weight}`);
        
        try {
          const price = await vault.getMaxPrice(token.address);
          console.log(`  Price: ${ethers.utils.formatUnits(price, 30)} USD`);
        } catch (error) {
          console.log(`  Price: Error - ${error.message.slice(0, 50)}...`);
        }
      }
    }
  } catch (error) {
    console.error(`Error in final verification: ${error.message}`);
  }
  
  // Environment variables for frontend
  console.log("\n=== FRONTEND INTEGRATION ===");
  
  console.log(`
// Environment Variables for Frontend
VITE_WORLD_RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
VITE_VAULT_ADDRESS=${vaultAddress}
VITE_ROUTER_ADDRESS=${routerAddress}
VITE_PRICE_FEED_ADDRESS=${vaultPriceFeedAddress}`);
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
