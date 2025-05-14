const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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

// Set gas options for transactions
function getGasOptions() {
  return {
    gasLimit: 5000000, // Manually set high gas limit
    gasPrice: ethers.utils.parseUnits("1.5", "gwei") // Adjust as needed
  };
}

// Main function
async function main() {
  console.log("Configuring price feeds for custom deployment on World Chain...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the VaultPriceFeed and SimplePriceFeed addresses
  if (!customData.CustomVaultPriceFeed) {
    console.error("CustomVaultPriceFeed address not found in deployment data.");
    process.exit(1);
  }
  
  if (!customData.SimplePriceFeed) {
    console.error("SimplePriceFeed address not found in deployment data.");
    process.exit(1);
  }
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Load VaultPriceFeed contract
  const vaultPriceFeedAbi = [
    "function owner() external view returns (address)",
    "function gov() external view returns (address)",
    "function priceFeeds(address _token) external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    customData.CustomVaultPriceFeed,
    vaultPriceFeedAbi,
    deployer
  );
  
  // Check governance/ownership
  let isGovernance = false;
  try {
    // Try gov() first
    const gov = await vaultPriceFeed.gov();
    console.log(`VaultPriceFeed governance: ${gov}`);
    isGovernance = gov.toLowerCase() === deployer.address.toLowerCase();
  } catch (error) {
    console.log("No gov() function. Trying owner()...");
    try {
      // Try owner() if gov() fails
      const owner = await vaultPriceFeed.owner();
      console.log(`VaultPriceFeed owner: ${owner}`);
      isGovernance = owner.toLowerCase() === deployer.address.toLowerCase();
    } catch (innerError) {
      console.error("Error checking VaultPriceFeed governance/ownership:", innerError.message);
    }
  }
  
  console.log(`Current account is governance/owner: ${isGovernance}`);
  if (!isGovernance) {
    console.warn("WARNING: Current account is not governance/owner. Transactions may fail.");
  }
  
  // Get test tokens
  const testTokens = customData.TestDeployment.tokens;
  if (!testTokens) {
    console.error("Test tokens not found in deployment data.");
    process.exit(1);
  }
  
  // Set SimplePriceFeed as the primary feed for each token in VaultPriceFeed
  console.log("\nSetting SimplePriceFeed as primary feed for tokens in VaultPriceFeed...");
  
  const tokenAddresses = Object.values(testTokens).map(token => token.address);
  
  for (const tokenAddress of tokenAddresses) {
    try {
      // Check current price feed
      let currentFeed;
      try {
        currentFeed = await vaultPriceFeed.priceFeeds(tokenAddress);
        console.log(`Current price feed for ${tokenAddress}: ${currentFeed}`);
        
        if (currentFeed.toLowerCase() === customData.SimplePriceFeed.toLowerCase()) {
          console.log(`✅ SimplePriceFeed is already set for ${tokenAddress}`);
          continue;
        }
      } catch (error) {
        console.warn(`Couldn't get current price feed for ${tokenAddress}:`, error.message);
      }
      
      console.log(`Setting SimplePriceFeed for ${tokenAddress}...`);
      const gasOptions = getGasOptions();
      console.log(`Using gas limit: ${gasOptions.gasLimit.toString()}, gas price: ${ethers.utils.formatUnits(gasOptions.gasPrice, 'gwei')} gwei`);
      
      const tx = await vaultPriceFeed.setPriceFeed(tokenAddress, customData.SimplePriceFeed, gasOptions);
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ SimplePriceFeed set as primary feed for ${tokenAddress}`);
      
      // Verify price feed was set
      try {
        const updatedFeed = await vaultPriceFeed.priceFeeds(tokenAddress);
        console.log(`Verified price feed for ${tokenAddress}: ${updatedFeed}`);
        
        if (updatedFeed.toLowerCase() !== customData.SimplePriceFeed.toLowerCase()) {
          console.warn(`⚠️ Price feed was not set correctly for ${tokenAddress}`);
        }
      } catch (error) {
        console.warn(`Couldn't verify price feed for ${tokenAddress}:`, error.message);
      }
      
      // Verify price can be retrieved from VaultPriceFeed
      try {
        const price = await vaultPriceFeed.getPrice(tokenAddress, true, true, false);
        console.log(`Verified price from VaultPriceFeed for ${tokenAddress}: ${ethers.utils.formatUnits(price, 30)} USD`);
      } catch (error) {
        console.warn(`Couldn't get price for ${tokenAddress} from VaultPriceFeed:`, error.message);
      }
    } catch (error) {
      console.error(`❌ Error setting price feed for ${tokenAddress}:`, error.message);
    }
  }
  
  console.log("\nVaultPriceFeed configuration completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
