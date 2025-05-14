# Price Feed Integration

This guide explains how to integrate the Oracle Keeper price feed with your GMX V1 contracts on World Chain.

## Overview

The Oracle Keeper is a price feed service providing real-time and cached cryptocurrency prices for GMX on World Chain. It implements a three-tier cascading fallback system:

1. **Primary Source:** Witnet on-chain oracle (when working)
2. **Secondary Source:** CoinGecko API
3. **Tertiary Source:** Emergency hardcoded failsafe values

## Oracle Keeper Details

- **Base URL:** `https://oracle-keeper.kevin8396.workers.dev`
- **Supported Tokens:** WLD (Worldcoin), WETH (Wrapped Ethereum), MAG (Magnify Cash)
- **Chain Information:** World Chain (Chain ID: 480)

## Key Endpoints

1. **All Prices (Cached):** `GET /prices`
   - Returns cached prices with timestamps
   - Cache refreshes every minute

2. **Direct Prices (Real-time):** `GET /direct-prices`
   - Bypasses all caching layers for real-time data
   - Use for time-sensitive operations

3. **Single Token Price:** `GET /price/:symbol`
   - Returns price for a specific token

4. **Health Check:** `GET /health`
   - Returns service health status and uptime

## On-Chain Integration

- **SimplePriceFeed Contract**: On-chain contract that stores prices
  - Address: `0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d`
  - Receives price updates from Oracle Keeper

## Price Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐    ┌─────────────────┐
│  Oracle Keeper  │────▶│  Update Script  │───▶│ SimplePriceFeed │
│  (API Server)   │     │  (mapPrices.js) │    │    (Contract)   │
└─────────────────┘     └─────────────────┘    └─────────────────┘
                                                       │
       ┌─────────────────┐                             │
       │                 │                             │
       │  UI Components  │◀────────────────────────────┘
       │                 │
       └─────────────────┘
```

## Implementation Steps

### Step 1: Creating Oracle Keeper Client

```typescript
// src/api/oracleKeeper.ts
import axios from 'axios';

const ORACLE_KEEPER_URL = process.env.VITE_ORACLE_KEEPER_URL || 'https://oracle-keeper.kevin8396.workers.dev';

export interface OracleKeeperResponse {
  prices: Record<string, number>;
  timestamp: string;
  lastUpdated: string;
  status: 'success' | 'partial' | 'error';
  source: string;
}

export interface TokenPriceResponse {
  symbol: string;
  price: number;
  timestamp: string;
  lastUpdated: string;
  status: 'success' | 'error';
  source: string;
}

// Fetch all prices (cached data, refreshes every minute)
export async function fetchPrices(): Promise<Record<string, number>> {
  try {
    const response = await axios.get<OracleKeeperResponse>(`${ORACLE_KEEPER_URL}/prices`);
    return response.data.prices;
  } catch (error) {
    console.error('Failed to fetch prices from Oracle Keeper:', error);
    // Return emergency fallback values
    return {
      WLD: 1.24,  // Emergency fallback
      WETH: 2480.22,
      MAG: 0.0004124
    };
  }
}

/**
 * Map Oracle Keeper prices to test tokens
 */
export function mapPricesToTestTokens(
  oraclePrices: Record<string, number>
): Record<string, number> {
  const testTokenPrices: Record<string, number> = {};
  
  // Map WLD price to TUSD
  if (oraclePrices.WLD) {
    testTokenPrices.TUSD = oraclePrices.WLD;
  }
  
  // Map WETH price to TETH
  if (oraclePrices.WETH) {
    testTokenPrices.TETH = oraclePrices.WETH;
  }
  
  // Map scaled WETH price to TBTC
  if (oraclePrices.WETH) {
    testTokenPrices.TBTC = oraclePrices.WETH * 12;
  }
  
  return testTokenPrices;
}
```

### Step 2: Create Price Hooks

```typescript
// src/hooks/usePrices.ts

import { useEffect, useState } from 'react';
import { fetchOracleKeeperPrices, mapPricesToTestTokens } from '../services/oracleService';
import { useTokens } from '../contexts/TokensContext';

export function useOraclePrices(refreshInterval = 30000) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { isTestMode } = useTokens();
  
  useEffect(() => {
    if (!isTestMode) return;
    
    const fetchPrices = async () => {
      try {
        setIsLoading(true);
        const oracleData = await fetchOracleKeeperPrices();
        
        // Map Oracle Keeper prices to test tokens
        const testTokenPrices = mapPricesToTestTokens(oracleData.prices);
        
        setPrices(testTokenPrices);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch prices'));
        console.error('Error fetching prices:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Fetch immediately
    fetchPrices();
    
    // Set up interval for refreshing prices
    const intervalId = setInterval(fetchPrices, refreshInterval);
    
    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, [refreshInterval, isTestMode]);
  
  return { prices, isLoading, error, lastUpdated };
}
```

### Step 3: Create On-Chain Price Hook

```typescript
// src/hooks/useOnChainPrices.ts

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useContracts } from '../contexts/ContractsContext';
import { useTokens } from '../contexts/TokensContext';

export function useOnChainPrices() {
  const [prices, setPrices] = useState<Record<string, ethers.BigNumber>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { simplePriceFeed } = useContracts();
  const { tokens, isTestMode } = useTokens();
  
  useEffect(() => {
    if (!simplePriceFeed || !isTestMode || tokens.length === 0) return;
    
    const fetchOnChainPrices = async () => {
      try {
        setIsLoading(true);
        
        const tokenPrices: Record<string, ethers.BigNumber> = {};
        
        // For each token, fetch its price from the SimplePriceFeed
        for (const token of tokens) {
          try {
            const price = await simplePriceFeed.prices(token.address);
            tokenPrices[token.symbol] = price;
          } catch (err) {
            console.error(`Error fetching price for ${token.symbol}:`, err);
          }
        }
        
        setPrices(tokenPrices);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch on-chain prices'));
        console.error('Error fetching on-chain prices:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Fetch immediately
    fetchOnChainPrices();
    
    // Set up interval for refreshing prices
    const intervalId = setInterval(fetchOnChainPrices, 60000); // 60 seconds
    
    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, [simplePriceFeed, tokens, isTestMode]);
  
  return { prices, isLoading, error, lastUpdated };
}
```
