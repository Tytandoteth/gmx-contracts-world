const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Oracle Keeper URL
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";

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

// Fetch prices from Oracle Keeper
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
  
  // Use fallback prices if API call fails
  console.warn("Using fallback prices for tokens");
  return {
    WLD: 1.24,
    WETH: 2481.08,
    MAG: 0.00041212
  };
}

// Map real token prices to test tokens
function mapPricesToTestTokens(prices, customData) {
  const testTokens = customData.TestDeployment.tokens;
  
  // Create mapping
  const tokenMapping = {
    WLD: "TUSD",
    WETH: "TETH",
    BTC: "TBTC"
  };
  
  // Create result object
  const result = {};
  
  // Map real token prices to test tokens
  for (const [realToken, testToken] of Object.entries(tokenMapping)) {
    if (prices[realToken] && testTokens[testToken]) {
      result[testToken] = prices[realToken];
    }
  }
  
  return result;
}

// Main function
async function main() {
  console.log("Whitelisting tokens for custom deployment on World Chain...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the Custom Vault address
  if (!customData.CustomVault) {
    console.error("Custom Vault address not found in deployment data.");
    process.exit(1);
  }
  
  // Get Oracle Keeper prices
  const oraclePrices = await fetchPrices();
  const testTokenPrices = mapPricesToTestTokens(oraclePrices, customData);
  
  console.log("Test token prices:");
  console.log(testTokenPrices);
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Load custom vault
  const vaultAbi = [
    "function gov() external view returns (address)",
    "function whitelistedTokens(address) external view returns (bool)",
    "function tokenWeights(address) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)",
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ];
  
  const vault = new ethers.Contract(customData.CustomVault, vaultAbi, deployer);
  
  // Check governance
  try {
    const gov = await vault.gov();
    console.log(`Custom Vault governance: ${gov}`);
    
    // Check if deployer is governance
    const isGov = gov.toLowerCase() === deployer.address.toLowerCase();
    console.log(`Current account is governance: ${isGov}`);
    
    if (!isGov) {
      console.warn("WARNING: Current account is not governance. Transactions may fail.");
      console.log(`Need to use the account that has governance control: ${gov}`);
    }
  } catch (error) {
    console.error("Error checking governance:", error.message);
  }
  
  // Prepare test tokens for whitelisting
  const testTokens = Object.keys(customData.TestDeployment.tokens);
  console.log(`\nTest tokens to whitelist: ${testTokens.join(", ")}`);
  
  // Define token configurations
  for (const token of testTokens) {
    try {
      const tokenAddress = customData.TestDeployment.tokens[token].address;
      const tokenDecimals = customData.TestDeployment.tokens[token].decimals;
      
      console.log(`\nProcessing ${token} (${tokenAddress})...`);
      
      // Check if token is already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const currentWeight = await vault.tokenWeights(tokenAddress);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`${token} is already whitelisted with weight ${currentWeight.toString()}`);
        continue;
      }
      
      // Define token-specific parameters
      let weight, minProfitBps, maxUsdgAmount, isStable, isShortable;
      
      // Different configuration based on token type
      if (token === "TUSD") {
        // Stablecoin
        weight = 10000; // 10% weight
        minProfitBps = 75; // 0.75%
        maxUsdgAmount = ethers.utils.parseUnits("50000000", 18); // 50M max
        isStable = true;
        isShortable = false;
      } else if (token === "TETH") {
        // WETH test token
        weight = 20000; // 20% weight
        minProfitBps = 150; // 1.5%
        maxUsdgAmount = ethers.utils.parseUnits("100000000", 18); // 100M max
        isStable = false;
        isShortable = true;
      } else if (token === "TBTC") {
        // BTC test token
        weight = 20000; // 20% weight
        minProfitBps = 150; // 1.5%
        maxUsdgAmount = ethers.utils.parseUnits("50000000", 18); // 50M max
        isStable = false;
        isShortable = true;
      } else {
        // Generic configuration for other tokens
        weight = 5000; // 5% weight
        minProfitBps = 150; // 1.5%
        maxUsdgAmount = ethers.utils.parseUnits("10000000", 18); // 10M max
        isStable = false;
        isShortable = false;
      }
      
      console.log(`Whitelisting ${token} with parameters:`);
      console.log(`  Weight: ${weight}`);
      console.log(`  MinProfitBps: ${minProfitBps}`);
      console.log(`  MaxUsdgAmount: ${ethers.utils.formatUnits(maxUsdgAmount, 18)}`);
      console.log(`  IsStable: ${isStable}`);
      console.log(`  IsShortable: ${isShortable}`);
      
      // Execute the transaction
      const tx = await vault.setTokenConfig(
        tokenAddress,
        tokenDecimals,
        weight,
        minProfitBps,
        maxUsdgAmount,
        isStable,
        isShortable
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ ${token} has been successfully whitelisted!`);
      
      // Verify whitelisting was successful
      const verifyWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const verifyWeight = await vault.tokenWeights(tokenAddress);
      console.log(`Verification: ${token} whitelisted=${verifyWhitelisted}, weight=${verifyWeight.toString()}`);
      
    } catch (error) {
      console.error(`❌ Error whitelisting ${token}:`, error.message);
    }
  }
  
  // Check total token weights
  try {
    const totalWeights = await vault.totalTokenWeights();
    console.log(`\nTotal token weights after whitelisting: ${totalWeights.toString()}`);
    
    // Check if weights sum is greater than 0
    if (totalWeights.gt(0)) {
      console.log("✅ Token whitelisting successful! Total weights > 0");
    } else {
      console.warn("⚠️ Warning: Total token weights are still 0. Check the contract configuration.");
    }
  } catch (error) {
    console.error("Error checking total weights:", error.message);
  }
  
  console.log("\nToken whitelisting process completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
