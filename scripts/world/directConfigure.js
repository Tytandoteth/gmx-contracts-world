const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Directly configuring GMX contracts for World Chain...");
  
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
  
  // Get contract instances
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  const router = await ethers.getContractAt("Router", deploymentData.Router);
  
  // Check governance
  const vaultGov = await vault.gov();
  console.log(`Vault governor: ${vaultGov}`);
  
  const priceFeedGov = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed governor: ${priceFeedGov}`);
  
  const newTimelock = deploymentData.Timelock;
  console.log(`New Timelock: ${newTimelock}`);
  
  // 1. Fix the Router in Vault
  console.log("\n1. Fixing Router in Vault...");
  const currentRouter = await vault.router();
  
  if (currentRouter.toLowerCase() === deploymentData.Router.toLowerCase()) {
    console.log("✅ Router already correctly set in Vault");
  } else {
    console.log(`❌ Router mismatch! Current: ${currentRouter}, Expected: ${deploymentData.Router}`);
    
    // If the deployer is the direct governor, use direct methods
    if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("Deployer is vault governor, using direct methods...");
      try {
        // Try to reinitialize the Vault
        const usdg = await vault.usdg();
        const priceFeed = await vault.priceFeed();
        const liquidationFeeUsd = await vault.liquidationFeeUsd();
        const fundingRateFactor = await vault.fundingRateFactor();
        const stableFundingRateFactor = await vault.stableFundingRateFactor();
        
        console.log("Reinitializing Vault with correct Router...");
        const tx1 = await vault.initialize(
          deploymentData.Router,
          usdg,
          priceFeed,
          liquidationFeeUsd,
          fundingRateFactor,
          stableFundingRateFactor
        );
        
        console.log(`Transaction sent: ${tx1.hash}`);
        await tx1.wait();
        console.log("Vault reinitialized with correct Router");
      } catch (error) {
        console.error(`Error reinitializing Vault: ${error.message}`);
      }
    } else if (vaultGov.toLowerCase() === newTimelock.toLowerCase()) {
      // If the new Timelock is governor, use it to fix the Router
      console.log("New Timelock is vault governor, using Timelock methods...");
      const timelock = await ethers.getContractAt("Timelock", newTimelock);
      
      try {
        // Get current values from Vault
        const usdg = await vault.usdg();
        const priceFeed = await vault.priceFeed();
        const liquidationFeeUsd = await vault.liquidationFeeUsd();
        const fundingRateFactor = await vault.fundingRateFactor();
        const stableFundingRateFactor = await vault.stableFundingRateFactor();
        
        // Create a signal to reinitialize the Vault through the Timelock
        console.log("Creating a custom action for reinitialization...");
        const vaultInterface = new ethers.utils.Interface([
          "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external"
        ]);
        
        const reinitializeData = vaultInterface.encodeFunctionData("initialize", [
          deploymentData.Router,
          usdg,
          priceFeed,
          liquidationFeeUsd,
          fundingRateFactor,
          stableFundingRateFactor
        ]);
        
        // Store this data for use in a direct call since we need to wait for buffer period
        fs.writeFileSync(
          path.join(__dirname, "../../.world-vault-reinit-action.json"),
          JSON.stringify({
            target: vault.address,
            data: reinitializeData,
            description: "Reinitialize Vault with correct Router"
          }, null, 2)
        );
        
        console.log("Stored Vault reinitialization action data for later execution");
      } catch (error) {
        console.error(`Error preparing Vault reinitialization: ${error.message}`);
      }
    } else {
      console.log("Cannot fix Router in Vault - governance permissions not available");
    }
  }
  
  // 2. Set up price feeds
  console.log("\n2. Setting up price feeds in VaultPriceFeed...");
  
  // Check if we can configure directly
  if (priceFeedGov.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("Deployer is VaultPriceFeed governor, setting price feeds directly...");
    
    // WLD price feed
    try {
      console.log("Setting WLD price feed...");
      const tx2 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      );
      console.log(`Transaction sent: ${tx2.hash}`);
      await tx2.wait();
      console.log("WLD price feed set successfully");
    } catch (error) {
      console.error(`Error setting WLD price feed: ${error.message}`);
    }
    
    // WWORLD price feed
    try {
      console.log("Setting WWORLD price feed...");
      const tx3 = await vaultPriceFeed.setTokenConfig(
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      );
      console.log(`Transaction sent: ${tx3.hash}`);
      await tx3.wait();
      console.log("WWORLD price feed set successfully");
    } catch (error) {
      console.error(`Error setting WWORLD price feed: ${error.message}`);
    }
  } else if (priceFeedGov.toLowerCase() === newTimelock.toLowerCase()) {
    // If the new Timelock is governor, use it to set price feeds
    console.log("New Timelock is VaultPriceFeed governor, using Timelock methods...");
    const timelock = await ethers.getContractAt("Timelock", newTimelock);
    
    try {
      // Create actions to set price feeds
      console.log("Creating custom actions for price feeds...");
      const priceFeedInterface = new ethers.utils.Interface([
        "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
      ]);
      
      // WLD price feed data
      const wldData = priceFeedInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,
        deploymentData.MockPriceFeeds.WLD,
        8, // decimals
        true // isStable
      ]);
      
      // Store WLD price feed action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wld-pricefeed-action.json"),
        JSON.stringify({
          target: vaultPriceFeed.address,
          data: wldData,
          description: "Set WLD Price Feed"
        }, null, 2)
      );
      
      console.log("Stored WLD price feed action data for later execution");
      
      // WWORLD price feed data
      const wworldData = priceFeedInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WWORLD,
        deploymentData.MockPriceFeeds.WWORLD,
        8, // decimals
        false // isStable
      ]);
      
      // Store WWORLD price feed action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wworld-pricefeed-action.json"),
        JSON.stringify({
          target: vaultPriceFeed.address,
          data: wworldData,
          description: "Set WWORLD Price Feed"
        }, null, 2)
      );
      
      console.log("Stored WWORLD price feed action data for later execution");
    } catch (error) {
      console.error(`Error preparing price feed actions: ${error.message}`);
    }
  } else {
    console.log("Cannot set price feeds - governance permissions not available");
  }
  
  // 3. Whitelist tokens
  console.log("\n3. Whitelisting tokens in Vault...");
  
  // Check if we can whitelist directly
  if (vaultGov.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("Deployer is vault governor, whitelisting tokens directly...");
    
    // Whitelist WLD
    try {
      console.log("Whitelisting WLD token...");
      const tx4 = await vault.setTokenConfig(
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      );
      console.log(`Transaction sent: ${tx4.hash}`);
      await tx4.wait();
      console.log("WLD token whitelisted successfully");
    } catch (error) {
      console.error(`Error whitelisting WLD: ${error.message}`);
    }
    
    // Whitelist WWORLD
    try {
      console.log("Whitelisting WWORLD token...");
      const tx5 = await vault.setTokenConfig(
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      );
      console.log(`Transaction sent: ${tx5.hash}`);
      await tx5.wait();
      console.log("WWORLD token whitelisted successfully");
    } catch (error) {
      console.error(`Error whitelisting WWORLD: ${error.message}`);
    }
  } else if (vaultGov.toLowerCase() === newTimelock.toLowerCase()) {
    // If the new Timelock is governor, use it to whitelist tokens
    console.log("New Timelock is vault governor, using Timelock methods...");
    
    try {
      // Create actions to whitelist tokens
      console.log("Creating custom actions for token whitelisting...");
      const vaultInterface = new ethers.utils.Interface([
        "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
      ]);
      
      // WLD whitelist data
      const wldData = vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        true, // isStable
        false // isShortable
      ]);
      
      // Store WLD whitelist action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wld-whitelist-action.json"),
        JSON.stringify({
          target: vault.address,
          data: wldData,
          description: "Whitelist WLD Token"
        }, null, 2)
      );
      
      console.log("Stored WLD whitelist action data for later execution");
      
      // WWORLD whitelist data
      const wworldData = vaultInterface.encodeFunctionData("setTokenConfig", [
        deploymentData.WWORLD,
        18, // decimals
        10000, // weight
        0, // minProfitBps
        ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
        false, // isStable
        true // isShortable
      ]);
      
      // Store WWORLD whitelist action data
      fs.writeFileSync(
        path.join(__dirname, "../../.world-wworld-whitelist-action.json"),
        JSON.stringify({
          target: vault.address,
          data: wworldData,
          description: "Whitelist WWORLD Token"
        }, null, 2)
      );
      
      console.log("Stored WWORLD whitelist action data for later execution");
    } catch (error) {
      console.error(`Error preparing token whitelist actions: ${error.message}`);
    }
  } else {
    console.log("Cannot whitelist tokens - governance permissions not available");
  }
  
  console.log("\nDirect configuration completed!");
  console.log("\nNext steps:");
  
  if (vaultGov.toLowerCase() === newTimelock.toLowerCase() || priceFeedGov.toLowerCase() === newTimelock.toLowerCase()) {
    console.log("1. Since governance is transferred to the new Timelock, we need to execute the stored actions.");
    console.log("2. Run executeTimelockActions.js to execute all pending actions.");
    console.log("3. Run validateWorldDeployment.js to verify everything is working.");
  } else {
    console.log("1. Wait for the governance transfer to complete (24 hours from the old Timelock).");
    console.log("2. Then run this script again to configure directly.");
    console.log("3. Finally, run validateWorldDeployment.js to verify everything is working.");
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
