# Trading Components - Part 2: Leverage Trading

This guide continues from Part 1 and focuses on implementing leverage trading functionality for GMX V1.

## Leverage Trading Functions

GMX V1 allows users to open leveraged long and short positions through the PositionRouter contract. Let's implement the necessary functions.

### Position Router Functions

Create a utility module for position operations:

```typescript
// src/lib/v1/positions.ts

import { ethers } from 'ethers';
import { isNativeToken } from '../tokens';
import { NATIVE_TOKEN_ADDRESS } from '../../config/chains';

export interface PositionParams {
  // Position details
  collateralToken: string;
  indexToken: string;
  isLong: boolean;
  
  // Amount details
  collateralAmount: ethers.BigNumber;
  sizeDelta: ethers.BigNumber;
  
  // Price details
  acceptablePrice: ethers.BigNumber;
  
  // Settings
  leverage: number;
  slippage: number; // basis points, e.g. 50 = 0.5%
  referralCode?: string;
}

/**
 * Open a new leveraged position using PositionRouter
 */
export async function openPosition(
  positionRouter: ethers.Contract,
  params: PositionParams
): Promise<ethers.ContractTransaction> {
  if (!positionRouter) {
    throw new Error("PositionRouter contract not initialized");
  }
  
  const {
    collateralToken,
    indexToken,
    isLong,
    collateralAmount,
    sizeDelta,
    acceptablePrice,
    referralCode
  } = params;
  
  // Check if we're using native token as collateral
  const isNativeIn = isNativeToken(collateralToken);
  
  // Prepare path
  const path = [collateralToken];
  
  // Execution fee
  const executionFee = await positionRouter.minExecutionFee();
  
  // Referral code (default to zero bytes32 if not provided)
  const refCode = referralCode || ethers.constants.HashZero;
  
  // Value to send (collateral + execution fee if native token)
  const value = isNativeIn 
    ? collateralAmount.add(executionFee) 
    : executionFee;
  
  // Approve position router to spend collateral token (if not native)
  if (!isNativeIn) {
    const tokenContract = new ethers.Contract(
      collateralToken,
      ["function approve(address spender, uint amount) public returns (bool)"],
      positionRouter.signer
    );
    
    // Check if approval is needed
    const signerAddress = await positionRouter.signer.getAddress();
    const allowance = await tokenContract.allowance(signerAddress, positionRouter.address);
    
    if (allowance.lt(collateralAmount)) {
      console.log(`Approving ${positionRouter.address} to spend ${collateralToken}...`);
      const approveTx = await tokenContract.approve(
        positionRouter.address, 
        ethers.constants.MaxUint256
      );
      await approveTx.wait();
      console.log("Approval successful");
    }
  }
  
  // Create the position
  let tx;
  
  if (isNativeIn) {
    tx = await positionRouter.createIncreasePosition(
      path,
      indexToken,
      collateralAmount,
      0, // minOut (0 for single token path)
      sizeDelta,
      isLong,
      acceptablePrice,
      executionFee,
      refCode,
      { value, gasLimit: 2500000 }
    );
  } else {
    tx = await positionRouter.createIncreasePosition(
      path,
      indexToken,
      0, // _amountIn (0 because we're transferring tokens separately)
      collateralAmount,
      sizeDelta,
      isLong,
      acceptablePrice,
      executionFee,
      refCode,
      { value: executionFee, gasLimit: 2500000 }
    );
  }
  
  return tx;
}

/**
 * Increase an existing position
 */
export async function increasePosition(
  positionRouter: ethers.Contract,
  params: PositionParams
): Promise<ethers.ContractTransaction> {
  // Implementation is similar to openPosition
  // The key difference is that the user already has a position
  return openPosition(positionRouter, params);
}

/**
 * Decrease a position
 */
export interface DecreasePositionParams {
  collateralToken: string;
  indexToken: string;
  isLong: boolean;
  
  // Amount to reduce
  collateralDelta: ethers.BigNumber;
  sizeDelta: ethers.BigNumber;
  
  // Price details
  acceptablePrice: ethers.BigNumber;
  
  // Settings
  receiveNative?: boolean;
  slippage: number; // basis points
}

export async function decreasePosition(
  positionRouter: ethers.Contract,
  params: DecreasePositionParams
): Promise<ethers.ContractTransaction> {
  if (!positionRouter) {
    throw new Error("PositionRouter contract not initialized");
  }
  
  const {
    collateralToken,
    indexToken,
    isLong,
    collateralDelta,
    sizeDelta,
    acceptablePrice,
    receiveNative
  } = params;
  
  // Prepare path - for receiving tokens
  const outputToken = receiveNative ? NATIVE_TOKEN_ADDRESS : collateralToken;
  const path = [collateralToken, outputToken];
  
  // Execution fee
  const executionFee = await positionRouter.minExecutionFee();
  
  // Create the decrease position transaction
  const tx = await positionRouter.createDecreasePosition(
    path,
    indexToken,
    collateralDelta,
    sizeDelta,
    isLong,
    await positionRouter.signer.getAddress(),
    acceptablePrice,
    0, // minOut
    executionFee,
    receiveNative,
    ethers.constants.AddressZero, // no callback
    { value: executionFee, gasLimit: 2500000 }
  );
  
  return tx;
}

/**
 * Close a position completely
 */
export async function closePosition(
  positionRouter: ethers.Contract,
  position: any, // Position object from Vault.getPosition
  acceptablePrice: ethers.BigNumber,
  receiveNative?: boolean
): Promise<ethers.ContractTransaction> {
  // To close a position, we decrease it by its full size
  return decreasePosition(positionRouter, {
    collateralToken: position.collateralToken,
    indexToken: position.indexToken,
    isLong: position.isLong,
    collateralDelta: position.collateral,
    sizeDelta: position.size,
    acceptablePrice,
    receiveNative,
    slippage: 50 // 0.5% default slippage
  });
}

/**
 * Calculate leverage for a position
 */
export function calculateLeverage(
  size: ethers.BigNumber,
  collateral: ethers.BigNumber
): number {
  if (collateral.isZero()) return 0;
  
  // Leverage = size / collateral
  const leverageBN = size.mul(10000).div(collateral);
  return leverageBN.toNumber() / 10000;
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  isLong: boolean,
  size: ethers.BigNumber,
  collateral: ethers.BigNumber,
  entryPrice: ethers.BigNumber,
  cumulativeFundingRate: ethers.BigNumber,
  liquidationFeeUsd: ethers.BigNumber
): ethers.BigNumber {
  if (size.isZero() || collateral.isZero()) {
    return ethers.BigNumber.from(0);
  }
  
  // For long positions: liquidationPrice = entryPrice * (1 - collateral / size + liquidationFee / size)
  // For short positions: liquidationPrice = entryPrice * (1 + collateral / size - liquidationFee / size)
  
  const liquidationFeeAdjustment = liquidationFeeUsd.mul(ethers.utils.parseUnits("1", 30)).div(size);
  const collateralAdjustment = collateral.mul(ethers.utils.parseUnits("1", 30)).div(size);
  
  if (isLong) {
    return entryPrice
      .mul(ethers.utils.parseUnits("1", 30))
      .sub(collateralAdjustment)
      .add(liquidationFeeAdjustment)
      .div(ethers.utils.parseUnits("1", 30));
  } else {
    return entryPrice
      .mul(ethers.utils.parseUnits("1", 30))
      .add(collateralAdjustment)
      .sub(liquidationFeeAdjustment)
      .div(ethers.utils.parseUnits("1", 30));
  }
}

/**
 * Get position key for a user's position
 */
export function getPositionKey(
  account: string,
  collateralToken: string,
  indexToken: string,
  isLong: boolean
): string {
  return ethers.utils.solidityKeccak256(
    ["address", "address", "address", "bool"],
    [account, collateralToken, indexToken, isLong]
  );
}
```

