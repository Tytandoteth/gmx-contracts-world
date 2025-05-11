# Test Environment Integration Guide

This guide provides step-by-step instructions for integrating the GMX test environment with your frontend interface using the Oracle Keeper.

## Table of Contents

1. [Test Environment Overview](#test-environment-overview)
2. [Contract Addresses](#contract-addresses)
3. [Frontend Integration Steps](#frontend-integration-steps)
4. [Oracle Keeper Integration](#oracle-keeper-integration)
5. [Regular Price Updates](#regular-price-updates)
6. [Testing Workflow](#testing-workflow)

## Test Environment Overview

This test environment provides a complete GMX trading setup with:

- Three test tokens (TUSD, TBTC, TETH) with real-time price feeds
- A SimplePriceFeed contract for Oracle Keeper integration
- GMX core contracts configured for testing (Vault, Router, etc.)

The environment allows for testing the entire trading flow with realistic price movements without needing to use the actual Witnet oracle yet.

## Contract Addresses

### Test Tokens
- **TUSD**: `0xc1f17FB5db2A71617840eCe29c241997448f6720` (maps to WLD price)
- **TBTC**: `0x9cdee0fb64c18d3af7C8cB30Aada5f7fe90aF553` (maps to scaled WETH price)
- **TETH**: `0xE9298442418B800105b86953db930659e5b13058` (maps to WETH price)

### Core Contracts
- **Vault**: `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5`
- **Router**: `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b`
- **PositionRouter**: `0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF`
- **PositionManager**: `0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D`
- **OrderBook**: `0x8179D468fF072B8A9203A293a37ef70EdCA850fc`

### Price Feed
- **SimplePriceFeed**: `0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d`

## Frontend Integration Steps

### 1. Update Environment Variables

Add the following to your `.env.local` file:

```
# RPC Configuration
VITE_WORLD_RPC_URL=https://rpc.world-chain.com/v1/mainnet

# Oracle Keeper Configuration
VITE_ORACLE_KEEPER_URL=https://oracle-keeper.kevin8396.workers.dev/direct-prices

# Test Environment
VITE_USE_TEST_TOKENS=true
```

### 2. Create Test Token Configuration

Create a new file `src/config/testTokens.ts`:

```typescript
export const TEST_TOKENS = {
  TUSD: {
    address: "0xc1f17FB5db2A71617840eCe29c241997448f6720",
    symbol: "TUSD",
    name: "Test USD",
    decimals: 18,
    isStable: true,
    isShortable: false,
    priceSource: "WLD",
    imageUrl: "/icons/tusd.svg"
  },
  TBTC: {
    address: "0x9cdee0fb64c18d3af7C8cB30Aada5f7fe90aF553",
    symbol: "TBTC",
    name: "Test Bitcoin",
    decimals: 8,
    isStable: false,
    isShortable: true,
    priceSource: "WETH",
    priceScale: 12,
    imageUrl: "/icons/tbtc.svg"
  },
  TETH: {
    address: "0xE9298442418B800105b86953db930659e5b13058",
    symbol: "TETH",
    name: "Test Ethereum",
    decimals: 18,
    isStable: false,
    isShortable: true,
    priceSource: "WETH",
    imageUrl: "/icons/teth.svg"
  }
};

export const TEST_CONTRACTS = {
  Vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
  Router: "0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b",
  PositionRouter: "0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF",
  PositionManager: "0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D",
  OrderBook: "0x8179D468fF072B8A9203A293a37ef70EdCA850fc",
  SimplePriceFeed: "0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d"
};
```

### 3. Update Token Selection Logic

Modify your token selection logic to use test tokens when the environment variable is set:

```typescript
// src/config/tokens.ts
import { TEST_TOKENS } from './testTokens';

const USE_TEST_TOKENS = process.env.VITE_USE_TEST_TOKENS === 'true';

export const getTokens = (chainId: number) => {
  if (chainId === 480 && USE_TEST_TOKENS) {
    return TEST_TOKENS;
  }
  
  // Return regular tokens for production
  return {
    // Your regular token configuration
  };
};
```

### 4. Create Test Token Minter Component

Add a component to allow minting test tokens for ease of testing:

```tsx
// src/components/TestTokenMinter.tsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { TEST_TOKENS } from '../config/testTokens';
import TokenABI from '../abis/Token.json';

const USE_TEST_TOKENS = process.env.VITE_USE_TEST_TOKENS === 'true';

export const TestTokenMinter: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  
  // Only show in test mode
  if (!USE_TEST_TOKENS) return null;
  
  const handleMint = async () => {
    if (!selectedToken || !amount) return;
    
    try {
      setStatus('pending');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      const token = TEST_TOKENS[selectedToken];
      const tokenContract = new ethers.Contract(token.address, TokenABI, signer);
      
      const decimals = token.decimals || 18;
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);
      
      const tx = await tokenContract.mint(address, parsedAmount);
      await tx.wait();
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error minting tokens:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };
  
  return (
    <div className="test-token-minter">
      <h3>Mint Test Tokens</h3>
      
      <div className="form-group">
        <label>Token</label>
        <select 
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
        >
          <option value="">Select Token</option>
          {Object.keys(TEST_TOKENS).map((symbol) => (
            <option key={symbol} value={symbol}>{TEST_TOKENS[symbol].name}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label>Amount</label>
        <input 
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount to mint"
        />
      </div>
      
      <button 
        onClick={handleMint}
        disabled={!selectedToken || !amount || status === 'pending'}
      >
        {status === 'pending' ? 'Minting...' : 'Mint Tokens'}
      </button>
      
      {status === 'success' && <div className="success">Tokens minted successfully!</div>}
      {status === 'error' && <div className="error">Failed to mint tokens</div>}
    </div>
  );
};
```

## Oracle Keeper Integration

Your Oracle Keeper is already deployed at `https://oracle-keeper.kevin8396.workers.dev/direct-prices` and provides prices for WLD, WETH, and MAG.

### Price Mapping Logic

The test tokens map to Oracle Keeper prices as follows:

1. **TUSD** maps to WLD price (1:1)
2. **TBTC** maps to WETH price (12:1 scale)
3. **TETH** maps to WETH price (1:1)

This means when the Oracle Keeper reports:
- WLD = $1.25
- WETH = $2,500

The test tokens will have these prices:
- TUSD = $1.25
- TBTC = $30,000
- TETH = $2,500

### Implementing Price Fetching

Use the following service to fetch and map prices:

```typescript
// src/services/priceMappingService.ts
import axios from 'axios';
import { TEST_TOKENS } from '../config/testTokens';

const ORACLE_KEEPER_URL = process.env.VITE_ORACLE_KEEPER_URL || 
  'https://oracle-keeper.kevin8396.workers.dev/direct-prices';

interface OracleKeeperResponse {
  prices: {
    [key: string]: number;
  };
  timestamp: string;
  source: string;
}

export const fetchTestTokenPrices = async () => {
  try {
    const response = await axios.get<OracleKeeperResponse>(ORACLE_KEEPER_URL);
    const oraclePrices = response.data.prices;
    
    const testPrices: Record<string, number> = {};
    
    // Map Oracle Keeper prices to test tokens
    Object.entries(TEST_TOKENS).forEach(([symbol, token]) => {
      const sourceToken = token.priceSource || symbol;
      const scale = token.priceScale || 1;
      
      if (oraclePrices[sourceToken]) {
        testPrices[symbol] = oraclePrices[sourceToken] * scale;
      }
    });
    
    return {
      prices: testPrices,
      timestamp: response.data.timestamp,
      source: response.data.source
    };
  } catch (error) {
    console.error('Error fetching prices from Oracle Keeper:', error);
    throw error;
  }
};
```

## Regular Price Updates

To ensure the on-chain prices (in SimplePriceFeed) stay in sync with the Oracle Keeper, you need to run the price update script regularly.

### Setting Up a Cron Job

1. Create a shell script wrapper `update_prices.sh`:

```bash
#!/bin/bash
cd /path/to/gmx-contracts-world
npx hardhat run scripts/world/mapOracleKeeperToTestTokens.js --network worldchain >> price_updates.log 2>&1
```

2. Make it executable:

```bash
chmod +x update_prices.sh
```

3. Add a cron job to run every 5 minutes:

```bash
*/5 * * * * /path/to/update_prices.sh
```

## Testing Workflow

1. **Connect Wallet** to World Chain (chainId: 480)
2. **Mint Test Tokens** using the TestTokenMinter component
3. **Check Prices** are updating correctly from Oracle Keeper
4. **Execute Trades** with test tokens
5. **Create Leveraged Positions** to test full functionality

### Full Testing Checklist

- [ ] Connect wallet to World Chain
- [ ] Mint test tokens (TUSD, TBTC, TETH)
- [ ] Verify token balances appear correctly
- [ ] Check current test token prices match Oracle Keeper
- [ ] Execute a simple swap (TUSD to TETH)
- [ ] Create a leveraged long position
- [ ] Create a leveraged short position
- [ ] Manage positions (increase, decrease, close)
- [ ] Place a limit order
- [ ] Verify all transactions confirm correctly
