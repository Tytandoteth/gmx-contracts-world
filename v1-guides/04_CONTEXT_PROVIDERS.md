# Context Providers for V1 Integration

This guide explains how to implement React context providers for GMX V1 contract integration. These providers will manage state and provide access to contracts, tokens, and price data throughout your application.

## Overview of Required Context Providers

For V1 integration, you'll need the following context providers:

1. **ContractsProvider**: Manages connections to V1 smart contracts
2. **TokensProvider**: Provides token information
3. **PricesProvider**: Handles price data from Oracle Keeper and on-chain sources
4. **PositionsProvider**: Tracks user positions (optional)

## ContractsProvider Implementation

Create a context provider for V1 contracts:

```typescript
// src/contexts/ContractsContext.tsx

import React, { createContext, useContext, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core'; // Or your web3 provider
import { getContractAddress } from '../config/contracts';
import { ABIs } from '../abis';
import { WORLD_CHAIN_ID } from '../config/chains';

// Type definitions for strong typing
interface ContractsContextValue {
  vault: ethers.Contract | null;
  router: ethers.Contract | null;
  vaultPriceFeed: ethers.Contract | null;
  orderBook: ethers.Contract | null;
  positionRouter: ethers.Contract | null;
  positionManager: ethers.Contract | null;
  simplePriceFeed: ethers.Contract | null;
  getTokenContract: (address: string) => ethers.Contract | null;
  isInitialized: boolean;
}

// Create the context with default values
const ContractsContext = createContext<ContractsContextValue>({
  vault: null,
  router: null,
  vaultPriceFeed: null,
  orderBook: null,
  positionRouter: null,
  positionManager: null,
  simplePriceFeed: null,
  getTokenContract: () => null,
  isInitialized: false,
});

// Provider component
export function ContractsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { provider, account, chainId } = useWeb3React();
  
  // Create and memoize contract instances
  const contracts = useMemo((): ContractsContextValue => {
    // Return default values if conditions aren't met
    if (!provider || !account || chainId !== WORLD_CHAIN_ID) {
      return {
        vault: null,
        router: null,
        vaultPriceFeed: null,
        orderBook: null,
        positionRouter: null,
        positionManager: null,
        simplePriceFeed: null,
        getTokenContract: () => null,
        isInitialized: false,
      };
    }
    
    // Get signer for authenticated transactions
    const signer = provider.getSigner();
    
    // Create contract instances
    const vault = new ethers.Contract(
      getContractAddress(chainId, 'Vault'),
      ABIs.Vault,
      signer
    );
    
    const router = new ethers.Contract(
      getContractAddress(chainId, 'Router'),
      ABIs.Router,
      signer
    );
    
    const orderBook = new ethers.Contract(
      getContractAddress(chainId, 'OrderBook'),
      ABIs.OrderBook,
      signer
    );
    
    const positionRouter = new ethers.Contract(
      getContractAddress(chainId, 'PositionRouter'),
      ABIs.PositionRouter,
      signer
    );
    
    const positionManager = new ethers.Contract(
      getContractAddress(chainId, 'PositionManager'),
      ABIs.PositionManager,
      signer
    );
    
    // SimplePriceFeed for test environment
    const simplePriceFeed = new ethers.Contract(
      getContractAddress(chainId, 'SimplePriceFeed'),
      ABIs.SimplePriceFeed,
      signer
    );
    
    // We'll get the VaultPriceFeed address from the Vault
    let vaultPriceFeed: ethers.Contract | null = null;
    vault.priceFeed()
      .then((priceFeedAddress: string) => {
        vaultPriceFeed = new ethers.Contract(
          priceFeedAddress,
          ABIs.VaultPriceFeed,
          signer
        );
      })
      .catch((error: Error) => {
        console.error("Error getting price feed address:", error);
      });
    
    // Helper function to get token contract
    const getTokenContract = (address: string): ethers.Contract | null => {
      if (!address) return null;
      return new ethers.Contract(address, ABIs.Token, signer);
    };
    
    return {
      vault,
      router,
      vaultPriceFeed,
      orderBook,
      positionRouter,
      positionManager,
      simplePriceFeed,
      getTokenContract,
      isInitialized: true,
    };
  }, [provider, account, chainId]);
  
  return (
    <ContractsContext.Provider value={contracts}>
      {children}
    </ContractsContext.Provider>
  );
}

// Custom hook to use the contracts context
export function useContracts(): ContractsContextValue {
  return useContext(ContractsContext);
}
```

## TokensProvider Implementation

Create a context for token information:

