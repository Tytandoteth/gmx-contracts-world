const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Minimal gas settings
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 2000000 // Reduced from 5M to 2M
};

// Focus on just one token (TUSD) to minimize gas usage
async function main() {
  console.log("\n=== Minimal Gas Token Setup for GMX V1 ===\n");
  
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
  const newSimplePriceFeedAddress = customDeployment.SimplePriceFeed; // Using the one from deployment file
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${newSimplePriceFeedAddress}`);
  
  // Just focus on TUSD - the stablecoin which is simpler to handle
  const tusdAddress = customDeployment.TestDeployment.tokens.TUSD.address;
  const tusdDecimals = customDeployment.TestDeployment.tokens.TUSD.decimals;
  console.log(`- Target token: TUSD (${tusdAddress}, ${tusdDecimals} decimals)`);
  
  try {
    // Set up SimplePriceFeed contract interface
    const simplePriceFeedAbi = [
      "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
      "function getPrice(address _token) external view returns (uint256)"
    ];
    
    const simplePriceFeed = new ethers.Contract(
      newSimplePriceFeedAddress,
      simplePriceFeedAbi,
      deployer
    );
    
    // Step 1: Verify price is set in SimplePriceFeed
    console.log("\n--- Step 1: Verifying Price in SimplePriceFeed ---");
    
    let hasPrice = false;
    try {
      const price = await simplePriceFeed.getPrice(tusdAddress);
      console.log(`- TUSD price: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
      hasPrice = true;
    } catch (error) {
      console.log(`- No price set for TUSD, setting price now...`);
      
      // Set price for TUSD only
      const tusdPrice = ethers.utils.parseUnits("1", 30); // $1.00 (30 decimals)
      
      try {
        const setPriceTx = await simplePriceFeed.setPrices(
          [tusdAddress], 
          [tusdPrice],
          GAS_OPTIONS
        );
        console.log(`- Transaction submitted: ${setPriceTx.hash}`);
        
        await setPriceTx.wait();
        console.log(`- Price set successfully`);
        hasPrice = true;
      } catch (setPriceError) {
        console.error(`- Error setting price: ${setPriceError.message}`);
      }
    }
    
    if (!hasPrice) {
      console.log("❌ Cannot proceed without price set in SimplePriceFeed");
      return;
    }
    
    // Step 2: Update VaultPriceFeed (most critical)
    console.log("\n--- Step 2: Configuring VaultPriceFeed (Critical) ---");
    
    const vaultPriceFeedAbi = [
      "function priceFeeds(address _token) external view returns (address)",
      "function setPriceFeed(address _token, address _priceFeed) external"
    ];
    
    const vaultPriceFeed = new ethers.Contract(
      vaultPriceFeedAddress,
      vaultPriceFeedAbi,
      deployer
    );
    
    // First check if already configured
    let isPriceFeedConfigured = false;
    
    try {
      const currentPriceFeed = await vaultPriceFeed.priceFeeds(tusdAddress);
      console.log(`- Current price feed for TUSD: ${currentPriceFeed}`);
      
      if (currentPriceFeed.toLowerCase() === newSimplePriceFeedAddress.toLowerCase()) {
        console.log(`- Already using the correct SimplePriceFeed ✅`);
        isPriceFeedConfigured = true;
      }
    } catch (error) {
      console.log(`- Could not check current price feed: ${error.message.slice(0, 100)}...`);
    }
    
    // Only try to set price feed if needed
    if (!isPriceFeedConfigured) {
      try {
        console.log(`- Setting price feed for TUSD...`);
        
        const setPriceFeedTx = await vaultPriceFeed.setPriceFeed(
          tusdAddress,
          newSimplePriceFeedAddress,
          GAS_OPTIONS
        );
        
        console.log(`- Transaction submitted: ${setPriceFeedTx.hash}`);
        await setPriceFeedTx.wait();
        
        console.log(`- Price feed updated successfully ✅`);
        isPriceFeedConfigured = true;
      } catch (error) {
        console.error(`- Error setting price feed: ${error.message.slice(0, 100)}...`);
      }
    }
    
    if (!isPriceFeedConfigured) {
      console.log("❌ Cannot proceed without configuring VaultPriceFeed");
      return;
    }
    
    // Step 3: Whitelist token in Vault (attempt only if previous steps succeeded)
    console.log("\n--- Step 3: Whitelisting TUSD in Vault ---");
    
    const vaultAbi = [
      "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
      "function whitelistedTokens(address _token) external view returns (bool)"
    ];
    
    const vault = new ethers.Contract(
      vaultAddress,
      vaultAbi,
      deployer
    );
    
    // Check if already whitelisted
    let isWhitelisted = false;
    
    try {
      isWhitelisted = await vault.whitelistedTokens(tusdAddress);
      if (isWhitelisted) {
        console.log(`- TUSD is already whitelisted ✅`);
      }
    } catch (error) {
      console.log(`- Could not check if TUSD is whitelisted: ${error.message.slice(0, 100)}...`);
    }
    
    // Only try to whitelist if needed
    if (!isWhitelisted) {
      try {
        console.log(`- Whitelisting TUSD...`);
        
        const whitelistTx = await vault.setTokenConfig(
          tusdAddress,
          tusdDecimals,
          10000, // 10% weight
          75,    // 0.75% min profit basis points
          ethers.utils.parseUnits("10000000", 18), // $10M max USDG amount
          true,  // isStable = true for TUSD
          false, // isShortable = false for TUSD
          GAS_OPTIONS
        );
        
        console.log(`- Transaction submitted: ${whitelistTx.hash}`);
        await whitelistTx.wait();
        
        console.log(`- TUSD successfully whitelisted ✅`);
        isWhitelisted = true;
      } catch (error) {
        console.error(`- Error whitelisting TUSD: ${error.message.slice(0, 100)}...`);
      }
    }
    
    // Step 4: Create environment variables file
    console.log("\n--- Step 4: Creating Environment Variables for Frontend ---");
    
    const envVars = `# GMX V1 on World Chain - Custom Deployment (Minimal Setup)
VITE_WORLD_RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
VITE_VAULT_ADDRESS=${vaultAddress}
VITE_ROUTER_ADDRESS=${customDeployment.CustomRouter}
VITE_VAULT_PRICE_FEED_ADDRESS=${vaultPriceFeedAddress}
VITE_SIMPLE_PRICE_FEED_ADDRESS=${newSimplePriceFeedAddress}

# Additional Contract Addresses
VITE_POSITION_ROUTER=${customDeployment.PositionRouter || ''}
VITE_POSITION_MANAGER=${customDeployment.PositionManager || ''}
VITE_ORDER_BOOK=${customDeployment.OrderBook || ''}
`;
    
    const envFilePath = path.join(__dirname, "../../.env.world.custom");
    fs.writeFileSync(envFilePath, envVars);
    console.log(`✅ Created environment variables file: ${envFilePath}`);
    
    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(`SimplePriceFeed used: ${newSimplePriceFeedAddress}`);
    console.log(`VaultPriceFeed configured: ${isPriceFeedConfigured ? '✅ YES' : '❌ NO'}`);
    console.log(`TUSD whitelisted: ${isWhitelisted ? '✅ YES' : '❌ NO'}`);
    
    if (isPriceFeedConfigured) {
      if (isWhitelisted) {
        console.log("\n✅ Minimal GMX V1 Integration Complete!");
        console.log("You have successfully whitelisted TUSD and can now use the platform.");
      } else {
        console.log("\n⚠️ Partial integration achieved.");
        console.log("Price feeds are configured but TUSD is not whitelisted. You may still be able to use the frontend for viewing, but trading may not work fully.");
      }
      console.log("\nConnect your frontend using the generated environment variables file.");
    } else {
      console.log("\n❌ Integration incomplete.");
      console.log("Please try again after adding more ETH to your account.");
    }
  } catch (error) {
    console.error(`Error in setup process: ${error.message}`);
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
