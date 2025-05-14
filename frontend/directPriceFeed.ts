import { ethers } from 'ethers';

// Use our working SimplePriceFeed contract
const SIMPLE_PRICE_FEED_ADDRESS = '0x7e402dE1894f3dCed30f9bECBc51aD08F2016095';
const SIMPLE_PRICE_FEED_ABI = [
  "function getPrice(address _token) external view returns (uint256)",
  "function prices(address _token) external view returns (uint256)"
];

/**
 * Creates a standardized provider for World Chain
 * This ensures consistent connection settings across the app
 */
export const getWorldChainProvider = (): ethers.providers.JsonRpcProvider => {
  const RPC_URL = 'https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/';
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, {
    chainId: 480,
    name: 'worldchain'
  });
  
  // Configure provider for optimal performance
  provider.pollingInterval = 4000;
  
  return provider;
};

/**
 * Fetches token price directly from SimplePriceFeed contract
 * @param tokenAddress The token address to get price for
 * @returns Price in USD (formatted as string with decimals)
 */
export const getTokenPrice = async (tokenAddress: string): Promise<string> => {
  try {
    const provider = getWorldChainProvider();
    const priceFeed = new ethers.Contract(
      SIMPLE_PRICE_FEED_ADDRESS,
      SIMPLE_PRICE_FEED_ABI,
      provider
    );
    
    // First try the standard getPrice method
    try {
      const price = await priceFeed.getPrice(tokenAddress);
      return ethers.utils.formatUnits(price, 30); // 30 decimals per GMX standard
    } catch (error) {
      console.warn(`getPrice failed, trying direct prices mapping: ${(error as Error).message}`);
      // Fallback to direct prices mapping accessor
      const price = await priceFeed.prices(tokenAddress);
      if (price.eq(0)) {
        throw new Error(`No price found for token ${tokenAddress}`);
      }
      return ethers.utils.formatUnits(price, 30);
    }
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    throw new Error(`Failed to get price for token ${tokenAddress}`);
  }
};

/**
 * Batch fetches prices for multiple tokens
 * @param tokenAddresses Array of token addresses
 * @returns Map of token addresses to prices
 */
export const getBatchTokenPrices = async (
  tokenAddresses: string[]
): Promise<Record<string, string>> => {
  const prices: Record<string, string> = {};
  
  await Promise.all(
    tokenAddresses.map(async (address) => {
      try {
        prices[address] = await getTokenPrice(address);
      } catch (error) {
        console.error(`Failed to get price for ${address}:`, error);
        prices[address] = "0"; // Use 0 as fallback for failed price queries
      }
    })
  );
  
  return prices;
};

/**
 * Checks if the price feed is functioning correctly
 * @returns Boolean indicating if the price feed is working
 */
export const isPriceFeedWorking = async (): Promise<boolean> => {
  try {
    // Try to get price for TUSD as a test
    const TUSD_ADDRESS = "0xc99E5FC1A556bD42A6dAff82Fb585814E41431dc";
    const price = await getTokenPrice(TUSD_ADDRESS);
    return parseFloat(price) > 0;
  } catch (error) {
    console.error("Price feed check failed:", error);
    return false;
  }
};
