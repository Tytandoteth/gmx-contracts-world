# GMX on World Chain - Deployment Guide

## Project Overview

This document provides a comprehensive overview of the GMX on World Chain deployment, focused on the WLD and WETH trading pair. The system consists of a parallel set of contracts where the deployer has governance control, providing a complete workaround to the inaccessible governance issue on the original deployment.

## Deployment Architecture

The project is built on three main repositories that work together:

1. **Smart Contracts (gmx-contracts-world)**: Custom deployment of GMX contracts focused on WLD and WETH
2. **Oracle Keeper (redstone-oracle-keeper)**: Service that provides price data for the trading system
3. **Frontend Interface (gmx-interface-world)**: Modified GMX interface that connects to the custom contract deployment

## Current Deployment Status

| Component | Status | Address | Notes |
|-----------|--------|---------|-------|
| **Tokens** |
| WLD | ✅ Deployed | `0x99A49AaA79b648ee24e85c4eb3A1c9c429A95652` | Native World Chain token |
| WETH | ✅ Deployed | `0xF35611DF18c3FFcBA904640dCb367C6089CF25f1` | Wrapped ETH on World Chain |
| USDG | ✅ Deployed | `0xB1AfC10073a6C05a3c79ac051deFaa1C83DcEFAf` | Internal stablecoin for GMX system |
| **Price Feeds** |
| RedStonePriceFeed | ✅ Deployed | `0xA63636C9d557793234dD5E33a24EAd68c36Df148` | Primary price feed for production |
| VaultPriceFeed | ✅ Deployed | `0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf` | Aggregator for all price sources |
| WLD MockPriceFeed | ✅ Deployed | `0x38ad5c1D52717A7EC0a3eed6a4D225dC6F4C013F` | Mock for development ($1.25) |
| WETH MockPriceFeed | ✅ Deployed | `0x33e8Fd5EcC2272d324656A261C78d9ab341759b8` | Mock for development ($3,000.00) |
| **Core System** |
| Vault | ✅ Deployed | `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5` | Main contract for all user funds |
| Router | ✅ Deployed | `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b` | Entry point for user operations |
| VaultUtils | ✅ Deployed | `0x26eCCeBB6E82210dc4dD3134ab2ded1AB78a5345` | Utility functions for Vault operations |
| **Trading System** |
| ShortsTracker | ✅ Deployed | `0x22CCf3C6a4370A097FbDF6a44e4DaC392a6c0bf9` | Tracks short positions |
| OrderBook | ✅ Deployed | `0x8179D468fF072B8A9203A293a37ef70EdCA850fc` | Handles limit orders |
| PositionUtils | ✅ Deployed | `0x70A279a1D5360818B8c72594609A710A245733b6` | Library for position calculations |
| PositionRouter | ✅ Deployed | `0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF` | Handles position execution with delays |
| PositionManager | ✅ Deployed | `0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D` | Advanced position management |
| **Oracle Service** |
| Oracle Keeper | ✅ Implemented | N/A | Provides price data for WLD ($1.25) and WETH ($3,000) |

## Oracle Keeper Status

The Oracle Keeper implementation is now complete with the following features:

- **Correct Mock Prices**:
  - WLD: $1.25 (matching GMX MockPriceFeed)
  - WETH: $3,000.00 (matching GMX MockPriceFeed)

- **Configuration**:
  ```json
  "debug": {
    "rpcUrl": "https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/",
    "chainId": "480",
    "contractAddress": "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
    "supportedTokens": ["WLD", "WETH"],
    "cacheDuration": 30000
  }
  ```

- **Status Reporting**:
  - Status shows "fallback" when using mock prices
  - Source correctly displays "GMX Development Mock Prices"
  - Full debug information available for transparency

## Remaining Tasks and Solutions

### 1. Token Whitelisting Solution

With the Oracle Keeper now functioning, we can whitelist tokens using RedStone SDK for transaction wrapping. A new script has been created:

```bash
# Install the RedStone SDK first
npm install @redstone-finance/evm-connector

# Run the whitelisting script with RedStone SDK
npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain
```

This script wraps the vault contract call with RedStone price data, which resolves the price validation issue during token whitelisting.

### 2. MAG Token Integration

The roadmap includes adding support for MAG token:

1. Add MAG to the Oracle Keeper's supported tokens list
2. Set the mock price to $2.50 as specified
3. Use the same whitelisting script for MAG once ready

### 3. Health Check Enhancement

The Oracle Keeper should be enhanced with:
- More detailed health status information
- Explicit status for GMX contract integration
- Monitoring for price feed reliability

## Integration Instructions

