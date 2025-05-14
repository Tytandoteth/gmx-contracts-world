# Price Feed Integration - Part 2

This is a continuation of the price feed integration guide, focusing on UI components and price updates.

## Price Components

### Step 4: Create Price Display Components

Create reusable price display components:

```tsx
// src/components/PriceDisplay.tsx

import React from 'react';
import { usePrices } from '../hooks/usePrices';
import { useOnChainPrices } from '../hooks/useOnChainPrices';
import { ethers } from 'ethers';

interface PriceDisplayProps {
  symbol: string;
  showChange?: boolean;
  className?: string;
}

export function PriceDisplay({ 
  symbol, 
  showChange = false,
  className = '' 
}: PriceDisplayProps): JSX.Element {
  const { prices, isLoading: isApiLoading } = usePrices();
  const { prices: onChainPrices, isLoading: isOnChainLoading } = useOnChainPrices();
  
  // Format price from BigNumber (on-chain price)
  const formatOnChainPrice = (price?: ethers.BigNumber): string => {
    if (!price) return 'N/A';
    
    try {
      // Assuming price is stored with 30 decimals in SimplePriceFeed
      const formattedPrice = ethers.utils.formatUnits(price, 30);
      return parseFloat(formattedPrice).toFixed(2);
    } catch (err) {
      console.error('Error formatting on-chain price:', err);
      return 'Error';
    }
  };
  
  // Get price from API and on-chain
  const apiPrice = prices[symbol];
  const onChainPrice = onChainPrices[symbol];
  
  return (
    <div className={`price-display ${className}`}>
      <div className="price-container">
        <span className="price-label">API Price:</span>
        <span className="price-value">
          {isApiLoading ? 'Loading...' : apiPrice ? `$${apiPrice.toFixed(2)}` : 'N/A'}
        </span>
      </div>
      
      <div className="price-container">
        <span className="price-label">On-chain Price:</span>
        <span className="price-value">
          {isOnChainLoading ? 'Loading...' : `$${formatOnChainPrice(onChainPrice)}`}
        </span>
      </div>
      
      {showChange && apiPrice && onChainPrice && (
        <div className="price-difference">
          <span className="difference-label">Difference:</span>
          <PriceDifference 
            apiPrice={apiPrice} 
            onChainPrice={onChainPrice} 
          />
        </div>
      )}
    </div>
  );
}

interface PriceDifferenceProps {
  apiPrice: number;
  onChainPrice: ethers.BigNumber;
}

function PriceDifference({ 
  apiPrice, 
  onChainPrice 
}: PriceDifferenceProps): JSX.Element {
  try {
    // Convert on-chain price to comparable number
    const onChainPriceNum = parseFloat(ethers.utils.formatUnits(onChainPrice, 30));
    
    // Calculate difference percentage
    const difference = ((onChainPriceNum - apiPrice) / apiPrice) * 100;
    
    // Determine color based on difference
    const className = difference > 0 ? 'positive' : difference < 0 ? 'negative' : '';
    
    return (
      <span className={`difference-value ${className}`}>
        {difference.toFixed(2)}%
      </span>
    );
  } catch (err) {
    return <span className="difference-error">Error calculating</span>;
  }
}
```

### Step 5: Create Price Dashboard Component

```tsx
// src/components/PriceDashboard.tsx

import React from 'react';
import { useTokens } from '../contexts/TokensContext';
import { PriceDisplay } from './PriceDisplay';

export function PriceDashboard(): JSX.Element {
  const { tokens, isTestMode } = useTokens();
  
  if (!isTestMode) {
    return (
      <div className="price-dashboard">
        <div className="dashboard-header">
          <h2>Production Mode</h2>
          <p>Price dashboard is only available in test mode</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="price-dashboard">
      <div className="dashboard-header">
        <h2>Price Dashboard</h2>
        <p>Oracle Keeper Integration Status</p>
      </div>
      
      <div className="price-grid">
        {tokens.map(token => (
          <div key={token.symbol} className="price-card">
            <h3>{token.name} ({token.symbol})</h3>
            <PriceDisplay 
              symbol={token.symbol} 
              showChange 
            />
            {token.priceSource && (
              <div className="source-info">
                <span>Price Source: {token.priceSource}</span>
                {token.priceScale && token.priceScale !== 1 && (
                  <span>Scale Factor: {token.priceScale}x</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## On-Chain Price Updates

### Step 6: Create Price Update Service

Create a service to monitor on-chain price updates:

```typescript
// src/services/priceUpdateService.ts

import { ethers } from 'ethers';
import { getContractAddress } from '../config/contracts';
import { ABIs } from '../abis';
import { fetchOracleKeeperPrices, mapPricesToTestTokens } from './oracleService';

