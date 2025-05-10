# RedStone Oracle Integration Guide for GMX on World Chain

This guide explains how to integrate RedStone oracles with your custom GMX deployment on World Chain.

## Overview

Your custom GMX deployment includes:
- Custom VaultPriceFeed: `0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf`
- RedStonePriceFeed: `0xA63636C9d557793234dD5E33a24EAd68c36Df148`
- Custom Vault: `0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5`
- Custom Router: `0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b`

## Important: How RedStone Works

RedStone uses a unique approach for delivering oracle data:

1. Price data is **not stored on-chain** (saving gas costs)
2. Instead, data is delivered in transaction calldata when interacting with contracts
3. A special wrapper is needed to include this data when calling contracts

This means you **cannot** directly call the RedStonePriceFeed contract methods without using the RedStone wrapper!

## Frontend Integration Steps

### 1. Install Required Dependencies

```bash
npm install @redstone-finance/evm-connector @redstone-finance/sdk ethers
```

### 2. Initialize Contract with RedStone Wrapper

```typescript
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { ethers } from 'ethers';

// Define your ABI - only include the functions you need
const RedStonePriceFeedAbi = [
  "function getLatestPrice(string calldata symbol) public view returns (uint256)",
  "function getLatestPrices(string[] calldata symbols) public view returns (uint256[])",
  "function getTokenDecimals(string calldata symbol) public view returns (uint8)"
];

// Connect to your RedStonePriceFeed contract
const provider = new ethers.providers.JsonRpcProvider("https://rpc.world.computer");
const redStonePriceFeed = new ethers.Contract(
  "0xA63636C9d557793234dD5E33a24EAd68c36Df148", 
  RedStonePriceFeedAbi, 
  provider
);

// Wrap the contract with RedStone data provider
const wrappedContract = WrapperBuilder
  .wrapLite(redStonePriceFeed)
  .usingPriceFeed("redstone-primary");
```

### 3. Fetch Token Prices

```typescript
// Get single token price
async function getTokenPrice(symbol: string): Promise<string | null> {
  try {
    const price = await wrappedContract.getLatestPrice(symbol);
    return ethers.utils.formatUnits(price, 8); // Assuming 8 decimals
  } catch (error) {
    console.error(`Error getting ${symbol} price:`, error);
    return null;
  }
}

// Get multiple token prices
async function getMultipleTokenPrices(symbols: string[]): Promise<Array<{symbol: string; price: string}>> {
  try {
    const prices = await wrappedContract.getLatestPrices(symbols);
    return symbols.map((symbol, i) => ({
      symbol,
      price: ethers.utils.formatUnits(prices[i], 8)
    }));
  } catch (error) {
    console.error("Error getting token prices:", error);
    return [];
  }
}

// Example usage
const wldPrice = await getTokenPrice("WLD");
console.log(`WLD price: $${wldPrice}`);

const allPrices = await getMultipleTokenPrices(["WLD", "ETH", "BTC", "WWORLD"]);
console.log("All prices:", allPrices);
```

### 4. React Component Example

```tsx
import React, { useState, useEffect } from 'react';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { ethers } from 'ethers';

interface TokenPrices {
  [key: string]: string;
}

const TokenPrices: React.FC = () => {
  const [prices, setPrices] = useState<TokenPrices>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPrices = async (): Promise<void> => {
      try {
        setLoading(true);
        
        const provider = new ethers.providers.JsonRpcProvider("https://rpc.world.computer");
        const redStonePriceFeed = new ethers.Contract(
          "0xA63636C9d557793234dD5E33a24EAd68c36Df148",
          ["function getLatestPrices(string[] calldata) view returns (uint256[])"],
          provider
        );
        
        const wrappedContract = WrapperBuilder
          .wrapLite(redStonePriceFeed)
          .usingPriceFeed("redstone-primary");
        
        const tokens = ["WLD", "ETH", "BTC", "WWORLD"];
        const priceData = await wrappedContract.getLatestPrices(tokens);
        
        const priceMap: TokenPrices = {};
        tokens.forEach((symbol, i) => {
          priceMap[symbol] = ethers.utils.formatUnits(priceData[i], 8);
        });
        
        setPrices(priceMap);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch prices:", err);
        setError("Failed to load prices. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrices();
    
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading) return <div>Loading prices...</div>;
  if (error) return <div className="error">{error}</div>;
  
  return (
    <div className="token-prices">
      <h2>Token Prices</h2>
      <ul>
        {Object.entries(prices).map(([token, price]) => (
          <li key={token}>
            {token}: ${parseFloat(price).toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TokenPrices;
```

