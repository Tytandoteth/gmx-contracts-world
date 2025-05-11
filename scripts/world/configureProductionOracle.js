/**
 * Configuration Guide for Oracle Keeper in Production Environment
 * 
 * Follow these steps to configure the Oracle Keeper for production use:
 * 
 * 1. Repository Setup:
 *    git clone https://github.com/Tytandoteth/redstone-oracle-keeper
 *    cd redstone-oracle-keeper
 *    npm install
 * 
 * 2. Environment Configuration:
 *    Create a .env file with the following variables:
 *    ```
 *    # RedStone Configuration
 *    REDSTONE_API_KEY=your_redstone_api_key
 *    REDSTONE_PRICE_SERVICE=redstone-main
 *    
 *    # Provider Configuration
 *    RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
 *    CHAIN_ID=480
 *    
 *    # Contract Configuration
 *    REDSTONE_PRICE_FEED_ADDRESS=0xA63636C9d557793234dD5E33a24EAd68c36Df148
 *    
 *    # Token Configuration
 *    SUPPORTED_TOKENS=WLD,WETH
 *    
 *    # Service Configuration
 *    PORT=3000
 *    UPDATE_INTERVAL_MS=60000
 *    CACHE_DURATION_MS=30000
 *    
 *    # Feature Flags
 *    USE_MOCK_PRICES=false
 *    ENABLE_DEBUG=true
 *    ```
 * 
 * 3. Update the Configuration in config.js:
 *    ```javascript
 *    module.exports = {
 *      redstone: {
 *        apiKey: process.env.REDSTONE_API_KEY,
 *        priceService: process.env.REDSTONE_PRICE_SERVICE,
 *      },
 *      provider: {
 *        rpcUrl: process.env.RPC_URL,
 *        chainId: process.env.CHAIN_ID,
 *      },
 *      contract: {
 *        redStonePriceFeedAddress: process.env.REDSTONE_PRICE_FEED_ADDRESS,
 *      },
 *      tokens: {
 *        supported: (process.env.SUPPORTED_TOKENS || '').split(','),
 *      },
 *      service: {
 *        port: parseInt(process.env.PORT || '3000'),
 *        updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '60000'),
 *        cacheDurationMs: parseInt(process.env.CACHE_DURATION_MS || '30000'),
 *      },
 *      features: {
 *        useMockPrices: process.env.USE_MOCK_PRICES === 'true',
 *        enableDebug: process.env.ENABLE_DEBUG === 'true',
 *      }
 *    };
 *    ```
 * 
 * 4. Update the priceService.js to use RedStone data provider:
 *    ```javascript
 *    const { RedstoneCommon } = require('redstone-sdk');
 *    const config = require('./config');
 *    
 *    class PriceService {
 *      constructor() {
 *        this.redstone = new RedstoneCommon({
 *          apiKey: config.redstone.apiKey,
 *        });
 *      }
 *    
 *      async getPrices() {
 *        try {
 *          const supportedTokens = config.tokens.supported;
 *          const prices = {};
 *          
 *          for (const token of supportedTokens) {
 *            try {
 *              const price = await this.redstone.getPrice({
 *                symbol: token,
 *                provider: config.redstone.priceService,
 *              });
 *              
 *              prices[token] = {
 *                symbol: token,
 *                price: price.value.toString(),
 *                timestamp: price.timestamp,
 *                source: 'redstone-live',
 *              };
 *            } catch (error) {
 *              console.error(`Error fetching price for ${token}:`, error);
 *            }
 *          }
 *          
 *          return prices;
 *        } catch (error) {
 *          console.error('Error fetching prices:', error);
 *          return {};
 *        }
 *      }
 *    }
 *    
 *    module.exports = new PriceService();
 *    ```
 * 
 * 5. Deploy the Oracle Keeper:
 *    - For development: Run locally with `npm start`
 *    - For production: Deploy to a reliable hosting service like:
 *      - AWS Lambda + API Gateway
 *      - Cloudflare Workers
 *      - DigitalOcean App Platform
 *      - Heroku
 *    
 *    Example deployment using Heroku:
 *    ```
 *    heroku create gmx-world-oracle-keeper
 *    git push heroku main
 *    ```
 * 
 * 6. Set Up Monitoring:
 *    - Add integration with monitoring services like New Relic or Datadog
 *    - Set up alerts for API failures or price anomalies
 *    - Configure health check endpoints for uptime monitoring
 */

