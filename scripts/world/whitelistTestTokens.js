const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Script for whitelisting test tokens in the Vault using the SimplePriceFeed
 */
async function main() {
  console.log("======================================================");
  console.log("WHITELIST TEST TOKENS WITH SIMPLEPRICEFEED");
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
  
  // Get test token addresses
  const tusdAddress = deploymentData.TestEnvironment?.tokens?.TUSD;
  const tbtcAddress = deploymentData.TestEnvironment?.tokens?.TBTC;
  const tethAddress = deploymentData.TestEnvironment?.tokens?.TETH;
  
  if (!tusdAddress || !tbtcAddress || !tethAddress) {
    console.error("❌ Test token addresses not found in deployment data");
    process.exit(1);
  }
  
  console.log(`Test token addresses:`);
  console.log(`TUSD: ${tusdAddress}`);
  console.log(`TBTC: ${tbtcAddress}`);
  console.log(`TETH: ${tethAddress}`);
  
  // Get the SimplePriceFeed address
  const simplePriceFeedAddress = deploymentData.TestEnvironment?.contracts?.SimplePriceFeed;
  if (!simplePriceFeedAddress) {
    console.error("❌ SimplePriceFeed address not found in deployment data");
    process.exit(1);
  }
  console.log(`SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Get the Vault address
  const vaultAddress = deploymentData.Vault;
  if (!vaultAddress) {
    console.error("❌ Vault address not found in deployment data");
    process.exit(1);
  }
  console.log(`Vault: ${vaultAddress}`);
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`Connected with ${deployer.address}`);
  
  const vault = await ethers.getContractAt("Vault", vaultAddress, deployer);
  const priceFeed = await ethers.getContractAt("VaultPriceFeed", await vault.priceFeed());
  
  console.log(`VaultPriceFeed: ${priceFeed.address}`);
  
  // Configure price feed to use SimplePriceFeed for test tokens
  console.log("\nConfiguring price feeds for test tokens...");
  
  // Set SimplePriceFeed as the price feed for TUSD
  console.log(`Setting SimplePriceFeed for TUSD...`);
  let tx = await priceFeed.setTokenConfig(
    tusdAddress,              // _token
    simplePriceFeedAddress,   // _priceFeed
    18,                       // _priceDecimals
    false                     // _isStrictStable
  );
  await tx.wait();
  console.log("✅ Price feed set for TUSD");
  
  // Set SimplePriceFeed as the price feed for TBTC
  console.log(`Setting SimplePriceFeed for TBTC...`);
  tx = await priceFeed.setTokenConfig(
    tbtcAddress,              // _token
    simplePriceFeedAddress,   // _priceFeed
    8,                        // _priceDecimals
    false                     // _isStrictStable
  );
  await tx.wait();
  console.log("✅ Price feed set for TBTC");
  
  // Set SimplePriceFeed as the price feed for TETH
  console.log(`Setting SimplePriceFeed for TETH...`);
  tx = await priceFeed.setTokenConfig(
    tethAddress,              // _token
    simplePriceFeedAddress,   // _priceFeed
    18,                       // _priceDecimals
    false                     // _isStrictStable
  );
  await tx.wait();
  console.log("✅ Price feed set for TETH");
  
  // Whitelist tokens in the Vault
  console.log("\nWhitelisting tokens in Vault...");
  
  // Whitelist TUSD
  console.log(`Whitelisting TUSD...`);
  tx = await vault.setTokenConfig(
    tusdAddress,  // _token
    18,           // _tokenDecimals
    10000,        // _tokenWeight
    75,           // _minProfitBps
    true,         // _isStable
    true          // _isShortable
  );
  await tx.wait();
  console.log("✅ TUSD whitelisted in Vault");
  
  // Whitelist TBTC
  console.log(`Whitelisting TBTC...`);
  tx = await vault.setTokenConfig(
    tbtcAddress,  // _token
    8,            // _tokenDecimals
    10000,        // _tokenWeight
    75,           // _minProfitBps
    false,        // _isStable
    true          // _isShortable
  );
  await tx.wait();
  console.log("✅ TBTC whitelisted in Vault");
  
  // Whitelist TETH
  console.log(`Whitelisting TETH...`);
  tx = await vault.setTokenConfig(
    tethAddress,  // _token
    18,           // _tokenDecimals
    10000,        // _tokenWeight
    75,           // _minProfitBps
    false,        // _isStable
    true          // _isShortable
  );
  await tx.wait();
  console.log("✅ TETH whitelisted in Vault");
  
  console.log("\n======================================================");
  console.log("TEST TOKENS WHITELISTED SUCCESSFULLY");
  console.log("======================================================");
  
  console.log(`
Test tokens are now whitelisted in the Vault and ready for trading.
Make sure the SimplePriceFeed contract has current prices for all tokens.
Run the price update script to set prices:

npx hardhat run scripts/world/mapOracleKeeperToTestTokens.js --network worldchain
  `);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
