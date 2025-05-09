const { deployContract, contractAt, sendTxn, writeTmpAddresses, readTmpAddresses } = require("./shared/helpers")
const { expandDecimals } = require("./shared/utilities")

async function main() {
  // If WLD token was already deployed, read its address
  let addresses = {}
  try {
    addresses = readTmpAddresses()
  } catch (e) {
    console.log("No addresses found, proceeding with fresh deployment")
  }

  const WLD_TOKEN = addresses.WLD
  if (!WLD_TOKEN) {
    throw new Error("WLD token address not found. Please deploy WLD token first using scripts/tokens/deployWLDToken.js")
  }

  console.log("Using WLD token:", WLD_TOKEN)
  
  // Deploy Vault
  const vault = await deployContract("Vault", [])
  
  // Deploy tokens for pricing
  const weth = await deployContract("Token", ["Wrapped Ethereum", "WETH", 18])
  const usdc = await deployContract("Token", ["USD Coin", "USDC", 6])
  
  // Deploy price feed for vault
  const priceFeed = await deployContract("VaultPriceFeed", [])
  
  // Deploy Router
  const router = await deployContract("Router", [vault.address, WLD_TOKEN, weth.address])
  
  // Deploy VaultUtils
  const vaultUtils = await deployContract("VaultUtils", [vault.address])
  
  // Deploy GlpManager (use WLD token as the GLP token)
  const glpManager = await deployContract("GlpManager", [vault.address, WLD_TOKEN, 24 * 60 * 60])
  
  // Initialize Vault
  await sendTxn(
    vault.initialize(
      router.address, // router
      WLD_TOKEN, // usdg (using WLD as the stable token)
      vaultUtils.address, // vaultUtils
      priceFeed.address, // priceFeed
      glpManager.address, // liquidityManager
      expandDecimals(5, 30), // maxUsdgAmount - 5 billion
    ),
    "vault.initialize"
  )
  
  // Deploy ShortsTracker
  const shortsTracker = await deployContract("ShortsTracker", [vault.address])
  
  // Deploy PositionRouter
  const positionRouter = await deployContract(
    "PositionRouter", 
    [vault.address, router.address, weth.address, shortsTracker.address, 30, expandDecimals(1, 30)]
  )
  
  // Deploy PositionManager
  const positionManager = await deployContract(
    "PositionManager",
    [vault.address, router.address, shortsTracker.address, weth.address, 30, expandDecimals(1, 30)]
  )
  
  // Deploy OrderBook
  const orderBook = await deployContract("OrderBook", [])
  
  // Update deployment addresses
  addresses.Vault = vault.address
  addresses.Router = router.address
  addresses.VaultUtils = vaultUtils.address
  addresses.GlpManager = glpManager.address
  addresses.ShortsTracker = shortsTracker.address
  addresses.PositionRouter = positionRouter.address
  addresses.PositionManager = positionManager.address
  addresses.OrderBook = orderBook.address
  
  writeTmpAddresses(addresses)
  console.log("Core contracts deployment complete. Addresses saved.")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
