# RedStone Oracle Keeper Setup Guide

This document provides instructions for setting up and configuring the [redstone-oracle-keeper](https://github.com/Tytandoteth/redstone-oracle-keeper) to work with our custom GMX deployment.

## Overview

The Oracle Keeper serves as a middleware between RedStone data sources and the GMX interface, providing:

1. API endpoints for price data
2. Caching for improved performance
3. Redundancy for reliability
4. Historical price tracking

## Setup Instructions

### Installation

```bash
# Clone the repository
git clone https://github.com/Tytandoteth/redstone-oracle-keeper.git
cd redstone-oracle-keeper

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# RedStone Configuration
REDSTONE_PROVIDER=redstone-primary-prod
REDSTONE_MAX_AGE_SECONDS=60

# Tokens to track
TRACKED_TOKENS=WLD,ETH,BTC,USDC,USDT

# Custom GMX Deployment
REDSTONE_PRICE_FEED_ADDRESS=0xA63636C9d557793234dD5E33a24EAd68c36Df148
VAULT_PRICE_FEED_ADDRESS=0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf
VAULT_ADDRESS=0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5

# World Chain RPC
RPC_URL=https://rpc.worldchain.network
```

### Implementation

The core of the Oracle Keeper is implemented in TypeScript using Express. Here's the main implementation structure:

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import { RedstoneSDK } from '@redstone-finance/sdk';
import { ethers } from 'ethers';

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const REDSTONE_PROVIDER = process.env.REDSTONE_PROVIDER || 'redstone-primary-prod';
const REDSTONE_MAX_AGE_SECONDS = parseInt(process.env.REDSTONE_MAX_AGE_SECONDS || '60');
const TRACKED_TOKENS = (process.env.TRACKED_TOKENS || 'WLD,ETH,BTC,USDC,USDT').split(',');

// Configure RedStone price provider
const priceProvider = new RedstoneSDK.PriceProvider({
  dataServiceId: REDSTONE_PROVIDER,
  maxDataAgeInSeconds: REDSTONE_MAX_AGE_SECONDS
});

// Price cache to reduce API calls
let priceCache: Record<string, any> = {};
let lastUpdated = 0;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Middleware to update price cache
async function updatePriceCache() {
  const now = Date.now();
  const cacheAge = now - lastUpdated;
  
  // Only update cache if older than 10 seconds
  if (cacheAge > 10000) {
    try {
      const prices = await priceProvider.getPriceForSymbols(TRACKED_TOKENS);
      priceCache = prices;
      lastUpdated = now;
      console.log('Price cache updated:', Object.keys(prices).length, 'tokens');
    } catch (error) {
      console.error('Failed to update price cache:', error);
    }
  }
}

// API endpoint to get prices
app.get('/prices', async (req, res) => {
  try {
    await updatePriceCache();
    
    // Allow filtering by symbols
    const requestedSymbols = req.query.symbols 
      ? (req.query.symbols as string).split(',') 
      : TRACKED_TOKENS;
    
    // Filter prices by requested symbols
    const filteredPrices: Record<string, any> = {};
    for (const symbol of requestedSymbols) {
      if (priceCache[symbol]) {
        filteredPrices[symbol] = priceCache[symbol];
      }
    }
    
    res.json({ 
      prices: filteredPrices,
      timestamp: lastUpdated,
      provider: REDSTONE_PROVIDER
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Endpoint to get contract status
app.get('/contracts', async (req, res) => {
  const addresses = {
    redStonePriceFeed: process.env.REDSTONE_PRICE_FEED_ADDRESS,
    vaultPriceFeed: process.env.VAULT_PRICE_FEED_ADDRESS,
    vault: process.env.VAULT_ADDRESS
  };
  
  res.json({ addresses });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    lastPriceUpdate: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    trackedTokens: TRACKED_TOKENS
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`RedStone Oracle Keeper running on port ${PORT}`);
  console.log(`Tracking ${TRACKED_TOKENS.length} tokens from ${REDSTONE_PROVIDER}`);
});
```

### Building and Running

```bash
# Build the project
npm run build

# Start the server
npm start

# For development with auto-reloading
npm run dev
```

## Deployment

### PM2 (Process Manager)

For production deployment, you can use PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the service with PM2
pm2 start dist/index.js --name "oracle-keeper"

# Configure PM2 to start on system boot
pm2 startup
pm2 save
```

### Docker Deployment

Alternatively, use Docker for containerized deployment:

```bash
# Build Docker image
docker build -t redstone-oracle-keeper .

# Run Docker container
docker run -d -p 3000:3000 --env-file .env --name oracle-keeper redstone-oracle-keeper
```

## Integration with GMX Interface

To use the Oracle Keeper with the GMX interface, update your frontend configuration:

```typescript
// In your frontend config
const ORACLE_KEEPER_URL = 'https://your-oracle-keeper-url.com';

// Function to fetch prices
async function fetchPrices(symbols = ['WLD', 'ETH', 'BTC']) {
  const response = await fetch(`${ORACLE_KEEPER_URL}/prices?symbols=${symbols.join(',')}`);
  const data = await response.json();
  return data.prices;
}
```

## Monitoring and Maintenance

### Health Checks

Implement a health check system to monitor the Oracle Keeper:

```bash
# Using curl to check the health endpoint
curl https://your-oracle-keeper-url.com/health
```

Expected response:
```json
{
  "status": "ok",
  "lastPriceUpdate": "2025-05-11T02:30:45.123Z",
  "trackedTokens": ["WLD", "ETH", "BTC", "USDC", "USDT"]
}
```

### Logging

For production, enhance logging:

```typescript
// Add Winston logger
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Replace console.log/error with logger
logger.info('RedStone Oracle Keeper running on port ${PORT}');
```

## Redundancy and Fallbacks

For production reliability, implement:

1. **Multiple Data Sources**: Configure fallback to alternative RedStone data services
2. **Caching Strategy**: Retain valid prices for a reasonable time if RedStone is unreachable
3. **Multiple Instances**: Run the Oracle Keeper on multiple servers behind a load balancer

Example implementation of fallback data sources:

```typescript
// Configure multiple RedStone providers
const primaryProvider = new RedstoneSDK.PriceProvider({
  dataServiceId: 'redstone-primary-prod',
  maxDataAgeInSeconds: 60
});

const fallbackProvider = new RedstoneSDK.PriceProvider({
  dataServiceId: 'redstone-secondary-prod',
  maxDataAgeInSeconds: 120
});

// Try primary, fall back to secondary
async function getPricesWithFallback(symbols) {
  try {
    return await primaryProvider.getPriceForSymbols(symbols);
  } catch (error) {
    logger.warn('Primary provider failed, using fallback', { error: error.message });
    return await fallbackProvider.getPriceForSymbols(symbols);
  }
}
```

## Future Enhancements

Consider these enhancements for the next version:

1. **WebSocket Support**: Provide real-time price updates via WebSockets
2. **Historical Price API**: Store and serve historical price data
3. **Price Deviation Alerts**: Monitor and alert on significant price deviations
4. **Custom Price Adjustments**: Allow configurable price adjustments (e.g., for testing)
5. **Admin API**: Secure endpoints to manage the service configuration

## Troubleshooting

### Common Issues

1. **RedStone API Errors**:
   - Check that the RedStone service ID is correct
   - Verify network connectivity to RedStone servers

2. **Slow Response Times**:
   - Optimize caching strategy
   - Consider increasing server resources

3. **Service Crashes**:
   - Implement proper error handling
   - Use PM2 to automatically restart the service

## Complete Example

A complete implementation example is available in the repository at [examples/production-setup.ts](https://github.com/Tytandoteth/redstone-oracle-keeper/blob/main/examples/production-setup.ts).
