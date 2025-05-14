const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get custom deployment data
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Contract addresses
  const simplePriceFeedAddress = customData.SimplePriceFeed;
  console.log("SimplePriceFeed address:", simplePriceFeedAddress);
  
  // Tokens
  const tusdAddress = customData.TestDeployment.tokens.TUSD.address;
  console.log("TUSD address:", tusdAddress);
  
  // Connect signer
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  // Get balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  // Minimal ABI for SimplePriceFeed
  const simplePriceFeedAbi = ["function setPrice(address _token, uint256 _price) external"];
  
  // Connect to contract
  const simplePriceFeed = new ethers.Contract(
    simplePriceFeedAddress,
    simplePriceFeedAbi,
    deployer
  );
  
  // Prepare price (WLD price with 30 decimals)
  const wldPrice = 1.30;
  const priceWithDecimals = ethers.utils.parseUnits(wldPrice.toString(), 30);
  
  // Override options with VERY low gas values
  const options = {
    gasPrice: ethers.utils.parseUnits("0.5", "gwei"), // Use a very low gas price
    gasLimit: 1000000                                // Lower gas limit
  };
  
  console.log("Transaction options:", {
    gasPrice: ethers.utils.formatUnits(options.gasPrice, "gwei") + " gwei",
    gasLimit: options.gasLimit.toString()
  });
  
  console.log(`Setting price for TUSD to ${wldPrice} USD...`);
  
  try {
    // Send transaction with lower gas values
    const tx = await simplePriceFeed.setPrice(tusdAddress, priceWithDecimals, options);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for transaction confirmation...");
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("✅ Price set successfully!");
  } catch (error) {
    console.error("❌ Transaction failed:", error.message);
    
    // Extract and display any revert reason
    if (error.data) {
      try {
        const reason = ethers.utils.toUtf8String(error.data);
        console.error("Revert reason:", reason);
      } catch (decodeError) {
        console.error("Could not decode revert reason");
      }
    }
    
    // Check if contract is valid
    try {
      const code = await ethers.provider.getCode(simplePriceFeedAddress);
      if (code === '0x') {
        console.error("⚠️ Contract does not exist at address:", simplePriceFeedAddress);
      } else {
        console.log("✅ Contract exists at address:", simplePriceFeedAddress);
      }
    } catch (codeError) {
      console.error("Error checking contract code:", codeError.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
