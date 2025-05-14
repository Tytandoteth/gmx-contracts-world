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
    WLD: 1.29,
    WETH: 2535.53,
    MAG: 0.00038697
  };
}

// Main function
async function main() {
  console.log("Generating token whitelisting actions for custom deployment governance...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the Custom Vault address
  if (!customData.CustomVault) {
    console.error("Custom Vault address not found in deployment data.");
    process.exit(1);
  }
  
  // Load custom vault
  const [deployer] = await ethers.getSigners();
  
  const vaultAbi = [
    "function gov() external view returns (address)",
    "function whitelistedTokens(address) external view returns (bool)",
    "function tokenWeights(address) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)",
    "function owner() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(customData.CustomVault, vaultAbi, deployer);
  
  // Check governance
  let gov;
  try {
    gov = await vault.gov();
    console.log(`Custom Vault governance: ${gov}`);
  } catch (error) {
    console.error("Error checking Vault governance:", error.message);
    
    // Try checking owner instead
    try {
      gov = await vault.owner();
      console.log(`Custom Vault owner: ${gov}`);
    } catch (innerError) {
      console.error("Error checking Vault owner:", innerError.message);
      gov = "Unknown";
    }
  }
  
  console.log(`\nToken Whitelisting Actions for Custom Vault (${customData.CustomVault}):`);
  console.log("=========================\n");
  
  // Define token configurations for custom tokens
  const tokens = [
    // Token configurations based on the test tokens in CustomDeployment
    {
      name: "TUSD (WLD)",
      address: customData.TestDeployment.tokens.TUSD.address,
      decimals: customData.TestDeployment.tokens.TUSD.decimals,
      weight: 10000,  // 10% weight
      minProfitBps: 75,  // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18).toString(),  // 50M max
      isStable: true,
      isShortable: false
    },
    {
      name: "TETH (WETH)",
      address: customData.TestDeployment.tokens.TETH.address,
      decimals: customData.TestDeployment.tokens.TETH.decimals,
      weight: 20000,  // 20% weight
      minProfitBps: 150,  // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("100000000", 18).toString(),  // 100M max
      isStable: false,
      isShortable: true
    },
    {
      name: "TBTC (BTC)",
      address: customData.TestDeployment.tokens.TBTC.address,
      decimals: customData.TestDeployment.tokens.TBTC.decimals,
      weight: 20000,  // 20% weight
      minProfitBps: 150,  // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18).toString(),  // 50M max
      isStable: false,
      isShortable: true
    }
  ];
  
  console.log("Function calls for direct execution:");
  console.log("-----------------------------------");
  
  // Generate function calls for each token
  for (const token of tokens) {
    try {
      console.log(`// Whitelist ${token.name} (${token.address})`);
      console.log(`await vault.setTokenConfig(
  "${token.address}", 
  ${token.decimals}, 
  ${token.weight}, 
  ${token.minProfitBps}, 
  "${token.maxUsdgAmount}", 
  ${token.isStable}, 
  ${token.isShortable}
);`);
      console.log();
      
      // Generate JSON format for governance tools
      console.log(`JSON format for governance tools:`);
      console.log(JSON.stringify({
        target: customData.CustomVault,
        action: "setTokenConfig",
        args: [
          token.address,
          token.decimals,
          token.weight,
          token.minProfitBps,
          token.maxUsdgAmount,
          token.isStable,
          token.isShortable
        ]
      }, null, 2));
      console.log();
      
      // Generate ABI-encoded calldata
      const iface = new ethers.utils.Interface([
        "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
      ]);
      
      const calldata = iface.encodeFunctionData("setTokenConfig", [
        token.address,
        token.decimals,
        token.weight,
        token.minProfitBps,
        token.maxUsdgAmount,
        token.isStable,
        token.isShortable
      ]);
      
      console.log(`ABI-encoded calldata for direct execution:`);
      console.log(calldata);
      console.log();
    } catch (error) {
      console.error(`Error generating data for ${token.name}:`, error.message);
    }
  }
  
  console.log("Price Feed Configuration Actions:");
  console.log("================================");
  
  // Check if we have the SimplePriceFeed and CustomVaultPriceFeed addresses
  if (customData.SimplePriceFeed && customData.CustomVaultPriceFeed) {
    console.log(`\nTo set SimplePriceFeed for VaultPriceFeed:`);
    
    for (const token of tokens) {
      console.log(`\n// Set SimplePriceFeed for ${token.name}`);
      console.log(`await vaultPriceFeed.setPriceFeed("${token.address}", "${customData.SimplePriceFeed}");`);
      
      // Generate JSON format for governance tools
      console.log(`\nJSON format for governance tools:`);
      console.log(JSON.stringify({
        target: customData.CustomVaultPriceFeed,
        action: "setPriceFeed",
        args: [
          token.address,
          customData.SimplePriceFeed
        ]
      }, null, 2));
    }
  }
  
  console.log("\nTo set prices in SimplePriceFeed:");
  
  // Fetch prices from Oracle Keeper
  const prices = await fetchPrices();
  
  const tokenAddresses = tokens.map(t => t.address);
  const tokenPrices = [];
  
  // Map prices to test tokens
  tokenPrices.push(ethers.utils.parseUnits(prices.WLD.toString(), 30).toString()); // TUSD price from WLD
  tokenPrices.push(ethers.utils.parseUnits(prices.WETH.toString(), 30).toString()); // TETH price from WETH
  tokenPrices.push(ethers.utils.parseUnits("40000", 30).toString()); // TBTC price (fixed BTC price)
  
  console.log(`\n// Set prices for all tokens at once`);
  console.log(`await simplePriceFeed.setPrices(
  [${tokenAddresses.map(a => `"${a}"`).join(', ')}],
  [${tokenPrices.join(', ')}]
);`);
  
  // Generate JSON format for governance tools
  console.log(`\nJSON format for governance tools:`);
  console.log(JSON.stringify({
    target: customData.SimplePriceFeed,
    action: "setPrices",
    args: [
      tokenAddresses,
      tokenPrices
    ]
  }, null, 2));
  
  console.log("\nInstructions for Frontend Environment Variables:");
  console.log("=============================================");
  console.log(`
Add the following to your .env file in the gmx-interface-world project:

VITE_WORLD_RPC_URL="https://world-chain.testnet.worldcoin.org"
VITE_ORACLE_KEEPER_URL="https://oracle-keeper.kevin8396.workers.dev"
VITE_USE_PRODUCTION_PRICES=true
VITE_CHAIN_ID=480

# Custom V1 Contract Addresses
VITE_VAULT_ADDRESS="${customData.CustomVault}"
VITE_ROUTER_ADDRESS="${customData.CustomRouter}"
VITE_POSITION_ROUTER_ADDRESS="${customData.CustomPositionRouter || ''}"
VITE_POSITION_MANAGER_ADDRESS="${customData.CustomPositionManager || ''}"
VITE_VAULT_PRICE_FEED_ADDRESS="${customData.CustomVaultPriceFeed || ''}"
`);
  
  console.log("\nYou can execute these actions through:");
  console.log(`1. If you have direct access to the governance account (${gov}), use these function calls`);
  console.log("2. If using a multi-sig wallet, prepare and submit the transactions using the JSON format");
  console.log("3. If using a timelock, schedule these actions through the timelock controller");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
