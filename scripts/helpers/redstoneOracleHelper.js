const { contractAt, sendTxn } = require("../shared/helpers");

/**
 * Helpers for integrating Redstone Oracle with GMX on World Chain
 */

/**
 * Configures the price feed contract to use Redstone oracle data
 * @param {string} priceFeedAddress - Address of the VaultPriceFeed contract
 * @param {string} tokenAddress - Address of the token to configure price feed for
 * @param {string} oracleAddress - Address of the Redstone oracle
 * @param {number} oracleDecimals - Number of decimals in the oracle price
 */
async function configureRedstoneOracleForToken(priceFeedAddress, tokenAddress, oracleAddress, oracleDecimals) {
  const priceFeed = await contractAt("VaultPriceFeed", priceFeedAddress);
  
  // Check if the token is already configured
  try {
    const signers = await priceFeed.signers(tokenAddress);
    if (signers.length > 0) {
      console.log(`Oracle for ${tokenAddress} is already configured`);
      return;
    }
  } catch (error) {
    // Continue with configuration
  }
  
  console.log(`Configuring Redstone oracle for token ${tokenAddress}`);
  
  // Set the price feed as an oracle
  await sendTxn(
    priceFeed.setTokenConfig(
      tokenAddress,        // token
      oracleAddress,       // oracle
      oracleDecimals,      // decimals
      false,               // isStrictStable
      false                // isShortable
    ),
    "priceFeed.setTokenConfig"
  );
  
  console.log(`Oracle configured for ${tokenAddress}`);
}

/**
 * Loads oracle configuration from periphery/config/oracles.js and configures all oracles
 * @param {string} priceFeedAddress - Address of the VaultPriceFeed contract
 */
async function configureAllRedstoneOracles(priceFeedAddress) {
  try {
    console.log("Loading oracle configuration...");
    const oracles = require("../../periphery/config/oracles.js");
    
    // Get token addresses from the deployment
    const addresses = require("../../.tmp/addresses.json");
    
    const tokens = {
      "WLD_USD": addresses.WLD,
      // Add other token mappings as needed
    };
    
    for (const [oracleKey, oracleConfig] of Object.entries(oracles)) {
      const tokenAddress = tokens[oracleKey];
      if (!tokenAddress) {
        console.log(`Token address not found for oracle ${oracleKey}`);
        continue;
      }
      
      if (!oracleConfig.address || oracleConfig.address === "0x0000000000000000000000000000000000000000") {
        console.log(`Oracle address not configured for ${oracleKey}`);
        continue;
      }
      
      await configureRedstoneOracleForToken(
        priceFeedAddress, 
        tokenAddress, 
        oracleConfig.address, 
        oracleConfig.decimals
      );
    }
    
    console.log("Oracle configuration complete");
  } catch (error) {
    console.error("Error configuring oracles:", error);
  }
}

/**
 * Fetches a price from Redstone oracle using the SDK
 * @param {string} tokenSymbol - Symbol of the token (e.g., "WLD")
 * @returns {Promise<number>} - The token price
 */
async function getRedstonePrice(tokenSymbol) {
  try {
    // This is a placeholder - actual implementation depends on the Redstone SDK version
    const { getPrice } = require("@redstone-finance/sdk");
    
    // Get latest price from Redstone
    const price = await getPrice(tokenSymbol);
    return price;
  } catch (error) {
    console.error(`Error fetching Redstone price for ${tokenSymbol}:`, error);
    throw error;
  }
}

module.exports = {
  configureRedstoneOracleForToken,
  configureAllRedstoneOracles,
  getRedstonePrice
};
