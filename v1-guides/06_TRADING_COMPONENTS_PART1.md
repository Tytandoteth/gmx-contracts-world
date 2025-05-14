# Trading Components - Part 1: Core Trading Functions

This guide covers the implementation of V1 trading components for your GMX interface. We'll focus on the core trading functions in Part 1.

## V1 Trading Overview

GMX V1 supports three main trading activities:
1. **Token Swaps**: Simple exchange between tokens
2. **Leverage Trading**: Opening long/short positions with leverage
3. **Limit Orders**: Placing conditional orders at specific price levels

## Core Trading Functions

Let's implement the foundational trading functions for your V1 integration.

### Swap Functions

Create a utility module for swap operations:

```typescript
// src/lib/v1/swap.ts

import { ethers } from 'ethers';
import { getSwapPath, getFeeBasisPoints } from '../tokens';
import { NATIVE_TOKEN_ADDRESS } from '../../config/chains';

export interface SwapParams {
  // Input token details
  tokenIn: string;
  tokenInSymbol: string;
  tokenInDecimals: number;
  
  // Output token details
  tokenOut: string;
  tokenOutSymbol: string;
  tokenOutDecimals: number;
  
  // Amount details
  amountIn: ethers.BigNumber;
  minAmountOut: ethers.BigNumber;
  
  // Settings
  receiveNative?: boolean;
  slippage: number; // basis points, e.g. 50 = 0.5%
}

/**
 * Execute a token swap using V1 Router
 */
export async function executeSwap(
  router: ethers.Contract,
  params: SwapParams
): Promise<ethers.ContractTransaction> {
  if (!router) {
    throw new Error("Router contract not initialized");
  }
  
  const {
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    receiveNative
  } = params;
  
  // Get swap path
  const path = getSwapPath(tokenIn, tokenOut);
  
  // Check if we're swapping native token
  const isNativeIn = tokenIn === NATIVE_TOKEN_ADDRESS;
  
  // Function name depends on whether we're swapping native token
  const swapFunctionName = 
    isNativeIn && receiveNative ? "swapETHToTokens" :
    isNativeIn ? "swapETHToTokens" :
    receiveNative ? "swapTokensToETH" : "swapTokens";
  
  // Value to send (only if tokenIn is native)
  const value = isNativeIn ? amountIn : ethers.BigNumber.from(0);
  
  // Prepare transaction parameters
  let tx;
  
  // Approve router to spend tokenIn (only if not native token)
  if (!isNativeIn) {
    const tokenContract = new ethers.Contract(
      tokenIn,
      ["function approve(address spender, uint amount) public returns (bool)"],
      router.signer
    );
    
    // Check if approval is needed
    const signerAddress = await router.signer.getAddress();
    const allowance = await tokenContract.allowance(signerAddress, router.address);
    
    if (allowance.lt(amountIn)) {
      console.log(`Approving ${router.address} to spend ${tokenIn}...`);
      const approveTx = await tokenContract.approve(router.address, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log("Approval successful");
    }
  }
  
  // Determine which swap function to call based on the tokens involved
  if (isNativeIn) {
    tx = await router.swapETHToTokens(
      path,
      minAmountOut,
      await router.signer.getAddress(),
      { value, gasLimit: 2000000 }
    );
  } else if (receiveNative) {
    tx = await router.swapTokensToETH(
      path,
      amountIn,
      minAmountOut,
      await router.signer.getAddress(),
      { gasLimit: 2000000 }
    );
  } else {
    tx = await router.swapTokens(
      path,
      amountIn,
      minAmountOut,
      await router.signer.getAddress(),
      { gasLimit: 2000000 }
    );
  }
  
  return tx;
}

/**
 * Calculate price impact for a swap
 */
export function calculatePriceImpact(
  amountIn: ethers.BigNumber,
  amountOut: ethers.BigNumber,
  reserveIn: ethers.BigNumber,
  reserveOut: ethers.BigNumber,
  tokenInDecimals: number,
  tokenOutDecimals: number
): number {
  if (amountIn.isZero() || amountOut.isZero() || 
      reserveIn.isZero() || reserveOut.isZero()) {
    return 0;
  }
  
  // Convert amounts to common decimals
  const normalizedAmountIn = ethers.utils.parseUnits(
    ethers.utils.formatUnits(amountIn, tokenInDecimals),
    18
  );
  const normalizedAmountOut = ethers.utils.parseUnits(
    ethers.utils.formatUnits(amountOut, tokenOutDecimals),
    18
  );
  const normalizedReserveIn = ethers.utils.parseUnits(
    ethers.utils.formatUnits(reserveIn, tokenInDecimals),
    18
  );
  const normalizedReserveOut = ethers.utils.parseUnits(
    ethers.utils.formatUnits(reserveOut, tokenOutDecimals),
    18
  );
  
  // Calculate spot price and execution price
  const spotPrice = normalizedReserveOut.mul(ethers.constants.WeiPerEther).div(normalizedReserveIn);
  const executionPrice = normalizedAmountOut.mul(ethers.constants.WeiPerEther).div(normalizedAmountIn);
  
  // Calculate price impact
  const priceImpact = spotPrice.sub(executionPrice).mul(10000).div(spotPrice).toNumber();
  
  return priceImpact / 100; // Convert from basis points to percentage
}

/**
 * Get the minimum output amount based on slippage
 */
export function getMinOutputAmount(
  outputAmount: ethers.BigNumber,
  slippage: number
): ethers.BigNumber {
  if (outputAmount.isZero()) {
    return ethers.BigNumber.from(0);
  }
  
  // slippage is in basis points, e.g. 50 = 0.5%
  const minOutputBps = 10000 - slippage;
  return outputAmount.mul(minOutputBps).div(10000);
}

/**
 * Calculate fee for a swap
 */
export function calculateSwapFee(
  amountIn: ethers.BigNumber,
  tokenInSymbol: string,
  tokenOutSymbol: string,
  isStableSwap: boolean
): ethers.BigNumber {
  // Get fee basis points based on the tokens being swapped
  const feeBasisPoints = getFeeBasisPoints(
    tokenInSymbol,
    tokenOutSymbol,
    isStableSwap
  );
  
  // Calculate fee amount
  return amountIn.mul(feeBasisPoints).div(10000);
}
```

