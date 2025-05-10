# GMX on World Chain - Readiness Assessment

This document identifies potential issues and provides recommendations for continuing work on the GMX on World Chain project.

## Custom Deployment Status

| Component | Address | Status |
|-----------|---------|--------|
| VaultPriceFeed | `0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf` | ✅ Deployed |
| RedStonePriceFeed | `0xA63636C9d557793234dD5E33a24EAd68c36Df148` | ✅ Deployed |
| Vault | `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5` | ✅ Deployed |
| Router | `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b` | ✅ Deployed |
| USDG | `0xB1AfC10073a6C05a3c79ac051deFaa1C83DcEFAf` | ✅ Deployed |
| VaultUtils | `0x26eCCeBB6E82210dc4dD3134ab2ded1AB78a5345` | ✅ Deployed |

## Potential Issues and Risks

### 1. RedStone Integration Issues

#### 1.1. SDK Version Compatibility
- **Issue**: The project uses `@redstone-finance/evm-connector` version `0.8.0` and `@redstone-finance/sdk` version `0.8.0`. These might not be the latest versions.
- **Risk**: Incompatibility with newer RedStone data sources or security fixes missing.
- **Recommendation**: Update to the latest RedStone SDK versions after verifying compatibility.

#### 1.2. RedStonePriceFeed Implementation
- **Issue**: The `getAuthorisedSignerIndex` function in `RedStonePriceFeed.sol` returns `0` for any signer, allowing any signer to provide price data.
- **Risk**: HIGH - This is marked as a testing configuration in comments but is a significant security concern for production.
- **Recommendation**: Implement proper signer validation against a whitelist of trusted RedStone signers.

#### 1.3. Unique Signers Threshold
- **Issue**: `getUniqueSignersThreshold` is set to `1` in `RedStonePriceFeed.sol`, which is explicitly noted as a testing configuration.
- **Risk**: MEDIUM - In production, this should be higher (3-5 as noted in comments) to ensure oracle reliability.
- **Recommendation**: Increase this value for production deployment and implement proper multi-signer validation.

#### 1.4. Price Decimals Handling
- **Issue**: The price decimals handling in `RedStonePriceFeed.sol` assumes 8 decimals as default but doesn't perform conversion if the actual decimals differ.
- **Risk**: MEDIUM - Could lead to price calculation errors if RedStone provides prices with different decimal precision.
- **Recommendation**: Implement proper decimal conversion logic.

### 2. Contract Configuration Issues

#### 2.1. VaultPriceFeed Dependencies
- **Issue**: `VaultPriceFeed.sol` has dependencies on Chainlink and PancakeSwap interfaces which may not be relevant on World Chain.
- **Risk**: LOW - Unused code increases complexity and attack surface.
- **Recommendation**: Remove unused dependencies and functionality for World Chain deployment.

#### 2.2. Missing ShortsTracker Configuration
- **Issue**: The custom deployment doesn't include ShortsTracker configuration, which is present in the original deployment.
- **Risk**: MEDIUM - Shorting functionality might not work correctly.
- **Recommendation**: Deploy and configure ShortsTracker for the custom deployment.

#### 2.3. Incomplete Token List
- **Issue**: `getSupportedTokens()` in `RedStonePriceFeed.sol` only returns three tokens: WLD, ETH, and BTC.
- **Risk**: LOW - Additional tokens used in the system may not be properly recognized by RedStone SDK.
- **Recommendation**: Update the supported tokens list to include all tokens used in the system.

### 3. Integration Issues

#### 3.1. Frontend Integration
- **Issue**: The GMX interface needs to be updated to use the custom contract addresses and RedStone SDK wrapping.
- **Risk**: HIGH - Without proper integration, trades will fail due to missing price data.
- **Recommendation**: Implement the frontend configuration and RedStone SDK integration as outlined in FRONTEND_INTEGRATION.md.

#### 3.2. Oracle Keeper
- **Issue**: Oracle Keeper hasn't been deployed and configured with the new RedStonePriceFeed address.
- **Risk**: HIGH - Frontend will not have access to price data without the Oracle Keeper.
- **Recommendation**: Deploy the Oracle Keeper as outlined in ORACLE_KEEPER_SETUP.md.

#### 3.3. Transaction Gas Requirements
- **Issue**: RedStone transactions include price data in calldata, which increases gas requirements.
- **Risk**: MEDIUM - Users may experience failed transactions if gas limits are not properly configured.
- **Recommendation**: Ensure sufficient gas limits are set in the frontend for RedStone-wrapped transactions.

### 4. Testing and Verification Issues

#### 4.1. Missing End-to-End Tests
- **Issue**: No comprehensive tests for the RedStone integration and custom deployment.
- **Risk**: HIGH - Potential for undiscovered bugs in production.
- **Recommendation**: Create a test suite that verifies the entire flow from frontend to contracts with RedStone integration.

#### 4.2. Mock Price Feeder Dependency
- **Issue**: For development, there's a dependency on the mock price feeder script.
- **Risk**: LOW - Developers might forget to switch to RedStone for production.
- **Recommendation**: Create clear development/production flags and documentation for switching between modes.

## Immediate Next Steps

1. **Security Hardening**:
   - Update `getAuthorisedSignerIndex` and `getUniqueSignersThreshold` in `RedStonePriceFeed.sol` for production use
   - Implement proper signer validation against trusted RedStone signers

2. **Frontend Integration**:
   - Create configuration file for custom contract addresses
   - Implement RedStone SDK wrapping for transactions
   - Add appropriate gas limit settings for RedStone transactions

3. **Oracle Keeper Deployment**:
   - Deploy the Oracle Keeper service
   - Configure it to work with the new RedStonePriceFeed address
   - Implement monitoring for the service

4. **Testing Framework**:
   - Create a comprehensive test suite for the custom deployment
   - Include edge cases like RedStone unavailability and price spikes
   - Implement integration tests that verify the entire flow

## Long-term Considerations

1. **Governance Strategy**:
   - Develop a clear governance strategy for the custom deployment
   - Create documentation for governance operations (token listing, parameter updates)

2. **Monitoring and Alerting**:
   - Implement monitoring for price feeds and Oracle Keeper
   - Create alerting for abnormal price conditions or service disruptions

3. **Failover Mechanisms**:
   - Design and implement failover mechanisms for price feeds
   - Consider secondary oracles as fallbacks

4. **Documentation Updates**:
   - Create developer onboarding documentation
   - Document production deployment procedures
   - Create user guides explaining the RedStone integration

## Critical Path

The following tasks are on the critical path and should be addressed immediately:

1. Fix the security issues in `RedStonePriceFeed.sol`
2. Deploy the Oracle Keeper
3. Complete the frontend integration with RedStone SDK
4. Implement comprehensive testing

## Risk Matrix

| Issue | Impact | Likelihood | Risk Level |
|-------|--------|------------|------------|
| Weak signer validation | High | High | Critical |
| Low unique signers threshold | High | Medium | High |
| Missing Oracle Keeper | High | High | Critical |
| Incomplete frontend integration | High | High | Critical |
| Missing tests | Medium | High | High |
| Gas requirement issues | Medium | Medium | Medium |
| Decimal precision issues | Medium | Low | Medium |

## Conclusion

The custom deployment provides a workable solution for the governance issue, but several critical issues need to be addressed before production use. Focus on securing the RedStone price feed implementation and completing the frontend and Oracle Keeper integrations as the highest priorities.
