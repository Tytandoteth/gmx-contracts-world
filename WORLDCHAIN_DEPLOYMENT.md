# GMX on World Chain Deployment Guide

This guide provides step-by-step instructions for deploying GMX contracts to World Chain and configuring the system for use.

## Prerequisites

- Node.js (v14+)
- NPM or Yarn
- Private key with WORLD tokens for deployment gas fees
- Basic understanding of Solidity and GMX protocol

## Setup Environment

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the World Chain environment setup script:
   ```bash
   node scripts/setupWorldchainEnv.js
   ```
4. Edit `env.json` to add your private key:
   ```json
   {
     "WORLDCHAIN_DEPLOY_KEY": "YOUR_PRIVATE_KEY_HERE"
   }
   ```

## Deployment Process

The deployment process follows these main steps:

1. **Deploy WLD Token** - Deploy World ID token or a test clone
2. **Deploy Core Contracts** - Deploy GMX's core trading infrastructure
3. **Deploy Periphery Contracts** - Deploy supporting contracts and readers
4. **Deploy Gov Token** (Optional) - Deploy GMX governance token
5. **Update Oracle Feeds** - Configure price feeds for assets
6. **Frontend Configuration** - Set up the GMX interface

### Step 1: Deploy WLD Token

```bash
npx hardhat run scripts/tokens/deployWLDToken.js --network worldchain
```

This will deploy an ERC-20 token called "World ID" (WLD) that will be used in the GMX ecosystem. For a production deployment, you would typically use the existing WLD token address instead.

### Step 2: Deploy Core Contracts

```bash
npx hardhat run scripts/deploy-core.js --network worldchain
```

This deploys the following core contracts:
- Vault - The main contract for holding assets and handling trades
- Router - Handles routing of user transactions
- VaultUtils - Utility functions for the Vault
- GlpManager - Manages GLP (GMX's liquidity provider token), using WLD as the base token
- ShortsTracker - Tracks short positions
- PositionRouter & PositionManager - Manage trading positions
- OrderBook - Handles limit orders

### Step 3: Deploy Periphery Contracts

```bash
npx hardhat run scripts/deploy-periphery.js --network worldchain
```

This deploys reader contracts and peripherals:
- VaultReader - Reads data from the vault
- ReaderV2 - General data reading functions
- OrderBookReader - Reads from the order book
- PositionRouterReader - Reads position router data
- Timelock - Governance timelock for controlled changes

### Step 4: Deploy Gov Token (Optional)

```bash
npx hardhat run scripts/deployGovToken.js --network worldchain
```

This deploys:
- GMX - Governance token
- EsGMX - Escrowed GMX for staking rewards

### Step 5: Update Oracle Feeds

Configure the oracle feeds in `periphery/config/oracles.js`:

```javascript
module.exports = {
  WLD_USD: {
    address: "0x...", // Redstone/Chainlink WLD oracle on World Chain
    decimals: 8
  }
  // Add other asset oracles as needed
}
```

For World Chain, Redstone oracles are recommended and should be installed via:
```bash
npm install @redstone-finance/sdk
```

### Step 6: Frontend Configuration

Update the frontend configuration in `frontend-config.env.local` with the deployed contract addresses:

```
RPC_URL=https://rpc.worldchain.network
CHAIN_ID=12345
VAULT_ADDRESS=0x...
WLD_TOKEN=0x...
# Add other contract addresses
```

## Testing the Deployment

After deployment, test the following key features:

1. **Deposits** - Test adding liquidity to the platform
2. **Long/short WLD** - Test trading functionality
3. **Oracle accuracy** - Verify price feeds are working correctly
4. **LP earning fees/funding** - Check fee distribution for liquidity providers

## World ID Integration (Optional)

For integrating World ID authentication:

1. Create a World ID application at [https://developer.worldcoin.org](https://developer.worldcoin.org)
2. Add the World ID App ID to your frontend configuration
3. Implement the authentication flow in the frontend

## Troubleshooting

- **Gas issues**: Ensure your wallet has sufficient WORLD tokens
- **Oracle failures**: Check Redstone configuration and connection
- **Contract deployment failures**: Verify compiler version compatibility

## Additional Resources

- [GMX Documentation](https://gmx-docs.io)
- [World Chain Documentation](https://docs.worldchain.network)
- [Redstone Oracle Docs](https://docs.redstone.finance)

## Security Considerations

- Ensure proper access controls are in place for contract management
- Consider a security audit before production use
- Use multisig wallets for governance functions
- Test thoroughly on testnet before mainnet deployment