### Position Hooks

Create React hooks to interact with positions:

```typescript
// src/hooks/usePositions.ts

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import { useContracts } from '../contexts/ContractsContext';
import { useTokens } from '../contexts/TokensContext';
import { calculateLeverage, calculateLiquidationPrice } from '../lib/v1/positions';

export interface Position {
  key: string;
  account: string;
  collateralToken: string;
  indexToken: string;
  isLong: boolean;
  size: ethers.BigNumber;
  collateral: ethers.BigNumber;
  averagePrice: ethers.BigNumber;
  entryFundingRate: ethers.BigNumber;
  reserveAmount: ethers.BigNumber;
  realisedPnl: ethers.BigNumber;
  lastIncreasedTime: ethers.BigNumber;
  hasProfit?: boolean;
  delta?: ethers.BigNumber;
  leverage: number;
  liquidationPrice?: ethers.BigNumber;
  // UI helpers
  collateralTokenSymbol?: string;
  indexTokenSymbol?: string;
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { account } = useWeb3React();
  const { vault } = useContracts();
  const { tokens, getTokenByAddress } = useTokens();
  
  // Function to fetch positions
  const fetchPositions = useCallback(async () => {
    if (!account || !vault || tokens.length === 0) {
      setPositions([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const userPositions: Position[] = [];
      
      // Liquidation fee from vault
      const liquidationFeeUsd = await vault.liquidationFeeUsd();
      
      // For each token that can be used as collateral
      for (const collateralToken of tokens) {
        // For each token that can be shorted/longed
        for (const indexToken of tokens.filter(t => t.isShortable)) {
          // Check for long position
          try {
            const longPosition = await vault.getPosition(
              account,
              collateralToken.address,
              indexToken.address,
              true // isLong
            );
            
            if (longPosition && longPosition.size.gt(0)) {
              // Calculate additional position metrics
              const leverage = calculateLeverage(
                longPosition.size,
                longPosition.collateral
              );
              
              const liquidationPrice = calculateLiquidationPrice(
                true, // isLong
                longPosition.size,
                longPosition.collateral,
                longPosition.averagePrice,
                longPosition.entryFundingRate,
                liquidationFeeUsd
              );
              
              userPositions.push({
                key: `${collateralToken.address}-${indexToken.address}-long`,
                account,
                collateralToken: collateralToken.address,
                indexToken: indexToken.address,
                isLong: true,
                ...longPosition,
                leverage,
                liquidationPrice,
                collateralTokenSymbol: collateralToken.symbol,
                indexTokenSymbol: indexToken.symbol
              });
            }
          } catch (err) {
            console.error(`Error fetching long position for ${collateralToken.symbol}/${indexToken.symbol}:`, err);
          }
          
          // Check for short position if token is shortable
          if (indexToken.isShortable) {
            try {
              const shortPosition = await vault.getPosition(
                account,
                collateralToken.address,
                indexToken.address,
                false // isLong
              );
              
              if (shortPosition && shortPosition.size.gt(0)) {
                // Calculate additional position metrics
                const leverage = calculateLeverage(
                  shortPosition.size,
                  shortPosition.collateral
                );
                
                const liquidationPrice = calculateLiquidationPrice(
                  false, // isLong
                  shortPosition.size,
                  shortPosition.collateral,
                  shortPosition.averagePrice,
                  shortPosition.entryFundingRate,
                  liquidationFeeUsd
                );
                
                userPositions.push({
                  key: `${collateralToken.address}-${indexToken.address}-short`,
                  account,
                  collateralToken: collateralToken.address,
                  indexToken: indexToken.address,
                  isLong: false,
                  ...shortPosition,
                  leverage,
                  liquidationPrice,
                  collateralTokenSymbol: collateralToken.symbol,
                  indexTokenSymbol: indexToken.symbol
                });
              }
            } catch (err) {
              console.error(`Error fetching short position for ${collateralToken.symbol}/${indexToken.symbol}:`, err);
            }
          }
        }
      }
      
      setPositions(userPositions);
      setError(null);
    } catch (err) {
      console.error("Error fetching positions:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch positions"));
    } finally {
      setIsLoading(false);
    }
  }, [account, vault, tokens, getTokenByAddress]);
  
  // Fetch positions on mount and when dependencies change
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);
  
  return { positions, isLoading, error, refetch: fetchPositions };
}
```
