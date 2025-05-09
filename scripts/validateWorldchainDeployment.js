const { contractAt, readTmpAddresses } = require("./shared/helpers")

async function main() {
  console.log("Validating World Chain deployment...")
  
  // Read deployed contract addresses
  let addresses
  try {
    addresses = readTmpAddresses()
  } catch (e) {
    console.error("No addresses found. Please deploy contracts first.")
    process.exit(1)
  }

  // Check required contracts
  const requiredContracts = [
    "WLD",
    "Vault",
    "Router",
    "VaultUtils",
    "GlpManager",
    "PositionRouter",
    "PositionManager",
    "OrderBook"
  ]
  
  const missingContracts = []
  for (const contract of requiredContracts) {
    if (!addresses[contract]) {
      missingContracts.push(contract)
    }
  }
  
  if (missingContracts.length > 0) {
    console.error(`Missing required contracts: ${missingContracts.join(", ")}`)
    console.error("Please complete the deployment before validation.")
    process.exit(1)
  }
  
  console.log("All required contracts found. Validating configuration...")
  
  // Validate Vault configuration
  const vault = await contractAt("Vault", addresses.Vault)
  
  console.log("\nVault Configuration:")
  console.log("--------------------")
  const wld = await contractAt("FaucetToken", addresses.WLD)
  const wldSymbol = await wld.symbol()
  console.log(`WLD Token: ${addresses.WLD} (${wldSymbol})`)
  
  const vaultTokenCount = await vault.allWhitelistedTokensLength()
  console.log(`Whitelisted tokens: ${vaultTokenCount}`)
  
  // Validate Redstone Oracle integration if possible
  try {
    const priceFeed = await contractAt("VaultPriceFeed", await vault.priceFeed())
    console.log("\nPrice Feed Configuration:")
    console.log("-----------------------")
    console.log(`Price Feed: ${priceFeed.address}`)
    
    // Test WLD price - this will only work if oracles are configured
    try {
      const wldPrice = await priceFeed.getPrice(addresses.WLD, false, true, false)
      console.log(`WLD Price: $${ethers.utils.formatUnits(wldPrice, 30)}`)
      console.log("✓ Oracle price feed is functioning")
    } catch (error) {
      console.log("✗ Oracle price feed is not configured or not functioning")
      console.log("  Error:", error.message)
    }
  } catch (error) {
    console.log("✗ Error accessing price feed:", error.message)
  }
  
  // Validate governance token if deployed
  if (addresses.GMX) {
    try {
      const gmx = await contractAt("GMX", addresses.GMX)
      const gmxSymbol = await gmx.symbol()
      const gmxTotalSupply = await gmx.totalSupply()
      
      console.log("\nGovernance Token:")
      console.log("-----------------")
      console.log(`GMX Token: ${addresses.GMX} (${gmxSymbol})`)
      console.log(`Total Supply: ${ethers.utils.formatUnits(gmxTotalSupply, 18)} ${gmxSymbol}`)
    } catch (error) {
      console.log("✗ Error accessing GMX token:", error.message)
    }
  } else {
    console.log("\nGovernance Token: Not deployed")
  }
  
  console.log("\nDeployment Validation Complete")
  console.log("-----------------------------")
  console.log("Next steps:")
  console.log("1. Configure oracle price feeds if not already done")
  console.log("2. Set up frontend with the deployed contract addresses")
  console.log("3. Test trading functionality")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