/**
 * This script provides a deployment checklist for moving the 
 * Oracle Keeper to production with real RedStone data.
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("======================================================");
  console.log("PRODUCTION CONFIGURATION CHECKLIST FOR ORACLE KEEPER");
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
  
  console.log("\n------------------------------------------------------");
  console.log("PRODUCTION VERIFICATION CHECKLIST");
  console.log("------------------------------------------------------");
  
  console.log("\n1. RedStonePriceFeed Contract Review:");
  
  try {
    // Get connected contract
    const redStonePriceFeed = await ethers.getContractAt("RedStonePriceFeed", deploymentData.RedStonePriceFeed);
    
    // Check configuration
    const uniqueSignersThreshold = await redStonePriceFeed.uniqueSignersThreshold();
    console.log(`   - Unique Signers Threshold: ${uniqueSignersThreshold}`);
    console.log(`   - Recommended for Production: At least 3`);
    
    if (uniqueSignersThreshold < 3) {
      console.log(`   ⚠️ WARNING: Unique signers threshold is set to ${uniqueSignersThreshold}. For production, it's recommended to use at least 3.`);
    } else {
      console.log(`   ✅ Unique signers threshold is adequately configured for production.`);
    }
    
    // Check data service ID
    const dataServiceId = await redStonePriceFeed.dataServiceId();
    console.log(`   - Data Service ID: ${dataServiceId}`);
    console.log(`   - For Production: Use "redstone-main" or "redstone-rapid"`);
    
    // Check data feed IDs
    try {
      const wldFeedId = await redStonePriceFeed.dataFeedIds(deploymentData.WLD);
      console.log(`   - WLD Feed ID: ${ethers.utils.parseBytes32String(wldFeedId)}`);
    } catch (error) {
      console.log(`   ⚠️ WARNING: WLD data feed ID not configured`);
    }
    
    try {
      const wethFeedId = await redStonePriceFeed.dataFeedIds(deploymentData.WETH);
      console.log(`   - WETH Feed ID: ${ethers.utils.parseBytes32String(wethFeedId)}`);
    } catch (error) {
      console.log(`   ⚠️ WARNING: WETH data feed ID not configured`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error checking RedStonePriceFeed configuration: ${error.message}`);
  }
  
  console.log("\n2. VaultPriceFeed Contract Review:");
  
  try {
    // Get connected contract
    const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.CustomVaultPriceFeed);
    
    // Check configuration
    const useV2Pricing = await vaultPriceFeed.useV2Pricing();
    console.log(`   - Using V2 Pricing: ${useV2Pricing}`);
    
    // Check if RedStonePriceFeed is set as primary
    try {
      const wldPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WLD);
      console.log(`   - WLD Primary Price Feed: ${wldPriceFeed}`);
      console.log(`   - Expected RedStonePriceFeed: ${deploymentData.RedStonePriceFeed}`);
      
      if (wldPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase()) {
        console.log(`   ✅ WLD is correctly configured to use RedStonePriceFeed`);
      } else {
        console.log(`   ⚠️ WARNING: WLD is not using RedStonePriceFeed as primary`);
      }
    } catch (error) {
      console.log(`   ⚠️ WARNING: Cannot check WLD price feed configuration`);
    }
    
    try {
      const wethPriceFeed = await vaultPriceFeed.priceFeeds(deploymentData.WETH);
      console.log(`   - WETH Primary Price Feed: ${wethPriceFeed}`);
      console.log(`   - Expected RedStonePriceFeed: ${deploymentData.RedStonePriceFeed}`);
      
      if (wethPriceFeed.toLowerCase() === deploymentData.RedStonePriceFeed.toLowerCase()) {
        console.log(`   ✅ WETH is correctly configured to use RedStonePriceFeed`);
      } else {
        console.log(`   ⚠️ WARNING: WETH is not using RedStonePriceFeed as primary`);
      }
    } catch (error) {
      console.log(`   ⚠️ WARNING: Cannot check WETH price feed configuration`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error checking VaultPriceFeed configuration: ${error.message}`);
  }
  
  console.log("\n------------------------------------------------------");
  console.log("PRODUCTION DEPLOYMENT CHECKLIST");
  console.log("------------------------------------------------------");
  
  console.log(`
3. Oracle Keeper Production Setup:

   A. Clone and Configure Oracle Keeper:
      - \`git clone https://github.com/Tytandoteth/redstone-oracle-keeper\`
      - \`cd redstone-oracle-keeper\`
      - \`npm install\`
      - Configure .env as shown in the script
   
   B. Update Oracle Keeper to use Real Data:
      - Set USE_MOCK_PRICES=false in .env
      - Configure REDSTONE_API_KEY with a valid key
      - Use REDSTONE_PRICE_SERVICE=redstone-main for production
   
   C. Deploy to a Reliable Hosting Service:
      - Choose a platform with high availability
      - Configure auto-scaling if needed
      - Set up a custom domain (optional)
   
   D. Configure Monitoring:
      - Set up uptime monitoring
      - Add logs and metrics collection
      - Create alerts for service disruptions
      
4. Frontend Integration:

   A. Install RedStone SDK:
      - \`cd /path/to/gmx-interface-world\`
      - \`npm install @redstone-finance/evm-connector\`
   
   B. Configure API Endpoints:
      - Update API_URLS in the frontend to point to your deployed Oracle Keeper
   
   C. Implement Contract Wrappers:
      - Create WrapperService utility class
      - Wrap all contract calls requiring price data
   
   D. Test Live Integration:
      - Verify prices are correctly displayed
      - Test token swaps with live data
      - Create test positions to verify full functionality
      
5. Security and Risk Management:

   A. Price Feed Validation:
      - Implement price sanity checks
      - Set up circuit breakers for extreme price movements
   
   B. Transaction Monitoring:
      - Monitor on-chain transactions
      - Set up alerts for unusual activity
   
   C. Backup Strategy:
      - Configure fallback price sources
      - Document manual intervention procedures
      
6. Final Verification:

   A. Run Token Whitelisting with Live Data:
      - \`npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain\`
   
   B. Verify Complete Deployment:
      - \`npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain\`
   
   C. Conduct End-to-End Testing:
      - Execute live trades on the deployed system
      - Verify all positions and orders work correctly
      - Check profit/loss calculations with live prices
  `);
  
  console.log("\n======================================================");
  console.log("INTEGRATION SDK GUIDE FOR FRONTEND");
  console.log("======================================================");
  
  console.log(`
// Example integration for GMX interface:

// src/utils/RedStoneWrapper.js
import { WrapperBuilder } from "@redstone-finance/evm-connector";

export class RedStoneWrapper {
  static wrapContract(contract) {
    return WrapperBuilder
      .wrapLite(contract)
      .usingPriceFeed("redstone-main");
  }
  
  static async getMaxPrice(vault, token) {
    const wrappedVault = this.wrapContract(vault);
    return wrappedVault.getMaxPrice(token);
  }
  
  static async getMinPrice(vault, token) {
    const wrappedVault = this.wrapContract(vault);
    return wrappedVault.getMinPrice(token);
  }
  
  static async createIncreasePosition(positionRouter, params) {
    const wrappedPositionRouter = this.wrapContract(positionRouter);
    return wrappedPositionRouter.createIncreasePosition(
      params.path,
      params.indexToken,
      params.amountIn,
      params.minOut,
      params.sizeDelta,
      params.isLong,
      params.acceptablePrice,
      params.executionFee,
      params.referralCode,
      { value: params.executionFee }
    );
  }
  
  // Add more wrapped methods as needed...
}

// Usage in React components:
// src/components/Exchange.js
import { RedStoneWrapper } from "../utils/RedStoneWrapper";

async function createPosition() {
  try {
    const tx = await RedStoneWrapper.createIncreasePosition(
      positionRouter,
      {
        path: [wldAddress], 
        indexToken: wethAddress,
        amountIn: ethers.utils.parseEther("10"),
        minOut: 0,
        sizeDelta: ethers.utils.parseEther("100"),
        isLong: true,
        acceptablePrice: ethers.utils.parseUnits("3000", 30),
        executionFee: ethers.utils.parseEther("0.01"),
        referralCode: ethers.constants.HashZero
      }
    );
    
    await tx.wait();
    console.log("Position created successfully!");
  } catch (error) {
    console.error("Error creating position:", error);
  }
}
  `);
  
  console.log("\n======================================================");
  console.log("PRODUCTION READINESS CHECKLIST");
  console.log("======================================================");
  
  console.log(`
✅ 1. Install RedStone SDK: npm install @redstone-finance/evm-connector
✅ 2. Configure Oracle Keeper for live data: USE_MOCK_PRICES=false
✅ 3. Deploy Oracle Keeper to production hosting
✅ 4. Set uniqueSignersThreshold to at least 3 for production
✅ 5. Update frontends to use RedStone SDK wrappers
✅ 6. Test full trading flow with live data
✅ 7. Implement monitoring and alerting
✅ 8. Document recovery procedures for emergencies
  `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