## GMX Interface Integration

For the GMX interface, you'll need to:

1. Add the RedStone dependencies to the interface project
2. Create a wrapper service for price fetching
3. Modify the existing price fetching logic to use RedStone

### Create a RedStone Service

```typescript
// src/services/redstone.ts
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { ethers } from 'ethers';

interface PriceMap {
  [key: string]: string;
}

export class RedStoneService {
  private provider: ethers.providers.JsonRpcProvider;
  private priceFeedAddress: string;
  private priceFeedAbi: string[];
  private priceFeed: ethers.Contract;
  private wrappedContract: any; // The wrapper type is complex to define precisely

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider("https://rpc.world.computer");
    this.priceFeedAddress = "0xA63636C9d557793234dD5E33a24EAd68c36Df148";
    this.priceFeedAbi = [
      "function getLatestPrice(string) view returns (uint256)",
      "function getLatestPrices(string[]) view returns (uint256[])"
    ];
    
    this.priceFeed = new ethers.Contract(
      this.priceFeedAddress,
      this.priceFeedAbi,
      this.provider
    );
    
    this.wrappedContract = WrapperBuilder
      .wrapLite(this.priceFeed)
      .usingPriceFeed("redstone-primary");
  }
  
  async getPrice(symbol: string): Promise<string> {
    try {
      const price = await this.wrappedContract.getLatestPrice(symbol);
      return ethers.utils.formatUnits(price, 8);
    } catch (error) {
      console.error(`RedStone: Error getting ${symbol} price:`, error);
      throw error;
    }
  }
  
  async getPrices(symbols: string[]): Promise<PriceMap> {
    try {
      const prices = await this.wrappedContract.getLatestPrices(symbols);
      return symbols.reduce<PriceMap>((acc, symbol, i) => {
        acc[symbol] = ethers.utils.formatUnits(prices[i], 8);
        return acc;
      }, {});
    } catch (error) {
      console.error("RedStone: Error getting token prices:", error);
      throw error;
    }
  }
}

export default new RedStoneService();
```

## Deployment Configuration

To switch between the original deployment and your custom deployment, you can create a configuration toggle:

```typescript
// src/config/deployments.ts
interface DeploymentConfig {
  vault: string;
  router: string;
  vaultPriceFeed: string;
  redStonePriceFeed?: string;
}

interface WorldchainDeployments {
  original: DeploymentConfig;
  custom: DeploymentConfig;
}

export const WORLDCHAIN_DEPLOYMENTS: WorldchainDeployments = {
  original: {
    vault: "0x123...", // Original vault address
    router: "0x456...", // Original router address
    vaultPriceFeed: "0x789...", // Original VaultPriceFeed address
  },
  custom: {
    vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
    router: "0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b",
    vaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
    redStonePriceFeed: "0xA63636C9d557793234dD5E33a24EAd68c36Df148"
  }
};

// Use environment variable or localStorage to toggle between deployments
export const getActiveDeployment = (): DeploymentConfig => {
  const useCustom = localStorage.getItem("useCustomDeployment") === "true";
  return useCustom ? WORLDCHAIN_DEPLOYMENTS.custom : WORLDCHAIN_DEPLOYMENTS.original;
};
```

## Testing Your Integration

1. First, ensure your RedStonePriceFeed is working by using the test script
2. Implement the frontend integration as described above
3. Add a UI toggle to switch between original and custom deployments
4. Test trading functionality with your custom deployment

## Troubleshooting

1. **CalldataMustHaveValidPayload Error**: This means you're calling the contract directly without using the RedStone wrapper

2. **Price Not Updated**: Check that the RedStone API is returning data for your token symbols

3. **Transaction Reverts**: Ensure you're using the correct provider and network when creating the wrapper

## Additional Resources

- [RedStone Documentation](https://docs.redstone.finance/)
- [RedStone EVM Connector](https://github.com/redstone-finance/redstone-evm-connector)
- [RedStone Example Projects](https://github.com/redstone-finance/redstone-evm-examples)
