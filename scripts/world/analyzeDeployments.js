const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Utility function to read deployment data
function readDeploymentFile(filename) {
  const deploymentPath = path.join(__dirname, "../../", filename);
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment file not found: ${filename}`);
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(deploymentPath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading deployment file ${filename}:`, error.message);
    return null;
  }
}

// Utility function to check contract code existence
async function checkContractExists(address) {
  try {
    const code = await ethers.provider.getCode(address);
    return code !== '0x';
  } catch (error) {
    console.error(`Error checking contract at ${address}:`, error.message);
    return false;
  }
}

// Check governance/ownership of a contract
async function checkGovernance(contractAddress, contractType) {
  try {
    let governanceAddress;
    const [deployer] = await ethers.getSigners();
    
    // Different governance check methods based on contract type
    if (contractType === 'Vault' || contractType === 'CustomVault') {
      const vaultAbi = ["function gov() external view returns (address)"];
      const vault = new ethers.Contract(contractAddress, vaultAbi, deployer);
      governanceAddress = await vault.gov();
    } else if (contractType === 'PriceFeed' || contractType === 'SimplePriceFeed') {
      const priceFeedAbi = ["function owner() external view returns (address)"];
      const priceFeed = new ethers.Contract(contractAddress, priceFeedAbi, deployer);
      governanceAddress = await priceFeed.owner();
    } else {
      // Try both governance methods
      try {
        const govAbi = ["function gov() external view returns (address)"];
        const contract = new ethers.Contract(contractAddress, govAbi, deployer);
        governanceAddress = await contract.gov();
      } catch (error) {
        try {
          const ownerAbi = ["function owner() external view returns (address)"];
          const contract = new ethers.Contract(contractAddress, ownerAbi, deployer);
          governanceAddress = await contract.owner();
        } catch (innerError) {
          return { success: false, error: "Neither gov() nor owner() method available" };
        }
      }
    }
    
    const isDeployer = governanceAddress.toLowerCase() === deployer.address.toLowerCase();
    
    return {
      success: true,
      governanceAddress,
      isDeployer,
      deployerAddress: deployer.address
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check if token is whitelisted in Vault
async function checkTokenWhitelisted(vaultAddress, tokenAddress) {
  try {
    const [deployer] = await ethers.getSigners();
    const vaultAbi = ["function whitelistedTokens(address) external view returns (bool)"];
    const vault = new ethers.Contract(vaultAddress, vaultAbi, deployer);
    
    const isWhitelisted = await vault.whitelistedTokens(tokenAddress);
    return { success: true, isWhitelisted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Analyze both deployments
async function analyzeDeployments() {
  console.log("Analyzing GMX V1 Deployments on World Chain");
  console.log("==========================================");
  console.log("Using RPC URL: https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/");
  
  const [deployer] = await ethers.getSigners();
  console.log(`\nAccount: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Read deployment data
  console.log("\nLoading deployment data...");
  const standardDeployment = readDeploymentFile(".world-deployment.json");
  const customDeployment = readDeploymentFile(".world-custom-deployment.json");
  
  if (!standardDeployment || !customDeployment) {
    console.error("Could not read deployment files");
    return;
  }
  
  console.log("\n1. Standard Deployment Analysis");
  console.log("===============================");
  
  // Check Standard Vault
  const standardVault = standardDeployment.Vault;
  console.log(`\nVault: ${standardVault}`);
  const vaultExists = await checkContractExists(standardVault);
  console.log(`Contract exists: ${vaultExists ? '✅ Yes' : '❌ No'}`);
  
  if (vaultExists) {
    const govInfo = await checkGovernance(standardVault, 'Vault');
    if (govInfo.success) {
      console.log(`Governance: ${govInfo.governanceAddress}`);
      console.log(`Current account is governance: ${govInfo.isDeployer ? '✅ Yes' : '❌ No'}`);
      
      // Check if Timelock
      if (standardDeployment.Timelock) {
        const timelockContract = standardDeployment.Timelock;
        console.log(`\nTimelock: ${timelockContract}`);
        const timelockExists = await checkContractExists(timelockContract);
        console.log(`Contract exists: ${timelockExists ? '✅ Yes' : '❌ No'}`);
        
        if (timelockExists && govInfo.governanceAddress.toLowerCase() === timelockContract.toLowerCase()) {
          console.log(`✅ Vault governance is the Timelock contract`);
        } else {
          console.log(`❌ Vault governance is NOT the Timelock contract`);
        }
      }
    } else {
      console.log(`❌ Could not check governance: ${govInfo.error}`);
    }
  }
  
  // Check token whitelist status in standard deployment
  if (vaultExists && standardDeployment.WLD) {
    console.log(`\nChecking token whitelist status in standard Vault:`);
    const wldStatus = await checkTokenWhitelisted(standardVault, standardDeployment.WLD);
    console.log(`WLD (${standardDeployment.WLD}) whitelisted: ${wldStatus.success ? (wldStatus.isWhitelisted ? '✅ Yes' : '❌ No') : '❓ Error checking'}`);
  }
  
  console.log("\n2. Custom Deployment Analysis");
  console.log("=============================");
  
  // Check Custom Vault
  const customVault = customDeployment.CustomVault;
  console.log(`\nCustomVault: ${customVault}`);
  const customVaultExists = await checkContractExists(customVault);
  console.log(`Contract exists: ${customVaultExists ? '✅ Yes' : '❌ No'}`);
  
  if (customVaultExists) {
    const govInfo = await checkGovernance(customVault, 'CustomVault');
    if (govInfo.success) {
      console.log(`Governance: ${govInfo.governanceAddress}`);
      console.log(`Current account is governance: ${govInfo.isDeployer ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log(`❌ Could not check governance: ${govInfo.error}`);
    }
  }
  
  // Check SimplePriceFeed
  if (customDeployment.SimplePriceFeed) {
    const simplePriceFeed = customDeployment.SimplePriceFeed;
    console.log(`\nSimplePriceFeed: ${simplePriceFeed}`);
    const simplePriceFeedExists = await checkContractExists(simplePriceFeed);
    console.log(`Contract exists: ${simplePriceFeedExists ? '✅ Yes' : '❌ No'}`);
    
    if (simplePriceFeedExists) {
      const govInfo = await checkGovernance(simplePriceFeed, 'SimplePriceFeed');
      if (govInfo.success) {
        console.log(`Owner: ${govInfo.governanceAddress}`);
        console.log(`Current account is owner: ${govInfo.isDeployer ? '✅ Yes' : '❌ No'}`);
      } else {
        console.log(`❌ Could not check ownership: ${govInfo.error}`);
      }
    }
  }
  
  // Check VaultPriceFeed
  if (customDeployment.CustomVaultPriceFeed) {
    const vaultPriceFeed = customDeployment.CustomVaultPriceFeed;
    console.log(`\nCustomVaultPriceFeed: ${vaultPriceFeed}`);
    const vaultPriceFeedExists = await checkContractExists(vaultPriceFeed);
    console.log(`Contract exists: ${vaultPriceFeedExists ? '✅ Yes' : '❌ No'}`);
    
    if (vaultPriceFeedExists) {
      const govInfo = await checkGovernance(vaultPriceFeed, 'PriceFeed');
      if (govInfo.success) {
        console.log(`Owner: ${govInfo.governanceAddress}`);
        console.log(`Current account is owner: ${govInfo.isDeployer ? '✅ Yes' : '❌ No'}`);
      } else {
        console.log(`❌ Could not check ownership: ${govInfo.error}`);
      }
    }
  }
  
  // Check test tokens in custom deployment
  if (customVaultExists && customDeployment.TestDeployment && customDeployment.TestDeployment.tokens) {
    console.log(`\nChecking test token whitelist status in custom Vault:`);
    
    for (const [symbol, tokenData] of Object.entries(customDeployment.TestDeployment.tokens)) {
      const status = await checkTokenWhitelisted(customVault, tokenData.address);
      console.log(`${symbol} (${tokenData.address}) whitelisted: ${status.success ? (status.isWhitelisted ? '✅ Yes' : '❌ No') : '❓ Error checking'}`);
    }
  }
  
  console.log("\n3. Migration Strategy Analysis");
  console.log("=============================");
  
  // Determine which deployment to use
  const useStandardDeployment = vaultExists && (await checkGovernance(standardVault, 'Vault')).success && (await checkGovernance(standardVault, 'Vault')).isDeployer;
  const useCustomDeployment = customVaultExists && (await checkGovernance(customVault, 'CustomVault')).success && (await checkGovernance(customVault, 'CustomVault')).isDeployer;
  
  console.log(`Standard deployment usable (governance control): ${useStandardDeployment ? '✅ Yes' : '❌ No'}`);
  console.log(`Custom deployment usable (governance control): ${useCustomDeployment ? '✅ Yes' : '❌ No'}`);
  
  if (useStandardDeployment) {
    console.log(`\nRecommendation: Use standard deployment with Vault at ${standardVault}`);
  } else if (useCustomDeployment) {
    console.log(`\nRecommendation: Use custom deployment with CustomVault at ${customVault}`);
  } else {
    console.log(`\nRecommendation: Deploy new contracts with direct ownership for simpler governance`);
  }
  
  console.log("\n4. Governance Actions Recommendation");
  console.log("====================================");
  
  if (useCustomDeployment) {
    console.log("\nRecommended steps for Custom Deployment:");
    console.log("1. Configure SimplePriceFeed for the test tokens");
    console.log("2. Configure VaultPriceFeed to use SimplePriceFeed");
    console.log("3. Whitelist the test tokens in the Vault");
    console.log("4. Update frontend environment to use CustomVault addresses");
  } else if (useStandardDeployment) {
    console.log("\nRecommended steps for Standard Deployment:");
    console.log("1. Submit governance proposals for whitelisting WLD, WETH, and MAG through Timelock");
    console.log("2. Configure price feeds through governance");
    console.log("3. Update frontend environment to use standard Vault addresses");
  } else {
    console.log("\nRecommended steps:");
    console.log("1. Deploy a new set of contracts with direct ownership");
    console.log("2. Whitelist tokens directly without timelock governance");
    console.log("3. Configure frontend to use the new deployment");
  }
}

// Execute analysis
analyzeDeployments()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
