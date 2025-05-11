# GMX on World Chain - Production MVP Guide

This guide provides the status and next steps for each repository in the GMX on World Chain project to achieve a working MVP with live data in production. Use this document to coordinate across all repositories and ensure all components are properly aligned.

**Last Updated:** May 11, 2025

> **IMPORTANT UPDATE**: We are migrating from RedStone to Witnet Oracle. See the "Oracle Migration Plan" section below for details.

## Overall System Architecture

The GMX on World Chain system consists of three main repositories that work together:

1. **Smart Contracts (gmx-contracts-world)**: Core trading infrastructure deployed on World Chain
2. **Oracle Keeper (redstone-oracle-keeper)**: Price feed service that provides data for the trading system
3. **Frontend Interface (gmx-interface-world)**: User interface for interacting with the trading system

## Current Status & Next Steps by Repository

### 1. Smart Contracts (gmx-contracts-world)

**Current Status**: ⚠️ Transition Phase
- ✅ All contracts deployed on World Chain
- ✅ Mock price feeds configured and working
- ✅ Core infrastructure contracts verified
- ⚠️ Using mock price feeds rather than live Oracle data
- ⚠️ Tokens not yet whitelisted in Vault
- 🔄 Migrating from RedStone to Witnet Oracle (in progress)

**Next Steps (With Witnet Oracle)**:
1. Deploy WitnetPriceFeed contract:
   ```bash
   cd /path/to/gmx-contracts-world
   npx hardhat run scripts/world/deployWitnetPriceFeed.js --network worldchain
   ```

2. Whitelist tokens with Witnet Oracle:
   ```bash
   npx hardhat run scripts/world/whitelistTokensWitnet.js --network worldchain
   ```

3. Test Witnet price feeds:
   ```bash
   npx hardhat run scripts/world/testWitnetPriceFeeds.js --network worldchain
   ```

4. Verify production readiness:
   ```bash
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   ```

**Key Contract Addresses**:
- Vault: `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5`
- Router: `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b`
- VaultPriceFeed: `0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf`
- RedStonePriceFeed: `0xA63636C9d557793234dD5E33a24EAd68c36Df148`
- PositionRouter: `0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF`
- PositionManager: `0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D`

### 2. Oracle Keeper (redstone-oracle-keeper)

**Current Status**: ⚠️ Development Mode
- ✅ Implementation complete
- ✅ Mock prices configured for WLD ($1.25) and WETH ($3,000)
- ✅ Debug information available
- ⚠️ Not yet deployed to production hosting
- 🔄 Migrating from RedStone to Witnet Oracle (in progress)

**Next Steps (With Witnet Oracle)**:
1. Update Oracle Keeper code:
   - Clone repository (if not already done):
     ```bash
     git clone https://github.com/Tytandoteth/redstone-oracle-keeper
     cd redstone-oracle-keeper
     npm install
     ```
   
   - Remove RedStone dependencies and add Witnet interfaces:
     ```bash
     npm uninstall @redstone-finance/evm-connector
     npm install ethers@5.7.2
     ```
   
   - Create production `.env` file:
     ```
     # Witnet Configuration
     WITNET_PRICE_ROUTER_ADDRESS=YOUR_PRICE_ROUTER_ADDRESS
     
     # Provider Configuration
     RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
     CHAIN_ID=480
     
     # Token Configuration
     SUPPORTED_TOKENS=WLD,WETH,MAG
     
     # Token IDs in Witnet Format (bytes4)
     WLD_PRICE_ID=0x574c4455
     WETH_PRICE_ID=0x3d15f701
     MAG_PRICE_ID=0x4d414755
     
     # Service Configuration
     PORT=3000
     UPDATE_INTERVAL_MS=60000
     CACHE_DURATION_MS=30000
     
     # Feature Flags
     USE_PRODUCTION_PRICES=true
     ENABLE_DEBUG=true
     ```

2. Update blockchain.ts to use Witnet:
   - Replace RedStone functions with Witnet price router calls
   - Implement fallback to CoinGecko if Witnet is unavailable
   - Verify that the `priceService.js` properly fetches from RedStone

