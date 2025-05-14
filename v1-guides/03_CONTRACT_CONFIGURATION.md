# Contract Configuration

This guide explains how to configure your GMX V1 contracts in the interface for proper World Chain integration.

## Contract Address Configuration

Create or modify your contract configuration files to include the deployed V1 contract addresses.

### Step 1: Create Configuration File

```typescript
// src/config/contracts.ts

import { ethers } from 'ethers';

// World Chain ID
export const WORLD_CHAIN_ID = 480;

// Contract addresses for V1 on World Chain
export const V1_CONTRACTS = {
  [WORLD_CHAIN_ID]: {
    // Core contracts
    Vault: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
    Router: "0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b",
    VaultPriceFeed: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
    OrderBook: "0x8179D468fF072B8A9203A293a37ef70EdCA850fc",
    PositionRouter: "0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF",
    PositionManager: "0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D",
    
    // Custom contracts for test environment
    SimplePriceFeed: "0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d",
    
    // Add other contracts as needed (USDG, ShortsTracker, etc.)
    USDG: "", // Fill in from your deployment
    ShortsTracker: "", // Fill in from your deployment
    
    // Optional contracts depending on your deployment
    RewardRouter: "", // Fill in if deployed
    GlpManager: "", // Fill in if deployed
    ReferralStorage: "", // Fill in if deployed
  }
};

// Helper function to get contract address
export function getContractAddress(chainId: number, name: string): string {
  if (!V1_CONTRACTS[chainId]) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  
  const address = V1_CONTRACTS[chainId][name];
  if (!address) {
    throw new Error(`Contract ${name} not configured for chain ${chainId}`);
  }
  
  return address;
}

// Function to create contract instance
export function createContract(
  name: string, 
  chainId: number,
  library: ethers.providers.Provider | ethers.Signer,
  abi: any
): ethers.Contract {
  const address = getContractAddress(chainId, name);
  return new ethers.Contract(address, abi, library);
}
```

### Step 2: Configure Token List

Create or update your tokens configuration:

```typescript
// src/config/tokens.ts

import { WORLD_CHAIN_ID } from './contracts';

export interface TokenInfo {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  isStable: boolean;
  isShortable: boolean;
  priceSource?: string; // Optional, for test tokens
  priceScale?: number; // Optional, for test tokens
  imageUrl?: string;
}

// Test environment tokens
export const TEST_TOKENS: Record<string, TokenInfo> = {
  TUSD: {
    name: "Test USD",
    symbol: "TUSD",
    address: "0xc1f17FB5db2A71617840eCe29c241997448f6720",
    decimals: 18,
    isStable: true,
    isShortable: false,
    priceSource: "WLD",
    imageUrl: "/icons/ic_tusd_40.svg"
  },
  TBTC: {
    name: "Test Bitcoin",
    symbol: "TBTC",
    address: "0x9cdee0fb64c18d3af7C8cB30Aada5f7fe90aF553",
    decimals: 8,
    isStable: false,
    isShortable: true,
    priceSource: "WETH",
    priceScale: 12,
    imageUrl: "/icons/ic_tbtc_40.svg"
  },
  TETH: {
    name: "Test Ethereum",
    symbol: "TETH",
    address: "0xE9298442418B800105b86953db930659e5b13058",
    decimals: 18,
    isStable: false,
    isShortable: true,
    priceSource: "WETH",
    imageUrl: "/icons/ic_teth_40.svg"
  }
};

// Production tokens (for when you migrate to production tokens)
export const PRODUCTION_TOKENS: Record<string, TokenInfo> = {
  // Add your production tokens when ready
  WLD: {
    name: "World",
    symbol: "WLD",
    address: "", // Fill in when ready
    decimals: 18,
    isStable: false,
    isShortable: true,
    imageUrl: "/icons/wld.svg"
  },
  WETH: {
    name: "Wrapped Ethereum",
    symbol: "WETH",
    address: "", // Fill in when ready
    decimals: 18,
    isStable: false,
    isShortable: true,
    imageUrl: "/icons/weth.svg"
  }
};

// Use test or production tokens based on environment variable
const USE_TEST_TOKENS = process.env.VITE_USE_TEST_TOKENS === 'true';

// Tokens configuration per chain
export const ALL_TOKENS = {
  [WORLD_CHAIN_ID]: USE_TEST_TOKENS ? TEST_TOKENS : PRODUCTION_TOKENS
};

// Helper functions to access token information
export function getToken(chainId: number, symbol: string): TokenInfo | undefined {
  return ALL_TOKENS[chainId]?.[symbol];
}

export function getTokenByAddress(chainId: number, address: string): TokenInfo | undefined {
  const tokens = ALL_TOKENS[chainId] || {};
  return Object.values(tokens).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function getAllTokens(chainId: number): TokenInfo[] {
  return Object.values(ALL_TOKENS[chainId] || {});
}

export function getWhitelistedTokens(chainId: number): TokenInfo[] {
  return getAllTokens(chainId);
}
```

