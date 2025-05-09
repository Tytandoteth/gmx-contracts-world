const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found. Please deploy contracts first.");
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(deploymentPath, "utf8");
  if (!fileContent) {
    console.error("Deployment data is empty. Please deploy contracts first.");
    process.exit(1);
  }
  
  return JSON.parse(fileContent);
}

async function main() {
  console.log("Checking Router configuration...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get Router instance
  const router = await ethers.getContractAt("Router", deploymentData.Router);
  
  // Get current WETH address in Router
  const wethInRouter = await router.weth();
  
  console.log(`Router address: ${deploymentData.Router}`);
  console.log(`WETH address in Router: ${wethInRouter}`);
  console.log(`Expected WETH address: ${deploymentData.WETH}`);
  console.log(`WETH address is correct: ${wethInRouter.toLowerCase() === deploymentData.WETH.toLowerCase()}`);
  
  // Check other Router settings
  const vault = await router.vault();
  console.log(`Vault address in Router: ${vault}`);
  console.log(`Expected Vault address: ${deploymentData.Vault}`);
  console.log(`Vault address is correct: ${vault.toLowerCase() === deploymentData.Vault.toLowerCase()}`);
  
  console.log("Router check completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
