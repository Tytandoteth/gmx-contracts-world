const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Diagnostic Test for VaultPriceFeed and Vault ===\n");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Load custom deployment data
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Contract addresses
  const vaultAddress = customDeployment.CustomVault;
  const vaultPriceFeedAddress = customDeployment.CustomVaultPriceFeed;
  const simplePriceFeedAddress = customDeployment.SimplePriceFeed;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Target token - focus just on TUSD to minimize gas
  const tusdAddress = customDeployment.TestDeployment.tokens.TUSD.address;
  const tusdDecimals = customDeployment.TestDeployment.tokens.TUSD.decimals;
  console.log(`- Target token: TUSD (${tusdAddress}, ${tusdDecimals} decimals)`);
  
  // Load contracts with more detailed ABIs
  const vaultPriceFeedAbi = [
    "function gov() external view returns (address)",
    "function priceFeeds(address _token) external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function setTokenConfig(address _token, bool _isStrictStable) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)",
    "function isInitialized() external view returns (bool)",
    "function securityStartTime() external view returns (uint256)",
    "function priceSampleSpace() external view returns (uint256)",
    "function isAmmEnabled() external view returns (bool)",
    "function isSecondaryPriceEnabled() external view returns (bool)",
    "function useV2Pricing() external view returns (bool)",
    "function spreadBasisPoints(address _token) external view returns (uint256)",
    "function favorPrimaryPrice() external view returns (bool)",
    "function maxStrictPriceDeviation() external view returns (uint256)"
  ];
  
  const simplePriceFeedAbi = [
    "function gov() external view returns (address)",
    "function prices(address _token) external view returns (uint256)",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Step 1: Check VaultPriceFeed configuration
  console.log("\n--- VaultPriceFeed Configuration ---");
  
  try {
    const isInitialized = await vaultPriceFeed.isInitialized();
    console.log(`- Is initialized: ${isInitialized}`);
  } catch (error) {
    console.log(`- Could not check if initialized: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const securityStartTime = await vaultPriceFeed.securityStartTime();
    const currentTime = Math.floor(Date.now() / 1000);
    console.log(`- Security start time: ${securityStartTime}`);
    console.log(`- Current time: ${currentTime}`);
    console.log(`- Security time passed: ${currentTime > securityStartTime}`);
  } catch (error) {
    console.log(`- Could not check security time: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const priceSampleSpace = await vaultPriceFeed.priceSampleSpace();
    console.log(`- Price sample space: ${priceSampleSpace}`);
  } catch (error) {
    console.log(`- Could not check price sample space: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const isAmmEnabled = await vaultPriceFeed.isAmmEnabled();
    console.log(`- AMM enabled: ${isAmmEnabled}`);
  } catch (error) {
    console.log(`- Could not check if AMM enabled: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const isSecondaryPriceEnabled = await vaultPriceFeed.isSecondaryPriceEnabled();
    console.log(`- Secondary price enabled: ${isSecondaryPriceEnabled}`);
  } catch (error) {
    console.log(`- Could not check if secondary price enabled: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const useV2Pricing = await vaultPriceFeed.useV2Pricing();
    console.log(`- Using V2 pricing: ${useV2Pricing}`);
  } catch (error) {
    console.log(`- Could not check if using V2 pricing: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const favorPrimaryPrice = await vaultPriceFeed.favorPrimaryPrice();
    console.log(`- Favor primary price: ${favorPrimaryPrice}`);
  } catch (error) {
    console.log(`- Could not check if favoring primary price: ${error.message.slice(0, 100)}...`);
  }
  
  // Step 2: Check current price feeds
  console.log("\n--- Current Price Feed Configuration ---");
  
  try {
    const currentPriceFeed = await vaultPriceFeed.priceFeeds(tusdAddress);
    console.log(`- Current price feed for TUSD: ${currentPriceFeed}`);
    
    if (currentPriceFeed.toLowerCase() === simplePriceFeedAddress.toLowerCase()) {
      console.log(`- Already using the correct SimplePriceFeed ✅`);
    } else {
      console.log(`- Not using our SimplePriceFeed yet`);
    }
  } catch (error) {
    console.log(`- Could not check current price feed: ${error.message.slice(0, 100)}...`);
  }
  
  // Step 3: Test price retrieval
  console.log("\n--- Price Retrieval Tests ---");
  
  let simplePriceFeedWorking = false;
  try {
    const price = await simplePriceFeed.getPrice(tusdAddress);
    console.log(`- SimplePriceFeed price for TUSD: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
    simplePriceFeedWorking = true;
  } catch (error) {
    console.log(`- Error getting price from SimplePriceFeed: ${error.message.slice(0, 100)}...`);
  }
  
  try {
    const directPrice = await simplePriceFeed.prices(tusdAddress);
    console.log(`- Direct price mapping value for TUSD: ${ethers.utils.formatUnits(directPrice, 30)} USD`);
  } catch (error) {
    console.log(`- Could not check direct price mapping: ${error.message.slice(0, 100)}...`);
  }
  
  let vaultPriceFeedWorking = false;
  try {
    const price = await vaultPriceFeed.getPrice(tusdAddress, true, false, false);
    console.log(`- VaultPriceFeed price for TUSD: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
    vaultPriceFeedWorking = true;
  } catch (error) {
    console.log(`- Error getting price from VaultPriceFeed: ${error.message.slice(0, 100)}...`);
  }
  
  // Step 4: Test VaultPriceFeed.setPriceFeed with gasLimit set to 0 to simulate call and get error information
  console.log("\n--- Gas Estimation for setPriceFeed ---");
  
  // Create a transaction with tx.gasLimit = 0 to simulate a call that fails
  try {
    console.log(`- Simulating setPriceFeed call (won't spend gas)...`);
    
    const txData = vaultPriceFeed.interface.encodeFunctionData("setPriceFeed", [
      tusdAddress,
      simplePriceFeedAddress
    ]);
    
    const tx = {
      to: vaultPriceFeedAddress,
      from: deployer.address,
      data: txData,
      gasLimit: 0 // 0 gasLimit for simulation
    };
    
    await deployer.provider.call(tx);
    console.log(`- Call simulation succeeded (unexpected) ✅`);
  } catch (error) {
    console.log(`- Call simulation failed with reason: ${error.message}`);
    // Extract more details if available
    try {
      const revertReason = error.data || error.message;
      console.log(`- Possible revert reason: ${revertReason}`);
    } catch (parseError) {
      console.log(`- Could not parse revert reason: ${parseError.message}`);
    }
  }
  
  // Create environment variables regardless
  console.log("\n--- Creating Environment Variables ---");
  
  const envVars = `# GMX V1 on World Chain - Diagnostic Configuration
VITE_WORLD_RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
VITE_VAULT_ADDRESS=${vaultAddress}
VITE_ROUTER_ADDRESS=${customDeployment.CustomRouter}
VITE_VAULT_PRICE_FEED_ADDRESS=${vaultPriceFeedAddress}
VITE_SIMPLE_PRICE_FEED_ADDRESS=${simplePriceFeedAddress}

# Price Feed Status
VITE_SIMPLE_PRICE_FEED_WORKING=${simplePriceFeedWorking}
VITE_VAULT_PRICE_FEED_WORKING=${vaultPriceFeedWorking}

# Additional Contract Addresses
VITE_POSITION_ROUTER=${customDeployment.PositionRouter || ''}
VITE_POSITION_MANAGER=${customDeployment.PositionManager || ''}
VITE_ORDER_BOOK=${customDeployment.OrderBook || ''}
`;
  
  const envFilePath = path.join(__dirname, "../../.env.world.diagnostic");
  fs.writeFileSync(envFilePath, envVars);
  console.log(`✅ Created diagnostic environment variables file: ${envFilePath}`);
  
  // Analysis and recommendations
  console.log("\n=== Analysis and Recommendations ===");
  
  if (simplePriceFeedWorking) {
    console.log("✅ SimplePriceFeed is working correctly and returning prices");
  } else {
    console.log("❌ SimplePriceFeed is not working correctly");
  }
  
  if (vaultPriceFeedWorking) {
    console.log("✅ VaultPriceFeed is able to return prices");
  } else {
    console.log("❌ VaultPriceFeed is not returning prices properly");
  }
  
  console.log("\nBased on the diagnostic results:");
  
  console.log("1. Alternative Deployment Solution:");
  console.log("   - Since you have governance rights but configuration is still failing,");
  console.log("   - Consider using a direct deployment approach instead of configuration");
  console.log("   - Run 'npx hardhat run scripts/world/deployMinimalGmx.js --network worldchain'");
  console.log("   - This will deploy a fresh set of minimal contracts with proper configuration");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
