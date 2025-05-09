const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Function to get deployment data
async function getDeploymentData() {
  const deploymentPath = path.join(__dirname, "../../.world-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment data not found at", deploymentPath);
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

// Create governance actions
async function createActions() {
  console.log("Creating governance actions for World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to create governance actions.");
    process.exit(1);
  }
  
  // 1. Signal set price feed for the Vault
  console.log("\n1. Signaling to set price feed for the Vault...");
  try {
    const tx1 = await timelock.signalSetPriceFeed(
      deploymentData.Vault, 
      deploymentData.VaultPriceFeed
    );
    console.log(`Transaction sent: ${tx1.hash}`);
    await tx1.wait();
    console.log("Price feed signal action created successfully");
  } catch (error) {
    console.error(`Error creating price feed signal: ${error.message}`);
  }
  
  // 2. Signal to whitelist WLD token
  console.log("\n2. Creating direct whitelist action for WLD token...");
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  
  // Check if the vault is already initialized with tokens
  const isWldWhitelisted = await vault.whitelistedTokens(deploymentData.WLD);
  
  if (isWldWhitelisted) {
    console.log("WLD token is already whitelisted in the vault");
  } else {
    // Verify that we're the governor or we need to go through timelock
    const vaultGov = await vault.gov();
    console.log(`Vault governor: ${vaultGov}`);
    
    if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("Deployer is vault governor, whitelisting WLD directly...");
      try {
        const tx2 = await vault.setTokenConfig(
          deploymentData.WLD,
          18, // decimals
          10000, // weight
          0, // minProfitBps
          ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
          true, // isStable
          false // isShortable
        );
        console.log(`Transaction sent: ${tx2.hash}`);
        await tx2.wait();
        console.log("WLD token whitelisted successfully");
      } catch (error) {
        console.error(`Error whitelisting WLD token: ${error.message}`);
      }
    } else if (vaultGov.toLowerCase() === timelock.address.toLowerCase()) {
      console.log("Vault governor is the timelock, creating custom action...");
      // We need to encode the function call and use a generic signal action
      const vaultInterface = new ethers.utils.Interface([
        "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
      ]);
      
      const encodedCall = vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      ]);
      
      // Create a custom action key
      const actionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["string", "address", "address"],
          ["whitelistWLD", vault.address, deploymentData.WLD]
        )
      );
      
      try {
        // For custom function calls, we need to create a special handler
        // Use signalApprove as a template but modify the function call
        console.log("Creating custom action for whitelisting WLD...");
        const pendingActionKey = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [actionKey, deploymentData.WLD]
          )
        );
        
        // Store the action data
        fs.writeFileSync(
          path.join(__dirname, "../../.world-wld-whitelist-action.json"),
          JSON.stringify({
            key: pendingActionKey.toString(),
            target: vault.address,
            data: encodedCall,
            description: "Whitelist WLD Token"
          }, null, 2)
        );
        
        console.log("Custom action data saved. You'll need to execute this through a direct call to the Vault after the buffer period.");
      } catch (error) {
        console.error(`Error creating WLD custom action: ${error.message}`);
      }
    }
  }
  
  // 3. Signal to whitelist WWORLD token  
  console.log("\n3. Creating direct whitelist action for WWORLD token...");
  
  // Check if the vault is already initialized with tokens
  const isWworldWhitelisted = await vault.whitelistedTokens(deploymentData.WWORLD);
  
  if (isWworldWhitelisted) {
    console.log("WWORLD token is already whitelisted in the vault");
  } else {
    // Verify that we're the governor or we need to go through timelock
    const vaultGov = await vault.gov();
    
    if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("Deployer is vault governor, whitelisting WWORLD directly...");
      try {
        const tx3 = await vault.setTokenConfig(
          deploymentData.WWORLD,
          18, // decimals
          10000, // weight
          0, // minProfitBps
          ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
          false, // isStable
          true // isShortable
        );
        console.log(`Transaction sent: ${tx3.hash}`);
        await tx3.wait();
        console.log("WWORLD token whitelisted successfully");
      } catch (error) {
        console.error(`Error whitelisting WWORLD token: ${error.message}`);
      }
    } else if (vaultGov.toLowerCase() === timelock.address.toLowerCase()) {
      console.log("Vault governor is the timelock, creating custom action...");
      // We need to encode the function call and use a generic signal action
      const vaultInterface = new ethers.utils.Interface([
        "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
      ]);
      
      const encodedCall = vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      ]);
      
      // Create a custom action key
      const actionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["string", "address", "address"],
          ["whitelistWWORLD", vault.address, deploymentData.WWORLD]
        )
      );
      
      try {
        // For custom function calls, we need to create a special handler
        // Use signalApprove as a template but modify the function call
        console.log("Creating custom action for whitelisting WWORLD...");
        const pendingActionKey = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [actionKey, deploymentData.WWORLD]
          )
        );
        
        // Store the action data
        fs.writeFileSync(
          path.join(__dirname, "../../.world-wworld-whitelist-action.json"),
          JSON.stringify({
            key: pendingActionKey.toString(),
            target: vault.address,
            data: encodedCall,
            description: "Whitelist WWORLD Token"
          }, null, 2)
        );
        
        console.log("Custom action data saved. You'll need to execute this through a direct call to the Vault after the buffer period.");
      } catch (error) {
        console.error(`Error creating WWORLD custom action: ${error.message}`);
      }
    }
  }
  
  // 4. Create price feed configurations
  console.log("\n4. Setting up price feeds in VaultPriceFeed...");
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Check if we're allowed to configure directly or need timelock
  const priceFeedGov = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governor: ${priceFeedGov}`);
  
  if (priceFeedGov.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("Deployer is VaultPriceFeed governor, setting price feeds directly...");
    
    // WLD price feed
    console.log("Setting WLD price feed...");
    try {
      const tx4 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      );
      console.log(`Transaction sent: ${tx4.hash}`);
      await tx4.wait();
      console.log("WLD price feed set successfully");
    } catch (error) {
      console.error(`Error setting WLD price feed: ${error.message}`);
    }
    
    // WWORLD price feed
    console.log("\nSetting WWORLD price feed...");
    try {
      const tx5 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      );
      console.log(`Transaction sent: ${tx5.hash}`);
      await tx5.wait();
      console.log("WWORLD price feed set successfully");
    } catch (error) {
      console.error(`Error setting WWORLD price feed: ${error.message}`);
    }
  } else if (priceFeedGov.toLowerCase() === timelock.address.toLowerCase()) {
    console.log("VaultPriceFeed governor is the timelock, creating custom actions...");
    
    // WLD price feed custom action
    const vaultPriceFeedInterface = new ethers.utils.Interface([
      "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
    ]);
    
    const wldPriceFeedCall = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
      deploymentData.WLD,
      deploymentData.MockPriceFeeds.WLD,
      8, // decimals
      true // isStable
    ]);
    
    const wldPriceFeedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setWLDPriceFeed", vaultPriceFeed.address, deploymentData.WLD]
      )
    );
    
    try {
      console.log("Creating custom action for WLD price feed...");
      const wldPendingActionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "address"],
          [wldPriceFeedKey, deploymentData.WLD]
        )
      );
      
      // Store the action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wld-pricefeed-action.json"),
        JSON.stringify({
          key: wldPendingActionKey.toString(),
          target: vaultPriceFeed.address,
          data: wldPriceFeedCall,
          description: "Set WLD Price Feed"
        }, null, 2)
      );
      
      console.log("WLD price feed custom action data saved.");
    } catch (error) {
      console.error(`Error creating WLD price feed custom action: ${error.message}`);
    }
    
    // WWORLD price feed custom action
    const wworldPriceFeedCall = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
      deploymentData.WWORLD,
      deploymentData.MockPriceFeeds.WWORLD,
      8, // decimals
      false // isStable
    ]);
    
    const wworldPriceFeedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setWWORLDPriceFeed", vaultPriceFeed.address, deploymentData.WWORLD]
      )
    );
    
    try {
      console.log("Creating custom action for WWORLD price feed...");
      const wworldPendingActionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "address"],
          [wworldPriceFeedKey, deploymentData.WWORLD]
        )
      );
      
      // Store the action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wworld-pricefeed-action.json"),
        JSON.stringify({
          key: wworldPendingActionKey.toString(),
          target: vaultPriceFeed.address,
          data: wworldPriceFeedCall,
          description: "Set WWORLD Price Feed"
        }, null, 2)
      );
      
      console.log("WWORLD price feed custom action data saved.");
    } catch (error) {
      console.error(`Error creating WWORLD price feed custom action: ${error.message}`);
    }
  }
  
  // 5. Check Router in Vault
  console.log("\n5. Checking Router in Vault...");
  try {
    const currentRouter = await vault.router();
    if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      console.log(`✅ Router correctly set in Vault: ${currentRouter}`);
    } else {
      console.log(`❌ Router mismatch! Current: ${currentRouter}, Expected: ${deploymentData.Router}`);
      
      // Check if we're the governor
      const vaultGov = await vault.gov();
      if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("Deployer is Vault governor, attempting to update router directly...");
        // Check if there's a setRouter function
        try {
          // Try to reinitialize with the correct router
          const usdg = await vault.usdg();
          const priceFeed = await vault.priceFeed();
          const liquidationFeeUsd = await vault.liquidationFeeUsd();
          const fundingRateFactor = await vault.fundingRateFactor();
          const stableFundingRateFactor = await vault.stableFundingRateFactor();
          
          const tx6 = await vault.initialize(
            deploymentData.Router,
            usdg,
            priceFeed,
            liquidationFeeUsd,
            fundingRateFactor,
            stableFundingRateFactor
          );
          
          console.log(`Transaction sent: ${tx6.hash}`);
          await tx6.wait();
          console.log("Router updated successfully in Vault");
        } catch (error) {
          console.error(`Error updating router: ${error.message}`);
          console.log("You may need to manually update the Router in the Vault");
        }
      } else {
        console.log("Vault governor is not the deployer, cannot update router directly");
        console.log("You may need to create a custom governance action to update the Router");
      }
    }
  } catch (error) {
    console.error(`Error checking Router: ${error.message}`);
  }
  
  console.log("\nGovernance actions have been processed!");
  console.log("If any actions were signaled through the Timelock, wait for the buffer period before executing them.");
  console.log("If any custom actions were created, you'll need to execute them manually after the buffer period.");
}

// Execute pending governance actions
async function executeActions() {
  console.log("Executing pending governance actions for World Chain...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get timelock contract
  const timelock = await ethers.getContractAt("Timelock", deploymentData.Timelock);
  const timelockAdmin = await timelock.admin();
  console.log(`Timelock admin: ${timelockAdmin}`);
  
  if (timelockAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.warn("WARNING: Your account is not the Timelock admin!");
    console.warn("You won't be able to execute governance actions.");
    process.exit(1);
  }
  
  // 1. Execute Vault Price Feed action if it was signaled
  console.log("\n1. Executing Vault Price Feed action...");
  try {
    // Generate the action hash that was created with signalSetPriceFeed
    const priceFeedAction = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["string", "address", "address"],
        ["setPriceFeed", deploymentData.Vault, deploymentData.VaultPriceFeed]
      )
    );
    
    const priceFeedTimestamp = await timelock.pendingActions(priceFeedAction);
    const now = Math.floor(Date.now() / 1000);
    
    if (priceFeedTimestamp.isZero()) {
      console.log("Vault Price Feed action not found or already executed");
    } else if (priceFeedTimestamp.gt(now)) {
      const waitTime = priceFeedTimestamp.sub(now).toNumber();
      const hours = Math.floor(waitTime / 3600);
      const minutes = Math.floor((waitTime % 3600) / 60);
      console.log(`Vault Price Feed action not yet executable. Wait time: ${hours}h ${minutes}m`);
    } else {
      // Action is executable
      const tx1 = await timelock.setPriceFeed(
        deploymentData.Vault,
        deploymentData.VaultPriceFeed
      );
      console.log(`Transaction sent: ${tx1.hash}`);
      await tx1.wait();
      console.log("Vault Price Feed action executed successfully");
    }
  } catch (error) {
    console.error(`Error executing Vault Price Feed action: ${error.message}`);
  }
  
  // 2. Execute custom token whitelist actions if they were created
  console.log("\n2. Executing custom token whitelist actions...");
  
  // WLD whitelist action
  const wldActionPath = path.join(__dirname, "../../.world-wld-whitelist-action.json");
  if (fs.existsSync(wldActionPath)) {
    try {
      const wldAction = JSON.parse(fs.readFileSync(wldActionPath, "utf8"));
      console.log("Found WLD whitelist action, executing...");
      
      const vault = await ethers.getContractAt("Vault", wldAction.target);
      const tx2 = await vault.setTokenConfig(
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      );
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log("WLD token whitelist action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wldActionPath);
    } catch (error) {
      console.error(`Error executing WLD whitelist action: ${error.message}`);
    }
  } else {
    console.log("No WLD whitelist action found");
  }
  
  // WWORLD whitelist action
  const wworldActionPath = path.join(__dirname, "../../.world-wworld-whitelist-action.json");
  if (fs.existsSync(wworldActionPath)) {
    try {
      const wworldAction = JSON.parse(fs.readFileSync(wworldActionPath, "utf8"));
      console.log("Found WWORLD whitelist action, executing...");
      
      const vault = await ethers.getContractAt("Vault", wworldAction.target);
      const tx3 = await vault.setTokenConfig(
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      );
      console.log(`Transaction sent: ${tx3.hash}`);
      await tx3.wait();
      console.log("WWORLD token whitelist action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wworldActionPath);
    } catch (error) {
      console.error(`Error executing WWORLD whitelist action: ${error.message}`);
    }
  } else {
    console.log("No WWORLD whitelist action found");
  }
  
  // 3. Execute custom price feed actions if they were created
  console.log("\n3. Executing custom price feed actions...");
  
  // WLD price feed action
  const wldPriceFeedPath = path.join(__dirname, "../../.world-wld-pricefeed-action.json");
  if (fs.existsSync(wldPriceFeedPath)) {
    try {
      const wldPriceFeedAction = JSON.parse(fs.readFileSync(wldPriceFeedPath, "utf8"));
      console.log("Found WLD price feed action, executing...");
      
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", wldPriceFeedAction.target);
      const tx4 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      );
      console.log(`Transaction sent: ${tx4.hash}`);
      await tx4.wait();
      console.log("WLD price feed action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wldPriceFeedPath);
    } catch (error) {
      console.error(`Error executing WLD price feed action: ${error.message}`);
    }
  } else {
    console.log("No WLD price feed action found");
  }
  
  // WWORLD price feed action
  const wworldPriceFeedPath = path.join(__dirname, "../../.world-wworld-pricefeed-action.json");
  if (fs.existsSync(wworldPriceFeedPath)) {
    try {
      const wworldPriceFeedAction = JSON.parse(fs.readFileSync(wworldPriceFeedPath, "utf8"));
      console.log("Found WWORLD price feed action, executing...");
      
      const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", wworldPriceFeedAction.target);
      const tx5 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      );
      console.log(`Transaction sent: ${tx5.hash}`);
      await tx5.wait();
      console.log("WWORLD price feed action executed successfully");
      
      // Remove the action file
      fs.unlinkSync(wworldPriceFeedPath);
    } catch (error) {
      console.error(`Error executing WWORLD price feed action: ${error.message}`);
    }
  } else {
    console.log("No WWORLD price feed action found");
  }
  
  // 4. Verify Router in Vault
  console.log("\n4. Verifying Router in Vault...");
  try {
    const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
    const currentRouter = await vault.router();
    if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
      console.log(`✅ Router correctly set in Vault: ${currentRouter}`);
    } else {
      console.log(`❌ Router mismatch! Current: ${currentRouter}, Expected: ${deploymentData.Router}`);
      console.log("You may need to manually fix the Router");
    }
  } catch (error) {
    console.error(`Error checking Router: ${error.message}`);
  }
  
  console.log("\nExecution of governance actions completed!");
  console.log("Run a validation script to ensure everything is properly configured.");
}

// Process command line arguments
async function main() {
  const action = process.argv[process.argv.length - 1];
  
  if (action === 'create') {
    await createActions();
  } else if (action === 'execute') {
    await executeActions();
  } else {
    console.log("Usage:");
    console.log("  npx hardhat run scripts/world/worldGovernance.js create --network worldchain");
    console.log("  npx hardhat run scripts/world/worldGovernance.js execute --network worldchain");
  }
}

// Execute main function
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  createActions,
  executeActions
};
