const { contractAt, sendTxn, readTmpAddresses } = require("./shared/helpers")
const { configureAllRedstoneOracles } = require("./helpers/redstoneOracleHelper")

async function main() {
  console.log("Configuring oracles for World Chain...")
  
  // Read deployed contract addresses
  let addresses
  try {
    addresses = readTmpAddresses()
  } catch (e) {
    console.error("No addresses found. Please deploy contracts first.")
    process.exit(1)
  }

  // Check if Vault is deployed
  if (!addresses.Vault) {
    console.error("Vault not found. Please deploy core contracts first.")
    process.exit(1)
  }
  
  // Get Vault and price feed
  const vault = await contractAt("Vault", addresses.Vault)
  const priceFeedAddress = await vault.priceFeed()
  console.log(`Using price feed at ${priceFeedAddress}`)
  
  // Configure all oracles from periphery/config/oracles.js
  await configureAllRedstoneOracles(priceFeedAddress)
  
  console.log("\nOracle Configuration Complete")
  console.log("-------------------------")
  console.log("Next steps:")
  console.log("1. Validate oracle configuration with scripts/validateWorldchainDeployment.js")
  console.log("2. Test trading functionality")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
