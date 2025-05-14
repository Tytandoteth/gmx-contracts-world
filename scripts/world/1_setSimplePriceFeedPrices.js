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
    WETH: 2536.61,
    MAG: 0.00038699
  };
}

// Get price in the format expected by GMX (30 decimals)
function getPriceInGmxFormat(price) {
  // GMX uses 30 decimals for prices
  return ethers.utils.parseUnits(price.toString(), 30);
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
  console.log("Setting prices in SimplePriceFeed for custom deployment on World Chain...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the SimplePriceFeed address
  if (!customData.SimplePriceFeed) {
    console.error("SimplePriceFeed address not found in deployment data.");
    process.exit(1);
  }
  
  // Get Oracle Keeper prices
  const prices = await fetchPrices();
  console.log("Using prices:", prices);
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Load SimplePriceFeed contract
  const simplePriceFeedAbi = [
    "function owner() external view returns (address)",
    "function setPrice(address _token, uint256 _price) external",
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    customData.SimplePriceFeed,
    simplePriceFeedAbi,
    deployer
  );
  
  // Check SimplePriceFeed ownership
  try {
    const owner = await simplePriceFeed.owner();
    console.log(`SimplePriceFeed owner: ${owner}`);
    
    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
    console.log(`Current account is owner: ${isOwner}`);
    
    if (!isOwner) {
      console.warn("WARNING: Current account is not the owner. Transactions may fail.");
    }
  } catch (error) {
    console.error("Error checking SimplePriceFeed ownership:", error.message);
  }
  
  // Get test tokens
  const testTokens = customData.TestDeployment.tokens;
  if (!testTokens) {
    console.error("Test tokens not found in deployment data.");
    process.exit(1);
  }
  
  // Create price mapping for test tokens
  const tokenPrices = [];
  const tokens = [];
  
  // Map prices to test tokens (TUSD = WLD, TETH = WETH)
  if (testTokens.TUSD && prices.WLD) {
    tokens.push(testTokens.TUSD.address);
    tokenPrices.push(getPriceInGmxFormat(prices.WLD));
    console.log(`Set TUSD price to ${prices.WLD} USD (WLD price)`);
  }
  
  if (testTokens.TETH && prices.WETH) {
    tokens.push(testTokens.TETH.address);
    tokenPrices.push(getPriceInGmxFormat(prices.WETH));
    console.log(`Set TETH price to ${prices.WETH} USD (WETH price)`);
  }
  
  if (testTokens.TBTC) {
    // Use a fixed price for TBTC (BTC equivalent)
    const btcPrice = 40000; // Default BTC price
    tokens.push(testTokens.TBTC.address);
    tokenPrices.push(getPriceInGmxFormat(btcPrice));
    console.log(`Set TBTC price to ${btcPrice} USD (default BTC price)`);
  }
  
  // Try setting each price individually if batch fails
  const setIndividualPrices = async () => {
    console.log("Setting prices individually...");
    for (let i = 0; i < tokens.length; i++) {
      try {
        console.log(`Setting price for ${tokens[i]} to ${ethers.utils.formatUnits(tokenPrices[i], 30)} USD...`);
        const tx = await simplePriceFeed.setPrice(tokens[i], tokenPrices[i], getGasOptions());
        console.log(`Transaction submitted: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Price set successfully for ${tokens[i]}`);
      } catch (error) {
        console.error(`❌ Error setting price for ${tokens[i]}:`, error.message);
      }
    }
  };
  
  // Set prices in SimplePriceFeed contract
  try {
    console.log("Setting prices in batch...");
    const gasOptions = getGasOptions();
    console.log(`Using gas limit: ${gasOptions.gasLimit.toString()}, gas price: ${ethers.utils.formatUnits(gasOptions.gasPrice, 'gwei')} gwei`);
    
    const tx = await simplePriceFeed.setPrices(tokens, tokenPrices, gasOptions);
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Prices set successfully in SimplePriceFeed");
  } catch (error) {
    console.error("❌ Error setting prices in batch:", error.message);
    console.log("Trying individual price settings...");
    await setIndividualPrices();
  }
  
  // Verify prices were set correctly
  console.log("\nVerifying prices:");
  for (let i = 0; i < tokens.length; i++) {
    try {
      const price = await simplePriceFeed.getPrice(tokens[i]);
      console.log(`✅ Verified price for ${tokens[i]}: ${ethers.utils.formatUnits(price, 30)} USD`);
    } catch (error) {
      console.error(`❌ Error verifying price for ${tokens[i]}:`, error.message);
    }
  }
  
  console.log("\nSimplePriceFeed price setting completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
