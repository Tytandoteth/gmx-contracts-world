# GMX on World Chain - Deployment Guide

## Project Overview

This document provides a comprehensive overview of the GMX on World Chain deployment, focused on the WLD and WETH trading pair. The system consists of a parallel set of contracts where the deployer has governance control, providing a complete workaround to the inaccessible governance issue on the original deployment.

## Deployment Architecture

The project is built on three main components:

1. **Smart Contracts**: Custom deployment of GMX contracts focused on WLD and WETH
2. **Price Oracle**: RedStone price feed integration with mock price feeds for development
3. **Frontend Interface**: Modified GMX interface that connects to the custom contract deployment

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

## Known Issues and Limitations

1. **Token Whitelisting**: 
   - We were unable to directly whitelist WLD and WETH in the Vault due to price feed validation issues
   - The tokens are configured in VaultPriceFeed but Vault's `setTokenConfig` reverts

2. **Price Feed Considerations**:
   - Currently using mock price feeds for development
   - For production, the system must switch back to RedStonePriceFeed
   - RedStone integration requires transaction wrapping with price data

3. **Governance**:
   - All contracts have the deployer set as the governance address
   - This provides full control but requires appropriate key management

## Integration Points

### Frontend Integration

The frontend needs to be configured to connect to these custom contracts:

1. **Contract Addresses**: Replace the addresses in the frontend configuration with those from `.world-custom-deployment.json`

2. **RedStone Integration**: For price updates, integrate the RedStone SDK:
   ```javascript
   import { WrapperBuilder } from "redstone-evm-connector";
   
   // Wrap your contract calls with price data for RedStone
   const wrappedContract = WrapperBuilder
     .wrapLite(contract)
     .usingPriceFeed("redstone-main");
   
   // Then use wrappedContract for any calls requiring price data
   const result = await wrappedContract.FUNCTION_NAME();
   ```

3. **Mock Price Configuration**: For development, use the `fixedMockPriceFeeder.js` script to set predictable prices

### Oracle Keeper Service

The Oracle Keeper is required to serve RedStone price data to the frontend:

1. Clone the repo: `git clone https://github.com/Tytandoteth/redstone-oracle-keeper`
2. Install dependencies: `npm install`
3. Configure data source and provider in `.env`
4. Start the service: `npm run start`

The service will expose API endpoints that the frontend can use to fetch the latest price data.

## Deployment Scripts Guide

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/world/deployCustomPriceFeed.js` | Deploys RedStonePriceFeed and VaultPriceFeed | `npx hardhat run scripts/world/deployCustomPriceFeed.js --network worldchain` |
| `scripts/world/configureRedStoneCustom.js` | Configures RedStonePriceFeed with tokens | `npx hardhat run scripts/world/configureRedStoneCustom.js --network worldchain` |
| `scripts/world/updateTokenConfig.js` | Updated deployment to focus on WLD and WETH | `npx hardhat run scripts/world/updateTokenConfig.js --network worldchain` |
| `scripts/world/deployRemainingFixed.js` | Deploys remaining contracts correctly | `npx hardhat run scripts/world/deployRemainingFixed.js --network worldchain` |
| `scripts/world/deployFinalStep.js` | Finalizes the deployment with PositionManager | `npx hardhat run scripts/world/deployFinalStep.js --network worldchain` |
| `scripts/world/fixedMockPriceFeeder.js` | Sets up mock prices for development | `npx hardhat run scripts/world/fixedMockPriceFeeder.js --network worldchain` |
| `scripts/world/verifyCompleteDeploymentFixed.js` | Verifies the full deployment | `npx hardhat run scripts/world/verifyCompleteDeploymentFixed.js --network worldchain` |

## Testing the Deployment

### Basic End-to-End Test Flow

1. **Set Mock Prices**:
   ```
   npx hardhat run scripts/world/fixedMockPriceFeeder.js --network worldchain
   ```

2. **Verify Token Prices**:
   - WLD should be $1.25
   - WETH should be $3,000.00

3. **Test Swap Functionality**:
   - Swap WLD to WETH (or vice versa) using the Router contract
   - The frontend should integrate this through the swap UI

4. **Test Position Creation**:
   - Create a long or short position through PositionRouter
   - Check position details through the Vault

## Next Steps

1. **Complete Token Whitelisting**: 
   - Resolve Vault whitelisting issue to enable full trading functionality
   - May require a custom transaction that bypasses the price validation or a governance proposal

2. **Frontend Integration**:
   - Update frontend configuration to use custom contract addresses
   - Integrate RedStone SDK for price feeds
   - Test all operations: swaps, leverage, limit orders

3. **Oracle Keeper Setup**:
   - Deploy RedStone Oracle Keeper service
   - Set up monitoring to ensure reliable price data
   - Configure backup price feeds if needed

4. **Testing and Security**:
   - Perform comprehensive testing of all functionality
   - Consider a security audit of the deployed contracts
   - Set up monitoring for key metrics and anomalies

5. **Documentation Update**:
   - Finalize all documentation for developers
   - Create user guides for traders
   - Document all deployed addresses and configurations

## Conclusion

The GMX on World Chain deployment is now substantially complete with a focus on WLD and WETH trading. The system provides a parallel infrastructure with governance control, enabling further customization and development. 

While there are still some issues to resolve with token whitelisting, the core infrastructure is in place and ready for frontend integration. The next phase should focus on resolving the remaining issues and completing the frontend integration for a full user experience.

---

*Last Updated: May 11, 2025*