3. Deploy to production hosting:
   - Deploy to a reliable hosting provider (Heroku, AWS, Cloudflare Workers, etc.)
   - Set up monitoring and alerts
   - Configure a custom domain (optional)

4. Test the live price service:
   - Verify `/prices` endpoint returns live prices for WLD and WETH
   - Check that status properly reflects "live" (not "fallback")
   - Test with frontend to ensure proper integration

**API Endpoints**:
- `/prices`: Returns prices for all supported tokens
- `/prices/WLD`: Returns WLD-specific price data
- `/prices/WETH`: Returns WETH-specific price data
- `/health`: Returns service health status

### 3. Frontend Interface (gmx-interface-world)

**Current Status**: ⚠️ Not Production Ready
- ✅ Basic UI implementation complete
- ✅ Core trading functionality implemented
- ⚠️ Not connected to deployed contracts
- ⚠️ Not using production price feeds
- 🔄 Migrating from RedStone to direct Witnet calls (in progress)

**Next Steps (With Witnet Oracle)**:
1. Update the price feed integration:
   ```bash
   cd /path/to/gmx-interface-world
   # No special SDK needed for Witnet - just use ethers.js
   ```

2. Update contract addresses:
   - Edit `src/config/addresses.ts` to include deployed contract addresses
   - Set the `WORLD_CHAIN` configuration to use mainnet addresses
   - Add the Witnet Price Router address

3. Implement direct contract calls to price feed:
   - Update price feed actions to query Witnet-based oracle
   - Add indicators showing price source (Witnet)
   - Implement fallback mechanisms for price availability

4. Configure Oracle Keeper integration:
   - Update API endpoints to point to deployed Oracle Keeper
   - Implement price polling and display
   - Add health status monitoring

5. Test full trading flow:
   - Test token swaps with live price data
   - Test creating leverage positions
   - Test limit orders
   - Verify position management and liquidation

**Example RedStone Wrapper Implementation**:
```javascript
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
}

## Integration Testing Checklist

Once all repositories are updated, follow this checklist to verify the complete system:

1. **Oracle Keeper Verification**:
   - [ ] Oracle Keeper is deployed and accessible
   - [ ] `/prices` endpoint returns live data
   - [ ] Price values are reasonable and within expected ranges

2. **Smart Contract Verification**:
   - [ ] VaultPriceFeed is using WitnetPriceFeed for all tokens
   - [ ] WitnetPriceFeed is properly configured with correct feed IDs
   - [ ] WLD and WETH tokens are successfully whitelisted
   - [ ] Unique signers threshold is set to at least 3 for security

3. **Frontend Verification**:
   - [ ] Frontend displays correct prices from Oracle Keeper
   - [ ] Contract addresses are properly configured
   - [ ] Direct contract calls are working correctly
   - [ ] All trading functions work end-to-end

4. **Full Trading Flow Test**:
   - [ ] Create a small swap (e.g., WLD to WETH)
   - [ ] Create a small long position
   - [ ] Create a small short position
   - [ ] Place and execute a limit order
   - [ ] Close a position and verify profit/loss calculation

## Deployment Command Quick Reference

### Smart Contracts

```bash
# Install RedStone SDK
npm install @redstone-finance/evm-connector

# Switch to live price feeds
npx hardhat run scripts/world/switchToLivePriceFeeds.js --network worldchain

# Whitelist tokens with RedStone SDK
npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain

# Verify deployment
npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
```

### Oracle Keeper

```bash
# Start in development mode
npm run start

# Deploy to Heroku
heroku create gmx-world-oracle-keeper
git push heroku main
```

### Frontend

```bash
# Install dependencies
npm install
npm install @redstone-finance/evm-connector

# Start development server
npm run start

# Build for production
npm run build

