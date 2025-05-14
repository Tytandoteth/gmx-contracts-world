const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Minimal gas settings to work with limited funds
const LOW_GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.1", "gwei"), // Extremely low gas price
  gasLimit: 1000000 // Lower gas limit
};

async function main() {
  console.log("=".repeat(80));
  console.log("GMX V1 Minimal Gas Token Whitelisting");
  console.log("=".repeat(80));
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Calculate max affordable gas
  const affordableGas = balance.div(LOW_GAS_OPTIONS.gasPrice);
  console.log(`Maximum affordable gas: ${affordableGas.toString()} units`);
  console.log(`Using gas limit: ${LOW_GAS_OPTIONS.gasLimit} units`);
  console.log(`Gas price: ${ethers.utils.formatUnits(LOW_GAS_OPTIONS.gasPrice, "gwei")} gwei`);
  
  // Load custom deployment
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Extract key addresses
  const vaultAddress = customDeployment.CustomVault;
  const simplePriceFeedAddress = customDeployment.SimplePriceFeed;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Get test tokens
  const testTokens = customDeployment.TestDeployment.tokens;
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // Step 1: Attempt to set prices with minimal gas
  console.log("\nStep 1: Setting minimal prices in SimplePriceFeed...");
  
  // We'll only try TUSD to save gas
  const tusd = testTokens.TUSD;
  
  const simplePriceFeedAbi = [
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  try {
    // Try to get current price first (view function, no gas needed)
    try {
      const currentPrice = await simplePriceFeed.getPrice(tusd.address);
      console.log(`Current TUSD price: ${ethers.utils.formatUnits(currentPrice, 30)} USD`);
      
      // If we already have a price, skip setting it
      if (currentPrice.gt(0)) {
        console.log("✅ TUSD already has a price, skipping price setting");
      } else {
        console.log("No price set yet, will attempt to set");
      }
    } catch (error) {
      console.log(`No current price available: ${error.message}`);
    }
    
    // Setting just one token price to save gas
    const tokenAddresses = [tusd.address];
    const tokenPrices = [ethers.utils.parseUnits("1", 30)]; // $1 for TUSD
    
    console.log("Setting TUSD price to $1.00...");
    const setPricesTx = await simplePriceFeed.setPrices(tokenAddresses, tokenPrices, LOW_GAS_OPTIONS);
    console.log(`Transaction submitted: ${setPricesTx.hash}`);
    await setPricesTx.wait();
    console.log("✅ Price set successfully");
    
    // Verify price
    const updatedPrice = await simplePriceFeed.getPrice(tusd.address);
    console.log(`Updated TUSD price: ${ethers.utils.formatUnits(updatedPrice, 30)} USD`);
  } catch (error) {
    console.error(`❌ Failed to set price: ${error.message}`);
    
    // If it's insufficient funds, provide details
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.log("\nGas calculation details:");
      console.log(`- Your balance: ${ethers.utils.formatEther(balance)} ETH`);
      console.log(`- Gas price: ${ethers.utils.formatUnits(LOW_GAS_OPTIONS.gasPrice, "gwei")} gwei`);
      console.log(`- Gas limit: ${LOW_GAS_OPTIONS.gasLimit}`);
      console.log(`- Max transaction cost: ${ethers.utils.formatEther(LOW_GAS_OPTIONS.gasPrice.mul(LOW_GAS_OPTIONS.gasLimit))} ETH`);
      
      // Calculate minimum needed ETH
      console.log(`\nYou need at least ${ethers.utils.formatEther(LOW_GAS_OPTIONS.gasPrice.mul(300000))} ETH for a basic transaction`);
    }
  }
  
  // Step 2: Try minimal token whitelisting with zero weight
  console.log("\nStep 2: Attempting minimal token whitelisting...");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Check if TUSD is already whitelisted
  try {
    const isWhitelisted = await vault.whitelistedTokens(tusd.address);
    
    if (isWhitelisted) {
      console.log("✅ TUSD is already whitelisted!");
      
      // Check decimals
      const decimals = await vault.tokenDecimals(tusd.address);
      console.log(`TUSD registered decimals: ${decimals}`);
    } else {
      console.log("TUSD is not yet whitelisted");
      
      // Try minimal whitelisting with zero weight to save gas
      try {
        console.log("\nAttempting to whitelist TUSD with minimal settings...");
        
        // Minimal parameters to reduce gas usage
        const tx = await vault.setTokenConfig(
          tusd.address,
          tusd.decimals,
          100,               // Very low weight (0.1%)
          0,                 // No min profit
          ethers.utils.parseUnits("1000", 18), // Very low max USDG
          true,              // Is stable
          false,             // Not shortable
          LOW_GAS_OPTIONS    // Low gas settings
        );
        
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          console.log("✅ TUSD successfully whitelisted!");
        } else {
          console.log("❌ Transaction failed");
        }
        
        // Verify whitelist status
        const whitelistStatus = await vault.whitelistedTokens(tusd.address);
        console.log(`TUSD whitelist status: ${whitelistStatus ? "Whitelisted" : "Not whitelisted"}`);
      } catch (error) {
        console.error(`❌ Whitelisting failed: ${error.message}`);
        
        if (error.message.includes("execution reverted")) {
          console.log("\nThis appears to be a contract logic error, not a gas issue.");
          console.log("Potential fixes:");
          console.log("1. Check if price feed is properly connected");
          console.log("2. Ensure the Vault can access price data");
          console.log("3. Review GMX V1 source code for token whitelisting requirements");
        }
      }
    }
  } catch (error) {
    console.error(`Error checking whitelist status: ${error.message}`);
  }
  
  // Suggest frontend-only implementation as fallback
  console.log("\n=== Frontend Integration Plan ===");
  console.log("Given the current challenges with token whitelisting, we recommend:");
  console.log("1. Proceed with frontend integration in read-only mode");
  console.log("2. Use Oracle Keeper for price data display");
  console.log("3. Show 'Coming Soon' for trading features");
  console.log("4. Add more ETH to your account for further contract operations");
  console.log("5. If you need full trading functionality quickly, consider funding the account with about 0.1 ETH");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
