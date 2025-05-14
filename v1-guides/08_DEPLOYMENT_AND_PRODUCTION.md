# Deployment and Production Guide

This guide outlines the steps for deploying GMX V1 components to production on World Chain.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Oracle Keeper Deployment](#oracle-keeper-deployment)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [Frontend Interface Deployment](#frontend-interface-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

### Environment Variables
Ensure all required environment variables are set across all components:

```bash
# Oracle Keeper (.env)
USE_PRODUCTION_PRICES=true  # Set to false for development mode
RPC_URL=your_world_chain_rpc
CHAIN_ID=480  # World Chain ID
SUPPORTED_TOKENS="WLD,WETH,MAG"

# Frontend (.env)
VITE_WORLD_RPC_URL=your_world_chain_rpc
VITE_ORACLE_KEEPER_URL=https://oracle-keeper.kevin8396.workers.dev
VITE_USE_TEST_TOKENS=false
```

### Contract Addresses
Verify the following contract addresses are deployed and verified:

```typescript
const PRODUCTION_ADDRESSES = {
  Vault: '0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5',
  Router: '0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b',
  VaultPriceFeed: '0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf',
  RedStonePriceFeed: '0xA63636C9d557793234dD5E33a24EAd68c36Df148',
  PositionRouter: '0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF',
  PositionManager: '0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D'
};
```

## Oracle Keeper Deployment

### 1. Configure Production Settings

Update the Oracle Keeper configuration:

```typescript
// config/production.ts
export const config = {
  priceUpdateInterval: 30000, // 30 seconds
  deviationThreshold: 0.5, // 0.5%
  tokens: {
    WLD: {
      address: '0x7aE97042a4A0eB4D1eB370C34F9736f9f85dB523',
      decimals: 18,
      witnetFeedId: '0xa59df722'
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      witnetFeedId: '0x3d15f701'
    },
    MAG: {
      address: '0x...',
      decimals: 18,
      witnetFeedId: 'pending'
    }
  }
};
```

### 2. Deploy to Cloudflare Workers

```bash
# Build and deploy Oracle Keeper
cd redstone-oracle-keeper
npm run build
wrangler publish
```

### 3. Configure Monitoring

Set up Cloudflare Workers monitoring:

```javascript
// monitor.js
addEventListener('scheduled', event => {
  event.waitUntil(
    fetch('your-keeper-url/health')
      .then(response => {
        if (!response.ok) {
          // Alert via configured channels
        }
      })
  );
});
```

## Smart Contract Deployment

### 1. Install RedStone SDK

```bash
cd gmx-contracts-world
npm install @redstone-finance/evm-connector
```

### 2. Switch to Live Price Feeds

```bash
# Run the script to switch from mock to live feeds
node scripts/world/switchToLivePriceFeeds.js
```

### 3. Whitelist Tokens

```bash
# Whitelist tokens with RedStone SDK integration
node scripts/world/whitelistTokensWithRedStone.js
```

### 4. Verify Complete Deployment

```bash
# Run verification script
node scripts/world/verifyCompleteDeploymentFixed.js
```

## Frontend Interface Deployment

### 1. Install Dependencies

```bash
cd gmx-interface-world
npm install @redstone-finance/evm-connector
```

### 2. Configure Production Build

Update vite.config.ts:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      external: ['@ethersproject/providers'],
    },
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.VITE_WORLD_RPC_URL': JSON.stringify(process.env.VITE_WORLD_RPC_URL),
    'process.env.VITE_ORACLE_KEEPER_URL': JSON.stringify(process.env.VITE_ORACLE_KEEPER_URL),
  }
});
```

### 3. Build and Deploy

```bash
# Build production bundle
npm run build

# Deploy to hosting service (e.g., Netlify)
netlify deploy --prod
```

## Post-Deployment Verification

### 1. Contract Verification

```typescript
// scripts/verify-deployment.ts
import { ethers } from 'ethers';
import { PRODUCTION_ADDRESSES } from './addresses';

async function verifyDeployment() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.VITE_WORLD_RPC_URL);
  
  // Verify Vault
  const vault = new ethers.Contract(PRODUCTION_ADDRESSES.Vault, VAULT_ABI, provider);
  const isInitialized = await vault.isInitialized();
  console.log('Vault initialized:', isInitialized);
  
  // Verify price feeds
  const priceFeed = new ethers.Contract(PRODUCTION_ADDRESSES.RedStonePriceFeed, PRICE_FEED_ABI, provider);
  const wldPrice = await priceFeed.getPrice(WLD_ADDRESS);
  console.log('WLD price feed working:', wldPrice.gt(0));
  
  // Additional verifications...
}

verifyDeployment();
```

### 2. Oracle Keeper Verification

```bash
# Test price feed endpoints
curl -X GET https://your-keeper-url/prices
curl -X GET https://your-keeper-url/health
```

### 3. Frontend Verification

Checklist:
- [ ] All contract interactions working
- [ ] Price feeds updating in real-time
- [ ] Trading functions operational
- [ ] Position management working
- [ ] Error handling properly configured

## Monitoring and Maintenance

### 1. Set up Monitoring Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
      
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
```

### 2. Configure Alerts

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://your-alert-endpoint'
```

### 3. Regular Maintenance Tasks

Daily:
- Monitor Oracle Keeper uptime
- Check price feed accuracy
- Review error logs

Weekly:
- Analyze trading volumes
- Review position statistics
- Check contract state

Monthly:
- Security audit review
- Performance optimization
- Dependency updates

## Production Timeline

Current timeline for full production deployment:

1. Oracle Keeper real-time data: ✅ Completed May 11, 2025
2. Interface RPC & price integration: 🔄 Due May 12, 2025
3. Contracts price feeds & token whitelisting: 📅 Due May 13, 2025
4. Full end-to-end testing: 📅 Due May 14, 2025
5. Production MVP launch: 🎯 Target May 15, 2025

## Emergency Procedures

### 1. Circuit Breaker Activation

If severe price deviation detected:

```typescript
// Emergency pause trading
await vault.setIsSwapEnabled(false);
await vault.setIsLeverageEnabled(false);
```

### 2. Price Feed Fallback

If Oracle Keeper fails:

```typescript
// Switch to backup price feed
await vaultPriceFeed.setIsSecondaryPriceEnabled(true);
```

### 3. Recovery Procedures

After resolving issues:

```typescript
// Resume trading
await vault.setIsSwapEnabled(true);
await vault.setIsLeverageEnabled(true);
```

## Support and Documentation

Maintain the following resources:
- System architecture diagrams
- API documentation
- Troubleshooting guides
- Contact information for key personnel

Keep this documentation updated with:
- New features and changes
- Known issues and workarounds
- Best practices and recommendations
- Regular security updates
