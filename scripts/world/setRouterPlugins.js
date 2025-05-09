const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Setting Router plugins for World Chain deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Deployment data loaded successfully");
  
  // Get Router contract
  const router = await ethers.getContractAt("Router", deploymentData.Router);
  
  // Check governance
  const routerGov = await router.gov();
  console.log(`Router governor: ${routerGov}`);
  
  if (routerGov.toLowerCase() !== deployer.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Router governor!");
    console.warn("Unable to set plugins directly.");
    
    // Check if Timelock is the governor
    if (routerGov.toLowerCase() === deploymentData.Timelock.toLowerCase()) {
      console.log("Timelock is the Router governor. You'll need to create governance actions.");
      // TODO: Implement Timelock action creation for Router plugins
    }
    
    process.exit(1);
  }
  
  // Set OrderBook as a plugin
  console.log(`\nSetting OrderBook (${deploymentData.OrderBook}) as a Router plugin...`);
  const isOrderBookPlugin = await router.plugins(deploymentData.OrderBook);
  
  if (isOrderBookPlugin) {
    console.log("OrderBook is already set as a plugin");
  } else {
    try {
      const tx1 = await router.addPlugin(deploymentData.OrderBook);
      console.log(`Transaction sent: ${tx1.hash}`);
      await tx1.wait();
      console.log("OrderBook successfully added as a Router plugin");
    } catch (error) {
      console.error(`Error adding OrderBook as plugin: ${error.message}`);
    }
  }
  
  // Set PositionRouter as a plugin
  console.log(`\nSetting PositionRouter (${deploymentData.PositionRouter}) as a Router plugin...`);
  const isPositionRouterPlugin = await router.plugins(deploymentData.PositionRouter);
  
  if (isPositionRouterPlugin) {
    console.log("PositionRouter is already set as a plugin");
  } else {
    try {
      const tx2 = await router.addPlugin(deploymentData.PositionRouter);
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log("PositionRouter successfully added as a Router plugin");
    } catch (error) {
      console.error(`Error adding PositionRouter as plugin: ${error.message}`);
    }
  }
  
  console.log("\nRouter plugins configuration completed!");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
