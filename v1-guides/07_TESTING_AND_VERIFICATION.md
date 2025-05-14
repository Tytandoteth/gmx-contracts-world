# Testing and Verification Guide

This guide outlines the testing procedures for verifying the GMX V1 integration on World Chain.

## Table of Contents
1. [Contract Integration Tests](#contract-integration-tests)
2. [Price Feed Verification](#price-feed-verification)
3. [UI Component Tests](#ui-component-tests)
4. [End-to-End Testing](#end-to-end-testing)
5. [Production Readiness Checklist](#production-readiness-checklist)

## Contract Integration Tests

### Test Environment Setup

Create a test configuration file:

```typescript
// test/v1/testConfig.ts
export const TEST_CONFIG = {
  RPC_URL: process.env.VITE_WORLD_RPC_URL,
  CONTRACTS: {
    Vault: '0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5',
    Router: '0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b',
    PositionRouter: '0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF'
  },
  TEST_TOKENS: {
    WLD: {
      address: '0x7aE97042a4A0eB4D1eB370C34F9736f9f85dB523',
      decimals: 18
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18
    }
  }
};
```

### Basic Contract Tests

```typescript
// test/v1/contractIntegration.test.ts
import { expect } from 'chai';
import { ethers } from 'ethers';
import { TEST_CONFIG } from './testConfig';

describe('V1 Contract Integration', () => {
  let provider: ethers.providers.JsonRpcProvider;
  let vault: ethers.Contract;
  let router: ethers.Contract;
  
  before(async () => {
    provider = new ethers.providers.JsonRpcProvider(TEST_CONFIG.RPC_URL);
    vault = new ethers.Contract(
      TEST_CONFIG.CONTRACTS.Vault,
      VAULT_ABI,
      provider
    );
    router = new ethers.Contract(
      TEST_CONFIG.CONTRACTS.Router,
      ROUTER_ABI,
      provider
    );
  });

  describe('Vault', () => {
    it('should return correct token weights', async () => {
      const wldWeight = await vault.tokenWeights(TEST_CONFIG.TEST_TOKENS.WLD.address);
      expect(wldWeight).to.be.gt(0);
    });

    it('should return valid max leverage', async () => {
      const maxLeverage = await vault.maxLeverage();
      expect(maxLeverage).to.be.gte(ethers.utils.parseUnits('30', 0));
    });
  });

  describe('Router', () => {
    it('should validate swap path', async () => {
      const isValid = await router.validateSwapPath(
        [TEST_CONFIG.TEST_TOKENS.WLD.address, TEST_CONFIG.TEST_TOKENS.WETH.address]
      );
      expect(isValid).to.be.true;
    });
  });
});
```

## Price Feed Verification

### Oracle Keeper Tests

```typescript
// test/v1/priceFeed.test.ts
import axios from 'axios';
import { expect } from 'chai';

const KEEPER_URL = process.env.VITE_ORACLE_KEEPER_URL;

describe('Price Feed Integration', () => {
  it('should fetch valid prices from Oracle Keeper', async () => {
    const response = await axios.get(`${KEEPER_URL}/prices`);
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('WLD');
    expect(response.data).to.have.property('WETH');
    
    // Validate price format and ranges
    expect(parseFloat(response.data.WLD)).to.be.gt(0);
    expect(parseFloat(response.data.WETH)).to.be.gt(0);
  });

  it('should handle price update intervals correctly', async () => {
    const firstResponse = await axios.get(`${KEEPER_URL}/prices`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    const secondResponse = await axios.get(`${KEEPER_URL}/prices`);
    
    expect(secondResponse.data.timestamp).to.be.gt(firstResponse.data.timestamp);
  });
});
```

## UI Component Tests

### Trading Components Tests

```typescript
// test/v1/components/SwapBox.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { SwapBox } from '../../../src/components/v1/SwapBox';
import { V1ContractsProvider } from '../../../src/contexts/V1ContractsContext';

describe('SwapBox Component', () => {
  it('should render token inputs correctly', () => {
    const { getByLabelText } = render(
      <V1ContractsProvider>
        <SwapBox defaultFromToken="WLD" defaultToToken="WETH" />
      </V1ContractsProvider>
    );
    
    expect(getByLabelText('From Token')).to.exist;
    expect(getByLabelText('To Token')).to.exist;
  });

  it('should calculate price impact', async () => {
    const { getByLabelText, getByText } = render(
      <V1ContractsProvider>
        <SwapBox defaultFromToken="WLD" defaultToToken="WETH" />
      </V1ContractsProvider>
    );
    
    const input = getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '100' } });
    
    await waitFor(() => {
      expect(getByText(/Price Impact:/)).to.exist;
    });
  });
});
```

### Position Management Tests

```typescript
// test/v1/components/LeverageTrading.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { LeverageTrading } from '../../../src/components/v1/LeverageTrading';

describe('LeverageTrading Component', () => {
  it('should calculate correct position size', () => {
    const { getByLabelText, getByText } = render(
      <LeverageTrading defaultCollateralToken="WLD" defaultIndexToken="WETH" />
    );
    
    const collateralInput = getByLabelText('Collateral Amount');
    const leverageInput = getByLabelText('Leverage');
    
    fireEvent.change(collateralInput, { target: { value: '100' } });
    fireEvent.change(leverageInput, { target: { value: '2' } });
    
    expect(getByText('Position Size: 200 USD')).to.exist;
  });

  it('should show liquidation price', async () => {
    const { getByLabelText, findByText } = render(
      <LeverageTrading defaultCollateralToken="WLD" defaultIndexToken="WETH" />
    );
    
    const collateralInput = getByLabelText('Collateral Amount');
    fireEvent.change(collateralInput, { target: { value: '1000' } });
    
    const liquidationPrice = await findByText(/Liquidation Price:/);
    expect(liquidationPrice).to.exist;
  });
});
```

## End-to-End Testing

### Test Scenarios

1. Basic Swap Flow:
```typescript
// test/v1/e2e/swapFlow.test.ts
describe('Swap Flow', () => {
  it('should complete WLD to WETH swap', async () => {
    // Connect wallet
    // Approve tokens
    // Execute swap
    // Verify balances
  });
});
```

2. Leverage Trading Flow:
```typescript
// test/v1/e2e/leverageFlow.test.ts
describe('Leverage Trading Flow', () => {
  it('should open and close long position', async () => {
    // Open position
    // Verify position details
    // Close position
    // Verify PnL
  });
});
```

## Production Readiness Checklist

### Contract Verification
- [ ] All contracts verified on World Chain explorer
- [ ] Token approvals working correctly
- [ ] Fee calculations accurate
- [ ] Position limits enforced properly

### Price Feed Verification
- [ ] Oracle Keeper providing real-time updates
- [ ] Price deviation checks passing
- [ ] Fallback price sources configured
- [ ] Alert system operational

### UI Component Verification
- [ ] All trading forms functional
- [ ] Position management working
- [ ] Order book updates in real-time
- [ ] Price charts displaying correctly

### Security Checks
- [ ] Input validation implemented
- [ ] Transaction signing prompts clear
- [ ] Error handling comprehensive
- [ ] Rate limiting configured

### Performance Verification
- [ ] Page load times < 3s
- [ ] Transaction confirmation feedback immediate
- [ ] Price updates < 500ms latency
- [ ] No memory leaks in long-running sessions

## Running Tests

1. Set up environment:
```bash
# Install dependencies
npm install

# Set up test environment variables
cp .env.test.example .env.test
```

2. Run contract tests:
```bash
npm run test:contracts
```

3. Run UI component tests:
```bash
npm run test:components
```

4. Run E2E tests:
```bash
npm run test:e2e
```

5. Generate coverage report:
```bash
npm run test:coverage
```

## Continuous Integration

Configure GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: V1 Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16.x'
      - run: npm ci
      - run: npm run test:contracts
      - run: npm run test:components
      - run: npm run test:e2e
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

Remember to:
1. Run all tests before deploying to production
2. Monitor test results in CI/CD pipeline
3. Maintain high test coverage
4. Update tests when adding new features
5. Regular security audits of test cases
