# Frontend Integration Guide: GMX Interface with Custom Contracts

This document explains how to integrate the [gmx-interface-world](https://github.com/Tytandoteth/gmx-interface-world) frontend with our custom GMX contract deployment and RedStone price feeds.

## Overview

The frontend integration has two main components:
1. **Contract Address Configuration**: Pointing the frontend to our custom contract addresses
2. **RedStone SDK Integration**: Properly wrapping transactions with price data

## Contract Address Configuration

Create a configuration file in your frontend project to easily switch between deployments:

```typescript
// src/config/contracts.ts

interface ContractAddresses {
  vault: string;
  router: string;
  vaultPriceFeed: string;
  redStonePriceFeed: string;
  usdg: string;
  tokens: {
    wld: string;
    wworld: string;
  };
  // Add other contracts as needed
}

// Original deployment (inaccessible governance)
export const ORIGINAL_CONTRACTS: ContractAddresses = {
  vault: "0xc2039dA724Ba0d55A5a3B235d25392D61B6028AE",
  router: "0x51dc2D3a570db1Dee93517Df298A3524d1434c5A",
  vaultPriceFeed: "0x27f97f1331Abe2253C16c52c84a93717Ca7AcEae",
  redStonePriceFeed: "", // Not configured in original deployment
  usdg: "0x...", // Add from main deployment
  tokens: {
    wld: "0x58e670fF93aC5527bf9c3c31D03237D43439cD1F",
    wworld: "0x1Bd411135304469c4c15312f1939da115a1AE4c6"
  }
};

// Custom deployment (with our governance control)
export const CUSTOM_CONTRACTS: ContractAddresses = {
  vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
  router: "0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b",
  vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
  redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
  usdg: "0xB1AfC10073a6C05a3c79ac051deFaa1C83DcEFAf",
  tokens: {
    wld: "0x99A49AaA79b648ee24e85c4eb3A1C9c429A95652",
    wworld: "0xE1a9E792851b22A808639cf8e75D0A4025333f4B"
  }
};

// Set which deployment to use
const USE_CUSTOM_DEPLOYMENT = true;

// Export active deployment
export const ACTIVE_CONTRACTS = USE_CUSTOM_DEPLOYMENT ? CUSTOM_CONTRACTS : ORIGINAL_CONTRACTS;
```

## RedStone SDK Integration

To properly use the RedStonePriceFeed, you need to integrate the RedStone SDK in your frontend. This SDK wraps contract calls with the required price data.

### 1. Install RedStone SDK

```bash
npm install @redstone-finance/evm-connector @redstone-finance/sdk
# or
yarn add @redstone-finance/evm-connector @redstone-finance/sdk
```

### 2. Contract Wrapping Utility

Create a utility function to wrap your contract instances with RedStone:

```typescript
// src/utils/redstone.ts

import { ethers } from 'ethers';
import { WrapperBuilder } from '@redstone-finance/evm-connector';

/**
 * Wraps a contract with RedStone SDK to include price data in transactions
 * @param contract Ethers contract instance
 * @param priceFeeds Array of token symbols to include prices for
 * @returns Wrapped contract instance
 */
export function wrapContractWithRedStone(
  contract: ethers.Contract,
  priceFeeds: string[] = ['WLD', 'ETH', 'BTC', 'USDC', 'USDT']
): ethers.Contract {
  return WrapperBuilder.wrapLite(contract)
    .usingPriceFeed('redstone-primary-prod')
    .withPriceFeeds(priceFeeds);
}
```

### 3. Using Wrapped Contracts

When executing transactions that need price data:

```typescript
// Example transaction execution
import { wrapContractWithRedStone } from '../utils/redstone';
import { ACTIVE_CONTRACTS } from '../config/contracts';

async function executeTradeExample(
  vaultContract: ethers.Contract,
  tokenAddress: string,
  isLong: boolean,
  amount: ethers.BigNumber
) {
  try {
    // Wrap the contract for this transaction
    const wrappedVault = wrapContractWithRedStone(vaultContract, ['WLD', 'ETH']);
    
    // Execute transaction with price data included
    const tx = await wrappedVault.executeOrder(
      tokenAddress,
      isLong,
      amount,
      { gasLimit: 3000000 }
    );
    
    return await tx.wait();
  } catch (error) {
    console.error('Trade execution failed:', error);
    throw error;
  }
}
```

## Oracle Keeper Integration

Configure your frontend to fetch prices from the Oracle Keeper service:

```typescript
// src/utils/prices.ts

const ORACLE_KEEPER_URL = 'https://your-oracle-keeper-url.com';

/**
 * Fetch prices from the Oracle Keeper
 * @param symbols Array of token symbols to fetch prices for
 * @returns Object with token prices
 */
export async function fetchPrices(symbols: string[] = ['WLD', 'ETH', 'BTC', 'USDC']) {
  try {
    const response = await fetch(`${ORACLE_KEEPER_URL}/prices?symbols=${symbols.join(',')}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    return data.prices;
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    throw error;
  }
}
```

## Development vs. Production

### For Development

During development, you can use the mock price feeder script to set predictable prices:

1. Run the mock price feeder:
   ```bash
   npx hardhat run scripts/world/mockPriceFeeder.js --network worldchain
   ```

2. Use regular contract instances without RedStone wrapping:
   ```typescript
   // Development mode - uses mock price feeds
   const vault = new ethers.Contract(ACTIVE_CONTRACTS.vault, VaultABI, signer);
   const price = await vault.getMaxPrice(tokenAddress);
   ```

### For Production

In production, always use RedStone-wrapped contracts for transactions:

```typescript
// Production mode
const vault = new ethers.Contract(ACTIVE_CONTRACTS.vault, VaultABI, signer);
// Only wrap for transactions that require price data
const wrappedVault = wrapContractWithRedStone(vault);
const tx = await wrappedVault.executeOrder(...);
```

## React Component Example

Here's a simple React component example integrating with the custom contract deployment:

```tsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ACTIVE_CONTRACTS } from '../config/contracts';
import { wrapContractWithRedStone } from '../utils/redstone';
import { fetchPrices } from '../utils/prices';
import VaultABI from '../abis/Vault.json';

