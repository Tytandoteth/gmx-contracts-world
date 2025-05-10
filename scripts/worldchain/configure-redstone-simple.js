// Direct configuration script for connecting RedStonePriceFeed to GMX price feed system
// This script uses ethers directly without the helpers

const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("Starting RedStonePriceFeed configuration...");
  
  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Load deployment data
  let redStonePriceFeedAddress;
  try {
    const deploymentData = JSON.parse(fs.readFileSync('.world-redstone-deployment.json'));
    redStonePriceFeedAddress = deploymentData.redStonePriceFeed;
    console.log(`RedStonePriceFeed address: ${redStonePriceFeedAddress}`);
  } catch (error) {
    console.error("Error loading RedStone deployment data:", error.message);
    console.log("Please run deploy-redstone-simple.js first");
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
    console.log("Make sure the GMX core has been deployed to World Chain");
    process.exit(1);
  }
  
  if (!vaultPriceFeedAddress) {
    console.error("VaultPriceFeed address not found in World Chain deployment data");
    process.exit(1);
  }
  
  // Get the VaultPriceFeed contract instance
  console.log("Connecting to GMX VaultPriceFeed...");
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", vaultPriceFeedAddress);
  
  // Define token configurations - use the correct token addresses from World Chain with proper checksums
  // These should be the actual token addresses deployed on World Chain
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
  // Get governance information
  const govAddress = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governance address: ${govAddress}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  if (govAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("WARNING: Your deployer account doesn't have governance permissions on VaultPriceFeed");
    console.log("You'll need to transfer governance or use the governance account to configure price feeds");
  }
  
  for (const token of tokenConfigs) {
    try {
      console.log(`Setting price feed for ${token.symbol} (${token.tokenAddress})...`);
      
      // Check if the token has a price feed already
      const currentPriceFeed = await vaultPriceFeed.priceFeeds(token.tokenAddress);
      console.log(`Current price feed for ${token.symbol}: ${currentPriceFeed}`);
      
      if (currentPriceFeed.toLowerCase() === redStonePriceFeedAddress.toLowerCase()) {
        console.log(`✅ ${token.symbol} already using RedStonePriceFeed`);
        continue;
      }
      
      // Only try to set the token config if we're the governance account
      if (govAddress.toLowerCase() === deployer.address.toLowerCase()) {
        // Set the price feed configuration for the token
        console.log(`Calling setTokenConfig for ${token.symbol}...`);
        const tx = await vaultPriceFeed.setTokenConfig(
          token.tokenAddress,
          redStonePriceFeedAddress,
          token.priceDecimals,
          token.isStableToken
        );
        await tx.wait();
        console.log(`✅ Price feed set for ${token.symbol}`);
      } else {
        console.log(`⚠️ Skipping ${token.symbol} - no governance permission`);
      }
    } catch (error) {
      console.error(`Error setting price feed for ${token.symbol}:`, error.message);
    }
  }
  
  // Save configuration
  const configData = {
    vaultPriceFeedAddress,
    redStonePriceFeedAddress,
    tokens: tokenConfigs.reduce((acc, token) => {
      acc[token.symbol] = {
        address: token.tokenAddress,
        priceFeed: redStonePriceFeedAddress,
        priceDecimals: token.priceDecimals,
        isStableToken: token.isStableToken
      };
      return acc;
    }, {}),
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    '.world-redstone-config.json',
    JSON.stringify(configData, null, 2)
  );
  
  console.log("Configuration completed!");
  console.log("Configuration data saved to .world-redstone-config.json");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Configuration failed:", error);
    process.exit(1);
  });