### Token Utilities

Create token utility functions to support trading:

```typescript
// src/lib/tokens.ts

import { NATIVE_TOKEN_ADDRESS } from '../config/chains';
import { TokenInfo } from '../config/tokens';

/**
 * Determine if a token swap is between stablecoins
 */
export function isStableSwap(
  tokenInSymbol: string,
  tokenOutSymbol: string,
  tokens: Record<string, TokenInfo>
): boolean {
  const tokenIn = tokens[tokenInSymbol];
  const tokenOut = tokens[tokenOutSymbol];
  
  if (!tokenIn || !tokenOut) return false;
  
  return tokenIn.isStable && tokenOut.isStable;
}

/**
 * Get the swap path for a pair of tokens
 */
export function getSwapPath(
  tokenIn: string,
  tokenOut: string
): string[] {
  // Direct swap
  const path = [tokenIn, tokenOut];
  
  // For V1, if both tokens are not native and not stables,
  // we might need to route through an intermediate token
  // This would require more complex logic based on your specific V1 setup
  
  return path;
}

/**
 * Get fee basis points for a swap
 */
export function getFeeBasisPoints(
  tokenInSymbol: string,
  tokenOutSymbol: string,
  isStableSwap: boolean
): number {
  // In V1, stable-to-stable swaps typically have lower fees
  if (isStableSwap) {
    return 4; // 0.04% for stable swaps
  }
  
  // Regular swaps have higher fees
  return 30; // 0.3% for regular swaps
}

/**
 * Determine if token is native
 */
export function isNativeToken(address: string): boolean {
  return address === NATIVE_TOKEN_ADDRESS || 
         address === ethers.constants.AddressZero;
}

/**
 * Get token transfer gas limit
 */
export function getTokenTransferGasLimit(symbol: string): number {
  // Some tokens require more gas for transfers
  const specialTokens: Record<string, number> = {
    // Add any tokens with special gas requirements here
  };
  
  return specialTokens[symbol] || 700000; // Default gas limit
}
```