### Step 3: Set Up Contract ABIs

Ensure your ABIs are correctly imported and organized:

```typescript
// src/abis/index.ts

import VaultABI from './Vault.json';
import RouterABI from './Router.json';
import VaultPriceFeedABI from './VaultPriceFeed.json';
import OrderBookABI from './OrderBook.json';
import PositionRouterABI from './PositionRouter.json';
import PositionManagerABI from './PositionManager.json';
import SimplePriceFeedABI from './SimplePriceFeed.json';
import TokenABI from './Token.json';
import USDGABI from './USDG.json';
import ShortsTrackerABI from './ShortsTracker.json';

export const ABIs = {
  Vault: VaultABI,
  Router: RouterABI,
  VaultPriceFeed: VaultPriceFeedABI,
  OrderBook: OrderBookABI,
  PositionRouter: PositionRouterABI,
  PositionManager: PositionManagerABI,
  SimplePriceFeed: SimplePriceFeedABI,
  Token: TokenABI,
  USDG: USDGABI,
  ShortsTracker: ShortsTrackerABI
};
```

### Step 4: Configure Chain Information

Update your chain configuration file:

```typescript
// src/config/chains.ts

export const WORLD_CHAIN_ID = 480;

export const CHAIN_NAMES = {
  [WORLD_CHAIN_ID]: "World Chain"
};

export const RPC_PROVIDERS = {
  [WORLD_CHAIN_ID]: process.env.VITE_WORLD_RPC_URL || "https://rpc.world-chain.com/v1/mainnet"
};

export const NETWORK_METADATA = {
  [WORLD_CHAIN_ID]: {
    chainId: `0x${WORLD_CHAIN_ID.toString(16)}`,
    chainName: "World Chain",
    nativeCurrency: {
      name: "World",
      symbol: "WLD",
      decimals: 18
    },
    rpcUrls: [RPC_PROVIDERS[WORLD_CHAIN_ID]],
    blockExplorerUrls: ["https://worldscan.org/"]
  }
};

export const DEFAULT_CHAIN_ID = WORLD_CHAIN_ID;
export const SUPPORTED_CHAIN_IDS = [WORLD_CHAIN_ID];

// Add network to wallet
export async function addNetwork(chainId: number) {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }
  
  const metadata = NETWORK_METADATA[chainId];
  if (!metadata) {
    throw new Error(`Network ${chainId} not configured`);
  }
  
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [metadata]
    });
    return true;
  } catch (error) {
    console.error("Failed to add network", error);
    throw error;
  }
}
```

### Step 5: Environment Variables

Create or update your `.env.local` file:

```
# RPC Configuration
VITE_WORLD_RPC_URL=https://rpc.world-chain.com/v1/mainnet

# Oracle Keeper Configuration
VITE_ORACLE_KEEPER_URL=https://oracle-keeper.kevin8396.workers.dev/direct-prices

# Test Environment
VITE_USE_TEST_TOKENS=true
```

### Step 6: Update Configuration Exports

Create an entry point for all V1 configuration:

```typescript
// src/config/v1.ts

export * from './contracts';
export * from './tokens';
export * from './chains';
export { ABIs } from '../abis';

// Add any other V1-specific configuration here
export const V1_CONFIG = {
  MAX_LEVERAGE: 50, // Maximum leverage in the V1 system
  BASIS_POINTS_DIVISOR: 10000,
  PRICE_PRECISION: ethers.utils.parseUnits("1", 30),
  USDG_DECIMALS: 18
};
```

By setting up these configuration files, you ensure that your interface has all the necessary information to interact with your deployed V1 contracts on World Chain.
