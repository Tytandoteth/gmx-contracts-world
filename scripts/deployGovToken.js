const { deployContract, sendTxn, writeTmpAddresses, readTmpAddresses } = require("./shared/helpers")
const { expandDecimals } = require("./shared/utilities")

async function main() {
  // Read existing addresses
  let addresses = {}
  try {
    addresses = readTmpAddresses()
  } catch (e) {
    console.log("No addresses found, proceeding with fresh deployment")
  }

  // Deploy GMX token
  const gmx = await deployContract("GMX", [])
  addresses.GMX = gmx.address
  
  console.log("GMX token deployed at:", gmx.address)
  
  // Deploy esGMX (Escrowed GMX) token for staking rewards
  const esGmx = await deployContract("EsGMX", [])
  addresses.EsGMX = esGmx.address
  
  console.log("EsGMX token deployed at:", esGmx.address)
  
  // Set addresses for initial mint
  let recipient = process.env.RECIPIENT_ADDRESS
  if (!recipient) {
    recipient = process.env.DEPLOYER_ADDRESS
  }
  
  if (!recipient) {
    console.warn("No recipient address specified, using deployer address")
    const [deployer] = await ethers.getSigners()
    recipient = deployer.address
  }
  
  // Mint initial tokens to multisig or vesting contract
  if (recipient) {
    console.log(`Minting tokens to ${recipient}`)
    
    // Mint initial supply - 10 million tokens with 18 decimals
    const initialSupply = expandDecimals(10000000, 18)
    await sendTxn(gmx.mint(recipient, initialSupply), "gmx.mint")
    
    console.log(`Minted ${ethers.utils.formatUnits(initialSupply, 18)} GMX to ${recipient}`)
  }
  
  // Save addresses
  writeTmpAddresses(addresses)
  
  console.log("\nDeployment Summary:")
  console.log("-------------------")
  console.log(`GMX token: ${addresses.GMX}`)
  console.log(`EsGMX token: ${addresses.EsGMX}`)
  console.log("\nNext steps:")
  console.log("1. Set up staking and reward distribution if needed")
  console.log("2. Update frontend config with token addresses")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
