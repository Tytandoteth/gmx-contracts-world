# GMX V1 Integration Guide

This guide provides comprehensive instructions for integrating GMX V1 contracts into your interface on World Chain. Each section is designed to walk you through a specific aspect of the integration process.

## Quick Start

The following steps provide a high-level overview of the integration process:

1. Remove V2 version switcher and related components
2. Configure V1 contracts for World Chain
3. Set up context providers for contracts, tokens, and prices
4. Integrate Oracle Keeper for price feeds
5. Update trading components to use V1 contracts
6. Test the integration with your deployed contracts
7. Deploy to production

## Deployment Checklist

Before proceeding with the integration, ensure you have:

- Deployed all core GMX V1 contracts to World Chain
- Whitelisted your test tokens in the Vault contract
- Set up the SimplePriceFeed contract for Oracle Keeper integration
- Verified your contracts on World Chain block explorer

## Detailed Sections

### 1. System Architecture
- [Architecture Overview](./v1-guides/01_ARCHITECTURE_OVERVIEW.md)
  - Core contracts explanation
  - System components and interactions
  - Data flow diagrams

### 2. Migration from V2
- [Removing V2 Support](./v1-guides/02_REMOVING_V2_SUPPORT.md)
  - Removing V2 components
  - Cleaning up dependencies
  - Migration considerations

### 3. Contract Setup
- [Contract Configuration](./v1-guides/03_CONTRACT_CONFIGURATION.md)
  - Contract addresses
  - Token configuration
  - ABI setup

### 4. State Management
- [Context Providers](./v1-guides/04_CONTEXT_PROVIDERS.md)
  - ContractsProvider implementation
  - TokensProvider for token information
  - PricesProvider for real-time price data
  - PositionsProvider for position tracking

### 5. Price Feed Integration
- [Price Feed Integration Part 1](./v1-guides/05_PRICE_FEED_INTEGRATION.md)
  - Oracle Keeper setup
  - Price feed configuration
  - Basic price retrieval

- [Price Feed Integration Part 2](./v1-guides/05_PRICE_FEED_INTEGRATION_PART2.md)
  - Advanced price handling
  - Real-time updates
  - Error handling

### 6. Trading Implementation
- [Trading Components Part 1](./v1-guides/06_TRADING_COMPONENTS_PART1.md)
  - Core trading functions
  - Swap implementation
  - Basic position management

- [Trading Components Part 2](./v1-guides/06_TRADING_COMPONENTS_PART2.md)
  - Advanced trading features
  - Leverage trading
  - Position management

- [Trading Components Part 3](./v1-guides/06_TRADING_COMPONENTS_PART3.md)
  - UI components
  - Trading forms
  - Order book interface

### 7. Testing and Quality Assurance
- [Testing and Verification](./v1-guides/07_TESTING_AND_VERIFICATION.md)
  - Contract integration tests
  - UI component testing
  - End-to-end verification
  - Production readiness checklist

### 8. Production Deployment
- [Deployment and Production](./v1-guides/08_DEPLOYMENT_AND_PRODUCTION.md)
  - Deployment procedures
  - Monitoring setup
  - Maintenance guidelines
  - Emergency procedures

### 9. Troubleshooting
- [Troubleshooting Guide](./v1-guides/09_TROUBLESHOOTING_GUIDE.md)
  - Contract connection issues
  - Price feed problems
  - Transaction failures
  - UI component issues
  - Performance optimization

## Contract Addresses

Key contract addresses on World Chain:
```typescript
const PRODUCTION_ADDRESSES = {
  Vault: '0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5',
  Router: '0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b',
  VaultPriceFeed: '0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf',
  RedStonePriceFeed: '0xA63636C9d557793234dD5E33a24EAd68c36Df148',
  PositionRouter: '0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF',
  PositionManager: '0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D'
};
```

## Production Timeline

Current timeline for full production deployment:
1. ✅ Oracle Keeper real-time data (May 11, 2025)
2. 🔄 Interface RPC & price integration (May 12, 2025)
3. 📅 Contracts price feeds & token whitelisting (May 13, 2025)
4. 📅 Full end-to-end testing (May 14, 2025)
5. 🎯 Production MVP launch (May 15, 2025)
