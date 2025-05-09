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
  console.log("Fixing Router configuration on local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get Router instance
  const router = await ethers.getContractAt("Router", deploymentData.Router);
  
  // Get current WETH address in Router
  const currentWeth = await router.weth();
  console.log(`Current WETH address in Router: ${currentWeth}`);
  console.log(`Expected WETH address: ${deploymentData.WETH}`);
  
  // Check if an update is needed
  if (currentWeth.toLowerCase() !== deploymentData.WETH.toLowerCase()) {
    console.log("WETH address in Router needs to be updated");
    
    // We need to check if Router has a function to update the WETH address
    // If not, we might need to redeploy the Router
    
    // Check if Router has the setWeth function
    try {
      // This will throw an error if the function doesn't exist
      if (router.setWeth) {
        console.log("Setting new WETH address in Router...");
        const tx = await router.setWeth(deploymentData.WETH);
        await tx.wait();
        console.log(`Transaction hash: ${tx.hash}`);
        
        // Verify the update
        const newWeth = await router.weth();
        console.log(`New WETH address in Router: ${newWeth}`);
        console.log(`Update successful: ${newWeth.toLowerCase() === deploymentData.WETH.toLowerCase() ? "✅" : "❌"}`);
      } else {
        console.log("Router does not have a setWeth function. Need to redeploy Router.");
        
        // Deploy a new Router with the correct WETH address
        console.log("Deploying new Router...");
        const Router = await ethers.getContractFactory("Router");
        const newRouter = await Router.deploy(deploymentData.Vault, deploymentData.WETH, deploymentData.WLD);
        await newRouter.deployed();
        
        console.log(`New Router deployed at: ${newRouter.address}`);
        
        // Update the deployment data
        deploymentData.Router = newRouter.address;
        const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
        console.log("Deployment data updated with new Router address");
      }
    } catch (error) {
      console.log("Router does not have a setWeth function or there was an error. Need to redeploy Router.");
      
      // Deploy a new Router with the correct WETH address
      console.log("Deploying new Router...");
      console.log(`Using parameters:`);
      console.log(`- Vault: ${deploymentData.Vault}`);
      console.log(`- USDG (WLD): ${deploymentData.WLD}`);
      console.log(`- WETH: ${deploymentData.WETH}`);
      
      const Router = await ethers.getContractFactory("Router");
      const newRouter = await Router.deploy(
        deploymentData.Vault,  // vault
        deploymentData.WLD,    // usdg - using WLD as USDG token
        deploymentData.WETH    // weth - this should be the WETH token
      );
      await newRouter.deployed();
      
      console.log(`New Router deployed at: ${newRouter.address}`);
      
      // Update the deployment data
      deploymentData.Router = newRouter.address;
      const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
      console.log("Deployment data updated with new Router address");
    }
  } else {
    console.log("WETH address in Router is already correct");
  }
  
  console.log("Router configuration fix completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
