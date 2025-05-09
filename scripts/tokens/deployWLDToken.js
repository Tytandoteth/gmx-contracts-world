const { deployContract, sendTxn, writeTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../shared/utilities")

async function main() {
  const addresses = {}
  
  // Deploy WLD token clone with 18 decimals and initial supply of 1 million tokens
  addresses.WLD = (await deployContract("FaucetToken", ["World ID", "WLD", 18, expandDecimals(1000000, 18)])).address
  console.log("WLD token deployed at:", addresses.WLD)
  
  // Enable faucet functionality for easier testing
  const wld = await contractAt("FaucetToken", addresses.WLD)
  await sendTxn(wld.enableFaucet(), "wld.enableFaucet")
  
  // Write addresses to file for future reference
  writeTmpAddresses(addresses)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
