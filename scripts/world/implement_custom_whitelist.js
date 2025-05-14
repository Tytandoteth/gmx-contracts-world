const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Oracle Keeper URL
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";

async function getCustomDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  return JSON.parse(fileContent);
}

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
  
  // Use fallback prices
  console.warn("Using fallback prices for tokens");
  return {
    WLD: 1.30,
    WETH: 2540.00,
    MAG: 0.00038699
  };
}

async function main() {
  console.log("Implementing token whitelisting for custom deployment on World Chain");
  console.log("=================================================================");
  console.log("Using RPC URL: https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/");
  
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Load contracts
  const vault = new ethers.Contract(
    customData.CustomVault,
    [
      "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
      "function whitelistedTokens(address) external view returns (bool)",
      "function tokenWeights(address) external view returns (uint256)",
      "function gov() external view returns (address)"
    ],
    deployer
  );
  
  // Verify governance
  const gov = await vault.gov();
  console.log(`Vault governance: ${gov}`);
  if (gov.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("Your account doesn't have governance rights on the Vault!");
    return;
  }
  
  // Get test tokens
  const testTokens = customData.TestDeployment.tokens;
  if (!testTokens) {
    console.error("Test tokens not found in deployment data");
    return;
  }
  
  // Whitelist each token
  console.log("\nWhitelisting tokens in CustomVault:");
  for (const [symbol, tokenData] of Object.entries(testTokens)) {
    try {
      const tokenAddress = tokenData.address;
      const tokenDecimals = tokenData.decimals;
      
      // Check if already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const currentWeight = await vault.tokenWeights(tokenAddress);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`⏩ ${symbol} (${tokenAddress}) is already whitelisted with weight ${currentWeight}`);
        continue;
      }
      
      // Configure based on token type
      let weight, minProfitBps, maxUsdgAmount, isStable, isShortable;
      
      if (symbol === "TUSD") {
        weight = 10000; // 10% weight
        minProfitBps = 75; // 0.75%
        maxUsdgAmount = ethers.utils.parseUnits("50000000", 18); // 50M max
        isStable = true;
        isShortable = false;
      } else if (symbol === "TETH") {
        weight = 20000; // 20% weight
        minProfitBps = 150; // 1.5%
        maxUsdgAmount = ethers.utils.parseUnits("100000000", 18); // 100M max
        isStable = false;
        isShortable = true;
      } else {
        weight = 20000; // 20% weight
        minProfitBps = 150; // 1.5%
        maxUsdgAmount = ethers.utils.parseUnits("50000000", 18); // 50M max
        isStable = false;
        isShortable = true;
      }
      
      console.log(`Whitelisting ${symbol} (${tokenAddress})...`);
      console.log(`Parameters: weight=${weight}, minProfitBps=${minProfitBps}, isStable=${isStable}, isShortable=${isShortable}`);
      
      const options = {
        gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
        gasLimit: 500000
      };
      
      const tx = await vault.setTokenConfig(
        tokenAddress,
        tokenDecimals,
        weight,
        minProfitBps,
        maxUsdgAmount,
        isStable,
        isShortable,
        options
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ ${symbol} has been successfully whitelisted!`);
      
      // Verify
      const verifyWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const verifyWeight = await vault.tokenWeights(tokenAddress);
      console.log(`Verification: ${symbol} whitelisted=${verifyWhitelisted}, weight=${verifyWeight}`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${symbol}:`, error.message);
    }
  }
  
  console.log("\nCreating environment file for frontend...");
  const envContent = `# GMX V1 Environment Variables for World Chain
# Generated on ${new Date().toISOString()}

# Network Configuration
VITE_WORLD_RPC_URL="https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/"
VITE_CHAIN_ID=480

# Oracle Keeper Configuration
VITE_ORACLE_KEEPER_URL="https://oracle-keeper.kevin8396.workers.dev"
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
`;

  fs.writeFileSync(path.join(__dirname, "../../.env.world.custom"), envContent);
  console.log("Created environment file: .env.world.custom");
  
  console.log("\nImplementation Summary:");
  console.log("======================");
  console.log("1. Attempted to whitelist test tokens in the custom Vault");
  console.log("2. Created environment file for frontend integration");
  console.log("3. Next step: Configure your frontend with the custom environment variables");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
