# Troubleshooting Guide for GMX V1 Integration

This guide covers common issues you might encounter during GMX V1 integration on World Chain and provides solutions to resolve them.

## Table of Contents
1. [Contract Connection Issues](#contract-connection-issues)
2. [Price Feed Problems](#price-feed-problems)
3. [Transaction Failures](#transaction-failures)
4. [UI Component Issues](#ui-component-issues)
5. [Performance Optimization](#performance-optimization)
6. [Oracle Keeper Troubleshooting](#oracle-keeper-troubleshooting)
7. [TypeScript and ESLint Errors](#typescript-and-eslint-errors)

## Contract Connection Issues

### Issue: Failed to Connect to V1 Contracts

**Symptoms:**
- `null` contract instances in ContractsProvider
- Errors like "Cannot read property 'X' of null" when trying to call contract methods

**Solutions:**
1. Verify your RPC URL is correct and the node is responsive:

```typescript
// Test RPC connection
import { ethers } from 'ethers';

async function testRPC() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.VITE_WORLD_RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    console.log('Connected successfully. Current block:', blockNumber);
  } catch (error) {
    console.error('RPC connection failed:', error);
  }
}
```

2. Ensure contract addresses are correct for the current network:

```typescript
// Check that you're connected to World Chain
if (chainId !== WORLD_CHAIN_ID) {
  console.error(`Connected to chain ${chainId}, but expected World Chain (${WORLD_CHAIN_ID})`);
}
```

3. Verify ABIs match the deployed contracts:

```bash
# Use cast to verify ABI compatibility
cast abi-encode "balanceOf(address)" 0x... --rpc-url $WORLD_RPC_URL
```

### Issue: Contract Method Not Found

**Symptoms:**
- Errors like "function not found" or "method undefined" when calling contract methods

**Solutions:**
1. Check that the ABI includes the method you're trying to call:

```typescript
// Inspect ABI to ensure method exists
console.log(JSON.stringify(ABIs.Vault.filter(item => item.name === 'getTargetUsdgAmount')));
```

2. Verify you're using the correct contract instance:

```typescript
// Debugging contract instances
console.log('Contract address:', contract.address);
console.log('Available methods:', Object.keys(contract.functions));
```

## Price Feed Problems

### Issue: Prices Not Updating

**Symptoms:**
- UI shows stale prices or zero values
- Price-dependent calculations fail

**Solutions:**
1. Check Oracle Keeper status:

```bash
# Oracle Keeper health check
curl https://your-keeper-url/health
```

2. Verify the price update loop is running:

```typescript
// In your PricesProvider
useEffect(() => {
  let interval: NodeJS.Timeout;
  
  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${process.env.VITE_ORACLE_KEEPER_URL}/prices`);
      console.log('Received prices:', response.data);
      // Process prices...
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  };
  
  fetchPrices(); // Fetch immediately
  interval = setInterval(fetchPrices, 30000); // Every 30 seconds
  
  return () => clearInterval(interval);
}, []);
```

3. Implement a fallback mechanism for price data:

```typescript
// Fallback to on-chain prices if API fails
const fetchFallbackPrices = async () => {
  try {
    const { vaultPriceFeed } = useContracts();
    if (!vaultPriceFeed) return {};
    
    const fallbackPrices = {};
    for (const token of supportedTokens) {
      const price = await vaultPriceFeed.getPrice(token.address, false);
      fallbackPrices[token.symbol] = ethers.utils.formatUnits(price, 30);
    }
    return fallbackPrices;
  } catch (error) {
    console.error('Failed to fetch fallback prices:', error);
    return {};
  }
};
```

### Issue: Price Deviation Errors

**Symptoms:**
- Transactions fail with "price deviation too high" errors
- Inconsistent prices between UI and contract

**Solutions:**
1. Add price consistency checks:

```typescript
function isPriceConsistent(uiPrice: number, chainPrice: number): boolean {
  const deviation = Math.abs(uiPrice - chainPrice) / chainPrice;
  return deviation < 0.005; // 0.5% deviation max
}
```

2. Ensure prices are properly formatted:

```typescript
// Convert price from Wei representation (1e30) to USD
function formatPriceFromChain(priceInWei: BigNumber): number {
  return parseFloat(ethers.utils.formatUnits(priceInWei, 30));
}
```

## Transaction Failures

### Issue: Transaction Reverted

**Symptoms:**
- "Transaction has been reverted by the EVM" errors
- Failed transactions in wallet

**Solutions:**
1. Check token allowances:

```typescript
// Verify allowance before swap
async function checkAndApproveToken(token: string, spender: string, amount: BigNumber) {
  const tokenContract = getTokenContract(token);
  if (!tokenContract) return false;
  
  const allowance = await tokenContract.allowance(account, spender);
  if (allowance.lt(amount)) {
    const tx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
    await tx.wait();
    return true;
  }
  return true;
}
```

2. Verify gas limits:

```typescript
// Estimate gas and add buffer
async function estimateGasWithBuffer(method, args, options = {}) {
  try {
    const gasEstimate = await method.estimateGas(...args, options);
    return gasEstimate.mul(120).div(100); // Add 20% buffer
  } catch (error) {
    console.error('Gas estimation failed:', error);
    throw error;
  }
}
```

3. Debug reverts with detailed error messages:

```typescript
// Enhanced error handling
try {
  const tx = await contract.method(...args);
  await tx.wait();
} catch (error) {
  if (error.data) {
    // Try to decode the error
    const decodedError = abiCoder.decode(['string'], error.data);
    console.error('Transaction failed with reason:', decodedError[0]);
  } else {
    console.error('Transaction failed:', error.message);
  }
}
```

### Issue: User Confirmation Timeout

**Symptoms:**
- Transaction doesn't execute due to user not confirming in time
- Position updates fail to execute

**Solutions:**
1. Implement a retry mechanism with increasing timeouts:

```typescript
// Retry pattern for user confirmations
async function executeWithRetry(method, args, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await method(...args);
    } catch (error) {
      if (error.code === 4001) { // User rejected
        console.log('User rejected transaction');
        throw error;
      }
      
      retries++;
      if (retries >= maxRetries) throw error;
      
      console.log(`Retry attempt ${retries}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}
```

## UI Component Issues

### Issue: Position Data Not Displaying

**Symptoms:**
- Empty position lists
- "Loading" state never completes

**Solutions:**
1. Check for errors in position data fetching:

```typescript
// Add better error handling to position fetching
const fetchPositions = async () => {
  setIsLoading(true);
  setError(null);
  
  try {
    // Fetch positions
    const positions = await reader.getPositions(...);
    setPositions(positions);
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    setError(error);
    // Show mock data for debugging
    setPositions([{ /* mock position */ }]);
  } finally {
    setIsLoading(false);
  }
};
```

2. Add fallback UI components:

```tsx
// Fallback component when position data fails
function PositionFallback({ error }) {
  return (
    <div className="position-fallback">
      <h3>Unable to load position data</h3>
      <p>Error: {error?.message || 'Unknown error'}</p>
      <button onClick={retry}>Retry</button>
    </div>
  );
}
```

### Issue: Price Chart Not Rendering

**Symptoms:**
- Empty or broken chart displays
- JavaScript errors in console related to chart rendering

**Solutions:**
1. Check data formatting:

```typescript
// Ensure price data is in the correct format for your charting library
function formatPriceDataForChart(priceData) {
  return priceData.map(item => ({
    time: item.timestamp / 1000, // Convert to seconds if needed
    value: parseFloat(item.price)
  }));
}
```

2. Add error boundaries around chart components:

```tsx
// Create error boundary for chart components
class ChartErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, info) {
    console.error('Chart error:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <div className="chart-error">Chart could not be displayed</div>;
    }
    return this.props.children;
  }
}
```

## Performance Optimization

### Issue: Slow UI Response

**Symptoms:**
- UI lag during price updates
- Delayed transaction feedback

**Solutions:**
1. Implement memo and useCallback for expensive components:

```tsx
// Optimize with memo and useCallback
const MemoizedPriceDisplay = React.memo(function PriceDisplay({ token, price }) {
  return <div>{token}: ${price.toFixed(2)}</div>;
});

function PriceList({ prices }) {
  // Only re-render when prices actually change
  return (
    <div>
      {Object.entries(prices).map(([token, price]) => (
        <MemoizedPriceDisplay key={token} token={token} price={price} />
      ))}
    </div>
  );
}
```

2. Debounce price updates:

```typescript
// Debounce price updates to reduce renders
import { debounce } from 'lodash';

const debouncedSetPrices = useCallback(
  debounce((newPrices) => {
    setPrices(newPrices);
  }, 500),
  []
);

// Use in price update loop
useEffect(() => {
  const fetchPrices = async () => {
    try {
      const response = await axios.get(API_URL);
      debouncedSetPrices(response.data);
    } catch (error) {
      console.error(error);
    }
  };
  
  const interval = setInterval(fetchPrices, 3000);
  return () => clearInterval(interval);
}, [debouncedSetPrices]);
```

## Oracle Keeper Troubleshooting

### Issue: Oracle Keeper Not Returning Data

**Symptoms:**
- `/prices` endpoint returns errors or empty responses
- Status endpoint shows issues

**Solutions:**
1. Check Oracle Keeper health status:

```bash
# Check Oracle Keeper health
curl https://oracle-keeper.kevin8396.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1715418035712,
  "version": "1.0.0-witnet",
  "requestId": "abc123def",
  "uptime": 1082530,
  "endpoints": [
    "/health",
    "/metrics",
    "/api/metrics/batch",
    "/prices",
    "/price/:symbol"
  ]
}
```

2. Try the different price endpoints to isolate the issue:

```bash
# Try cached prices
curl https://oracle-keeper.kevin8396.workers.dev/prices

# Try direct (real-time) prices
curl https://oracle-keeper.kevin8396.workers.dev/direct-prices

# Try individual token price
curl https://oracle-keeper.kevin8396.workers.dev/price/WLD
```

3. Check metrics for potential rate limiting issues:

```bash
# Check Oracle Keeper metrics
curl https://oracle-keeper.kevin8396.workers.dev/metrics
```

4. Implement a health check dashboard in your application:

```tsx
// Oracle Keeper status component
function OracleStatus() {
  const [status, setStatus] = useState({ 
    healthy: false, 
    lastUpdate: null,
    version: '',
    uptime: 0 
  });
  
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('https://oracle-keeper.kevin8396.workers.dev/health');
        const data = await response.json();
        setStatus({
          healthy: data.status === 'ok',
          lastUpdate: new Date(data.timestamp),
          version: data.version,
          uptime: Math.floor(data.uptime / (1000 * 60)) // minutes
        });
      } catch (error) {
        setStatus({ healthy: false, lastUpdate: null, version: '', uptime: 0 });
        console.error('Oracle health check failed:', error);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`oracle-status ${status.healthy ? 'healthy' : 'error'}`}>
      <h3>Oracle Keeper Status</h3>
      <div>Status: {status.healthy ? 'Online ✓' : 'Offline ✗'}</div>
      {status.lastUpdate && 
        <div>Last Update: {status.lastUpdate.toLocaleTimeString()}</div>}
      {status.version && <div>Version: {status.version}</div>}
      {status.uptime > 0 && <div>Uptime: {status.uptime} minutes</div>}
    </div>
  );
}
```

## TypeScript and ESLint Errors

### Issue: TypeScript Compilation Errors

**Symptoms:**
- Build failures due to type errors
- ESLint warnings or errors

**Solutions:**
1. Ensure strict TypeScript configuration:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    // Other strict options...
  }
}
```

2. Fix common ESLint issues:

```typescript
// ESLint configuration for GMX V1 integration
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'no-shadow': 'error',
    'prefer-const': 'error'
  }
};
```

3. Define proper interfaces for all components:

```typescript
// Define proper interfaces
interface TokenData {
  address: string;
  symbol: string;
  decimals: number;
  price?: number;
}

interface PositionData {
  key: string;
  size: BigNumber;
  collateral: BigNumber;
  leverage: number;
  entryPrice: BigNumber;
  markPrice: BigNumber;
  pnl: BigNumber;
  isLong: boolean;
}
```

## Common Error Messages and Solutions

| Error Message | Possible Cause | Solution |
|---------------|----------------|----------|
| "execution reverted: Vault: zero amount" | Attempting swap with 0 amount | Validate input amount before sending transaction |
| "insufficient funds for gas * price + value" | Not enough ETH for gas | Ensure wallet has enough ETH for transaction fees |
| "price impact too high" | Large order affecting price significantly | Reduce order size or increase allowed slippage |
| "fee basis points exceeded" | Swap fee exceeds max allowed | Check if token has high swap fees, reduce order size |
| "execution reverted: Router: mark price lower than limit" | Market price worse than limit price | Update limit price or wait for better market conditions |
| "Vault: leverage not enabled" | Leverage trading disabled | Check if leverage trading is enabled in Vault |
| "liquidation fee exceeded collateral" | Position would be immediately liquidatable | Increase collateral or reduce position size |

## Debugging Tools

### Contract Call Debugger

Use the following utility to debug contract calls:

```typescript
// Contract call debugger
async function debugContractCall(contract, method, args) {
  console.log(`Debugging call to ${contract.address}.${method}`);
  console.log('Arguments:', args);
  
  try {
    // Try to estimate gas first to check if call would revert
    const gasEstimate = await contract.estimateGas[method](...args);
    console.log('Gas estimate:', gasEstimate.toString());
    
    // Make the actual call
    const result = await contract[method](...args);
    console.log('Call result:', result);
    return result;
  } catch (error) {
    console.error('Call failed:', error);
    
    // Try to decode error message
    if (error.data) {
      try {
        const iface = new ethers.utils.Interface(['function Error(string)']);
        const decoded = iface.parseError(error.data);
        console.error('Decoded error:', decoded);
      } catch (e) {
        console.error('Could not decode error data');
      }
    }
    
    throw error;
  }
}
```

### Network Monitor

Set up a network monitor to track RPC health:

```typescript
// Network health monitor
class NetworkMonitor {
  private status: 'connected' | 'disconnected' | 'degraded' = 'disconnected';
  private provider: ethers.providers.Provider;
  private listeners: Array<(status: string) => void> = [];
  
  constructor(provider: ethers.providers.Provider) {
    this.provider = provider;
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    setInterval(async () => {
      try {
        const startTime = Date.now();
        await this.provider.getBlockNumber();
        const latency = Date.now() - startTime;
        
        const newStatus = 
          latency < 500 ? 'connected' : 
          latency < 2000 ? 'degraded' : 'disconnected';
        
        if (newStatus !== this.status) {
          this.status = newStatus;
          this.notifyListeners();
        }
      } catch (error) {
        if (this.status !== 'disconnected') {
          this.status = 'disconnected';
          this.notifyListeners();
        }
      }
    }, 5000);
  }
  
  public addListener(listener: (status: string) => void): void {
    this.listeners.push(listener);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }
  
  public getStatus(): string {
    return this.status;
  }
}
```

## Additional Resources

- [World Chain Developer Docs](https://docs.worldchain.xyz)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [GMX Documentation](https://gmx-docs.io)
- [Community Discord](https://discord.gg/worldchain)

## Support

If you encounter issues not covered in this guide, please:

1. Check GitHub issues for similar problems
2. Ask in the developer Discord channel
3. Submit a detailed bug report with steps to reproduce

Remember to include the following information in bug reports:
- Browser and version
- Wallet type and version
- Transaction hash (if applicable)
- Console errors
- Network conditions
