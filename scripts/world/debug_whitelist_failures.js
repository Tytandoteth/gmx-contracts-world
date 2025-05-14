const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Debugging Levels
const DEBUG = {
  INFO: 0,
  VERBOSE: 1,
  TRACE: 2
};

// Set debug level
const DEBUG_LEVEL = DEBUG.TRACE;

// Gas options to avoid estimation errors
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 3000000 // Extremely high gas limit for debugging
};

// Log with different levels
function log(level, message) {
  if (level <= DEBUG_LEVEL) {
    console.log(message);
  }
}

// Get custom deployment data
async function getCustomDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  return JSON.parse(fileContent);
}

// Format address for better readability
function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Main debugging function
async function debugWhitelistFailures() {
  console.log("=".repeat(80));
  console.log("GMX V1 Token Whitelisting Debug - World Chain");
  console.log("=".repeat(80));
  
  const customData = await getCustomDeploymentData();
  console.log(`Using RPC: https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/`);
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Contract addresses
  const vaultAddress = customData.CustomVault;
  const vaultPriceFeedAddress = customData.CustomVaultPriceFeed;
  const simplePriceFeedAddress = customData.SimplePriceFeed;
  const routerAddress = customData.CustomRouter;
  
  console.log(`\nContract Addresses:`);
  console.log(`- Vault: ${formatAddress(vaultAddress)}`);
  console.log(`- VaultPriceFeed: ${formatAddress(vaultPriceFeedAddress)}`);
  console.log(`- SimplePriceFeed: ${formatAddress(simplePriceFeedAddress)}`);
  console.log(`- Router: ${formatAddress(routerAddress)}`);
  
  // Test tokens
  const testTokens = customData.TestDeployment.tokens;
  
  // Debug Root Cause 1: Price Feed Validation Issues
  console.log("\n=== ROOT CAUSE 1: PRICE FEED VALIDATION ===");
  
  // Load VaultPriceFeed Contract
  const vaultPriceFeedAbi = [
    "function priceFeeds(address _token) external view returns (address)",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Load SimplePriceFeed Contract
  const simplePriceFeedAbi = [
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Check price feeds for each token
  for (const [symbol, token] of Object.entries(testTokens)) {
    console.log(`\nChecking price feed for ${symbol} (${formatAddress(token.address)}):`);
    
    try {
      // Check if VaultPriceFeed knows about the token
      const registeredFeed = await vaultPriceFeed.priceFeeds(token.address);
      console.log(`- Registered feed in VaultPriceFeed: ${registeredFeed}`);
      console.log(`- Is SimplePriceFeed? ${registeredFeed.toLowerCase() === simplePriceFeedAddress.toLowerCase()}`);
      
      // Try to get price from VaultPriceFeed
      try {
        const price = await vaultPriceFeed.getPrice(token.address, true, false, false);
        console.log(`- VaultPriceFeed price: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
      } catch (error) {
        console.error(`- VaultPriceFeed getPrice error: ${error.message} ❌`);
      }
      
      // Try to get price from SimplePriceFeed
      try {
        const price = await simplePriceFeed.getPrice(token.address);
        console.log(`- SimplePriceFeed price: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
      } catch (error) {
        console.error(`- SimplePriceFeed getPrice error: ${error.message} ❌`);
      }
    } catch (error) {
      console.error(`Error checking price feed for ${symbol}: ${error.message}`);
    }
  }
  
  // Debug Root Cause 2: Missing Initialization Steps
  console.log("\n=== ROOT CAUSE 2: MISSING INITIALIZATION STEPS ===");
  
  // Load Vault Contract with detailed ABI
  const vaultAbi = [
    "function gov() external view returns (address)",
    "function isInitialized() external view returns (bool)",
    "function inManagerMode() external view returns (bool)",
    "function inPrivateLiquidationMode() external view returns (bool)",
    "function isSwapEnabled() external view returns (bool)",
    "function isLeverageEnabled() external view returns (bool)",
    "function hasDynamicFees() external view returns (bool)",
    "function totalTokenWeights() external view returns (uint256)",
    "function usdg() external view returns (address)",
    "function router() external view returns (address)",
    "function stableSwapFeeBasisPoints() external view returns (uint256)",
    "function stableTaxBasisPoints() external view returns (uint256)",
    "function swapFeeBasisPoints() external view returns (uint256)",
    "function taxBasisPoints() external view returns (uint256)",
    "function whitelistedTokens(address) external view returns (bool)",
    "function tokenDecimals(address) external view returns (uint256)",
    "function priceFeed() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  try {
    // Check initialization status
    const isInitialized = await vault.isInitialized();
    console.log(`Vault initialized: ${isInitialized}`);
    
    // Check mode settings
    const inManagerMode = await vault.inManagerMode();
    console.log(`Vault in manager mode: ${inManagerMode}`);
    
    const inPrivateLiquidationMode = await vault.inPrivateLiquidationMode();
    console.log(`Vault in private liquidation mode: ${inPrivateLiquidationMode}`);
    
    // Check feature flags
    const isSwapEnabled = await vault.isSwapEnabled();
    console.log(`Swap enabled: ${isSwapEnabled}`);
    
    const isLeverageEnabled = await vault.isLeverageEnabled();
    console.log(`Leverage enabled: ${isLeverageEnabled}`);
    
    const hasDynamicFees = await vault.hasDynamicFees();
    console.log(`Has dynamic fees: ${hasDynamicFees}`);
    
    // Check USDG and router
    const usdgAddress = await vault.usdg();
    console.log(`USDG address: ${usdgAddress}`);
    
    const registeredRouterAddress = await vault.router();
    console.log(`Registered router: ${registeredRouterAddress}`);
    console.log(`Router matches CustomRouter: ${registeredRouterAddress.toLowerCase() === routerAddress.toLowerCase()}`);
    
    // Check fee settings
    const stableSwapFeeBasisPoints = await vault.stableSwapFeeBasisPoints();
    console.log(`Stable swap fee: ${stableSwapFeeBasisPoints} basis points`);
    
    const swapFeeBasisPoints = await vault.swapFeeBasisPoints();
    console.log(`Swap fee: ${swapFeeBasisPoints} basis points`);
    
    // Check total token weights
    const totalTokenWeights = await vault.totalTokenWeights();
    console.log(`Total token weights: ${totalTokenWeights}`);
    
    // Check price feed setting
    const priceFeedAddress = await vault.priceFeed();
    console.log(`Registered price feed: ${priceFeedAddress}`);
    console.log(`Price feed matches VaultPriceFeed: ${priceFeedAddress.toLowerCase() === vaultPriceFeedAddress.toLowerCase()}`);
  } catch (error) {
    console.error(`Error checking vault initialization: ${error.message}`);
  }
  
  // Debug Root Cause 3: Contract Governance Dependencies
  console.log("\n=== ROOT CAUSE 3: GOVERNANCE DEPENDENCIES ===");
  
  try {
    // Check governance
    const govAddress = await vault.gov();
    console.log(`Vault governance: ${govAddress}`);
    console.log(`Current account is governance: ${govAddress.toLowerCase() === deployer.address.toLowerCase()}`);
    
    // Query other potential controllers
    const additionalControllers = [
      { name: "VaultPriceFeed", address: vaultPriceFeedAddress },
      { name: "Router", address: routerAddress }
    ];
    
    for (const controller of additionalControllers) {
      try {
        const controllerContract = new ethers.Contract(
          controller.address,
          ["function gov() external view returns (address)", "function owner() external view returns (address)"],
          deployer
        );
        
        try {
          const controllerGov = await controllerContract.gov();
          console.log(`${controller.name} governance: ${controllerGov}`);
          console.log(`Current account is ${controller.name} governance: ${controllerGov.toLowerCase() === deployer.address.toLowerCase()}`);
        } catch (error) {
          try {
            const controllerOwner = await controllerContract.owner();
            console.log(`${controller.name} owner: ${controllerOwner}`);
            console.log(`Current account is ${controller.name} owner: ${controllerOwner.toLowerCase() === deployer.address.toLowerCase()}`);
          } catch (innerError) {
            console.log(`${controller.name} has no gov or owner method`);
          }
        }
      } catch (error) {
        console.error(`Error checking ${controller.name} governance: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error checking governance: ${error.message}`);
  }
  
  // Debug Root Cause 4: Transaction Data Format Issues
  console.log("\n=== ROOT CAUSE 4: TRANSACTION DATA FORMAT ===");
  
  // Check if tokenDecimals are registered correctly
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      const decimals = await vault.tokenDecimals(token.address);
      console.log(`${symbol} registered decimals: ${decimals}`);
      console.log(`Matches deployment data: ${decimals.toString() === token.decimals.toString()}`);
    } catch (error) {
      console.log(`${symbol} decimals not registered: ${error.message}`);
    }
  }
  
  // Debug Root Cause 5: State Inconsistency
  console.log("\n=== ROOT CAUSE 5: STATE INCONSISTENCY ===");
  
  // Try a more targeted approach - attempt to read the Vault contract code
  try {
    const vaultCode = await ethers.provider.getCode(vaultAddress);
    const codeSize = (vaultCode.length - 2) / 2; // Subtract '0x' and divide by 2 for byte count
    console.log(`Vault contract code size: ${codeSize} bytes`);
    console.log(`Vault has code: ${vaultCode !== '0x'}`);
  } catch (error) {
    console.error(`Error reading vault code: ${error.message}`);
  }
  
  // Let's try a basic whitelisting attempt for TUSD with detailed error tracing
  console.log("\n=== ATTEMPTING DIRECT WHITELISTING WITH TRACING ===");
  
  // Create a contract instance with a detailed function definition
  const vaultSetTokenConfigAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ];
  
  const vaultForTokenConfig = new ethers.Contract(
    vaultAddress,
    vaultSetTokenConfigAbi,
    deployer
  );
  
  // Select one token for testing
  const testToken = testTokens.TUSD;
  
  // Detailed parameters for logging
  const tokenConfigParams = {
    token: testToken.address,
    decimals: testToken.decimals,
    weight: 10000, // 10% weight
    minProfitBps: 75, // 0.75%
    maxUsdgAmount: ethers.utils.parseUnits("50000000", 18), // 50M max
    isStable: true,
    isShortable: false
  };
  
  console.log("Attempting to whitelist TUSD with parameters:");
  console.log(JSON.stringify(tokenConfigParams, null, 2));
  
  try {
    // Attempt whitelisting with excessive gas and detailed logs
    const tx = await vaultForTokenConfig.setTokenConfig(
      tokenConfigParams.token,
      tokenConfigParams.decimals,
      tokenConfigParams.weight,
      tokenConfigParams.minProfitBps,
      tokenConfigParams.maxUsdgAmount,
      tokenConfigParams.isStable,
      tokenConfigParams.isShortable,
      {
        gasLimit: 5000000, // Very high gas limit
        gasPrice: ethers.utils.parseUnits("0.5", "gwei")
      }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    
    // Wait for transaction with detailed logging
    const receipt = await tx.wait();
    console.log("Transaction succeeded:");
    console.log(`- Block: ${receipt.blockNumber}`);
    console.log(`- Gas used: ${receipt.gasUsed.toString()}`);
    
    // Check if token is now whitelisted
    const isWhitelisted = await vault.whitelistedTokens(testToken.address);
    console.log(`TUSD is now whitelisted: ${isWhitelisted}`);
  } catch (error) {
    console.error("Transaction failed with error:");
    console.error(error.message);
    
    // Try to extract more detailed error information
    if (error.code === "CALL_EXCEPTION") {
      console.log("\nDetailed transaction error analysis:");
      
      if (error.transaction) {
        console.log("Transaction data:");
        console.log(`- To: ${error.transaction.to}`);
        console.log(`- From: ${error.transaction.from}`);
        console.log(`- Data: ${error.transaction.data.slice(0, 66)}...`);
        console.log(`- Gas limit: ${error.transaction.gasLimit.toString()}`);
      }
      
      if (error.receipt) {
        console.log("Transaction receipt:");
        console.log(`- Status: ${error.receipt.status}`);
        console.log(`- Gas used: ${error.receipt.gasUsed.toString()}`);
      }
      
      // Analyze contract reversion
      console.log("\nPossible reversion causes in GMX V1 Vault:");
      console.log("1. Invalid price feed configuration");
      console.log("2. Token already whitelisted or blacklisted");
      console.log("3. Insufficient price feed data");
      console.log("4. Non-governance caller");
      console.log("5. Vault in unexpected state");
    }
  }
  
  // Final debugging report
  console.log("\n=== FINAL DEBUGGING REPORT ===");
  console.log("Based on the tests conducted, the most likely causes are:");
  console.log("1. Price feed validation: Check if prices are properly set and accessible");
  console.log("2. Missing initialization: Verify USDG token setup and router configuration");
  console.log("3. Permission issues: Ensure all contracts have correct governance");
  
  console.log("\nNext steps recommendations:");
  console.log("1. Check Vault source code for whitelisting requirements");
  console.log("2. Verify token decimals against contract expectations");
  console.log("3. Try initializing USDG or router connections first");
  console.log("4. Consider direct transaction debugging with hardhat-tracer");
}

// Run debugging
debugWhitelistFailures()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
