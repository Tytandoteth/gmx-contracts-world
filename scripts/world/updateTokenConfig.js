const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const { toUsd } = require("../../test/shared/units");
const fs = require('fs');
const path = require('path');

/**
 * Script to update the custom deployment to use only WLD and WETH
 * Removes references to WWORLD and updates configuration accordingly
 */
async function main() {
  console.log("======================================================");
  console.log("UPDATING TOKEN CONFIGURATION (WLD & WETH ONLY)");
  console.log("======================================================");
  
  // Load custom deployment data
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
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer address: ${deployer.address}`);
  
  // Check if WETH already exists
  if (!deploymentData.WETH) {
    console.log("\nDeploying WETH token...");
    
    // Deploy WETH mock token
    const WETH = await ethers.getContractFactory("MintableBaseToken");
    const wethToken = await WETH.deploy("WETH Token", "WETH", 0);
    await wethToken.deployed();
    deploymentData.WETH = wethToken.address;
    console.log("WETH deployed at:", wethToken.address);
    
    // Set deployer as minter
    await wethToken.setMinter(deployer.address, true);
    console.log("Set deployer as minter for WETH");
    
    // Mint some tokens for testing
    await wethToken.mint(deployer.address, expandDecimals(1000000, 18));
    console.log("Minted 1,000,000 WETH tokens to deployer");
  } else {
    console.log("\nUsing existing WETH token:", deploymentData.WETH);
  }
  
  // Deploy WETH mock price feed if needed
  if (!deploymentData.MockPriceFeeds || !deploymentData.MockPriceFeeds.WETH) {
    console.log("\nDeploying WETH mock price feed...");
    
    // Initialize MockPriceFeeds object if it doesn't exist
    if (!deploymentData.MockPriceFeeds) {
      deploymentData.MockPriceFeeds = {};
    }
    
    // Deploy WETH Price Feed
    const WethPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const wethPriceFeed = await WethPriceFeed.deploy(toUsd(1500)); // $1500 initial price
    await wethPriceFeed.deployed();
    deploymentData.MockPriceFeeds.WETH = wethPriceFeed.address;
    console.log("WETH price feed deployed at:", wethPriceFeed.address);
  } else {
    console.log("\nUsing existing WETH mock price feed:", deploymentData.MockPriceFeeds.WETH);
  }
  
  // Get VaultPriceFeed instance
  console.log("\nConfiguring VaultPriceFeed for WLD and WETH...");
  const vaultPriceFeed = await ethers.getContractAt(
    "VaultPriceFeed", 
    deploymentData.CustomVaultPriceFeed
  );
  
  // Configure VaultPriceFeed for WETH using RedStonePriceFeed
  console.log("Setting WETH to use RedStonePriceFeed...");
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,
    deploymentData.RedStonePriceFeed,
    8, // decimals
    false // isStable
  );
  console.log("✅ WETH configured to use RedStonePriceFeed");
  
  // Verify WLD is configured correctly
  console.log("Verifying WLD configuration...");
  const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
  if (wldPriceFeed.toLowerCase() !== deploymentData.RedStonePriceFeed.toLowerCase()) {
    console.log("Updating WLD to use RedStonePriceFeed...");
    await vaultPriceFeed.setTokenConfig(
      deploymentData.WLD,
      deploymentData.RedStonePriceFeed,
      8, // decimals
      false // isStable
    );
    console.log("✅ WLD configured to use RedStonePriceFeed");
  } else {
    console.log("✅ WLD already configured to use RedStonePriceFeed");
  }
  
  // Configure RedStonePriceFeed to support WETH
  console.log("\nConfiguring RedStonePriceFeed for WETH...");
  const redStonePriceFeed = await ethers.getContractAt(
    "RedStonePriceFeed", 
    deploymentData.RedStonePriceFeed
  );
  
  // Set token decimals for WETH in RedStonePriceFeed
  try {
    await redStonePriceFeed.setTokenDecimals("ETH", 8);
    console.log("✅ Set WETH decimals in RedStonePriceFeed");
  } catch (error) {
    console.log("Note: Could not set WETH decimals in RedStonePriceFeed. This may be normal if already configured.");
  }
  
  // Update deployment data to remove WWORLD and USDG references
  console.log("\nUpdating deployment data to focus on WLD and WETH only...");
  
  // Create a new object without WWORLD reference
  const updatedDeploymentData = {
    WLD: deploymentData.WLD,
    WETH: deploymentData.WETH,
    CustomVaultPriceFeed: deploymentData.CustomVaultPriceFeed,
    RedStonePriceFeed: deploymentData.RedStonePriceFeed,
    CustomVault: deploymentData.CustomVault,
    CustomRouter: deploymentData.CustomRouter,
    CustomVaultUtils: deploymentData.CustomVaultUtils,
    MockPriceFeeds: {
      WLD: deploymentData.MockPriceFeeds.WLD,
      WETH: deploymentData.MockPriceFeeds.WETH
    }
  };
  
  // Keep USDG reference if it's needed by the system
  if (deploymentData.CustomUSDG) {
    updatedDeploymentData.CustomUSDG = deploymentData.CustomUSDG;
  }
  
  // Save the updated deployment data
  fs.writeFileSync(deploymentFilePath, JSON.stringify(updatedDeploymentData, null, 2));
  console.log("✅ Deployment data updated successfully");
  
  // Create mock price feeder script for the new tokens
  await createMockPriceFeederScript(updatedDeploymentData);
  
  console.log("\n======================================================");
  console.log("TOKEN CONFIGURATION UPDATED SUCCESSFULLY");
  console.log("======================================================");
  console.log("Your custom deployment now focuses on WLD and WETH tokens.");
  console.log("The following contracts are configured:");
  console.log(`- WLD Token: ${updatedDeploymentData.WLD}`);
  console.log(`- WETH Token: ${updatedDeploymentData.WETH}`);
  console.log(`- VaultPriceFeed: ${updatedDeploymentData.CustomVaultPriceFeed}`);
  console.log(`- RedStonePriceFeed: ${updatedDeploymentData.RedStonePriceFeed}`);
  console.log(`- Vault: ${updatedDeploymentData.CustomVault}`);
  console.log(`- Router: ${updatedDeploymentData.CustomRouter}`);
  console.log(`- VaultUtils: ${updatedDeploymentData.CustomVaultUtils}`);
  console.log("\nTo use mock prices for development, run:");
  console.log("npx hardhat run scripts/world/mockPriceFeederNew.js --network worldchain");
}

// Create a new mock price feeder script for WLD and WETH
async function createMockPriceFeederScript(deploymentData) {
  console.log("\nCreating new mock price feeder script for WLD and WETH...");
  
  const scriptContent = `const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Setting up mock prices for WLD and WETH...");
  
  // Load custom deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("Loaded custom deployment data");
  } catch (error) {
    console.error("Error loading custom deployment data:", error);
    process.exit(1);
  }
  
  // Connect to mock price feeds
  console.log(\`Connecting to WLD MockPriceFeed at \${deploymentData.MockPriceFeeds.WLD}...\`);
  const wldPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WLD);
  
  console.log(\`Connecting to WETH MockPriceFeed at \${deploymentData.MockPriceFeeds.WETH}...\`);
  const wethPriceFeed = await ethers.getContractAt("MockPriceFeed", deploymentData.MockPriceFeeds.WETH);
  
  console.log(\`Connecting to VaultPriceFeed at \${deploymentData.CustomVaultPriceFeed}...\`);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
  
  // Update mock prices
  console.log("Updating mock prices...");
  
  // Update WLD price (setting to $1.25)
  await wldPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1.25", 8));
  console.log("Set WLD price to $1.25");
  
  // Update WETH price (setting to $1750)
  await wethPriceFeed.setLatestAnswer(ethers.utils.parseUnits("1750", 8));
  console.log("Set WETH price to $1750");
  
  // Switch VaultPriceFeed to use mock price feeds
  console.log("Switching VaultPriceFeed to use mock price feeds...");
  
  // Update VaultPriceFeed for WLD
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WLD mock feed");
  
  // Update VaultPriceFeed for WETH
  await vaultPriceFeed.setTokenConfig(
    deploymentData.WETH,
    deploymentData.MockPriceFeeds.WETH,
    8, // decimals
    false // isStable
  );
  console.log("VaultPriceFeed now using WETH mock feed");
  
  console.log("\\nMock prices set up for development!");
  console.log("You can now use the custom deployment with predictable pricing for WLD and WETH.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Setup failed:", error);
    process.exit(1);
  });`;
  
  const scriptPath = path.join(__dirname, '../../scripts/world/mockPriceFeederNew.js');
  fs.writeFileSync(scriptPath, scriptContent);
  console.log("✅ Created new mock price feeder script at:", scriptPath);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Token configuration update failed:", error);
    process.exit(1);
  });
