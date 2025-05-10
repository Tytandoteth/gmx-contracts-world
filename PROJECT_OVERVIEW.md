# GMX on World Chain - Project Overview

This document provides a comprehensive overview of the GMX on World Chain project, including the relationships between repositories, architecture, deployment status, and roadmap.

## Repository Structure

The project consists of three main repositories that work together to provide a complete trading solution:

### 1. [gmx-contracts-world](https://github.com/Tytandoteth/gmx-contracts-world)

Smart contract implementation for GMX on World Chain.

- Core trading infrastructure (Vault, Router, OrderBook, etc.)
- Price feed integrations (RedStonePriceFeed)
- Deployment scripts and utilities

**Current Status**: Two deployments exist:
- Original deployment (with inaccessible governance)
- Custom deployment (with our governance control)

### 2. [gmx-interface-world](https://github.com/Tytandoteth/gmx-interface-world)

Frontend interface for GMX on World Chain.

- Trading UI for users
- Position management
- Price chart visualization
- Account management

**Current Status**: Needs configuration update to connect to custom contract deployment.

### 3. [redstone-oracle-keeper](https://github.com/Tytandoteth/redstone-oracle-keeper)

Oracle service for price feeds.

- Middleware between RedStone data sources and GMX interface
- API endpoints for price data
- Caching and redundancy for price feeds

**Current Status**: Needs to be configured for new RedStonePriceFeed contract address.

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│  GMX Interface      │◄────┤  RedStone Oracle    │
│  (Frontend)         │     │  Keeper             │
│                     │     │                     │
└─────────┬───────────┘     └─────────────────────┘
          │                           ▲
          │                           │
          │                           │
          ▼                           │
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│  GMX Contracts      │◄────┤  RedStone Data      │
│  (Blockchain)       │     │  Sources            │
│                     │     │                     │
└─────────────────────┘     └─────────────────────┘
```

- **User Flow**: Users interact with the GMX Interface to trade
- **Price Data Flow**: RedStone Oracle Keeper fetches prices from RedStone and provides them to the interface
- **Trading Flow**: Interface uses RedStone SDK to wrap transactions with price data when interacting with contracts

## Deployment Status

### Custom Deployment Addresses

Our custom deployment with full governance control is available at these addresses:

- VaultPriceFeed: `0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf`
- RedStonePriceFeed: `0xA63636C9d557793234dD5E33a24EAd68c36Df148`
- Vault: `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5`
- Router: `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b`
- USDG: `0xB1AfC10073a6C05a3c79ac051deFaa1C83DcEFAf`
- VaultUtils: `0x26eCCeBB6E82210dc4dD3134ab2ded1AB78a5345`

More addresses are available in the `.world-custom-deployment.json` file.

## Integration Summary

The integration between components works as follows:

1. **Contracts ↔ Oracle**:
   - RedStonePriceFeed contract receives price data in transaction calldata
   - Vault queries prices from VaultPriceFeed, which queries RedStonePriceFeed

2. **Frontend ↔ Oracle**:
   - Frontend requests prices from Oracle Keeper API
   - Oracle Keeper fetches and formats price data from RedStone

3. **Frontend ↔ Contracts**:
   - Frontend wraps transactions with RedStone SDK to include price data
   - Frontend reads contract state (positions, balances) directly

## Updated Roadmap

### Phase 1: Core Infrastructure (✅ Completed)
- ✅ Deploy core GMX contracts
- ✅ Implement RedStonePriceFeed contract
- ✅ Create parallel deployment with governance control

### Phase 2: Oracle Integration (🔄 In Progress)
- ✅ Create RedStone Oracle Keeper service
- ✅ Configure RedStonePriceFeed with proper token decimals
- 🔄 Deploy and test Oracle Keeper in production environment
- ⏱️ Implement redundancy and fallback mechanisms

### Phase 3: Frontend Integration (⏱️ Upcoming)
- ⏱️ Update frontend configuration for custom contracts
- ⏱️ Integrate RedStone SDK for transaction wrapping
- ⏱️ Implement switch between original and custom deployments
- ⏱️ Add price feed visualization and diagnostics

### Phase 4: Testing and QA (⏱️ Upcoming)
- ⏱️ Create comprehensive test suite for price feeds
- ⏱️ Perform security audit of custom deployment
- ⏱️ Conduct end-to-end testing of trading flows
- ⏱️ Stress test Oracle Keeper under high load

### Phase 5: Launch and Monitoring (⏱️ Upcoming)
- ⏱️ Public launch of trading platform
- ⏱️ Implement monitoring and alerting
- ⏱️ Create incident response procedures
- ⏱️ Set up regular governance operations

## Next Steps

1. **Complete Oracle Keeper Configuration**:
   - Update the Oracle Keeper to point to new RedStonePriceFeed address
   - Deploy Oracle Keeper to production environment
   - Implement monitoring for Oracle Keeper

2. **Update Frontend Configuration**:
   - Create configuration toggle for contract addresses
   - Integrate RedStone SDK wrapper for transactions
   - Test trading flows with custom deployment

3. **Documentation and Testing**:
   - Document the parallel deployment approach
   - Create operational procedures for contract governance
   - Establish testing protocol for new features

## Development Workflow

For local development:

1. Use `scripts/world/mockPriceFeeder.js` to set predictable prices
2. Run local Oracle Keeper instance for frontend testing
3. Use RedStone SDK wrapping for contract interactions

For production:

1. Configure frontend for custom contract addresses
2. Use deployed Oracle Keeper instance
3. Implement proper error handling and fallbacks for price feeds

## Governance Operations

Since we have full control over the custom deployment, governance operations include:

1. Adding/removing tokens from trading
2. Adjusting leverage limits and fees
3. Updating price feed configurations
4. Managing protocol parameters

All operations should be done through proper governance procedures with testing and verification.
