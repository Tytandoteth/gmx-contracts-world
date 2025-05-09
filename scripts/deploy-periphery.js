const { deployContract, contractAt, sendTxn, readTmpAddresses, writeTmpAddresses } = require("./shared/helpers")
const { expandDecimals } = require("./shared/utilities")

async function main() {
  // Read deployed contract addresses
  let addresses
  try {
    addresses = readTmpAddresses()
  } catch (e) {
    console.error("No addresses found. Please deploy core contracts first using scripts/deploy-core.js")
    process.exit(1)
  }

  // Check if core contracts are deployed
  const { Vault, Router, PositionRouter, PositionManager, OrderBook } = addresses
  if (!Vault || !Router || !PositionRouter || !PositionManager || !OrderBook) {
    console.error("Core contracts not found. Please deploy core contracts first.")
    process.exit(1)
  }

  console.log("Deploying periphery contracts...")
  
  // Deploy VaultReader
  const vaultReader = await deployContract("VaultReader", [])
  addresses.VaultReader = vaultReader.address
  
  // Deploy ReaderV2
  const reader = await deployContract("ReaderV2", [])
  addresses.Reader = reader.address
  
  // Deploy OrderBookReader
  const orderBookReader = await deployContract("OrderBookReader", [])
  addresses.OrderBookReader = orderBookReader.address
  
  // Deploy PositionRouterReader
  const positionRouterReader = await deployContract("PositionRouterReader", [])
  addresses.PositionRouterReader = positionRouterReader.address
  
  // For Redstone Oracle integration
  try {
    // Import and setup Redstone Oracle if available
    const { setupRedstoneOracle } = require("@redstone-finance/sdk")
    console.log("Setting up Redstone Oracle integration...")
    
    // This is a placeholder. The actual implementation would depend on Redstone's SDK specifics
    // and World Chain's oracle requirements
    await setupRedstoneOracle({
      // Configuration parameters would go here
      networkId: 12345, // World Chain ID
      // Additional Redstone-specific configuration
    })
    
    console.log("Redstone Oracle integration complete")
  } catch (error) {
    console.log("Redstone Oracle integration skipped or failed:", error.message)
    console.log("You may need to configure oracle feeds manually")
  }
  
  // Deploy Timelock for governance
  const timelock = await deployContract(
    "Timelock", 
    [
      addresses.admin || addresses.deployer || process.env.DEPLOYER_ADDRESS, // admin
      60 * 60 * 24, // buffer - 24 hours
      addresses.tokenManager || "0x0000000000000000000000000000000000000000", // tokenManager
      addresses.mintReceiver || "0x0000000000000000000000000000000000000000", // mintReceiver
      addresses.glpManager || "0x0000000000000000000000000000000000000000", // glpManager
    ]
  )
  addresses.Timelock = timelock.address
  
  // Save all addresses
  writeTmpAddresses(addresses)
  console.log("Periphery contracts deployed and addresses saved")
  
  console.log("\nDeployment Summary:")
  console.log("-------------------")
  console.log(`VaultReader: ${addresses.VaultReader}`)
  console.log(`Reader: ${addresses.Reader}`)
  console.log(`OrderBookReader: ${addresses.OrderBookReader}`)
  console.log(`PositionRouterReader: ${addresses.PositionRouterReader}`)
  console.log(`Timelock: ${addresses.Timelock}`)
  console.log("\nNext steps:")
  console.log("1. Configure oracle feeds in periphery/config/oracles.js")
  console.log("2. Deploy GovToken (GMX) using scripts/deployGovToken.js if needed")
  console.log("3. Update frontend config with the deployed contract addresses")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
