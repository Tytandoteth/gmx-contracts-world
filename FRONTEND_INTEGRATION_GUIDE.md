# GMX V1 Frontend Integration Guide

This guide outlines how to integrate the GMX V1 frontend with your World Chain contracts, focusing on using a direct price feed approach to enable trading functionality.

## Overview

We're using a hybrid approach:
- Using the existing deployed contracts (Vault, Router, etc.)
- Using a new working SimplePriceFeed for price data
- Implementing direct price fetching in the frontend

## 1. Environment Setup

Copy the `.env.world.frontend` file to your frontend project:

```
cp .env.world.frontend /path/to/gmx-interface-world/.env.local
```

Key environment variables:
- `VITE_SIMPLE_PRICE_FEED_ADDRESS`: Our new working price feed
- `VITE_PRICE_FEED_MODE`: Set to "DIRECT" to use our SimplePriceFeed directly
- `VITE_VAULT_ADDRESS`, `VITE_ROUTER_ADDRESS`: Existing contract addresses

## 2. Frontend Price Feed Integration

Create a custom price feed adapter in your frontend project:

```typescript
// src/utils/directPriceFeed.ts
import { ethers } from 'ethers';

const SIMPLE_PRICE_FEED_ABI = [
  "function getPrice(address _token) external view returns (uint256)"
];

export async function getTokenPrice(
  tokenAddress: string, 
  provider: ethers.providers.Provider
): Promise<string> {
  try {
    const priceFeedAddress = import.meta.env.VITE_SIMPLE_PRICE_FEED_ADDRESS;
    const priceFeed = new ethers.Contract(
      priceFeedAddress,
      SIMPLE_PRICE_FEED_ABI,
      provider
    );
    
    const price = await priceFeed.getPrice(tokenAddress);
    // Convert price from 30 decimals format to USD value
    return ethers.utils.formatUnits(price, 30);
  } catch (error) {
    console.error('Error fetching price:', error);
    return '0';
  }
}
```

## 3. Modify Price Data Fetching

Update your frontend's price fetching logic to use the direct mode when configured:

```typescript
// src/utils/prices.ts
import { getTokenPrice } from './directPriceFeed';

export async function getPrices(tokens, provider) {
  // Check if using direct price feed mode
  if (import.meta.env.VITE_PRICE_FEED_MODE === 'DIRECT') {
    const prices = {};
    
    // Get prices directly from SimplePriceFeed
    for (const token of tokens) {
      const price = await getTokenPrice(token.address, provider);
      prices[token.address] = price;
    }
    
    return prices;
  } else {
    // Use existing price fetching logic
    // ...
  }
}
```

## 4. Whitelist the Test Tokens in the UI

Update your token list to include our test tokens:

```typescript
// src/config/tokens.ts
export const ADDITIONAL_TOKENS = {
  TUSD: {
    address: "0xc99E5FC1A556bD42A6dAff82Fb585814E41431dc",
    name: "Test USD",
    symbol: "TUSD",
    decimals: 18,
    coingeckoUrl: "",
    isStable: true,
    imageUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png"
  }
};

// Add them to your tokens list
export const TOKENS = {
  ...EXISTING_TOKENS,
  ...ADDITIONAL_TOKENS
};
```

## 5. Testing the Integration

1. Start your frontend in development mode:
   ```
   cd /path/to/gmx-interface-world
   npm run dev
   ```

2. Connect to World Chain in your wallet

3. Test the following functionality:
   - Price display for TUSD
   - Creating a limit order
   - Creating a market order
   - Viewing positions
   
## 6. Troubleshooting

If you encounter issues:

1. **Price display issues**:
   - Check browser console for errors
   - Verify the SimplePriceFeed contract address
   - Make sure token addresses match exactly

2. **Transaction failures**:
   - Check if token is properly whitelisted in the UI
   - Ensure proper price is being fetched
   - Monitor gas settings and error messages

3. **Contract interaction errors**:
   - Verify ABI definitions match contract expectations
   - Check permissions and governance settings

## Next Steps

Once this direct integration is working, we can explore:
1. Adding more tokens to the SimplePriceFeed
2. Building a proper price oracle system
3. Exploring full contract redeployment with correct initialization
