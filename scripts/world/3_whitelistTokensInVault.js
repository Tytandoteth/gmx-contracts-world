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
  console.log("Whitelisting tokens in Vault for custom deployment on World Chain...");
  
  // Get custom deployment data
  const customData = await getCustomDeploymentData();
  console.log("Custom deployment data loaded successfully");
  
  // Check if we have the CustomVault address
  if (!customData.CustomVault) {
    console.error("CustomVault address not found in deployment data.");
    process.exit(1);
  }
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Load Vault contract
  const vaultAbi = [
    "function gov() external view returns (address)",
    "function owner() external view returns (address)",
    "function whitelistedTokens(address) external view returns (bool)",
    "function tokenWeights(address) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)",
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function allWhitelistedTokensLength() external view returns (uint256)",
    "function allWhitelistedTokens(uint256) external view returns (address)"
  ];
  
  const vault = new ethers.Contract(customData.CustomVault, vaultAbi, deployer);
  
  // Check governance/ownership
  let isGovernance = false;
  try {
    // Try gov() first
    const gov = await vault.gov();
    console.log(`Vault governance: ${gov}`);
    isGovernance = gov.toLowerCase() === deployer.address.toLowerCase();
  } catch (error) {
    console.log("No gov() function. Trying owner()...");
    try {
      // Try owner() if gov() fails
      const owner = await vault.owner();
      console.log(`Vault owner: ${owner}`);
      isGovernance = owner.toLowerCase() === deployer.address.toLowerCase();
    } catch (innerError) {
      console.error("Error checking Vault governance/ownership:", innerError.message);
    }
  }
  
  console.log(`Current account is governance/owner: ${isGovernance}`);
  if (!isGovernance) {
    console.warn("WARNING: Current account is not governance/owner. Transactions may fail.");
  }
  
  // Check current whitelisted tokens
  try {
    const totalWhitelistedTokens = await vault.allWhitelistedTokensLength();
    console.log(`Current whitelisted token count: ${totalWhitelistedTokens.toString()}`);
    
    if (totalWhitelistedTokens.gt(0)) {
      console.log("Currently whitelisted tokens:");
      for (let i = 0; i < totalWhitelistedTokens.toNumber(); i++) {
        const token = await vault.allWhitelistedTokens(i);
        const weight = await vault.tokenWeights(token);
        console.log(`${i + 1}. ${token} (Weight: ${weight.toString()})`);
      }
    }
    
    // Check total token weights
    const totalWeights = await vault.totalTokenWeights();
    console.log(`Current total token weights: ${totalWeights.toString()}`);
  } catch (error) {
    console.warn("Couldn't get current whitelisted tokens:", error.message);
  }
  
  // Get test tokens and token configuration
  const testTokens = customData.TestDeployment.tokens;
  if (!testTokens) {
    console.error("Test tokens not found in deployment data.");
    process.exit(1);
  }
  
  // Define token configurations
  const tokenConfigs = [
    {
      symbol: "TUSD",
      tokenDecimals: testTokens.TUSD.decimals,
      tokenWeight: 10000,  // 10% weight
      minProfitBps: 75,    // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18),  // 50M max
      isStable: true,
      isShortable: false
    },
    {
      symbol: "TETH",
      tokenDecimals: testTokens.TETH.decimals,
      tokenWeight: 20000,  // 20% weight
      minProfitBps: 150,   // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("100000000", 18),  // 100M max
      isStable: false,
      isShortable: true
    },
    {
      symbol: "TBTC",
      tokenDecimals: testTokens.TBTC.decimals,
      tokenWeight: 20000,  // 20% weight
      minProfitBps: 150,   // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18),  // 50M max
      isStable: false,
      isShortable: true
    }
  ];
  
  // Whitelist each token
  console.log("\nWhitelisting tokens in Vault...");
  for (const config of tokenConfigs) {
    const tokenAddress = testTokens[config.symbol].address;
    
    try {
      // Check if token is already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const currentWeight = await vault.tokenWeights(tokenAddress);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`✅ ${config.symbol} is already whitelisted with weight ${currentWeight.toString()}`);
        continue;
      }
      
      console.log(`Whitelisting ${config.symbol} (${tokenAddress})...`);
      console.log(`Parameters: weight=${config.tokenWeight}, minProfitBps=${config.minProfitBps}, maxUsdg=${ethers.utils.formatUnits(config.maxUsdgAmount, 18)}, isStable=${config.isStable}, isShortable=${config.isShortable}`);
      
      const gasOptions = getGasOptions();
      console.log(`Using gas limit: ${gasOptions.gasLimit.toString()}, gas price: ${ethers.utils.formatUnits(gasOptions.gasPrice, 'gwei')} gwei`);
      
      const tx = await vault.setTokenConfig(
        tokenAddress,
        config.tokenDecimals,
        config.tokenWeight,
        config.minProfitBps,
        config.maxUsdgAmount,
        config.isStable,
        config.isShortable,
        gasOptions
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ ${config.symbol} has been successfully whitelisted!`);
      
      // Verify whitelisting was successful
      const verifyWhitelisted = await vault.whitelistedTokens(tokenAddress);
      const verifyWeight = await vault.tokenWeights(tokenAddress);
      console.log(`Verification: ${config.symbol} whitelisted=${verifyWhitelisted}, weight=${verifyWeight.toString()}`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${config.symbol}:`, error.message);
    }
  }
  
  // Check total token weights after whitelisting
  try {
    const totalWeights = await vault.totalTokenWeights();
    console.log(`\nTotal token weights after whitelisting: ${totalWeights.toString()}`);
    
    // Check if weights sum is greater than 0
    if (totalWeights.gt(0)) {
      console.log("✅ Token whitelisting successful! Total weights > 0");
    } else {
      console.warn("⚠️ Warning: Total token weights are still 0. Check the contract configuration.");
    }
    
    // Check final whitelisted tokens
    const totalWhitelistedTokens = await vault.allWhitelistedTokensLength();
    console.log(`Final whitelisted token count: ${totalWhitelistedTokens.toString()}`);
    
    if (totalWhitelistedTokens.gt(0)) {
      console.log("Final whitelisted tokens:");
      for (let i = 0; i < totalWhitelistedTokens.toNumber(); i++) {
        const token = await vault.allWhitelistedTokens(i);
        const weight = await vault.tokenWeights(token);
        console.log(`${i + 1}. ${token} (Weight: ${weight.toString()})`);
      }
    }
  } catch (error) {
    console.warn("Couldn't get final whitelisted tokens:", error.message);
  }
  
  console.log("\nToken whitelisting process completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