export interface PriceUpdateResult {
  success: boolean;
  updatedTokens: string[];
  failedTokens: string[];
  error?: Error;
}

/**
 * Update on-chain prices using the Oracle Keeper data
 */
export async function updateOnChainPrices(
  signer: ethers.Signer,
  tokenAddresses: Record<string, string>
): Promise<PriceUpdateResult> {
  try {
    // Create contract instance
    const simplePriceFeedAddress = getContractAddress(480, 'SimplePriceFeed');
    const simplePriceFeed = new ethers.Contract(
      simplePriceFeedAddress,
      ABIs.SimplePriceFeed,
      signer
    );
    
    // Fetch latest prices from the direct-prices endpoint for real-time data
    const prices = await fetchDirectPrices();
    const testTokenPrices = mapPricesToTestTokens(prices);
    
    const updatedTokens: string[] = [];
    const failedTokens: string[] = [];
    
    // Update price for each token
    for (const [symbol, price] of Object.entries(testTokenPrices)) {
      const tokenAddress = tokenAddresses[symbol];
      
      if (!tokenAddress) {
        failedTokens.push(symbol);
        continue;
      }
      
      try {
        // Convert price to on-chain format (30 decimals)
        const priceWithPrecision = ethers.utils.parseUnits(price.toString(), 30);
        
        // Send transaction to update price
        const tx = await simplePriceFeed.updatePrice(tokenAddress, priceWithPrecision);
        await tx.wait();
        
        updatedTokens.push(symbol);
      } catch (err) {
        console.error(`Error updating price for ${symbol}:`, err);
        failedTokens.push(symbol);
      }
    }
    
    return {
      success: failedTokens.length === 0,
      updatedTokens,
      failedTokens
    };
  } catch (error) {
    return {
      success: false,
      updatedTokens: [],
      failedTokens: Object.keys(tokenAddresses),
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
}
```

### Step 7: Create Admin Price Update Component

```tsx
// src/components/AdminPriceUpdater.tsx

import React, { useState } from 'react';
import { useWeb3React } from '@web3-react/core'; // Or your web3 provider
import { useTokens } from '../contexts/TokensContext';
import { updateOnChainPrices } from '../services/priceUpdateService';

export function AdminPriceUpdater(): JSX.Element {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    updatedTokens?: string[];
    failedTokens?: string[];
    error?: string;
  } | null>(null);
  
  const { library, account } = useWeb3React();
  const { tokens, isTestMode } = useTokens();
  
  if (!isTestMode) {
    return <div>Price updater is only available in test mode</div>;
  }
  
  const handleUpdatePrices = async () => {
    if (!library || !account) {
      setResult({
        success: false,
        error: 'Wallet not connected'
      });
      return;
    }
    
    try {
      setIsUpdating(true);
      setResult(null);
      
      // Create token address map
      const tokenAddresses: Record<string, string> = {};
      tokens.forEach(token => {
        tokenAddresses[token.symbol] = token.address;
      });
      
      // Update prices
      const updateResult = await updateOnChainPrices(
        library.getSigner(),
        tokenAddresses
      );
      
      setResult({
        success: updateResult.success,
        updatedTokens: updateResult.updatedTokens,
        failedTokens: updateResult.failedTokens,
        error: updateResult.error?.message
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="admin-price-updater">
      <h3>Manual Price Update</h3>
      <p>
        This will fetch the latest prices from the Oracle Keeper and update 
        them on-chain in the SimplePriceFeed contract.
      </p>
      
      <button
        onClick={handleUpdatePrices}
        disabled={isUpdating}
        className="update-button"
      >
        {isUpdating ? 'Updating...' : 'Update Prices'}
      </button>
      
      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          {result.success ? (
            <>
              <h4>✅ Prices updated successfully</h4>
              <p>Updated tokens: {result.updatedTokens?.join(', ')}</p>
            </>
          ) : (
            <>
              <h4>❌ Error updating prices</h4>
              {result.error && <p>Error: {result.error}</p>}
              {result.updatedTokens?.length > 0 && (
                <p>Updated tokens: {result.updatedTokens?.join(', ')}</p>
              )}
              {result.failedTokens?.length > 0 && (
                <p>Failed tokens: {result.failedTokens?.join(', ')}</p>
              )}
            </>
          )}
        </div>
      )}
      
      <div className="note">
        <strong>Note:</strong> For production deployments, consider setting up 
        automated price updates using a scheduled task/cron job that runs the 
        price update script regularly.
      </div>
    </div>
  );
}
```

## Scheduled Price Updates

For a production environment, it's recommended to set up scheduled price updates rather than relying on manual updates.

### Step 8: Create Price Update Script

This script should be run as a scheduled task or cron job:

```javascript
// scripts/updatePrices.js

const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://rpc.world-chain.com/v1/mainnet';
const ORACLE_KEEPER_URL = process.env.ORACLE_KEEPER_URL || 
  'https://oracle-keeper.kevin8396.workers.dev/direct-prices';
const SIMPLE_PRICE_FEED_ADDRESS = '0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Test token addresses
const TEST_TOKENS = {
  'TUSD': '0xc1f17FB5db2A71617840eCe29c241997448f6720',
  'TBTC': '0x9cdee0fb64c18d3af7C8cB30Aada5f7fe90aF553',
  'TETH': '0xE9298442418B800105b86953db930659e5b13058'
};

// Token price mapping
const TOKEN_PRICE_MAPPING = {
  'TUSD': { source: 'WLD', scale: 1 },
  'TBTC': { source: 'WETH', scale: 12 },
  'TETH': { source: 'WETH', scale: 1 }
};

// SimplePriceFeed ABI (minimal)
const SIMPLE_PRICE_FEED_ABI = [
  'function updatePrice(address _token, uint256 _price) external',
  'function prices(address) view returns (uint256)',
  'function lastUpdatedTimestamps(address) view returns (uint256)'
];

// Load the ABI for SimplePriceFeed
async function main() {
  try {
    console.log('Starting price update...');
    
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    
    // Connect to provider
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`Connected to network: ${await provider.getNetwork().then(n => n.name)}`);
    console.log(`Using wallet address: ${wallet.address}`);
    
    // Create contract instance
    const simplePriceFeed = new ethers.Contract(
      SIMPLE_PRICE_FEED_ADDRESS,
      SIMPLE_PRICE_FEED_ABI,
      wallet
    );
    
    // Fetch prices from Oracle Keeper
    console.log('Fetching prices from Oracle Keeper...');
    const response = await axios.get(ORACLE_KEEPER_URL);
    const oraclePrices = response.data.prices;
    
    console.log('Oracle prices:');
    console.log(JSON.stringify(oraclePrices, null, 2));
    
    // Map prices to test tokens
    const testTokenPrices = {};
    Object.entries(TOKEN_PRICE_MAPPING).forEach(([testToken, mapping]) => {
      const sourcePrice = oraclePrices[mapping.source];
      if (sourcePrice) {
        testTokenPrices[testToken] = sourcePrice * mapping.scale;
      }
    });
    
    console.log('Test token prices:');
    console.log(JSON.stringify(testTokenPrices, null, 2));
    
    // Update prices on-chain
    console.log('Updating on-chain prices...');
    
    const results = [];
    
    for (const [symbol, price] of Object.entries(testTokenPrices)) {
      const tokenAddress = TEST_TOKENS[symbol];
      
      if (!tokenAddress) {
        console.warn(`No address found for ${symbol}`);
        continue;
      }
      
      try {
        console.log(`Updating price for ${symbol} to $${price}...`);
        
        // Convert price to on-chain format (30 decimals)
        const priceWithPrecision = ethers.utils.parseUnits(price.toString(), 30);
        
        // Get current price for comparison
        const currentPrice = await simplePriceFeed.prices(tokenAddress);
        const currentPriceFormatted = ethers.utils.formatUnits(currentPrice, 30);
        
        console.log(`Current price: $${currentPriceFormatted}`);
        
        // Update price
        const tx = await simplePriceFeed.updatePrice(tokenAddress, priceWithPrecision);
        console.log(`Transaction submitted: ${tx.hash}`);
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        console.log(`Transaction confirmed: Block ${receipt.blockNumber}`);
        
        results.push({
          symbol,
          status: 'success',
          oldPrice: parseFloat(currentPriceFormatted),
          newPrice: price,
          txHash: tx.hash
        });
      } catch (error) {
        console.error(`Error updating price for ${symbol}:`, error);
        
        results.push({
          symbol,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('Price update complete');
    console.log('Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Save results to log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(
      `price-update-${timestamp}.json`,
      JSON.stringify({ 
        timestamp: new Date().toISOString(),
        results,
        oraclePrices
      }, null, 2)
    );
  } catch (error) {
    console.error('Error in price update script:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
```

### Step 9: Schedule the Script

Set up a cron job to run the script regularly:

```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/project && node scripts/updatePrices.js >> /var/log/price-updates.log 2>&1
```

By implementing these components and scripts, you'll have a complete price feed integration that:

1. Displays real-time prices from Oracle Keeper in your UI
2. Shows on-chain prices from the SimplePriceFeed contract
3. Allows manual updates of on-chain prices
4. Supports automated price updates through a scheduled script

This ensures that your test environment's prices stay synchronized with real market data from the Oracle Keeper.
