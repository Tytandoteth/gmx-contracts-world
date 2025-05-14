import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { PriceDataProvider } from './usePriceData';
import useWorldChainContracts from './useWorldChainContracts';
import { getWorldChainProvider } from './directPriceFeed';

// Define types for the context
interface WorldChainContextType {
  provider: ethers.providers.JsonRpcProvider | null;
  isConnected: boolean;
  connectionError: Error | null;
  contracts: Record<string, ethers.Contract | null>;
  contractsLoading: boolean;
  contractsError: Record<string, Error | null>;
  criticalContractsLoaded: boolean;
}

// Create the context with default values
const WorldChainContext = createContext<WorldChainContextType>({
  provider: null,
  isConnected: false,
  connectionError: null,
  contracts: {},
  contractsLoading: false,
  contractsError: {},
  criticalContractsLoaded: false
});

// Define props for the provider component
interface WorldChainProviderProps {
  children: ReactNode;
}

export const WorldChainProvider: React.FC<WorldChainProviderProps> = ({ children }) => {
  // Provider state
  const [provider, setProvider] = useState<ethers.providers.JsonRpcProvider | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  // Load contracts using our hook
  const { 
    contracts, 
    isLoading: contractsLoading, 
    errors: contractsError,
    areCriticalContractsLoaded
  } = useWorldChainContracts();

  // Initialize provider on mount
  useEffect(() => {
    const initProvider = async (): Promise<void> => {
      try {
        const newProvider = getWorldChainProvider();
        
        // Check if provider is connected by fetching network
        const network = await newProvider.getNetwork();
        console.log('Connected to network:', network);
        
        // Make sure we're connected to World Chain (chainId: 480)
        if (network.chainId !== 480) {
          throw new Error(`Connected to wrong network: ${network.name} (${network.chainId}). Expected World Chain (480).`);
        }
        
        setProvider(newProvider);
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        console.error('Error initializing World Chain provider:', error);
        setConnectionError(error as Error);
        setIsConnected(false);
      }
    };

    initProvider();
    
    // Clean up function
    return () => {
      // No specific cleanup needed for provider
    };
  }, []);

  // Create the context value object
  const contextValue: WorldChainContextType = {
    provider,
    isConnected,
    connectionError,
    contracts,
    contractsLoading,
    contractsError,
    criticalContractsLoaded: areCriticalContractsLoaded()
  };

  // Combine with PriceDataProvider to provide both contracts and price data
  return (
    <WorldChainContext.Provider value={contextValue}>
      <PriceDataProvider>
        {children}
      </PriceDataProvider>
    </WorldChainContext.Provider>
  );
};

// Custom hook to use the context
export const useWorldChain = (): WorldChainContextType => {
  const context = useContext(WorldChainContext);
  
  if (!context) {
    throw new Error('useWorldChain must be used within a WorldChainProvider');
  }
  
  return context;
};

/**
 * Example usage:
 * 
 * import { WorldChainProvider, useWorldChain } from './WorldChainProvider';
 * 
 * // Wrap your app with the provider
 * const App = () => (
 *   <WorldChainProvider>
 *     <YourComponent />
 *   </WorldChainProvider>
 * );
 * 
 * // Use the hook in your components
 * const YourComponent = () => {
 *   const { provider, contracts, isConnected } = useWorldChain();
 *   
 *   // Now you can use provider and contracts
 *   return (
 *     <div>
 *       {isConnected ? 'Connected to World Chain!' : 'Not connected'}
 *     </div>
 *   );
 * };
 */
