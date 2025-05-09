const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying WLD token to local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Deploy WLD token (using FaucetToken for simplicity)
  const FaucetToken = await ethers.getContractFactory("FaucetToken");
  
  // Deploy with 18 decimals
  const initialSupply = ethers.utils.parseUnits("1000000", 18); // 1 million WLD
  const wld = await FaucetToken.deploy("World Token", "WLD", 18, initialSupply);
  
  await wld.deployed();
  console.log(`WLD token deployed at: ${wld.address}`);
  
  // Save deployment info
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  let deploymentData = {};
  if (fs.existsSync(deploymentPath)) {
    const fileContent = fs.readFileSync(deploymentPath, "utf8");
    if (fileContent) {
      deploymentData = JSON.parse(fileContent);
    }
  }
  
  // Save WLD token address
  deploymentData.WLD = wld.address;
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment data saved to", deploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
