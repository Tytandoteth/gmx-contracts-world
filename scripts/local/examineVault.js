const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found. Please deploy contracts first.");
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Deployment data is empty. Please deploy contracts first.");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

async function main() {
  console.log("Examining Vault contract on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  console.log(`Vault address: ${deploymentData.Vault}`);
  
  // Print out available functions in the Vault interface
  console.log("\n--- Vault Interface ---");
  const vaultFunctions = Object.keys(vault.interface.functions);
  
  // Group functions by category
  const tokenConfigFuncs = vaultFunctions.filter(f => f.includes("Token") || f.includes("token"));
  const governanceFuncs = vaultFunctions.filter(f => f.includes("gov"));
  const priceFuncs = vaultFunctions.filter(f => f.includes("Price") || f.includes("price"));
  const otherFuncs = vaultFunctions.filter(f => 
    !tokenConfigFuncs.includes(f) && 
    !governanceFuncs.includes(f) && 
    !priceFuncs.includes(f)
  );
  
  console.log("\nToken Configuration Functions:");
  tokenConfigFuncs.forEach(f => console.log(`- ${f}`));
  
  console.log("\nGovernance Functions:");
  governanceFuncs.forEach(f => console.log(`- ${f}`));
  
  console.log("\nPrice Functions:");
  priceFuncs.forEach(f => console.log(`- ${f}`));
  
  console.log("\nOther Functions (sample):");
  otherFuncs.slice(0, 10).forEach(f => console.log(`- ${f}`));
  console.log(`... and ${otherFuncs.length - 10} more`);
  
  // Check governance
  const gov = await vault.gov();
  console.log(`\n--- Governance ---`);
  console.log(`Current Vault governance address: ${gov}`);
  console.log(`Is deployer the governor: ${gov.toLowerCase() === deployer.address.toLowerCase()}`);
  
  // Check token whitelisting
  console.log(`\n--- Whitelisted Tokens ---`);
  console.log(`WLD address: ${deploymentData.WLD}`);
  console.log(`WETH address: ${deploymentData.WETH}`);
  
  const wldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
  const wethWhitelisted = await vault.whitelistedTokens(deploymentData.WETH);
  
  console.log(`WLD whitelisted: ${wldWhitelisted}`);
  console.log(`WETH whitelisted: ${wethWhitelisted}`);
  
  const whitelistedCount = await vault.whitelistedTokenCount();
  console.log(`Total whitelisted tokens: ${whitelistedCount}`);
  
  // Try to find any whitelist function that might work
  try {
    console.log(`\n--- Testing Available Whitelist Functions ---`);
    
    if (vault.interface.functions['setTokenConfig(address,uint256,uint256,uint256,uint256,bool,bool)']) {
      console.log("Found setTokenConfig with 7 parameters");
    }
    
    // Let's look at direct ABI
    const vaultAbi = vault.interface.format('json');
    console.log(`\nVault ABI fragment for setTokenConfig: ${
      JSON.stringify(
        JSON.parse(vaultAbi).find(item => 
          item.name === 'setTokenConfig'
        ), null, 2
      )
    }`);
  } catch (error) {
    console.error("Error examining ABI:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
