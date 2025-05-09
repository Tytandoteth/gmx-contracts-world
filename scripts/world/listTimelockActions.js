const { ethers } = require("hardhat");
const { getDeploymentData, getTimelockActionsData, listPendingActions } = require("./timelockHelpers");

async function main() {
  console.log("Listing Timelock actions for World Chain...");
  
  const [admin] = await ethers.getSigners();
  console.log(`Using admin: ${admin.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  
  // List all pending actions
  await listPendingActions(timelock);
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
