# Trading Components Part 3: UI Implementation

This guide covers the implementation of UI components for GMX V1 trading functionality on World Chain.

## Table of Contents
1. [Trading Form Components](#trading-form-components)
2. [Position Management UI](#position-management-ui)
3. [Order Book Interface](#order-book-interface)
4. [Price Charts and Data](#price-charts-and-data)

## Trading Form Components

### SwapBox Component
The main component for token swaps:

```typescript
// src/components/v1/SwapBox.tsx
import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useV1Contracts } from '../../hooks/useV1Contracts';
import { useTokenPrices } from '../../hooks/useTokenPrices';

interface SwapBoxProps {
  defaultFromToken?: string;
  defaultToToken?: string;
}

export const SwapBox: React.FC<SwapBoxProps> = ({
  defaultFromToken,
  defaultToToken
}) => {
  const { router } = useV1Contracts();
  const { getPriceForToken } = useTokenPrices();
  
  // State management
  const [fromToken, setFromToken] = useState(defaultFromToken);
  const [toToken, setToToken] = useState(defaultToToken);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  
  // Swap execution
  const handleSwap = useCallback(async () => {
    if (!router || !fromToken || !toToken || !amount) return;
    
    try {
      const amountIn = ethers.utils.parseUnits(amount, 18);
      const minOut = // Calculate min output with slippage
      
      const tx = await router.swap(
        fromToken,
        toToken,
        amountIn,
        minOut,
        ethers.constants.AddressZero // referral
      );
      
      await tx.wait();
    } catch (error) {
      console.error('Swap failed:', error);
    }
  }, [router, fromToken, toToken, amount, slippage]);
  
  return (
    <div className="swap-box">
      {/* Token selection and amount inputs */}
      {/* Price impact and fee display */}
      {/* Swap button */}
    </div>
  );
};
```

### LeverageTrading Component
Component for opening and managing leveraged positions:

```typescript
// src/components/v1/LeverageTrading.tsx
import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useV1Contracts } from '../../hooks/useV1Contracts';
import { usePositionPrices } from '../../hooks/usePositionPrices';

interface LeverageTradingProps {
  defaultCollateralToken?: string;
  defaultIndexToken?: string;
}

export const LeverageTrading: React.FC<LeverageTradingProps> = ({
  defaultCollateralToken,
  defaultIndexToken
}) => {
  const { positionRouter } = useV1Contracts();
  const { getLiquidationPrice } = usePositionPrices();
  
  // Position state
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [isLong, setIsLong] = useState(true);
  
  // Open position handler
  const handleOpenPosition = useCallback(async () => {
    if (!positionRouter || !collateral) return;
    
    try {
      const collateralAmount = ethers.utils.parseUnits(collateral, 18);
      const sizeDelta = collateralAmount.mul(leverage);
      
      const tx = await positionRouter.createIncreasePosition(
        [defaultCollateralToken], // path
        defaultIndexToken,
        collateralAmount,
        sizeDelta,
        isLong,
        ethers.constants.MaxUint256, // acceptablePrice
        0, // executionFee
        ethers.constants.HashZero, // referralCode
        ethers.constants.AddressZero // callbackTarget
      );
      
      await tx.wait();
    } catch (error) {
      console.error('Failed to open position:', error);
    }
  }, [positionRouter, collateral, leverage, isLong]);
  
  return (
    <div className="leverage-trading">
      {/* Collateral and leverage inputs */}
      {/* Long/Short toggle */}
      {/* Position size and liquidation price display */}
      {/* Open position button */}
    </div>
  );
};
```

## Position Management UI

### ActivePositions Component
Display and manage open positions:

```typescript
// src/components/v1/ActivePositions.tsx
import React from 'react';
import { useV1Positions } from '../../hooks/useV1Positions';

export const ActivePositions: React.FC = () => {
  const { positions, closePosition } = useV1Positions();
  
  return (
    <div className="active-positions">
      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th>Size</th>
            <th>Collateral</th>
            <th>Entry Price</th>
            <th>Mark Price</th>
            <th>PnL</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.key}>
              {/* Position details */}
              <td>
                <button onClick={() => closePosition(position.key)}>
                  Close
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Order Book Interface

### OrderBook Component
Display and manage limit orders:

```typescript
// src/components/v1/OrderBook.tsx
import React from 'react';
import { useV1Orders } from '../../hooks/useV1Orders';

export const OrderBook: React.FC = () => {
  const { orders, cancelOrder } = useV1Orders();
  
  return (
    <div className="order-book">
      <div className="limit-orders">
        <h3>Limit Orders</h3>
        {orders.map((order) => (
          <div key={order.index} className="order-item">
            {/* Order details */}
            <button onClick={() => cancelOrder(order.index)}>
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Price Charts and Data

### PriceChart Component
Display token price charts with TradingView integration:

```typescript
// src/components/v1/PriceChart.tsx
import React from 'react';
import { TradingViewWidget } from '../common/TradingViewWidget';
import { useTokenPrices } from '../../hooks/useTokenPrices';

interface PriceChartProps {
  token: string;
  timeframe?: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  token,
  timeframe = '1D'
}) => {
  const { latestPrice, priceHistory } = useTokenPrices(token);
  
  return (
    <div className="price-chart">
      <div className="price-header">
        <h3>{token} Price</h3>
        <div className="current-price">${latestPrice}</div>
      </div>
      <TradingViewWidget
        symbol={token}
        timeframe={timeframe}
        containerId={`tv-chart-${token}`}
      />
    </div>
  );
};
```

## Integration Guidelines

1. Import and use these components in your main trading page:

```typescript
// src/pages/TradingPage.tsx
import React from 'react';
import { SwapBox } from '../components/v1/SwapBox';
import { LeverageTrading } from '../components/v1/LeverageTrading';
import { ActivePositions } from '../components/v1/ActivePositions';
import { OrderBook } from '../components/v1/OrderBook';
import { PriceChart } from '../components/v1/PriceChart';

export const TradingPage: React.FC = () => {
  return (
    <div className="trading-page">
      <div className="trading-container">
        <PriceChart token="WETH" />
        <div className="trading-forms">
          <SwapBox />
          <LeverageTrading />
        </div>
        <ActivePositions />
        <OrderBook />
      </div>
    </div>
  );
};
```

2. Ensure all required hooks are properly implemented and exported from their respective files.

3. Add proper error handling and loading states to all components.

4. Implement proper TypeScript interfaces for all props and state.

5. Add necessary unit tests for each component.

Remember to handle all edge cases and provide appropriate feedback to users during loading states and errors. The UI should be responsive and provide clear feedback for all user actions.
