const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Executing Timelock governance actions for World Chain...");
  
  const [admin] = await ethers.getSigners();
  console.log(`Using admin: ${admin.address}`);
  
  // Get deployment data
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  
  // Get the current timelock admin
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== admin.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to execute actions.");
    process.exit(1);
  }
  
  // Get contract instances
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Create interfaces for encoding
  const vaultInterface = new ethers.utils.Interface([
    "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external",
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
  ]);
  
  const vaultPriceFeedInterface = new ethers.utils.Interface([
    "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
  ]);
  
  // Get current Vault values for re-initialization
  const usdg = await vault.usdg();
  const priceFeed = await vault.priceFeed();
  const liquidationFeeUsd = await vault.liquidationFeeUsd();
  const fundingRateFactor = await vault.fundingRateFactor();
  const stableFundingRateFactor = await vault.stableFundingRateFactor();
  
  // Define all governance actions
  const actions = [
    {
      name: "Set Router in Vault",
      id: "setRouter",
      target: vault.address,
      data: vaultInterface.encodeFunctionData("initialize", [
        deploymentData.Router,
        usdg,
        priceFeed,
        liquidationFeeUsd,
        fundingRateFactor,
        stableFundingRateFactor
      ])
    },
    {
      name: "Set WLD Price Feed",
      id: "setWLDPriceFeed",
      target: vaultPriceFeed.address,
      data: vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      ])
    },
    {
      name: "Set WWORLD Price Feed",
      id: "setWWORLDPriceFeed",
      target: vaultPriceFeed.address,
      data: vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      ])
    },
    {
      name: "Whitelist WLD Token",
      id: "whitelistWLD",
      target: vault.address,
      data: vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      ])
    },
    {
      name: "Whitelist WWORLD Token",
      id: "whitelistWWORLD",
      target: vault.address,
      data: vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      ])
    }
  ];
  
  const now = Math.floor(Date.now() / 1000);
  let executed = 0;
  let stillPending = 0;
  let notFound = 0;
  
  console.log("\nChecking and executing actions...");
  
  for (const action of actions) {
    // Create unique action identifier
    const actionId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "bytes"],
        [action.id, action.target, action.data]
      )
    );
    
    console.log(`\nChecking action: ${action.name}...`);
    
    try {
      // Check if action exists and if it's executable
      const timestamp = await timelock.pendingActions(actionId);
      
      if (timestamp.isZero()) {
        console.log(`Action not found or already executed`);
        notFound++;
        continue;
      }
      
      if (timestamp.gt(now)) {
        const waitTimeSeconds = timestamp.toNumber() - now;
        const hours = Math.floor(waitTimeSeconds / 3600);
        const minutes = Math.floor((waitTimeSeconds % 3600) / 60);
        const seconds = waitTimeSeconds % 60;
        
        console.log(`Action is not yet executable`);
        console.log(`Wait time remaining: ${hours}h ${minutes}m ${seconds}s`);
        console.log(`Will be executable after: ${new Date(timestamp.toNumber() * 1000).toISOString()}`);
        stillPending++;
        continue;
      }
      
      // Action is executable, proceed
      console.log(`Action is executable, executing now...`);
      const tx = await timelock.executeAction(
        action.target,
        0, // value
        action.data,
        actionId
      );
      
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Action executed successfully!`);
      executed++;
    } catch (error) {
      console.error(`Error processing action: ${error.message}`);
    }
  }
  
  // Summary
  console.log("\n=== Execution Summary ===");
  console.log(`Executed: ${executed} actions`);
  console.log(`Still pending: ${stillPending} actions`);
  console.log(`Not found or already executed: ${notFound} actions`);
  
  if (stillPending > 0) {
    console.log("\nRun this script again after the pending actions become executable.");
  } else if (executed === 0 && stillPending === 0) {
    if (notFound === actions.length) {
      console.log("\nAll actions have already been executed or were never created.");
      console.log("Run validateDeploymentWorld.js to verify the deployment.");
    } else {
      console.log("\nNo actions were executed. Check if they were properly created.");
      console.log("Run createGovernanceActions.js to create the necessary actions.");
    }
  } else if (executed > 0) {
    console.log("\nSome actions were executed successfully!");
    if (executed + notFound === actions.length) {
      console.log("All available actions have been executed.");
      console.log("Run validateDeploymentWorld.js to verify the deployment.");
    } else {
      console.log("Run this script again later to execute the remaining pending actions.");
    }
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