```typescript
// src/contexts/TokensContext.tsx

import React, { createContext, useContext, useMemo } from 'react';
import { useWeb3React } from '@web3-react/core'; // Or your web3 provider
import { getWhitelistedTokens, TokenInfo } from '../config/tokens';

interface TokensContextValue {
  tokens: TokenInfo[];
  stableTokens: TokenInfo[];
  indexTokens: TokenInfo[];
  getTokenBySymbol: (symbol: string) => TokenInfo | undefined;
  getTokenByAddress: (address: string) => TokenInfo | undefined;
  isTestMode: boolean;
}

const TokensContext = createContext<TokensContextValue>({
  tokens: [],
  stableTokens: [],
  indexTokens: [],
  getTokenBySymbol: () => undefined,
  getTokenByAddress: () => undefined,
  isTestMode: false,
});

export function TokensProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { chainId } = useWeb3React();
  const isTestMode = process.env.VITE_USE_TEST_TOKENS === 'true';
  
  const tokensState = useMemo((): TokensContextValue => {
    if (!chainId) {
      return {
        tokens: [],
        stableTokens: [],
        indexTokens: [],
        getTokenBySymbol: () => undefined,
        getTokenByAddress: () => undefined,
        isTestMode,
      };
    }
    
    const tokens = getWhitelistedTokens(chainId);
    
    // Filter tokens by type
    const stableTokens = tokens.filter(token => token.isStable);
    const indexTokens = tokens.filter(token => token.isShortable);
    
    // Helper functions for finding tokens
    const getTokenBySymbol = (symbol: string): TokenInfo | undefined => {
      return tokens.find(token => token.symbol === symbol);
    };
    
    const getTokenByAddress = (address: string): TokenInfo | undefined => {
      return tokens.find(token => 
        token.address.toLowerCase() === address.toLowerCase()
      );
    };
    
    return {
      tokens,
      stableTokens,
      indexTokens,
      getTokenBySymbol,
      getTokenByAddress,
      isTestMode,
    };
  }, [chainId, isTestMode]);
  
  return (
    <TokensContext.Provider value={tokensState}>
      {children}
    </TokensContext.Provider>
  );
}

export function useTokens(): TokensContextValue {
  return useContext(TokensContext);
}
```

## PricesProvider Implementation

Create a context for price data:

```typescript
// src/contexts/PricesContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useContracts } from './ContractsContext';
import { useTokens } from './TokensContext';
import { fetchOracleKeeperPrices } from '../services/oracleService';

// Types
interface TokenPrice {
  value: number;
  decimals: number;
  formatted: string;
  contractPrice?: ethers.BigNumber;
  timestamp: string;
  source: string;
}

interface PricesContextValue {
  prices: Record<string, TokenPrice>;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

// Create the context
const PricesContext = createContext<PricesContextValue>({
  prices: {},
  isLoading: true,
  error: null,
  lastUpdated: null,
});

export function PricesProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { simplePriceFeed } = useContracts();
  const { tokens, isTestMode } = useTokens();
  
  // Fetch prices from Oracle Keeper
  useEffect(() => {
    if (!isTestMode || tokens.length === 0) return;
    
    const fetchPrices = async (): Promise<void> => {
      try {
        setIsLoading(true);
        
        // Get Oracle Keeper prices
        const oracleData = await fetchOracleKeeperPrices();
        const oraclePrices = oracleData.prices;
        
        // Format prices for each token
        const formattedPrices: Record<string, TokenPrice> = {};
        
        for (const token of tokens) {
          const sourceToken = token.priceSource || token.symbol;
          const scale = token.priceScale || 1;
          
          if (oraclePrices[sourceToken]) {
            const value = oraclePrices[sourceToken] * scale;
            formattedPrices[token.symbol] = {
              value,
              decimals: token.decimals,
              formatted: value.toFixed(2),
              timestamp: oracleData.timestamp,
              source: oracleData.source
            };
          }
        }
        
        setPrices(formattedPrices);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        console.error("Error fetching prices:", err);
        setError(err instanceof Error ? err : new Error("Unknown error fetching prices"));
      } finally {
        setIsLoading(false);
      }
    };
    
    // Fetch immediately and then poll
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // 30 second refresh
    
    return () => clearInterval(interval);
  }, [tokens, isTestMode]);
  
  // Fetch on-chain prices if SimplePriceFeed is available
  useEffect(() => {
    if (!simplePriceFeed || !isTestMode || tokens.length === 0) return;
    
    const fetchOnChainPrices = async (): Promise<void> => {
      try {
        // For each token, get on-chain price
        const updatedPrices = { ...prices };
        
        for (const token of tokens) {
          try {
            const tokenPrice = await simplePriceFeed.prices(token.address);
            
            if (updatedPrices[token.symbol]) {
              updatedPrices[token.symbol] = {
                ...updatedPrices[token.symbol],
                contractPrice: tokenPrice
              };
            }
          } catch (err) {
            console.error(`Error getting on-chain price for ${token.symbol}:`, err);
          }
        }
        
        setPrices(updatedPrices);
      } catch (err) {
        console.error("Error fetching on-chain prices:", err);
      }
    };
    
    fetchOnChainPrices();
    const interval = setInterval(fetchOnChainPrices, 60000); // 60 second refresh
    
    return () => clearInterval(interval);
  }, [simplePriceFeed, tokens, prices, isTestMode]);
  
  return (
    <PricesContext.Provider value={{ prices, isLoading, error, lastUpdated }}>
      {children}
    </PricesContext.Provider>
  );
}

export function usePrices(): PricesContextValue {
  return useContext(PricesContext);
}
```

