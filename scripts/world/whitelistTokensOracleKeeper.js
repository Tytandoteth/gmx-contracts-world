const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Oracle Keeper URL
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";

// Get deployment data if it exists
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    return {};
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    return {};
  }
  
  return JSON.parse(fileContent);
}

// Fetch prices from Oracle Keeper
async function fetchPrices() {
  try {
    // Use the direct-prices endpoint for real-time data
    const response = await axios.get(`${ORACLE_KEEPER_URL}/direct-prices`);
    if (response.data && response.data.prices) {
      console.log("Prices fetched from Oracle Keeper:", response.data.prices);
      return response.data.prices;
    } else {
      console.warn("Invalid response format from Oracle Keeper");
      return null;
    }
  } catch (error) {
    console.error("Error fetching prices from Oracle Keeper:", error.message);
    return null;
  }
}

// Check Oracle Keeper health
async function checkOracleHealth() {
  try {
    const response = await axios.get(`${ORACLE_KEEPER_URL}/health`);
    return response.data.status === "ok";
  } catch (error) {
    console.error("Oracle Keeper health check failed:", error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log("Whitelisting tokens for Oracle Keeper integration on World Chain...");
  
  // Check Oracle Keeper health but don't exit if unhealthy
  const isOracleHealthy = await checkOracleHealth();
  if (!isOracleHealthy) {
    console.warn("⚠️ Oracle Keeper health check failed. Proceeding anyway with token whitelisting.");
    console.warn("You can manually check by visiting: https://oracle-keeper.kevin8396.workers.dev/health");
  } else {
    console.log("✅ Oracle Keeper is healthy.");
  }
  
  // Fetch latest prices or use fallback values
  let prices = await fetchPrices();
  if (!prices) {
    console.warn("⚠️ Failed to fetch prices from Oracle Keeper. Using fallback values instead.");
    // Use fallback prices from project status memory
    prices = {
      WLD: 1.24,
      WETH: 2481.08,
      MAG: 0.00041212
    };
  }
  
  // Verify we have all the required tokens (either from API or fallback)
  if (!prices.WLD || !prices.WETH || !prices.MAG) {
    console.warn("⚠️ Missing some token prices. Using fallback values for missing tokens.");
    prices.WLD = prices.WLD || 1.24;
    prices.WETH = prices.WETH || 2481.08;
    prices.MAG = prices.MAG || 0.00041212;
  }
  
  console.log("Using the following token prices:");
  console.log(`WLD: $${prices.WLD}`);
  console.log(`WETH: $${prices.WETH}`);
  console.log(`MAG: $${prices.MAG}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Check for required contracts
  if (!deploymentData.Vault) {
    console.error("Vault not deployed. Please deploy core contracts first using deployCoreWorld.js");
    process.exit(1);
  }
  
  // Get Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Check governance status
  const gov = await vault.gov();
  console.log(`Vault governance address: ${gov}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  // Check if deployer is the governor
  const isDeployerGov = gov.toLowerCase() === deployer.address.toLowerCase();
  
  // Check if Timelock is the governor
  const isTimelockGov = deploymentData.Timelock && gov.toLowerCase() === deploymentData.Timelock.toLowerCase();
  
  console.log(`Deployer is governor: ${isDeployerGov}`);
  console.log(`Timelock is governor: ${isTimelockGov}`);
  
  if (!isDeployerGov && !isTimelockGov) {
    console.error("Neither deployer nor Timelock is the governance of the Vault. Cannot whitelist tokens.");
    process.exit(1);
  }
  
  // Token configuration
  const tokens = [
    {
      symbol: "WLD",
      address: deploymentData.WLD || "0x7aE97042a4A0eB4D1eB370C34F9736f9f85dB523", // Default WLD address if not in deployment data
      decimals: 18,
      weight: 10000, // 10% weight
      minProfitBps: 75, // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18), // 50M max
      isStable: true,
      isShortable: false
    },
    {
      symbol: "WETH",
      address: deploymentData.WETH || "0x4200000000000000000000000000000000000006", // Default WETH address if not in deployment data
      decimals: 18,
      weight: 20000, // 20% weight
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("100000000", 18), // 100M max
      isStable: false,
      isShortable: true
    },
    {
      symbol: "MAG",
      address: deploymentData.MAG || "0x7aeD5a612190f09Bd452dE1b8919E589f9BC1d5d", // Explicit MAG token address
      decimals: 18,
      weight: 5000, // 5% weight
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("20000000", 18), // 20M max
      isStable: false,
      isShortable: true
    }
  ];
  
  // Filter out tokens with missing addresses
  const tokensToWhitelist = tokens.filter(token => token.address);
  
  if (tokensToWhitelist.length === 0) {
    console.error("No valid token addresses found. Please update deployment data or provide addresses directly in the script.");
    process.exit(1);
  }
  
  if (tokensToWhitelist.length !== tokens.length) {
    console.warn(`Warning: Only ${tokensToWhitelist.length} of ${tokens.length} tokens have valid addresses and will be whitelisted.`);
    
    // List missing tokens
    const missingTokens = tokens.filter(token => !token.address).map(token => token.symbol);
    console.warn(`Missing addresses for: ${missingTokens.join(", ")}`);
  }
  
  // Process each token
  for (const token of tokensToWhitelist) {
    console.log(`\nProcessing ${token.symbol} (${token.address})...`);
    
    try {
      // Check if token is already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      const currentWeight = await vault.tokenWeights(token.address);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`${token.symbol} is already whitelisted with weight ${currentWeight.toString()}`);
        continue;
      }
      
      // Whitelist token
      if (isDeployerGov) {
        console.log(`Whitelisting ${token.symbol}...`);
        
        const tx = await vault.setTokenConfig(
          token.address,
          token.decimals,
          token.weight,
          token.minProfitBps,
          token.maxUsdgAmount,
          token.isStable,
          token.isShortable
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`${token.symbol} successfully whitelisted in Vault`);
        
        // Verify whitelisting was successful
        const isNowWhitelisted = await vault.whitelistedTokens(token.address);
        const newWeight = await vault.tokenWeights(token.address);
        console.log(`Verification: ${token.symbol} whitelisted=${isNowWhitelisted}, weight=${newWeight.toString()}`);
      } else {
        // If Timelock is the governor, provide instructions to whitelist the token through Timelock
        console.log(`${token.symbol}: Timelock is the governor. Execute the following through Timelock:`);
        console.log(`vault.setTokenConfig(${token.address}, ${token.decimals}, ${token.weight}, ${token.minProfitBps}, ${token.maxUsdgAmount.toString()}, ${token.isStable}, ${token.isShortable})`);
      }
    } catch (error) {
      console.error(`Error processing ${token.symbol}:`, error.message);
    }
  }
  
  if (isDeployerGov) {
    try {
      // Get total token weights after whitelisting
      const totalWeights = await vault.totalTokenWeights();
      console.log(`\nTotal token weights after whitelisting: ${totalWeights.toString()}`);
      
      // Check if totalWeights is greater than 0
      if (totalWeights.gt(0)) {
        console.log("✅ Token whitelisting successful! Total weights > 0");
      } else {
        console.warn("⚠️ Warning: Total token weights are still 0. Please check contract configuration.");
      }
    } catch (error) {
      console.error("Error checking total weights:", error.message);
    }
  }
  
  console.log("\nToken whitelisting process completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
