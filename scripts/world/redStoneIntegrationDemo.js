const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * This script demonstrates how to integrate with RedStone SDK
 * for proper price data wrapping with transactions
 * 
 * NOTE: This is a demonstration script showing the integration pattern.
 * The actual RedStone SDK import and WrapperBuilder need to be installed:
 * npm install @redstone-finance/evm-connector
 */

// Import RedStone SDK (commented out as this is just a demonstration)
// const { WrapperBuilder } = require("@redstone-finance/evm-connector");

async function main() {
  console.log("======================================================");
  console.log("REDSTONE SDK INTEGRATION DEMO");
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
  
  // Connect to contracts
  console.log("\n------------------------------------------------------");
  console.log("CONNECTING TO DEPLOYED CONTRACTS");
  console.log("------------------------------------------------------");
  
  console.log(`Vault address: ${deploymentData.CustomVault}`);
  console.log(`Router address: ${deploymentData.CustomRouter}`);
  console.log(`RedStonePriceFeed address: ${deploymentData.RedStonePriceFeed}`);
  
  const vault = await ethers.getContractAt("Vault", deploymentData.CustomVault);
  const router = await ethers.getContractAt("Router", deploymentData.CustomRouter);
  const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
  
  // DEMONSTRATION: How to wrap contracts with RedStone data
  console.log("\n------------------------------------------------------");
  console.log("DEMONSTRATION: WRAPPING CONTRACTS WITH REDSTONE");
  console.log("------------------------------------------------------");
  
  console.log(`
  // This is how you would wrap the Vault contract with RedStone data:
  const wrappedVault = WrapperBuilder
    .wrapLite(vault)
    .usingPriceFeed("redstone-main");
    
  // Then you can make calls that will automatically include price data:
  const wldPrice = await wrappedVault.getMaxPrice(deploymentData.WLD);
  console.log(\`WLD price: \${ethers.utils.formatUnits(wldPrice, 30)}\`);
  
  // For whitelisting tokens in the Vault:
  await wrappedVault.setTokenConfig(
    deploymentData.WLD,  // token
    18,                  // tokenDecimals
    10000,               // tokenWeight
    75,                  // minProfitBps (0.75%)
    0,                   // maxUsdgAmount
    false,               // isStable
    true                 // isShortable
  );
  `);
  
  // DEMONSTRATION: How to create a position through PositionRouter
  console.log("\n------------------------------------------------------");
  console.log("DEMONSTRATION: CREATING A POSITION WITH REDSTONE");
  console.log("------------------------------------------------------");
  
  console.log(`
  const positionRouter = await ethers.getContractAt("PositionRouter", deploymentData.CustomPositionRouter);
  
  // Wrap with RedStone data
  const wrappedPositionRouter = WrapperBuilder
    .wrapLite(positionRouter)
    .usingPriceFeed("redstone-main");
    
  // Approve tokens for position creation
  const wld = await ethers.getContractAt("ERC20", deploymentData.WLD);
  await wld.approve(router.address, ethers.constants.MaxUint256);
  
  // Create a long position with WLD as collateral, WETH as index token
  const path = [deploymentData.WLD]; // Collateral path
  const position = await wrappedPositionRouter.createIncreasePosition(
    path,                        // _path (collateral tokens)
    deploymentData.WETH,         // _indexToken (token to long/short)
    ethers.utils.parseEther("10"), // _amountIn (10 WLD)
    0,                           // _minOut
    ethers.utils.parseEther("100"), // _sizeDelta (100 USD position size)
    true,                        // _isLong
    ethers.utils.parseUnits("3000", 30), // _acceptablePrice (3,000 USD for WETH)
    ethers.utils.parseEther("0.01"), // _executionFee
    ethers.constants.HashZero,   // _referralCode
    { value: ethers.utils.parseEther("0.01") } // executionFee sent as ETH
  );
  `);
  
  // DEMONSTRATION: How to implement the Oracle Keeper
  console.log("\n------------------------------------------------------");
  console.log("DEMONSTRATION: ORACLE KEEPER IMPLEMENTATION");
  console.log("------------------------------------------------------");
  
  console.log(`
  // The Oracle Keeper should expose endpoints like:
  // GET /prices/WLD - Returns the latest WLD price
  // GET /prices/WETH - Returns the latest WETH price
  
  // The endpoints should return data in this format:
  {
    "symbol": "WLD",
    "price": "1.25",
    "timestamp": 1683765432,
    "source": "redstone"
  }
  
  // This data can then be used in the frontend to:
  // 1. Display prices to users
  // 2. Prepare transaction data with RedStone SDK
  // 3. Send transactions with price data attached
  `);
  
  console.log("\n======================================================");
  console.log("NEXT STEPS TO GET MVP WORKING");
  console.log("======================================================");
  
  console.log(`
1. Set up the RedStone Oracle Keeper:
   - Clone https://github.com/Tytandoteth/redstone-oracle-keeper
   - Configure for WLD and WETH price feeds
   - Deploy as a Cloudflare worker or serverless function

2. Install RedStone SDK in your frontend:
   - npm install @redstone-finance/evm-connector
   - Create wrapper functions for all contract interactions

3. Use a modified script for contract testing:
   - Create scripts that use RedStone SDK for proper price data
   - Test basic functionality like token whitelisting and trading

4. Update frontend to use the Oracle Keeper and RedStone SDK:
   - Fetch prices from Oracle Keeper
   - Wrap all contract calls with RedStone data
   - Test full trading flow
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
