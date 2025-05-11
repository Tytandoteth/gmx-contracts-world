# GMX on World Chain - Witnet Oracle Migration Roadmap

**Last Updated:** May 11, 2025

This document tracks the progress of migrating the GMX on World Chain project from RedStone Oracle to Witnet Oracle. Use this as the central reference to coordinate work across all repositories.

## Executive Summary

The migration from RedStone to Witnet Oracle aims to solve several key issues:
- Token whitelisting failures due to RedStone SDK transaction wrapping
- Gas estimation errors in price-sensitive operations
- Complex integration requirements across repositories

Migration will be completed when all three repositories are updated, tested, and deployed to production with Witnet Oracle integration.

## Migration Progress Dashboard

| Repository | Migration Status | Critical Blockers | Est. Completion |
|------------|------------------|-------------------|-----------------|
| Smart Contracts | 🟡 In Progress | Witnet Price Router Address | May 13, 2025 |
| Oracle Keeper | 🔴 Not Started | Depends on Contracts | May 15, 2025 |
| Frontend | 🔴 Not Started | Depends on Oracle Keeper | May 18, 2025 |

## Detailed Repository Status

### 1. Smart Contracts (gmx-contracts-world)

**Current Status**: 🟡 In Progress (60% Complete)

**Completed Tasks**:
- ✅ Created Witnet Oracle interfaces
- ✅ Implemented WitnetPriceFeed contract
- ✅ Created deployment scripts for Witnet integration
- ✅ Created token whitelisting scripts using Witnet
- ✅ Added testing scripts for Witnet price feeds

**Remaining Tasks**:
- 🔲 Obtain Witnet Price Router address for World Chain
- 🔲 Deploy WitnetPriceFeed contract
- 🔲 Configure WitnetPriceFeed with token price feed IDs
- 🔲 Whitelist tokens in the Vault
- 🔲 Verify end-to-end price feed functionality

**Dependencies**:
- Requires Witnet Price Router address for World Chain

### 2. Oracle Keeper (redstone-oracle-keeper)

**Current Status**: 🔴 Not Started (0% Complete)

**Tasks to Complete**:
- 🔲 Remove RedStone dependencies
- 🔲 Add Witnet interfaces and ABIs
- 🔲 Implement fetchWitnetPrices function
- 🔲 Update blockchain.ts to use Witnet
- 🔲 Modify service.ts to prioritize Witnet data
- 🔲 Update API endpoints with new data sources
- 🔲 Update configuration for Witnet integration
- 🔲 Deploy updated Oracle Keeper to production

**Dependencies**:
- Requires deployed WitnetPriceFeed contract address
- Requires Witnet Price Router address

### 3. Frontend (gmx-interface-world)

**Current Status**: 🔴 Not Started (0% Complete)

**Tasks to Complete**:
- 🔲 Remove RedStone SDK dependencies
- 🔲 Update contract address configuration
- 🔲 Update price feed logic to use direct contract calls
- 🔲 Add UI indicators for price feed source
- 🔲 Implement error handling for price feed issues
- 🔲 Connect to updated Oracle Keeper API
- 🔲 Test trading functionality end-to-end
- 🔲 Deploy to production

**Dependencies**:
- Requires deployed WitnetPriceFeed contract address
- Requires updated Oracle Keeper API

## Implementation Schedule

### Week 1 (May 11-17, 2025)

| Day | Smart Contracts | Oracle Keeper | Frontend |
|-----|----------------|---------------|----------|
| Sun (May 11) | Interface & contract implementation ✅ | - | - |
| Mon (May 12) | Get Witnet Price Router address | - | - |
| Tue (May 13) | Deploy WitnetPriceFeed & whitelist tokens | Start implementation | - |
| Wed (May 14) | Test & verify deployment | Continue implementation | - |
| Thu (May 15) | Support Oracle Keeper integration | Complete & deploy to testing | Start implementation |
| Fri (May 16) | Fix any issues found in testing | Fix issues & deploy to production | Continue implementation |
| Sat (May 17) | Production verification | Production monitoring | Testing |

### Week 2 (May 18-24, 2025)

| Day | Smart Contracts | Oracle Keeper | Frontend |
|-----|----------------|---------------|----------|
| Sun (May 18) | Monitor & support | Monitor & support | Complete implementation |
| Mon (May 19) | Monitor & support | Monitor & support | Deploy to production |
| Tue (May 20) | Final verification | Final verification | Final verification |

## Key Contract Addresses

| Contract | Address | Status |
|----------|---------|--------|
| Vault | 0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5 | ✅ Deployed |
| VaultPriceFeed | 0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf | ✅ Deployed |
| Witnet Price Router | TBD | ❌ Needed |
| WitnetPriceFeed | TBD | ❌ Not Deployed |

## Witnet Price Feed IDs

| Token | Witnet Price Feed ID | Status |
|-------|----------------------|--------|
| WLD | 0x574c4455 (placeholder) | ❌ Needs verification |
| WETH | 0x3d15f701 (standard ETH/USD) | ✅ Standard ID |
| MAG | 0x4d414755 (placeholder) | ❌ Needs verification |

## Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Witnet Price Router not available on World Chain | High | Medium | Research alternative oracle solutions (Chainlink, Band) |
| Tokens fail to whitelist with Witnet | High | Low | Create fallback contract for token pricing |
| Inaccurate prices from Witnet | Medium | Low | Implement CoinGecko validation & alerts |
| Integration delays between repositories | Medium | Medium | Prioritize Oracle Keeper update to unblock other repos |

## Communication & Coordination

For efficient coordination during the migration:
- Daily status updates in the GMX World Chain Discord channel
- Create GitHub issues for tracking progress in each repository
- Schedule syncs between repository maintainers every 2 days

**Contact Points**:
- Smart Contracts: [Your Name]
- Oracle Keeper: [Oracle Team Lead]
- Frontend: [Frontend Team Lead]
