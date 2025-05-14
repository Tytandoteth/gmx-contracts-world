import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getWorldChainProvider } from './directPriceFeed';
import { WORLD_CHAIN_CONTRACTS } from './contractAddresses';
import { ContractABIs } from './contractABIs';

/**
 * Type definitions for contract loading states
 */
export type ContractLoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Interface for contract registry
 */
export interface ContractRegistry {
  [key: string]: ethers.Contract | null;
}

/**
 * Interface for contract error registry
 */
export interface ContractErrorRegistry {
  [key: string]: Error | null;
}

/**
 * Hook for loading and interacting with World Chain contracts
 * Provides robust error handling and loading states
 */
export const useWorldChainContracts = () => {
  // Contract registry
  const [contracts, setContracts] = useState<ContractRegistry>({});
  
  // Loading state for each contract
  const [loadingStates, setLoadingStates] = useState<Record<string, ContractLoadingState>>({
    Vault: 'idle',
    Router: 'idle',
    SimplePriceFeed: 'idle',
    PositionRouter: 'idle',
    PositionManager: 'idle',
    OrderBook: 'idle'
  });
  
  // Error registry
  const [errors, setErrors] = useState<ContractErrorRegistry>({});
  
  // Overall loading state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  /**
   * Helper function to update loading state for a specific contract
   */
  const updateLoadingState = useCallback((
    contractName: string, 
    state: ContractLoadingState
  ) => {
    setLoadingStates(prev => ({
      ...prev,
      [contractName]: state
    }));
  }, []);
  
  /**
   * Helper function to update error state for a specific contract
   */
  const updateError = useCallback((
    contractName: string, 
    error: Error | null
  ) => {
    setErrors(prev => ({
      ...prev,
      [contractName]: error
    }));
  }, []);
  
  /**
   * Load a specific contract
   */
  const loadContract = useCallback(async (contractName: string) => {
    const contractInfo = WORLD_CHAIN_CONTRACTS[contractName];
    if (!contractInfo) {
      console.error(`Contract ${contractName} not found in registry`);
      return null;
    }
    
    const abi = ContractABIs[contractName];
    if (!abi) {
      console.error(`ABI for ${contractName} not found`);
      return null;
    }
    
    updateLoadingState(contractName, 'loading');
    
    try {
      const provider = getWorldChainProvider();
      const contract = new ethers.Contract(
        contractInfo.address,
        abi,
        provider
      );
      
      // Basic validation test - different for each contract type
      if (contractName === 'SimplePriceFeed') {
        // Test SimplePriceFeed by getting TUSD price
        const tusdAddress = "0xc99E5FC1A556bD42A6dAff82Fb585814E41431dc";
        await contract.getPrice(tusdAddress);
      } else if (contractName === 'Vault') {
        // Test Vault by checking if leverage is enabled
        await contract.isLeverageEnabled();
      } else if (contractName === 'Router') {
        // Test Router by getting the vault address
        await contract.vault();
      }
      
      updateLoadingState(contractName, 'success');
      updateError(contractName, null);
      
      return contract;
    } catch (error) {
      console.error(`Error loading ${contractName} contract:`, error);
      updateLoadingState(contractName, 'error');
      updateError(contractName, error as Error);
      return null;
    }
  }, [updateLoadingState, updateError]);
  
  /**
   * Load all contracts
   */
  const loadAllContracts = useCallback(async () => {
    setIsLoading(true);
    
    // Load most critical contracts first
    const contractsToLoad = [
      'SimplePriceFeed',  // Most important - we know this works
      'Vault',            // Core contract for trading
      'Router',           // Core contract for routing trades
      'PositionRouter',   // For leveraged trading
      'PositionManager',  // For position management
      'OrderBook'         // For limit orders
    ];
    
    const loadedContracts: ContractRegistry = {};
    
    for (const contractName of contractsToLoad) {
      loadedContracts[contractName] = await loadContract(contractName);
    }
    
    setContracts(loadedContracts);
    setIsLoading(false);
  }, [loadContract]);
  
  /**
   * Load contracts on mount
   */
  useEffect(() => {
    loadAllContracts();
    
    // Cleanup function
    return () => {
      // No specific cleanup needed for read-only contracts
    };
  }, [loadAllContracts]);
  
  /**
   * Helper to check if critical contracts are loaded
   */
  const areCriticalContractsLoaded = useCallback(() => {
    // For MVP, we only need SimplePriceFeed to be working
    return contracts.SimplePriceFeed !== null && 
           loadingStates.SimplePriceFeed === 'success';
  }, [contracts, loadingStates]);
  
  /**
   * Reload a specific contract
   */
  const reloadContract = useCallback(async (contractName: string) => {
    const contract = await loadContract(contractName);
    
    setContracts(prev => ({
      ...prev,
      [contractName]: contract
    }));
    
    return contract;
  }, [loadContract]);
  
  return {
    contracts,
    loadingStates,
    errors,
    isLoading,
    areCriticalContractsLoaded,
    reloadContract,
    loadAllContracts
  };
};

export default useWorldChainContracts;