### Smart Contract Integration

To integrate with the RedStone price feed system:

```javascript
// Install the RedStone SDK
// npm install @redstone-finance/evm-connector

const { WrapperBuilder } = require("@redstone-finance/evm-connector");

// Get contract instance
const vault = await ethers.getContractAt("Vault", vaultAddress);

// Wrap with RedStone data
const wrappedVault = WrapperBuilder
  .wrapLite(vault)
  .usingPriceFeed("redstone-main");

// Now calls will include the required price data
const tx = await wrappedVault.setTokenConfig(
  wldAddress,     // token
  18,             // tokenDecimals
  10000,          // tokenWeight
  75,             // minProfitBps (0.75%)
  0,              // maxUsdgAmount
  false,          // isStable
  true            // isShortable
);
```

### Frontend Integration

The frontend needs to:

1. **Connect to Oracle Keeper**:
   - Fetch prices from `/prices` endpoint
   - Displays status from Oracle Keeper

2. **Use RedStone SDK** for transaction wrapping:
   ```javascript
   import { WrapperBuilder } from "@redstone-finance/evm-connector";
   
   // Wrap contracts before use
   const wrappedContract = WrapperBuilder
     .wrapLite(contract)
     .usingPriceFeed("redstone-main");
   
   // Use wrapped contract for all price-sensitive operations
   const result = await wrappedContract.methodName();
   ```

## Deployment Scripts Guide

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/world/deployCustomPriceFeed.js` | Deploys RedStonePriceFeed and VaultPriceFeed | `npx hardhat run scripts/world/deployCustomPriceFeed.js --network worldchain` |
| `scripts/world/configureRedStoneCustom.js` | Configures RedStonePriceFeed with tokens | `npx hardhat run scripts/world/configureRedStoneCustom.js --network worldchain` |
| `scripts/world/updateTokenConfig.js` | Updated deployment to focus on WLD and WETH | `npx hardhat run scripts/world/updateTokenConfig.js --network worldchain` |
| `scripts/world/deployRemainingFixed.js` | Deploys remaining contracts correctly | `npx hardhat run scripts/world/deployRemainingFixed.js --network worldchain` |
| `scripts/world/deployFinalStep.js` | Finalizes the deployment with PositionManager | `npx hardhat run scripts/world/deployFinalStep.js --network worldchain` |
| `scripts/world/fixedMockPriceFeeder.js` | Sets up mock prices for development | `npx hardhat run scripts/world/fixedMockPriceFeeder.js --network worldchain` |
| `scripts/world/whitelistTokensWithRedStone.js` | Whitelists tokens using RedStone SDK | `npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain` |
| `scripts/world/verifyCompleteDeploymentFixed.js` | Verifies the full deployment | `npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain` |
| `scripts/world/redStoneIntegrationDemo.js` | Demonstrates RedStone integration | `npx hardhat run scripts/world/redStoneIntegrationDemo.js --network worldchain` |

## Testing the Full System

1. **Verify Oracle Keeper**:
   - Confirm `/prices` endpoint returns correct values for WLD and WETH
   - Verify status reports correctly through health check endpoint

2. **Whitelist Tokens**:
   ```bash
   npx hardhat run scripts/world/whitelistTokensWithRedStone.js --network worldchain
   ```

3. **Verify Whitelisting**:
   ```bash
   npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain
   ```

4. **Test Trading Operations**:
   - Use the frontend with RedStone SDK integration
   - Test swaps, leverage positions, and limit orders
   - Verify all operations complete successfully

## Next Steps and Roadmap

1. **Complete Integration Testing**:
   - Verify all components work together seamlessly
   - Test edge cases and error handling

2. **Add MAG Token**:
   - Update Oracle Keeper to include MAG price data
   - Configure price feed and whitelist MAG in the Vault
   - Update frontend to support MAG trading pairs

3. **Production Deployment**:
   - Transition from mock prices to real RedStone data
   - Set up monitoring and alerts
   - Perform security checks and audits

4. **Documentation and User Guides**:
   - Complete developer documentation
   - Create user guides for trading on the platform
   - Document system architecture and design decisions

## Conclusion

With the successful implementation of the Oracle Keeper and the solution for token whitelisting, the GMX on World Chain project has achieved a major milestone. The system now has all the components necessary for a working MVP focused on WLD and WETH trading pairs.

The three-repository architecture (Contracts, Oracle Keeper, Frontend) provides a flexible and maintainable system that can be extended with additional tokens and features in the future. 

The next phase will focus on comprehensive testing, adding MAG token support, and transitioning to production-ready price feeds.

---

*Last Updated: May 11, 2025*
