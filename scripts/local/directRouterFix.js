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

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  const existingData = await getDeploymentData();
  const updatedData = { ...existingData, ...data };
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedData, null, 2));
  console.log("Deployment data saved to", deploymentPath);
}

async function main() {
  console.log("Direct fix for Router configuration with detailed debugging...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  console.log("Creating and deploying a simple RouterMock contract for testing...");
  
  // Deploy a simple RouterMock contract with only the basic storage and constructor
  const RouterMockFactory = await ethers.getContractFactory("RouterMock");
  
  try {
    // Deploy the RouterMock
    console.log("Deploying RouterMock...");
    console.log(`Vault: ${deploymentData.Vault}`);
    console.log(`USDG: ${deploymentData.WLD}`);  
    console.log(`WETH: ${deploymentData.WETH}`);
    
    const routerMock = await RouterMockFactory.deploy(
      deploymentData.Vault, 
      deploymentData.WLD, 
      deploymentData.WETH
    );
    await routerMock.deployed();
    console.log(`RouterMock deployed at: ${routerMock.address}`);
    
    // Get the stored values
    const vault = await routerMock.vault();
    const usdg = await routerMock.usdg();
    const weth = await routerMock.weth();
    
    console.log("\nRouterMock Contract State:");
    console.log(`- vault: ${vault}`);
    console.log(`- usdg: ${usdg}`);
    console.log(`- weth: ${weth}`);
    
    // Verify the values
    console.log("\nVerifying values:");
    console.log(`Vault correct: ${vault === deploymentData.Vault}`);
    console.log(`USDG correct: ${usdg === deploymentData.WLD}`);
    console.log(`WETH correct: ${weth === deploymentData.WETH}`);
    
    // Now try to deploy the actual Router contract with extra debug info
    console.log("\nDeploying the actual Router contract...");
    const Router = await ethers.getContractFactory("Router");
    
    const newRouter = await Router.deploy(
      deploymentData.Vault,
      deploymentData.WLD, 
      deploymentData.WETH
    );
    await newRouter.deployed();
    console.log(`New Router deployed at: ${newRouter.address}`);
    
    // Get the stored values from the real router
    const routerVault = await newRouter.vault();
    const routerUsdg = await newRouter.usdg();
    const routerWeth = await newRouter.weth();
    
    console.log("\nReal Router Contract State:");
    console.log(`- vault: ${routerVault}`);
    console.log(`- usdg: ${routerUsdg}`);
    console.log(`- weth: ${routerWeth}`);
    
    // Verify the values
    console.log("\nVerifying values:");
    console.log(`Vault correct: ${routerVault === deploymentData.Vault}`);
    console.log(`USDG correct: ${routerUsdg === deploymentData.WLD}`);
    console.log(`WETH correct: ${routerWeth === deploymentData.WETH}`);
    
    if (routerWeth === deploymentData.WETH) {
      console.log("\nRouter WETH address is now correct! Saving to deployment data.");
      
      // Save the new Router address
      await saveDeploymentData({
        Router: newRouter.address
      });
      
      console.log("Router address updated in deployment data");
    } else {
      console.error("\nError: Router WETH address is still incorrect after deployment.");
    }
  } catch (error) {
    console.error("Error deploying or checking contracts:", error);
  }
}

// Create the RouterMock contract before running main
async function setupMockContract() {
  console.log("Setting up RouterMock contract...");
  
  // Create a simple RouterMock contract
  const routerMockCode = `
// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract RouterMock {
    address public vault;
    address public usdg;
    address public weth;
    address public gov;

    constructor(address _vault, address _usdg, address _weth) public {
        vault = _vault;
        usdg = _usdg;
        weth = _weth;
        gov = msg.sender;
    }
}
`;
  
  const routerMockPath = path.join(__dirname, "../../contracts/mocks/RouterMock.sol");
  
  try {
    // Ensure directory exists
    const dir = path.dirname(routerMockPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the contract file
    fs.writeFileSync(routerMockPath, routerMockCode);
    console.log("RouterMock contract created at:", routerMockPath);
    
    // Compile the contract
    try {
      console.log("Compiling contracts...");
      const { execSync } = require("child_process");
      execSync("npx hardhat compile", { cwd: path.join(__dirname, "../..") });
      console.log("Contracts compiled successfully");
    } catch (error) {
      console.error("Error compiling contracts:", error.message);
      process.exit(1);
    }
    
    // Run the main function
    await main();
  } catch (error) {
    console.error("Error setting up mock contract:", error);
    process.exit(1);
  }
}

// Run the setup function
setupMockContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
