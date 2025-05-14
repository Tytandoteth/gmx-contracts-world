import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getTokenPrice, getBatchTokenPrices, isPriceFeedWorking } from './directPriceFeed';
import { WORLD_CHAIN_TOKENS } from './contractAddresses';

// Define the context interface
interface PriceDataContextType {
  prices: Record<string, string>;
  isLoading: boolean;
  error: Error | null;
  priceFeedWorking: boolean;
  updatePrice: (tokenAddress: string) => Promise<void>;
  updateAllPrices: () => Promise<void>;
}

// Create the context with default values
const PriceDataContext = createContext<PriceDataContextType>({
  prices: {},
  isLoading: false,
  error: null,
  priceFeedWorking: false,
  updatePrice: async () => {},
  updateAllPrices: async () => {}
});

// Context provider component
export const PriceDataProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [priceFeedWorking, setPriceFeedWorking] = useState<boolean>(false);
  
  // Check if the price feed is working
  const checkPriceFeed = useCallback(async () => {
    try {
      const isWorking = await isPriceFeedWorking();
      setPriceFeedWorking(isWorking);
      return isWorking;
    } catch (err) {
      console.error('Error checking price feed:', err);
      setPriceFeedWorking(false);
      return false;
    }
  }, []);
  
  // Update price for a single token
  const updatePrice = useCallback(async (tokenAddress: string) => {
    try {
      const price = await getTokenPrice(tokenAddress);
      setPrices(prev => ({
        ...prev,
        [tokenAddress]: price
      }));
    } catch (err) {
      console.error(`Error updating price for ${tokenAddress}:`, err);
      // Don't set global error for single token failure
    }
  }, []);
  
  // Update prices for all tokens
  const updateAllPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get all token addresses from the registry
      const tokenAddresses = Object.values(WORLD_CHAIN_TOKENS).map(token => token.address);
      
      // Fetch prices in batch
      const updatedPrices = await getBatchTokenPrices(tokenAddresses);
      setPrices(updatedPrices);
    } catch (err) {
      console.error('Error updating all prices:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initialize on component mount
  useEffect(() => {
    const initializePriceData = async () => {
      setIsLoading(true);
      
      try {
        // First check if price feed is working
        const feedWorking = await checkPriceFeed();
        
        if (feedWorking) {
          // If feed is working, fetch all prices
          await updateAllPrices();
        } else {
          // If feed is not working, set error
          throw new Error('Price feed is not working');
        }
      } catch (err) {
        console.error('Error initializing price data:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializePriceData();
    
    // Set up polling for price updates every 15 seconds
    const intervalId = setInterval(() => {
      updateAllPrices();
    }, 15000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [checkPriceFeed, updateAllPrices]);
  
  // Format the context value
  const contextValue: PriceDataContextType = {
    prices,
    isLoading,
    error,
    priceFeedWorking,
    updatePrice,
    updateAllPrices
  };
  
  return (
    <PriceDataContext.Provider value={contextValue}>
      {children}
    </PriceDataContext.Provider>
  );
};

// Custom hook to use the context
export const usePriceData = (): PriceDataContextType => {
  const context = useContext(PriceDataContext);
  
  if (!context) {
    throw new Error('usePriceData must be used within a PriceDataProvider');
  }
  
  return context;
};

// Utility function to get price for a specific token by symbol
export const useTokenPrice = (symbol: string): { price: string; isLoading: boolean; error: Error | null } => {
  const { prices, isLoading, error } = usePriceData();
  const tokenAddress = WORLD_CHAIN_TOKENS[symbol]?.address;
  
  if (!tokenAddress) {
    return { 
      price: '0', 
      isLoading: false, 
      error: new Error(`Token symbol ${symbol} not found`) 
    };
  }
  
  return {
    price: prices[tokenAddress] || '0',
    isLoading,
    error
  };
};
