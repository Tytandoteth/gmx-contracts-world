const { deployContract, contractAt, sendTxn, getFrameSigner } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

async function main() {
  const signer = await getFrameSigner()
  
  console.log("Deployer address:", await signer.getAddress())
  
  // Deploy RedStonePriceFeed
  console.log("Deploying RedStonePriceFeed...")
  const redStonePriceFeed = await deployContract("RedStonePriceFeed", [])
  
  // Define token configurations
  const tokenConfigs = [
    { symbol: "WLD", decimals: 18 },
    { symbol: "ETH", decimals: 18 },
    { symbol: "BTC", decimals: 8 },
    { symbol: "USDC", decimals: 6 },
    { symbol: "USDT", decimals: 6 }
  ]
  
  // Configure token decimals
  console.log("Configuring token decimals...")
  for (const token of tokenConfigs) {
    console.log(`Setting decimals for ${token.symbol} to ${token.decimals}`)
    await sendTxn(
      redStonePriceFeed.setTokenDecimals(token.symbol, token.decimals),
      `RedStonePriceFeed.setTokenDecimals(${token.symbol}, ${token.decimals})`
    )
  }
  
  console.log("RedStonePriceFeed deployment and configuration complete")
  console.log("RedStonePriceFeed address:", redStonePriceFeed.address)
  
  // Save the deployment addresses to a file for easy access
  const fs = require('fs')
  const deploymentData = {
    redStonePriceFeed: redStonePriceFeed.address
  }
  
  fs.writeFileSync(
    '.world-redstone-deployment.json',
    JSON.stringify(deploymentData, null, 2)
  )
  
  console.log("Deployment addresses saved to .world-redstone-deployment.json")
  
  return {
    redStonePriceFeed: redStonePriceFeed.address
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
