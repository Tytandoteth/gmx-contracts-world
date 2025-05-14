# GMX V1 Architecture Overview

This document provides an overview of the GMX V1 architecture deployed on World Chain, helping you understand how the different components interact.

## V1 Architecture Components

GMX V1 uses a monolithic architecture with these key components:

### Core Contracts

1. **Vault** (`0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5`)
   - Central contract that holds all assets
   - Executes trades, manages leverage positions
   - Responsible for token whitelisting and configuration

2. **Router** (`0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b`)
   - User-facing entry point for interactions
   - Routes calls to appropriate contracts
   - Handles plugin management

3. **VaultPriceFeed** (`0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf`)
   - Provides price data for all assets
   - Accepts input from various price sources
   - Used in the Vault for calculations

4. **OrderBook** (`0x8179D468fF072B8A9203A293a37ef70EdCA850fc`)
   - Manages limit orders
   - Stores pending orders until execution
   - Offers more gas-efficient trading

5. **PositionRouter** (`0x566e66c17a6DfE5B0964fA0AFC85cF3cc5963dAF`)
   - Executes leveraged positions
   - Manages position creation and management

6. **PositionManager** (`0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D`)
   - Helps manage existing positions
   - Provides position-specific functions

7. **USDG**
   - Platform stablecoin
   - Used as the intermediary asset in the system
   - Minted when assets are added, burned when withdrawn

8. **ShortsTracker**
   - Tracks short positions across the platform
   - Provides global short interest data

9. **SimplePriceFeed** (`0xa19F571B0B00A36028Ce47721AFa1395Bb581E5d`)
   - Custom contract for Oracle Keeper integration
   - Provides prices for test tokens

### Test Tokens

1. **TUSD** (`0xc1f17FB5db2A71617840eCe29c241997448f6720`)
   - Test USD token
   - Maps to WLD price from Oracle Keeper

2. **TBTC** (`0x9cdee0fb64c18d3af7C8cB30Aada5f7fe90aF553`)
   - Test Bitcoin token
   - Maps to scaled WETH price (12x) from Oracle Keeper

3. **TETH** (`0xE9298442418B800105b86953db930659e5b13058`)
   - Test Ethereum token
   - Maps to WETH price from Oracle Keeper

## Core Flows

### Swapping Tokens (V1)

1. User approves Router to spend their tokens
2. User calls Router's `swap` function
3. Router validates and forwards to Vault
4. Vault executes the swap and updates balances

### Creating Leveraged Positions (V1)

1. User approves Router to spend their tokens
2. User calls PositionRouter's `createIncreasePosition` function
3. PositionRouter validates and forwards to Vault
4. Vault creates the position and allocates collateral

### Price Updates (V1 with Oracle Keeper)

1. Oracle Keeper fetches prices from external API
2. Price mapping script converts prices to test token values
3. Script calls SimplePriceFeed's `updatePrice` function
4. VaultPriceFeed reads these prices when needed for calculations
5. Vault uses these prices for all operations

## V1 vs V2 Architecture

It's important to understand the key differences between V1 (what you're using) and V2 architecture:

### V1 Architecture (Current)
- Single monolithic Vault contract
- USDG as the stablecoin
- Direct price feeding mechanism
- Simpler but less composable design

### V2 Architecture (Not Used)
- Market-based design with separate markets for each trading pair
- GLP instead of USDG
- DataStore/EventEmitter pattern
- More advanced fee structure
- Improved oracle system

This understanding will help you properly integrate your V1 contracts with the interface and avoid confusion with any V2 components.
