# GMX on World Chain - Oracle Integration Plan

## Current Status and Challenges

After deploying the full suite of GMX contracts on World Chain with focus on WLD and WETH trading pairs, we've encountered a critical issue with token whitelisting in the Vault contract. This document outlines our findings and proposes a structured approach to resolve these issues.

### Key Issues Identified

1. **Token Whitelisting Failure**: The `setTokenConfig` function in the Vault contract fails during execution, even when using mock price feeds.

2. **Price Validation Complexity**: The Vault's `getMaxPrice` function includes validation logic that requires properly functioning price feeds, and this validation cannot be bypassed through standard transaction methods.

3. **RedStone Transaction Wrapping Requirement**: The RedStonePriceFeed contract requires special transaction wrapping with price data, which isn't supported in standard Hardhat deployment scripts.

## Architecture-Aligned Solution

The project consists of three main repositories that work together:

1. **gmx-contracts-world**: Smart contract implementation (current repository)
2. **gmx-interface-world**: Frontend interface
3. **redstone-oracle-keeper**: Oracle service for price feeds

Our solution should leverage this architecture rather than attempting to work around it. The whitelisting issue is fundamentally tied to the oracle integration, which is a key part of the system design.

## Integration Plan

### Phase 1: RedStone Oracle Keeper Setup

1. **Clone and Configure the Oracle Keeper**:
   ```bash
   git clone https://github.com/Tytandoteth/redstone-oracle-keeper
   cd redstone-oracle-keeper
   npm install
   ```

2. **Configure for WLD and WETH**:
   - Update `.env` file with appropriate API keys and endpoints
   - Configure data sources for WLD/USD and WETH/USD price pairs
   - Set up appropriate update intervals and fallback mechanisms

3. **Deploy Oracle Keeper Service**:
   - Deploy as a Cloudflare worker or other serverless function
   - Set up monitoring and health checks
   - Create debugging endpoints for development

### Phase 2: RedStone SDK Integration with Contracts

1. **Create RedStone Price Provider**:
   Add a script to the contracts repository that demonstrates how to wrap transactions with RedStone data:

   ```javascript
   const { WrapperBuilder } = require("redstone-evm-connector");

   async function getTokenPrice(token) {
     // Get the contract instance
     const vault = await ethers.getContractAt("Vault", vaultAddress);
     
     // Wrap with RedStone data
     const wrappedVault = WrapperBuilder
       .wrapLite(vault)
       .usingPriceFeed("redstone-main");
     
     // Now calls will include the required price data
     const price = await wrappedVault.getMaxPrice(token);
     return price;
   }
   ```

2. **Create Whitelist Script with RedStone Wrapping**:
   ```javascript
   async function whitelistTokenWithRedStone(tokenAddress) {
     const vault = await ethers.getContractAt("Vault", vaultAddress);
     
     const wrappedVault = WrapperBuilder
       .wrapLite(vault)
       .usingPriceFeed("redstone-main");
     
     await wrappedVault.setTokenConfig(
       tokenAddress,
       18,
       10000,
       75,
       0,
       false,
       true
     );
   }
   ```

### Phase 3: Frontend Integration

1. **Update Frontend Configuration**:
   - Configure the frontend to use deployed contract addresses
   - Integrate the RedStone SDK for price data fetching
   - Create wrappers for all contract calls that require price data

2. **Implement EnhancedOracleKeeperFetcher**:
   ```javascript
   class EnhancedOracleKeeperFetcher {
     constructor(baseUrl) {
       this.baseUrl = baseUrl;
     }
     
     async fetchPrice(symbol) {
       const response = await fetch(`${this.baseUrl}/prices/${symbol}`);
       const data = await response.json();
       return data.price;
     }
     
     async wrapContract(contract) {
       // Integrate with RedStone SDK for transaction wrapping
       return WrapperBuilder
         .wrapLite(contract)
         .usingPriceFeed("redstone-main");
     }
   }
   ```

### Phase 4: Testing and Verification

1. **Comprehensive Test Suite**:
   - Test Oracle Keeper endpoints directly
   - Test contract interactions with RedStone wrapping
   - Test frontend integration with both components

2. **End-to-End Trading Flow Test**:
   - Create and execute a test trade using the complete system
   - Verify all components work together correctly

## Next Steps

1. **Immediate Action**: Set up the RedStone Oracle Keeper for WLD and WETH price data
2. **Short-term**: Create scripts with RedStone SDK integration for contract interaction
3. **Mid-term**: Complete frontend integration with the Oracle Keeper
4. **Long-term**: Add MAG token according to the roadmap and expand trading pairs

## Conclusion

By focusing on proper oracle integration instead of trying to work around the price validation, we align with the project's architectural design and create a more sustainable solution. The token whitelisting issue is fundamentally an oracle integration challenge, which is best addressed by leveraging the existing RedStone Oracle Keeper repository as designed.

This approach also prepares us for Phase 3 of the roadmap: "Oracle Keeper Integration" and ensures we're building on a solid foundation for the future phases.

---

*Last Updated: May 11, 2025*
