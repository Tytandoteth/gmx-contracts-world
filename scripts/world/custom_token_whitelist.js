const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper for console output formatting
const printSeparator = () => console.log("=".repeat(80));
const printHeader = (text) => {
  printSeparator();
  console.log(text);
  printSeparator();
};

async function main() {
  printHeader("GMX V1 Custom Deployment Token Whitelisting");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)}`);
  
  // Step 1: Load custom deployment data
  console.log("\nStep 1: Loading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Custom deployment file not found: ${deploymentPath}`);
    return;
  }
  
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Custom deployment data loaded successfully");
  
  // Extract key contract addresses
  const vaultAddress = customDeployment.CustomVault;
  const vaultPriceFeedAddress = customDeployment.CustomVaultPriceFeed;
  const simplePriceFeedAddress = customDeployment.SimplePriceFeed;
  const routerAddress = customDeployment.CustomRouter;
  const usdgAddress = customDeployment.USDG; // This should be available
  
  console.log(`\nKey Contract Addresses:`);
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  console.log(`- Router: ${routerAddress}`);
  console.log(`- USDG: ${usdgAddress || "Not found in deployment data"}`);
  
  // Extract token data from test deployment
  const testTokens = customDeployment.TestDeployment?.tokens || {};
  
  if (Object.keys(testTokens).length === 0) {
    console.error("No test tokens found in deployment data");
    return;
  }
  
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // Step 2: Verify governance control on key contracts
  printHeader("Step 2: Verifying governance control");
  
  const contracts = [
    { name: "Vault", address: vaultAddress, method: "gov" },
    { name: "VaultPriceFeed", address: vaultPriceFeedAddress, method: "gov" },
    { name: "Router", address: routerAddress, method: "gov" }
  ];
  
  for (const contract of contracts) {
    try {
      const instance = new ethers.Contract(
        contract.address,
        [`function ${contract.method}() external view returns (address)`],
        deployer
      );
      
      const governor = await instance[contract.method]();
      const hasControl = governor.toLowerCase() === deployer.address.toLowerCase();
      
      console.log(`${contract.name} governance: ${governor}`);
      console.log(`You have governance control: ${hasControl ? "✅ YES" : "❌ NO"}`);
      
      if (!hasControl) {
        console.error(`WARNING: You don't have governance control over ${contract.name}`);
      }
    } catch (error) {
      console.error(`Error checking governance for ${contract.name}: ${error.message}`);
    }
  }
  
  // Step 3: Check and fix price feed connections
  printHeader("Step 3: Verifying price feed connections");
  
  // Load the SimplePriceFeed contract
  const simplePriceFeedAbi = [
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Set price data in SimplePriceFeed
  const tokenAddresses = Object.values(testTokens).map(t => t.address);
  const tokenPrices = [];
  
  // Set default prices (in USD, with 30 decimals as per GMX standard)
  console.log("\nSetting prices in SimplePriceFeed...");
  Object.entries(testTokens).forEach(([symbol, token]) => {
    let price;
    if (symbol === "TUSD") {
      price = ethers.utils.parseUnits("1", 30); // $1.00 (stablecoin)
    } else if (symbol === "TBTC") {
      price = ethers.utils.parseUnits("60000", 30); // $60,000
    } else if (symbol === "TETH") {
      price = ethers.utils.parseUnits("3000", 30); // $3,000
    } else {
      price = ethers.utils.parseUnits("1", 30); // Default $1.00
    }
    tokenPrices.push(price);
    console.log(`- Setting ${symbol} price: ${ethers.utils.formatUnits(price, 30)} USD`);
  });
  
  try {
    // Set the prices in the SimplePriceFeed
    const setPricesTx = await simplePriceFeed.setPrices(tokenAddresses, tokenPrices, {
      gasLimit: 5000000
    });
    console.log(`\nTransaction submitted: ${setPricesTx.hash}`);
    await setPricesTx.wait();
    console.log("✅ Prices set successfully in SimplePriceFeed");
    
    // Verify prices were set correctly
    for (const [symbol, token] of Object.entries(testTokens)) {
      try {
        const price = await simplePriceFeed.getPrice(token.address);
        console.log(`- ${symbol} price: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
      } catch (error) {
        console.error(`- Failed to get ${symbol} price: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to set prices: ${error.message}`);
  }
  
  // Step 4: Whitelist one token at a time using incremental approach
  printHeader("Step 4: Token whitelisting");
  
  // Load the Vault contract with detailed ABI
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function isInitialized() external view returns (bool)",
    "function priceFeed() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Verify vault configuration before whitelisting
  try {
    const isInitialized = await vault.isInitialized();
    console.log(`Vault initialized: ${isInitialized ? "✅ YES" : "❌ NO"}`);
    
    if (!isInitialized) {
      console.error("ERROR: Vault is not initialized! This must be fixed before whitelisting.");
    }
    
    const vaultPriceFeed = await vault.priceFeed();
    console.log(`Vault price feed: ${vaultPriceFeed}`);
    console.log(`Price feed matches expected: ${vaultPriceFeed.toLowerCase() === vaultPriceFeedAddress.toLowerCase() ? "✅ YES" : "❌ NO"}`);
  } catch (error) {
    console.error(`Error checking vault configuration: ${error.message}`);
  }
  
  // Priority token to whitelist (start with stablecoin)
  const stablecoin = testTokens.TUSD;
  
  if (!stablecoin) {
    console.error("TUSD token not found in deployment data");
  } else {
    console.log(`\nAttempting to whitelist TUSD (${stablecoin.address})...`);
    
    // Check if already whitelisted
    try {
      const isWhitelisted = await vault.whitelistedTokens(stablecoin.address);
      if (isWhitelisted) {
        console.log("✅ TUSD is already whitelisted");
      } else {
        console.log("TUSD is not whitelisted yet, attempting to whitelist...");
        
        // Token config parameters
        const tokenConfig = {
          token: stablecoin.address,
          decimals: stablecoin.decimals,
          weight: 10000, // 10% weight
          minProfitBps: 75, // 0.75% min profit
          maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M max
          isStable: true,
          isShortable: false
        };
        
        console.log("Token config parameters:");
        console.log(`- Decimals: ${tokenConfig.decimals}`);
        console.log(`- Weight: ${tokenConfig.weight}`);
        console.log(`- Min Profit Bps: ${tokenConfig.minProfitBps}`);
        console.log(`- Max USDG: ${ethers.utils.formatUnits(tokenConfig.maxUsdgAmount, 18)}`);
        console.log(`- Is Stable: ${tokenConfig.isStable}`);
        console.log(`- Is Shortable: ${tokenConfig.isShortable}`);
        
        try {
          console.log("\nSending whitelist transaction...");
          const tx = await vault.setTokenConfig(
            tokenConfig.token,
            tokenConfig.decimals,
            tokenConfig.weight,
            tokenConfig.minProfitBps,
            tokenConfig.maxUsdgAmount,
            tokenConfig.isStable,
            tokenConfig.isShortable,
            {
              gasLimit: 5000000
            }
          );
          
          console.log(`Transaction submitted: ${tx.hash}`);
          const receipt = await tx.wait();
          
          if (receipt.status === 1) {
            console.log("✅ TUSD whitelisted successfully!");
          } else {
            console.error("❌ Transaction completed but failed");
          }
          
          // Verify whitelisting
          const whitelisted = await vault.whitelistedTokens(stablecoin.address);
          console.log(`TUSD whitelisted status: ${whitelisted ? "✅ YES" : "❌ NO"}`);
          
          // Check decimals
          const decimals = await vault.tokenDecimals(stablecoin.address);
          console.log(`TUSD decimals in vault: ${decimals}`);
        } catch (error) {
          console.error(`❌ Whitelisting transaction failed: ${error.message}`);
          
          // If the error occurs during gas estimation or transaction execution
          if (error.message.includes("execution reverted")) {
            console.log("\nPossible reasons for reversion:");
            console.log("1. Price feed not returning valid price data");
            console.log("2. Vault configuration issue (USDG setup, etc.)");
            console.log("3. Token parameters invalid (decimals mismatch, etc.)");
            console.log("4. Governance permissions issue");
            console.log("5. Function disabled or timelock active");
          }
        }
      }
    } catch (error) {
      console.error(`Error checking whitelist status: ${error.message}`);
    }
  }
  
  // Step 5: Verify Final State
  printHeader("Step 5: Final State Verification");
  
  // Check whitelist status for all tokens
  console.log("Token whitelist status:");
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      console.log(`- ${symbol}: ${isWhitelisted ? "✅ Whitelisted" : "❌ Not whitelisted"}`);
      
      if (isWhitelisted) {
        const decimals = await vault.tokenDecimals(token.address);
        console.log(`  Registered decimals: ${decimals}`);
      }
    } catch (error) {
      console.error(`Error checking ${symbol} status: ${error.message}`);
    }
  }
  
  // Provide next steps based on results
  console.log("\nNext steps based on results:");
  console.log("1. If tokens are whitelisted, proceed with frontend integration");
  console.log("2. If whitelisting failed, check contract logs and try with different parameters");
  console.log("3. Consider initializing with additional configuration if needed");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
