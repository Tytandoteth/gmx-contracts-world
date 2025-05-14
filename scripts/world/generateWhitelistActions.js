const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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

// Main function
async function main() {
  console.log("Generating token whitelisting actions for governance...");
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Check for required contracts
  if (!deploymentData.Vault) {
    console.error("Vault not deployed. Please check your deployment data.");
    process.exit(1);
  }
  
  // Get Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Get governance address
  const gov = await vault.gov();
  console.log(`Current Vault governance: ${gov}`);
  
  // Token configuration
  const tokens = [
    {
      symbol: "WLD",
      address: deploymentData.WLD || "0x7aE97042a4A0eB4D1eB370C34F9736f9f85dB523", 
      decimals: 18,
      weight: 10000, // 10% weight
      minProfitBps: 75, // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("50000000", 18), // 50M max
      isStable: true,
      isShortable: false
    },
    {
      symbol: "WETH",
      address: deploymentData.WETH || "0x4200000000000000000000000000000000000006", 
      decimals: 18,
      weight: 20000, // 20% weight
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("100000000", 18), // 100M max
      isStable: false,
      isShortable: true
    },
    {
      symbol: "MAG",
      address: deploymentData.MAG || "0x7aeD5a612190f09Bd452dE1b8919E589f9BC1d5d", 
      decimals: 18,
      weight: 5000, // 5% weight
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("20000000", 18), // 20M max
      isStable: false,
      isShortable: true
    }
  ];
  
  console.log("\nToken Whitelisting Actions:");
  console.log("=========================\n");
  
  // Generate function calls for each token
  for (const token of tokens) {
    // Check if token is already whitelisted
    try {
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      const currentWeight = await vault.tokenWeights(token.address);
      
      if (isWhitelisted && currentWeight.gt(0)) {
        console.log(`${token.symbol} (${token.address}) is already whitelisted with weight ${currentWeight.toString()}`);
        continue;
      }
      
      // Generate the action
      console.log(`// Whitelist ${token.symbol} (${token.address})`);
      console.log(`await vault.setTokenConfig(
  "${token.address}", 
  ${token.decimals}, 
  ${token.weight}, 
  ${token.minProfitBps}, 
  "${token.maxUsdgAmount.toString()}", 
  ${token.isStable}, 
  ${token.isShortable}
);`);
      console.log("");

      // Generate JSON format for custom governance tool if needed
      const jsonAction = {
        target: deploymentData.Vault,
        action: "setTokenConfig",
        args: [
          token.address,
          token.decimals,
          token.weight,
          token.minProfitBps,
          token.maxUsdgAmount.toString(),
          token.isStable,
          token.isShortable
        ]
      };
      
      console.log("JSON format for governance tools:");
      console.log(JSON.stringify(jsonAction, null, 2));
      console.log("");
      
    } catch (error) {
      console.error(`Error checking ${token.symbol}:`, error.message);
    }
  }
  
  // Generate ABI-encoded calldata for direct execution
  console.log("\nABI-encoded calldata for direct execution:");
  console.log("==========================================\n");
  
  const vaultInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ]);
  
  for (const token of tokens) {
    try {
      const calldata = vaultInterface.encodeFunctionData("setTokenConfig", [
        token.address,
        token.decimals,
        token.weight,
        token.minProfitBps,
        token.maxUsdgAmount,
        token.isStable,
        token.isShortable
      ]);
      
      console.log(`${token.symbol}: ${calldata}`);
    } catch (error) {
      console.error(`Error generating calldata for ${token.symbol}:`, error.message);
    }
  }
  
  console.log("\nYou can execute these actions through the governance contract at:", gov);
  console.log("\nInstructions:");
  console.log("1. If using a multi-sig wallet, prepare and submit the above transactions");
  console.log("2. If using a timelock, schedule these actions through the timelock controller");
  console.log("3. If using a DAO vote, submit these as proposals");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