# Deploy to hosting (e.g., Netlify, Vercel)
npm run deploy
```

## Common Issues & Solutions

### Price Feed Issues

**Symptom**: Transactions revert with price validation errors
**Solution**: 
1. Verify WitnetPriceFeed is configured correctly with proper data feed IDs
2. Ensure transactions are properly wrapped with Witnet SDK
3. Check Oracle Keeper is returning valid price data

### Whitelisting Issues

**Symptom**: Token whitelisting fails in the Vault
**Solution**:
1. Make sure Witnet SDK is installed
2. Verify WitnetPriceFeed is set as the primary price feed in VaultPriceFeed
3. Use the proper wrapping technique with Witnet SDK

### Frontend Connection Issues

**Symptom**: Frontend shows "Unable to connect to contracts"
**Solution**:
1. Verify contract addresses are correctly configured
2. Check network settings for World Chain (Chain ID: 480)
3. Ensure your wallet is connected to World Chain

## RedStone to Witnet Oracle Migration Plan

After encountering challenges with the RedStone Oracle integration, we've decided to migrate to Witnet Oracle for more straightforward integration with the GMX system on World Chain.

### Key Benefits of Migration

1. **Simplified Integration**: Witnet doesn't require special transaction wrapping, making token whitelisting and other operations more reliable
2. **Direct Contract Calls**: Frontend can interact directly with contracts without special SDK wrapper functions
3. **Better Price Feed Reliability**: Witnet has established integration with World Chain's infrastructure
4. **Simpler Maintenance**: Removes complexity from the Oracle Keeper implementation

### Required Code Changes

#### GMX Contracts
```solidity
// WitnetPriceFeed.sol (new contract)
pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "./interfaces/IPriceFeed.sol";
import "./interfaces/IWitnetPriceRouter.sol";
import "../access/Governable.sol";

contract WitnetPriceFeed is IPriceFeed, Governable {
    using SafeMath for uint256;
    
    IWitnetPriceRouter public immutable witnetPriceRouter;
    mapping(address => bytes4) public dataFeedIds;
    
    // Implementation details...
}
```

#### Oracle Keeper Service
```typescript
// blockchain.ts update
async function fetchWitnetPrices(provider, supportedTokens) {
  const router = new ethers.Contract(
    WITNET_PRICE_ROUTER_ADDRESS,
    WitnetPriceRouterABI,
    provider
  );
  
  // Implementation details...
}
```

#### Frontend Updates
```typescript
// Updated price fetching in src/Api/prices.ts
export async function fetchPrices(chainId, tokens, provider) {
  const priceFeed = getContract(priceFeedAddress, PRICE_FEED_ABI, provider);
  
  // Direct contract calls - no special wrapping needed
  // Implementation details...
}
```

## Migration Implementation Timeline

### Week 1: Oracle Keeper & Contract Updates
- Deploy WitnetPriceFeed contract
- Update Oracle Keeper to use Witnet
- Test price feed integration

### Week 2: Frontend & Production Deployment
- Update Frontend to use direct contract calls
- Complete end-to-end testing
- Deploy all components to production

## Monitoring & Maintenance

For a production system, implement the following monitoring:

1. **Price Feed Monitoring**:
   - Set up alerts for price deviations or service outages
   - Configure fallback mechanisms for price data

2. **Contract Monitoring**:
   - Monitor gas costs and transaction success rates
   - Set up alerts for unusual activity or failed transactions

3. **Performance Monitoring**:
   - Track Oracle Keeper response times
   - Monitor frontend performance metrics

## Conclusion

By following this guide, all three repositories can be synchronized and transitioned to production for a fully functional GMX on World Chain MVP with live data. Regular coordination between repositories is essential to ensure all components work together seamlessly.

## Contact Information

For questions or issues related to specific repositories:

- Smart Contracts: [Tytandoteth/gmx-contracts-world](https://github.com/Tytandoteth/gmx-contracts-world)
- Oracle Keeper: [Tytandoteth/redstone-oracle-keeper](https://github.com/Tytandoteth/redstone-oracle-keeper)
- Frontend Interface: [Tytandoteth/gmx-interface-world](https://github.com/Tytandoteth/gmx-interface-world)

---

*Last Updated: May 11, 2025*
