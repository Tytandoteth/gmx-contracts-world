const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function main() {
  console.log("Simple token whitelisting approach...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get IVault interface directly
  const vaultInterface = await ethers.getContractFactory("IVault");
  console.log("Retrieved IVault interface");
  
  // Get actual Vault instance
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  console.log(`Vault address: ${deploymentData.Vault}`);
  
  // Try to query the vault ABI directly by calling some function we know exists
  try {
    const isInitialized = await vault.isInitialized();
    console.log(`Vault initialized: ${isInitialized}`);
  } catch (error) {
    console.error("Error checking if vault is initialized:", error.message);
  }
  
  // Check existing whitelisted tokens
  try {
    const whitelistedCount = await vault.whitelistedTokenCount();
    console.log(`Whitelisted token count: ${whitelistedCount}`);
    
    for (let i = 0; i < Math.min(whitelistedCount.toNumber(), 10); i++) {
      const token = await vault.allWhitelistedTokens(i);
      console.log(`Whitelisted token ${i}: ${token}`);
    }
  } catch (error) {
    console.error("Error checking whitelisted tokens:", error.message);
  }
  
  // Try a different way to whitelist tokens
  console.log("\nTrying direct low-level call to whitelist WLD token...");
  const wldToken = deploymentData.WLD;
  
  // Using the IVault interface signature to create the calldata
  try {
    const iVault = await ethers.getContractAt("IVault", deploymentData.Vault);
    
    // Get function signature from IVault
    const functionSig = iVault.interface.getSighash("setTokenConfig");
    console.log(`SetTokenConfig function signature: ${functionSig}`);
    
    // Try to call the function directly
    const tx = await deployer.sendTransaction({
      to: iVault.address,
      data: iVault.interface.encodeFunctionData("setTokenConfig", [
        wldToken,
        18, // decimals
        10000, // weight (100%)
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      ]),
      gasLimit: 1000000,
    });
    
    console.log(`Direct transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("Transaction completed");
    
    // Check if token was whitelisted
    const isWhitelisted = await vault.whitelistedTokens(wldToken);
    console.log(`WLD token now whitelisted: ${isWhitelisted}`);
  } catch (error) {
    console.error("Error in direct call approach:", error.message);
    
    // If that fails, let's check if the contract is actually what we think it is
    console.log("\nVerifying contract code...");
    try {
      // Get the bytecode of the deployed contract
      const bytecode = await ethers.provider.getCode(deploymentData.Vault);
      console.log(`Bytecode length: ${bytecode.length}`);
      console.log(`First few bytes: ${bytecode.slice(0, 66)}...`);
      
      // Let's try redeploying a test vault to see if that helps
      console.log("\nRedeploying a test Vault to compare signatures...");
      
      const VaultFactory = await ethers.getContractFactory("Vault");
      const testVault = await VaultFactory.deploy();
      await testVault.deployed();
      
      console.log(`Test Vault deployed at: ${testVault.address}`);
      
      // Try to call initialize on the test vault
      try {
        const tx = await testVault.initialize(
          ethers.constants.AddressZero, // Router
          ethers.constants.AddressZero, // USDG
          ethers.constants.AddressZero, // Pricefeed
          0, // liquidationFeeUsd
          0, // fundingRateFactor
          0  // stableFundingRateFactor
        );
        
        await tx.wait();
        console.log("Test Vault initialized successfully");
        
        // Now try to set token config on the test vault
        const testTx = await testVault.setTokenConfig(
          wldToken,
          18, // decimals
          10000, // weight (100%)
          0, // minProfitBps
          ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
          true, // isStable
          false // isShortable
        );
        
        await testTx.wait();
        console.log("Test Vault token config set successfully");
        
        // This indicates our approach should be working, so the issue is with the deployed Vault
        console.log("\nPROBLEM IDENTIFIED: The deployed Vault contract doesn't match our interface!");
        console.log("Consider redeploying the Vault contract.");
      } catch (initError) {
        console.error("Error initializing test vault:", initError.message);
      }
    } catch (bytecodeError) {
      console.error("Error checking bytecode:", bytecodeError.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
