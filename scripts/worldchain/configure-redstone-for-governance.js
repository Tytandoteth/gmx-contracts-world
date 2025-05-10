// Script for governance address to configure RedStone price feeds
// This script should be run by the account that has governance control
// of the VaultPriceFeed contract (0x89eB82FeB33148fbEB5a06E8cDA3b8361BD26af3)

const { ethers } = require("hardhat");
const fs = require('fs');

// RedStone price feed contract address that was deployed
const REDSTONE_PRICE_FEED_ADDRESS = "0x5C09c03A3f82CfE7EE5224F92b34fE07e7f8AFB9";

async function main() {
  console.log("Starting RedStonePriceFeed configuration (governance script)...");
  
  // Get the governance signer
  const [governance] = await ethers.getSigners();
  console.log(`Governance address: ${governance.address}`);
  
  // Make sure we're using the correct governance account
  const expectedGovernance = "0x89eB82FeB33148fbEB5a06E8cDA3b8361BD26af3";
  if (governance.address.toLowerCase() !== expectedGovernance.toLowerCase()) {
    console.error(`ERROR: This script must be run by the governance account (${expectedGovernance})`);
    console.error(`Current account: ${governance.address}`);
    process.exit(1);
  }
  
  // Load World Chain deployment data to get the VaultPriceFeed address
  let vaultPriceFeedAddress;
  try {
    const worldDeployment = JSON.parse(fs.readFileSync('.world-deployment.json'));
    vaultPriceFeedAddress = worldDeployment.VaultPriceFeed;
    console.log(`GMX VaultPriceFeed address: ${vaultPriceFeedAddress}`);
  } catch (error) {
    console.error("Error loading World Chain deployment data:", error.message);
    process.exit(1);
  }
  
  // Get the VaultPriceFeed contract instance
  console.log("Connecting to GMX VaultPriceFeed...");
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", vaultPriceFeedAddress);
  
  // Verify governance
  const govAddress = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governance address: ${govAddress}`);
  
  if (govAddress.toLowerCase() !== governance.address.toLowerCase()) {
    console.error("ERROR: The connected account is not the governance of VaultPriceFeed");
    process.exit(1);
  }
  
  // Define token configurations - use the correct token addresses with proper checksums
  const tokenConfigs = [
    { 
      symbol: "WLD", 
      tokenAddress: ethers.utils.getAddress("0x163f8c2467924be0ae7b5347228cabf260318753"), 
      priceDecimals: 8, 
      isStableToken: false 
    },
    { 
      symbol: "ETH", 
      tokenAddress: ethers.utils.getAddress("0x47c031236e19d024b42f8ae6780e44a573170702"), 
      priceDecimals: 8, 
      isStableToken: false 
    },
    { 
      symbol: "BTC", 
      tokenAddress: ethers.utils.getAddress("0x6853ea96ff216fab11d2d930ce3c508556a4bdc3"), 
      priceDecimals: 8, 
      isStableToken: false 
    },
    { 
      symbol: "USDC", 
      tokenAddress: ethers.utils.getAddress("0x09400d9db990d5ed3f35d7be61dfaeb900af03c8"), 
      priceDecimals: 8, 
      isStableToken: true 
    },
    { 
      symbol: "USDT", 
      tokenAddress: ethers.utils.getAddress("0xe6d222caab2842d70f9ce058c9316b5c936e2949"), 
      priceDecimals: 8, 
      isStableToken: true 
    }
  ];
  
  console.log("Configuring price feeds in GMX VaultPriceFeed...");
  console.log(`Using RedStonePriceFeed at ${REDSTONE_PRICE_FEED_ADDRESS}`);
  
  // Configure each token
  for (const token of tokenConfigs) {
    try {
      console.log(`Setting price feed for ${token.symbol} (${token.tokenAddress})...`);
      
      // Check if the token has a price feed already
      const currentPriceFeed = await vaultPriceFeed.priceFeeds(token.tokenAddress);
      console.log(`Current price feed for ${token.symbol}: ${currentPriceFeed}`);
      
      if (currentPriceFeed.toLowerCase() === REDSTONE_PRICE_FEED_ADDRESS.toLowerCase()) {
        console.log(`✅ ${token.symbol} already using RedStonePriceFeed`);
        continue;
      }
      
      // Set the price feed configuration for the token
      console.log(`Calling setTokenConfig for ${token.symbol}...`);
      const tx = await vaultPriceFeed.setTokenConfig(
        token.tokenAddress,
        REDSTONE_PRICE_FEED_ADDRESS,
        token.priceDecimals,
        token.isStableToken
      );
      await tx.wait();
      console.log(`✅ Price feed set for ${token.symbol}`);
    } catch (error) {
      console.error(`Error setting price feed for ${token.symbol}:`, error.message);
    }
  }
  
  console.log("\nConfiguration completed!");
  console.log("All tokens have been configured to use the RedStonePriceFeed");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Configuration failed:", error);
    process.exit(1);
  });
