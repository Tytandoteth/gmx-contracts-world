const { deployContract, contractAt, sendTxn, getFrameSigner } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const fs = require('fs')

async function main() {
  const signer = await getFrameSigner()
  
  console.log("Configurer address:", await signer.getAddress())
  
  // Load deployment data
  let redStonePriceFeedAddress
  
  try {
    const deploymentData = JSON.parse(fs.readFileSync('.world-redstone-deployment.json'))
    redStonePriceFeedAddress = deploymentData.redStonePriceFeed
    console.log("Loaded RedStonePriceFeed address:", redStonePriceFeedAddress)
  } catch (error) {
    console.error("Error loading deployment data:", error)
    console.log("Please run deployRedStoneFeed.js first to deploy the price feed contract")
    process.exit(1)
  }
  
  // Load the GMX Vault contract
  // This requires that the GMX Vault is already deployed on World Chain
  console.log("Loading World deployment data...")
  let vaultAddress
  
  try {
    const worldDeployment = JSON.parse(fs.readFileSync('.world-deployment.json'))
    vaultAddress = worldDeployment.vault
    console.log("GMX Vault address:", vaultAddress)
  } catch (error) {
    console.error("Error loading World deployment data:", error)
    console.log("Please ensure GMX core contracts are deployed on World Chain")
    process.exit(1)
  }
  
  if (!vaultAddress) {
    console.error("Vault address not found in deployment data")
    process.exit(1)
  }
  
  const vault = await contractAt("Vault", vaultAddress)
  
  // Define token configurations
  const tokenConfigs = [
    { symbol: "WLD", tokenAddress: "0x163f8c2467924be0ae7b5347228cabf260318753" },
    { symbol: "ETH", tokenAddress: "0x47c031236e19d024b42f8AE6780E44A573170702" },
    { symbol: "BTC", tokenAddress: "0x6853EA96FF216fAb11D2d930CE3C508556A4bdc3" },
    { symbol: "USDC", tokenAddress: "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C8" },
    { symbol: "USDT", tokenAddress: "0xE6D222caAB2842D70F9CE058C9316B5C936E2949" }
  ]
  
  // Set price feeds for each token
  console.log("Configuring price feeds in GMX Vault...")
  for (const token of tokenConfigs) {
    console.log(`Setting price feed for ${token.symbol} (${token.tokenAddress}) to RedStonePriceFeed`)
    await sendTxn(
      vault.setPriceFeed(token.tokenAddress, redStonePriceFeedAddress),
      `Vault.setPriceFeed(${token.symbol}, RedStonePriceFeed)`
    )
  }
  
  console.log("Price feed configuration complete")
  
  // Save the configuration details
  const configData = {
    vaultAddress,
    redStonePriceFeedAddress,
    tokens: tokenConfigs.reduce((acc, token) => {
      acc[token.symbol] = {
        address: token.tokenAddress,
        priceFeed: redStonePriceFeedAddress
      }
      return acc
    }, {})
  }
  
  fs.writeFileSync(
    '.world-redstone-config.json',
    JSON.stringify(configData, null, 2)
  )
  
  console.log("Configuration details saved to .world-redstone-config.json")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