## Optional: PositionsProvider Implementation

For tracking user positions:

```typescript
// src/contexts/PositionsContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import { useContracts } from './ContractsContext';
import { useTokens } from './TokensContext';

// Types
interface Position {
  key: string;
  size: ethers.BigNumber;
  collateral: ethers.BigNumber;
  averagePrice: ethers.BigNumber;
  entryFundingRate: ethers.BigNumber;
  reserveAmount: ethers.BigNumber;
  realisedPnl: ethers.BigNumber;
  lastIncreasedTime: ethers.BigNumber;
  hasProfit?: boolean;
  delta?: ethers.BigNumber;
  isLong: boolean;
  indexToken: string;
  collateralToken: string;
}

interface PositionsContextValue {
  positions: Position[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Create context
const PositionsContext = createContext<PositionsContextValue>({
  positions: [],
  isLoading: true,
  error: null,
  refetch: () => {},
});

export function PositionsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { account } = useWeb3React();
  const { vault, reader } = useContracts();
  const { tokens } = useTokens();
  
  // Function to fetch positions
  const fetchPositions = async (): Promise<void> => {
    if (!account || !vault || tokens.length === 0) {
      setPositions([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const userPositions: Position[] = [];
      
      // For each token that can be used as collateral
      for (const token of tokens) {
        // For each token that can be shorted/longed
        for (const indexToken of tokens.filter(t => t.isShortable)) {
          // Check for long position
          const longPosition = await vault.getPosition(
            account,
            token.address,
            indexToken.address,
            true // isLong
          );
          
          if (longPosition && longPosition.size.gt(0)) {
            userPositions.push({
              key: `${token.address}-${indexToken.address}-long`,
              ...longPosition,
              isLong: true,
              indexToken: indexToken.address,
              collateralToken: token.address
            });
          }
          
          // Check for short position if token is shortable
          if (indexToken.isShortable) {
            const shortPosition = await vault.getPosition(
              account,
              token.address,
              indexToken.address,
              false // isLong
            );
            
            if (shortPosition && shortPosition.size.gt(0)) {
              userPositions.push({
                key: `${token.address}-${indexToken.address}-short`,
                ...shortPosition,
                isLong: false,
                indexToken: indexToken.address,
                collateralToken: token.address
              });
            }
          }
        }
      }
      
      setPositions(userPositions);
      setError(null);
    } catch (err) {
      console.error("Error fetching positions:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch positions"));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch positions on mount and when dependencies change
  useEffect(() => {
    fetchPositions();
  }, [account, vault, tokens]);
  
  return (
    <PositionsContext.Provider 
      value={{ 
        positions, 
        isLoading, 
        error,
        refetch: fetchPositions 
      }}
    >
      {children}
    </PositionsContext.Provider>
  );
}

export function usePositions(): PositionsContextValue {
  return useContext(PositionsContext);
}
```

## Integration in App Component

Update your App component to include these providers:

```typescript
// src/App.tsx

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Web3ReactProvider } from '@web3-react/core'; // Or your Web3 provider
import { getLibrary } from './utils/web3';
import { V1Provider } from './contexts/V1OnlyContext';
import { ContractsProvider } from './contexts/ContractsContext';
import { TokensProvider } from './contexts/TokensContext';
import { PricesProvider } from './contexts/PricesContext';
import { PositionsProvider } from './contexts/PositionsContext';

// Your components
import Routes from './Routes';

function App(): JSX.Element {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <V1Provider>
        <TokensProvider>
          <ContractsProvider>
            <PricesProvider>
              <PositionsProvider>
                <Router>
                  <Routes />
                </Router>
              </PositionsProvider>
            </PricesProvider>
          </ContractsProvider>
        </TokensProvider>
      </V1Provider>
    </Web3ReactProvider>
  );
}

export default App;
```

## Error Handling and Fallbacks

Ensure each context includes proper error handling and fallbacks:

1. **Connection Errors**: Handle cases where contract connections fail
2. **Network Errors**: Handle cases where the user is on the wrong network
3. **Data Loading States**: Provide loading indicators while data is being fetched
4. **Fallback Values**: Provide sensible defaults when data isn't available

By implementing these context providers, you create a foundation for your V1-only interface, making contract data and functionality accessible throughout your application.
