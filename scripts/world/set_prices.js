const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Setting Prices in SimplePriceFeed ===\n");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // SimplePriceFeed contract address - our new working one
  const simplePriceFeedAddress = "0x7e402dE1894f3dCed30f9bECBc51aD08F2016095";
  console.log(`SimplePriceFeed: ${simplePriceFeedAddress}`);
  
  // Load custom deployment to get token addresses
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get token addresses
  const tusdAddress = customDeployment.TestDeployment.tokens.TUSD.address;
  const tbtcAddress = customDeployment.TestDeployment.tokens.TBTC.address;
  const tethAddress = customDeployment.TestDeployment.tokens.TETH.address;
  
  // Token prices (in USD with 30 decimals as per GMX standard)
  const tokenPrices = {
    TUSD: ethers.utils.parseUnits("1", 30),         // $1.00
    TBTC: ethers.utils.parseUnits("60000", 30),     // $60,000.00
    TETH: ethers.utils.parseUnits("3000", 30),      // $3,000.00
  };
  
  console.log("\nToken prices to set:");
  console.log(`- TUSD (${tusdAddress}): $${ethers.utils.formatUnits(tokenPrices.TUSD, 30)}`);
  console.log(`- TBTC (${tbtcAddress}): $${ethers.utils.formatUnits(tokenPrices.TBTC, 30)}`);
  console.log(`- TETH (${tethAddress}): $${ethers.utils.formatUnits(tokenPrices.TETH, 30)}`);
  
  // Setup SimplePriceFeed contract interface
  const simplePriceFeedAbi = [
    "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
    "function getPrice(address _token) external view returns (uint256)"
  ];
  
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Set all prices in one transaction
  try {
    console.log("\nSetting prices for all tokens...");
    
    const tokenAddresses = [tusdAddress, tbtcAddress, tethAddress];
    const prices = [tokenPrices.TUSD, tokenPrices.TBTC, tokenPrices.TETH];
    
    const tx = await simplePriceFeed.setPrices(
      tokenAddresses,
      prices,
      { gasPrice: ethers.utils.parseUnits("0.5", "gwei"), gasLimit: 2000000 }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("✅ All prices set successfully");
    
    // Verify prices were set correctly
    console.log("\nVerifying prices:");
    
    // TUSD
    const tusdPrice = await simplePriceFeed.getPrice(tusdAddress);
    console.log(`- TUSD: $${ethers.utils.formatUnits(tusdPrice, 30)} ✅`);
    
    // TBTC
    const tbtcPrice = await simplePriceFeed.getPrice(tbtcAddress);
    console.log(`- TBTC: $${ethers.utils.formatUnits(tbtcPrice, 30)} ✅`);
    
    // TETH
    const tethPrice = await simplePriceFeed.getPrice(tethAddress);
    console.log(`- TETH: $${ethers.utils.formatUnits(tethPrice, 30)} ✅`);
    
  } catch (error) {
    console.error(`Error setting prices: ${error.message}`);
    
    // Try setting prices individually if batch setting fails
    console.log("\nTrying to set prices individually...");
    
    // TUSD
    try {
      console.log("Setting TUSD price...");
      await simplePriceFeed.setPrices(
        [tusdAddress],
        [tokenPrices.TUSD],
        { gasPrice: ethers.utils.parseUnits("0.5", "gwei"), gasLimit: 1000000 }
      );
      console.log("✅ TUSD price set");
    } catch (error) {
      console.error(`Error setting TUSD price: ${error.message}`);
    }
    
    // TBTC
    try {
      console.log("Setting TBTC price...");
      await simplePriceFeed.setPrices(
        [tbtcAddress],
        [tokenPrices.TBTC],
        { gasPrice: ethers.utils.parseUnits("0.5", "gwei"), gasLimit: 1000000 }
      );
      console.log("✅ TBTC price set");
    } catch (error) {
      console.error(`Error setting TBTC price: ${error.message}`);
    }
    
    // TETH
    try {
      console.log("Setting TETH price...");
      await simplePriceFeed.setPrices(
        [tethAddress],
        [tokenPrices.TETH],
        { gasPrice: ethers.utils.parseUnits("0.5", "gwei"), gasLimit: 1000000 }
      );
      console.log("✅ TETH price set");
    } catch (error) {
      console.error(`Error setting TETH price: ${error.message}`);
    }
  }
  
  console.log("\n=== Price Setting Complete ===");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
