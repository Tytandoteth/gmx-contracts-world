const { getFrameSigner, contractAt } = require("../shared/helpers")
const { expandDecimals, formatAmount } = require("../../test/shared/utilities")
const fs = require('fs')

// Token symbols to test
const TOKENS_TO_TEST = ["WLD", "ETH", "BTC", "USDC", "USDT"]

async function main() {
  console.log("Testing RedStone Price Feed on World Chain")
  console.log("==========================================\n")
  
  const signer = await getFrameSigner()
  
  console.log("Using account:", await signer.getAddress())
  
  // Get the deployed RedStonePriceFeed contract address
  let redStonePriceFeedAddress
  
  try {
    const deploymentData = JSON.parse(fs.readFileSync('.world-redstone-deployment.json'))
    redStonePriceFeedAddress = deploymentData.redStonePriceFeed
    console.log("RedStonePriceFeed address:", redStonePriceFeedAddress)
  } catch (error) {
    console.error("Error loading deployment data:", error)
    console.log("Please run deployRedStoneFeed.js first to deploy the price feed contract")
    process.exit(1)
  }
  
  if (!redStonePriceFeedAddress) {
    console.error("RedStonePriceFeed address not found in deployment data")
    process.exit(1)
  }
  
  try {
    console.log(`Testing RedStonePriceFeed at address: ${redStonePriceFeedAddress}`)
    
    // Get contract instance
    const priceFeed = await contractAt("RedStonePriceFeed", redStonePriceFeedAddress)
    
    // Check token decimals
    console.log("\nToken Decimals Configuration:")
    console.log("---------------------------")
    
    for (const token of TOKENS_TO_TEST) {
      try {
        const decimals = await priceFeed.getTokenDecimals(token)
        console.log(`${token}: ${decimals} decimals`)
      } catch (error) {
        console.warn(`Could not get decimals for ${token}: ${error.message}`)
      }
    }
    
    // Check prices
    console.log("\nToken Price Data:")
    console.log("---------------")
    
    // Test individual price queries
    for (const token of TOKENS_TO_TEST) {
      try {
        const price = await priceFeed.getLatestPrice(token)
        console.log(`${token}: ${formatAmount(price, 8)} USD`)
      } catch (error) {
        console.warn(`Could not get price for ${token}: ${error.message}`)
      }
    }
    
    // Test batch price query
    try {
      console.log("\nBatch Price Query:")
      console.log("----------------")
      
      const prices = await priceFeed.getLatestPrices(TOKENS_TO_TEST)
      
      for (let i = 0; i < TOKENS_TO_TEST.length; i++) {
        console.log(`${TOKENS_TO_TEST[i]}: ${formatAmount(prices[i], 8)} USD`)
      }
    } catch (error) {
      console.warn(`Could not perform batch price query: ${error.message}`)
    }
    
    // Verify GMX Vault Price Feed Integration
    console.log("\nVerifying GMX Vault Integration:")
    console.log("-----------------------------")
    
    try {
      const worldDeployment = JSON.parse(fs.readFileSync('.world-deployment.json'))
      const vaultAddress = worldDeployment.vault
      
      if (vaultAddress) {
        console.log(`GMX Vault address: ${vaultAddress}`)
        const vault = await contractAt("Vault", vaultAddress)
        
        // Define token addresses (these should match the ones in configureRedStonePriceFeeds.js)
        const tokenAddresses = {
          "WLD": "0x163f8c2467924be0ae7b5347228cabf260318753",
          "ETH": "0x47c031236e19d024b42f8AE6780E44A573170702",
          "BTC": "0x6853EA96FF216fAb11D2d930CE3C508556A4bdc3",
          "USDC": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C8",
          "USDT": "0xE6D222caAB2842D70F9CE058C9316B5C936E2949"
        }
        
        for (const [symbol, address] of Object.entries(tokenAddresses)) {
          try {
            const priceFeedAddress = await vault.priceFeed(address)
            const isConfigured = priceFeedAddress.toLowerCase() === redStonePriceFeedAddress.toLowerCase()
            
            console.log(`${symbol}: ${isConfigured ? '✅ Using RedStone' : '❌ Not using RedStone'} (${priceFeedAddress})`)
          } catch (error) {
            console.warn(`Could not check price feed for ${symbol}: ${error.message}`)
          }
        }
      } else {
        console.log("GMX Vault address not found in deployment data. Skipping Vault integration check.")
      }
    } catch (error) {
      console.warn("Could not verify GMX Vault integration:", error.message)
    }
    
    console.log("\nRedStone Price Feed Test Complete")
    
  } catch (error) {
    console.error(`Error testing RedStone price feed: ${error.message}`)
    process.exit(1)
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