const TradingWidget: React.FC = () => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Connect wallet and get signer
  useEffect(() => {
    const connectWallet = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setSigner(provider.getSigner());
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      }
    };
    
    connectWallet();
  }, []);
  
  // Fetch prices
  useEffect(() => {
    const getPrices = async () => {
      try {
        const tokenPrices = await fetchPrices(['WLD', 'ETH', 'BTC']);
        setPrices(tokenPrices);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      }
    };
    
    getPrices();
    const interval = setInterval(getPrices, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Execute a trade
  const executeTrade = async (token: string, isLong: boolean, amount: string) => {
    if (!signer) return;
    
    setLoading(true);
    try {
      const vault = new ethers.Contract(ACTIVE_CONTRACTS.vault, VaultABI, signer);
      const wrappedVault = wrapContractWithRedStone(vault, [token, 'ETH']);
      
      const amountWei = ethers.utils.parseEther(amount);
      const tx = await wrappedVault.executeOrder(
        ACTIVE_CONTRACTS.tokens[token.toLowerCase()],
        isLong,
        amountWei,
        { gasLimit: 3000000 }
      );
      
      await tx.wait();
      alert('Trade executed successfully!');
    } catch (error) {
      console.error('Trade failed:', error);
      alert('Trade failed. See console for details.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>Trading Widget</h2>
      <div>
        <h3>Current Prices</h3>
        {Object.entries(prices).map(([symbol, price]) => (
          <div key={symbol}>
            {symbol}: ${price.toFixed(2)}
          </div>
        ))}
      </div>
      
      <div>
        <h3>Execute Trade</h3>
        <button 
          disabled={loading} 
          onClick={() => executeTrade('WLD', true, '1.0')}
        >
          Long WLD (1.0 ETH)
        </button>
        <button 
          disabled={loading} 
          onClick={() => executeTrade('WLD', false, '1.0')}
        >
          Short WLD (1.0 ETH)
        </button>
      </div>
    </div>
  );
};

export default TradingWidget;
```

## Troubleshooting

### Common Issues and Solutions

1. **"Prices not available" error**:
   - Ensure Oracle Keeper is running and accessible
   - Check that token symbols match between frontend and Oracle Keeper

2. **Transaction reverts when using RedStone**:
   - Verify that RedStonePriceFeed contract is properly configured
   - Check that you're including the correct price feeds in the wrapper
   - Ensure gas limit is sufficient (RedStone transactions use more gas)

3. **Wrong prices showing in UI**:
   - Confirm Oracle Keeper is fetching from the correct RedStone data source
   - Verify decimal handling in price display logic

## Next Steps

1. **Test thoroughly** with both mock prices and RedStone integration
2. **Monitor transaction success rate** after deployment
3. **Create fallback mechanisms** for when RedStone data is unavailable
