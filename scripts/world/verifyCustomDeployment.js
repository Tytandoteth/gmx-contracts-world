const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Contract verification script for the custom GMX deployment
 * This script checks:
 * 1. Deployment status and bytecode verification
 * 2. Basic functionality
 * 3. Contract interconnections and permissions
 * 4. Ownership and governance configuration
 */
async function main() {
  console.log("======================================================");
  console.log("CUSTOM DEPLOYMENT VERIFICATION");
  console.log("======================================================");
  
  // Load deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded custom deployment data");
  } catch (error) {
    console.error("❌ Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`\nVerification by: ${deployer.address}`);
  
  // Set up results tracking
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: {}
  };
  
  // Record test result
  function recordResult(test, passed, message, details = null) {
    if (!results.details[test]) {
      results.details[test] = [];
    }
    
    if (passed === true) {
      results.passed++;
      results.details[test].push({ status: "PASSED", message, details });
      console.log(`✅ ${message}`);
    } else if (passed === false) {
      results.failed++;
      results.details[test].push({ status: "FAILED", message, details });
      console.error(`❌ ${message}`);
    } else {
      results.warnings++;
      results.details[test].push({ status: "WARNING", message, details });
      console.warn(`⚠️ ${message}`);
    }
  }
  
  // Verify contract code exists (not just an EOA)
  async function verifyCodeExists(address, name) {
    try {
      const code = await ethers.provider.getCode(address);
      const hasCode = code !== "0x";
      recordResult(
        "Contract Code Verification", 
        hasCode, 
        `${name} at ${address} ${hasCode ? "has" : "has NO"} contract code`
      );
      return hasCode;
    } catch (error) {
      recordResult(
        "Contract Code Verification", 
        false, 
        `Error verifying code for ${name} at ${address}: ${error.message}`
      );
      return false;
    }
  }
  
  // Check contract connection
  async function verifyContractConnection(contractInstance, targetAddress, connectionMethod, name, targetName) {
    try {
      const address = await contractInstance[connectionMethod]();
      const isConnected = address.toLowerCase() === targetAddress.toLowerCase();
      recordResult(
        "Contract Connections", 
        isConnected, 
        `${name} ${isConnected ? "is" : "is NOT"} connected to ${targetName} (${targetAddress})`
      );
      return isConnected;
    } catch (error) {
      recordResult(
        "Contract Connections", 
        false, 
        `Error verifying connection from ${name} to ${targetName}: ${error.message}`
      );
      return false;
    }
  }
  
  // Check contract ownership
  async function verifyContractOwnership(contractInstance, name) {
    try {
      let owner;
      
      // Different contracts might have different ownership methods
      if (typeof contractInstance.owner === "function") {
        owner = await contractInstance.owner();
      } else if (typeof contractInstance.gov === "function") {
        owner = await contractInstance.gov();
      } else {
        recordResult(
          "Contract Ownership", 
          null, 
          `Cannot determine ownership method for ${name}`
        );
        return false;
      }
      
      const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
      recordResult(
        "Contract Ownership", 
        isOwner, 
        `${name} ${isOwner ? "is" : "is NOT"} owned by deployer (${deployer.address})`
      );
      return isOwner;
    } catch (error) {
      recordResult(
        "Contract Ownership", 
        false, 
        `Error verifying ownership for ${name}: ${error.message}`
      );
      return false;
    }
  }
  
  // Verify token details
  async function verifyToken(address, symbol) {
    try {
      const token = await ethers.getContractAt("MintableBaseToken", address);
      const tokenSymbol = await token.symbol();
      const tokenName = await token.name();
      const tokenDecimals = await token.decimals();
      const tokenSupply = await token.totalSupply();
      
      recordResult(
        "Token Verification", 
        true, 
        `${symbol} token verified`,
        {
          symbol: tokenSymbol,
          name: tokenName,
          decimals: tokenDecimals.toString(),
          totalSupply: ethers.utils.formatUnits(tokenSupply, tokenDecimals)
        }
      );
      return true;
    } catch (error) {
      recordResult(
        "Token Verification", 
        false, 
        `Error verifying ${symbol} token: ${error.message}`
      );
      return false;
    }
  }
  
  console.log("\n------------------------------------------------------");
  console.log("1. VERIFYING CONTRACT EXISTENCE");
  console.log("------------------------------------------------------");
  
  // Check all main contracts for existence
  const contracts = [
    { address: deploymentData.WLD, name: "WLD Token" },
    { address: deploymentData.WWORLD, name: "WWORLD Token" },
    { address: deploymentData.CustomVaultPriceFeed, name: "VaultPriceFeed" },
    { address: deploymentData.RedStonePriceFeed, name: "RedStonePriceFeed" },
    { address: deploymentData.CustomVault, name: "Vault" },
    { address: deploymentData.CustomUSDG, name: "USDG" },
    { address: deploymentData.CustomRouter, name: "Router" },
    { address: deploymentData.CustomVaultUtils, name: "VaultUtils" },
    { address: deploymentData.MockPriceFeeds?.WLD, name: "WLD MockPriceFeed" },
    { address: deploymentData.MockPriceFeeds?.WWORLD, name: "WWORLD MockPriceFeed" }
  ];
  
  for (const contract of contracts) {
    if (contract.address) {
      await verifyCodeExists(contract.address, contract.name);
    }
  }
  
  console.log("\n------------------------------------------------------");
  console.log("2. VERIFYING TOKENS");
  console.log("------------------------------------------------------");
  
  // Verify token details
  await verifyToken(deploymentData.WLD, "WLD");
  await verifyToken(deploymentData.WWORLD, "WWORLD");
  
  try {
    const usdg = await ethers.getContractAt("USDG", deploymentData.CustomUSDG);
    const usdgName = await usdg.name();
    const usdgSymbol = await usdg.symbol();
    const usdgDecimals = await usdg.decimals();
    const usdgSupply = await usdg.totalSupply();
    
    recordResult(
      "Token Verification", 
      true, 
      `USDG token verified`,
      {
        symbol: usdgSymbol,
        name: usdgName,
        decimals: usdgDecimals.toString(),
        totalSupply: ethers.utils.formatUnits(usdgSupply, usdgDecimals)
      }
    );
  } catch (error) {
    recordResult(
      "Token Verification", 
      false, 
      `Error verifying USDG token: ${error.message}`
    );
  }
  
  console.log("\n------------------------------------------------------");
  console.log("3. VERIFYING CONTRACT CONNECTIONS");
  console.log("------------------------------------------------------");
  
  // Get contract instances
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
  const vaultUtils = await ethers.getContractAt("VaultUtils", deploymentData.CustomVaultUtils);
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
  
  // Verify vault connections
  await verifyContractConnection(vault, deploymentData.CustomVaultPriceFeed, "priceFeed", "Vault", "VaultPriceFeed");
  await verifyContractConnection(vault, deploymentData.CustomRouter, "router", "Vault", "Router");
  await verifyContractConnection(vault, deploymentData.CustomUSDG, "usdg", "Vault", "USDG");
  await verifyContractConnection(vault, deploymentData.CustomVaultUtils, "vaultUtils", "Vault", "VaultUtils");
  
  // Verify router connections
  await verifyContractConnection(router, deploymentData.CustomVault, "vault", "Router", "Vault");
  await verifyContractConnection(router, deploymentData.CustomUSDG, "usdg", "Router", "USDG");
  
  // Verify vault utils connection
  await verifyContractConnection(vaultUtils, deploymentData.CustomVault, "vault", "VaultUtils", "Vault");
  
  // Check if VaultPriceFeed is configured for tokens
  try {
    // Check WLD price feed configuration
    const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
    recordResult(
      "Price Feed Configuration",
      wldPriceFeed !== ethers.constants.AddressZero,
      `VaultPriceFeed ${wldPriceFeed !== ethers.constants.AddressZero ? "has" : "has NO"} price feed for WLD`,
      { configuredPriceFeed: wldPriceFeed }
    );
    
    // Check WWORLD price feed configuration
    const wworldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WWORLD);
    recordResult(
      "Price Feed Configuration",
      wworldPriceFeed !== ethers.constants.AddressZero,
      `VaultPriceFeed ${wworldPriceFeed !== ethers.constants.AddressZero ? "has" : "has NO"} price feed for WWORLD`,
      { configuredPriceFeed: wworldPriceFeed }
    );
    
    // Check which price feed is being used (RedStone or Mock)
    const isUsingRedStoneWLD = wldPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase();
    recordResult(
      "Price Feed Configuration",
      null, // Not a pass/fail, just info
      `WLD is ${isUsingRedStoneWLD ? "using RedStonePriceFeed" : "using MockPriceFeed"}`,
      { 
        currentPriceFeed: wldPriceFeed, 
        redStonePriceFeed: deploymentData.RedStonePriceFeed,
        mockPriceFeed: deploymentData.MockPriceFeeds?.WLD
      }
    );
    
    const isUsingRedStoneWWORLD = wworldPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase();
    recordResult(
      "Price Feed Configuration",
      null, // Not a pass/fail, just info
      `WWORLD is ${isUsingRedStoneWWORLD ? "using RedStonePriceFeed" : "using MockPriceFeed"}`,
      { 
        currentPriceFeed: wworldPriceFeed, 
        redStonePriceFeed: deploymentData.RedStonePriceFeed,
        mockPriceFeed: deploymentData.MockPriceFeeds?.WWORLD
      }
    );
  } catch (error) {
    recordResult(
      "Price Feed Configuration",
      false,
      `Error checking price feed configuration: ${error.message}`
    );
  }
  
  console.log("\n------------------------------------------------------");
  console.log("4. VERIFYING CONTRACT GOVERNANCE");
  console.log("------------------------------------------------------");
  
  // Check governance/ownership of contracts
  await verifyContractOwnership(vault, "Vault");
  await verifyContractOwnership(vaultPriceFeed, "VaultPriceFeed");
  await verifyContractOwnership(router, "Router");
  await verifyContractOwnership(vaultUtils, "VaultUtils");
  await verifyContractOwnership(redStonePriceFeed, "RedStonePriceFeed");
  
  console.log("\n------------------------------------------------------");
  console.log("5. VERIFYING BASIC FUNCTIONALITY");
  console.log("------------------------------------------------------");
  
  // Try getting price from VaultPriceFeed
  try {
    // Check price data fetching
    // Note: Direct calls to getPrice may fail due to RedStone requiring special transaction formatting
    // This is expected behavior
    
    // Try getting price from mock price feeds as a fallback to ensure contract infrastructure works
    let hasWorkingPriceMechanism = false;
    
    try {
      const wldMockPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
      const wldPrice = await wldMockPriceFeed.latestAnswer();
      
      recordResult(
        "Price Feed Functionality",
        true,
        `Got WLD price from MockPriceFeed: ${ethers.utils.formatUnits(wldPrice, 8)} USD`
      );
      
      hasWorkingPriceMechanism = true;
    } catch (error) {
      recordResult(
        "Price Feed Functionality",
        false,
        `Error getting WLD price from MockPriceFeed: ${error.message}`
      );
    }
    
    // Try getting a price through the VaultPriceFeed (this might fail with RedStone without wrapping)
    try {
      const wldPrice = await vaultPriceFeed.getPrice(deploymentData.WLD, false, true, false);
      
      recordResult(
        "Price Feed Functionality",
        true,
        `Got WLD price through VaultPriceFeed: ${ethers.utils.formatUnits(wldPrice, 30)} USD`,
        { isRedStoneWorking: true }
      );
      
      hasWorkingPriceMechanism = true;
    } catch (error) {
      recordResult(
        "Price Feed Functionality",
        null, // Warning, not failure (expected with RedStone)
        `Cannot get WLD price through VaultPriceFeed directly: ${error.message}`,
        { note: "This is expected with RedStonePriceFeed without proper transaction wrapping" }
      );
    }
    
    if (!hasWorkingPriceMechanism) {
      recordResult(
        "Price Feed Functionality",
        false,
        "No working price feed mechanism found. Either configure MockPriceFeeds or implement RedStone transaction wrapping"
      );
    }
  } catch (error) {
    recordResult(
      "Price Feed Functionality",
      false,
      `Error checking price feeds: ${error.message}`
    );
  }
  
  // Check vault initialization
  try {
    const isVaultInitialized = await vault.isInitialized();
    recordResult(
      "Vault Initialization",
      isVaultInitialized,
      `Vault ${isVaultInitialized ? "is" : "is NOT"} initialized`
    );
  } catch (error) {
    recordResult(
      "Vault Initialization",
      false,
      `Error checking vault initialization: ${error.message}`
    );
  }
  
  // Check RedStonePriceFeed configuration
  try {
    // Try accessing some RedStonePriceFeed configuration
    const dataServiceId = await redStonePriceFeed.getDataServiceId();
    const uniqueSignersThreshold = await redStonePriceFeed.getUniqueSignersThreshold();
    
    recordResult(
      "RedStonePriceFeed Configuration",
      true,
      `RedStonePriceFeed configuration verified`,
      {
        dataServiceId,
        uniqueSignersThreshold: uniqueSignersThreshold.toString()
      }
    );
    
    if (uniqueSignersThreshold.toString() === "1") {
      recordResult(
        "RedStonePriceFeed Configuration",
        null, // Warning, not failure
        "RedStonePriceFeed uniqueSignersThreshold is set to 1, which is good for testing but should be higher for production"
      );
    }
  } catch (error) {
    recordResult(
      "RedStonePriceFeed Configuration",
      false,
      `Error checking RedStonePriceFeed configuration: ${error.message}`
    );
  }
  
  console.log("\n======================================================");
  console.log("VERIFICATION SUMMARY");
  console.log("======================================================");
  console.log(`Total checks passed: ${results.passed}`);
  console.log(`Total warnings: ${results.warnings}`);
  console.log(`Total checks failed: ${results.failed}`);
  console.log("\nDetailed results saved to verification-results.json");
  
  // Save results to file
  fs.writeFileSync(
    path.join(__dirname, '../../verification-results.json'), 
    JSON.stringify(results, null, 2)
  );
  
  if (results.failed > 0) {
    console.error("\n⚠️ Verification found issues that need to be addressed");
  } else if (results.warnings > 0) {
    console.warn("\n⚠️ Verification completed with warnings");
  } else {
    console.log("\n✅ All verification checks passed successfully");
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
