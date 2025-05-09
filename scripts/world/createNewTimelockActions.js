const { ethers } = require("hardhat");
const { expandDecimals } = require("../../test/shared/utilities");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  
  // Load deployment data
  const officialDeploymentPath = path.join(__dirname, '../../.world-deployment.json');
  const timelockDeploymentPath = path.join(__dirname, '../../.world-timelock-deployment.json');
  
  if (!fs.existsSync(officialDeploymentPath)) {
    console.error("Official deployment data not found");
    process.exit(1);
  }
  
  if (!fs.existsSync(timelockDeploymentPath)) {
    console.error("Timelock deployment data not found");
    process.exit(1);
  }
  
  const officialDeployment = JSON.parse(fs.readFileSync(officialDeploymentPath, 'utf8'));
  const timelockDeployment = JSON.parse(fs.readFileSync(timelockDeploymentPath, 'utf8'));
  
  console.log("Loaded deployment data");
  
  // Get contract instances
  const newTimelock = await ethers.getContractAt("Timelock", timelockDeployment.Timelock);
  const vault = await ethers.getContractAt("Vault", officialDeployment.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", officialDeployment.VaultPriceFeed);
  const router = await ethers.getContractAt("Router", officialDeployment.Router);
  
  // Check current governors
  const vaultGov = await vault.gov();
  console.log(`Vault current governor: ${vaultGov}`);
  
  const priceFeedGov = await vaultPriceFeed.gov();
  console.log(`VaultPriceFeed current governor: ${priceFeedGov}`);
  
  // Check token whitelisting
  const wldToken = officialDeployment.WLD;
  const wworldToken = officialDeployment.WWORLD;
  
  const isWldWhitelisted = await vault.whitelistedTokens(wldToken);
  console.log(`WLD token whitelisted: ${isWldWhitelisted}`);
  
  const isWworldWhitelisted = await vault.whitelistedTokens(wworldToken);
  console.log(`WWORLD token whitelisted: ${isWworldWhitelisted}`);
  
  // Check price feeds
  const wldPriceFeed = await vaultPriceFeed.priceFeeds(wldToken);
  console.log(`WLD price feed: ${wldPriceFeed}`);
  
  const wworldPriceFeed = await vaultPriceFeed.priceFeeds(wworldToken);
  console.log(`WWORLD price feed: ${wworldPriceFeed}`);
  
  // Check current router in vault
  const currentRouter = await vault.router();
  console.log(`Current router in Vault: ${currentRouter}`);
  console.log(`Expected router: ${officialDeployment.Router}`);
  
  // Create governance actions using the new Timelock
  const actionsCreated = [];
  
  // 1. Fix Router configuration (if needed)
  if (currentRouter.toLowerCase() !== officialDeployment.Router.toLowerCase()) {
    console.log("\n1. Creating action to fix Router in Vault...");
    
    if (vaultGov.toLowerCase() === timelockDeployment.Timelock.toLowerCase()) {
      try {
        // Get current Vault params to use in reinitialization
        const usdg = await vault.usdg();
        const priceFeed = await vault.priceFeed();
        const liquidationFeeUsd = await vault.liquidationFeeUsd();
        const fundingRateFactor = await vault.fundingRateFactor();
        const stableFundingRateFactor = await vault.stableFundingRateFactor();
        
        // Create a custom action for reinitialization
        const vaultInterface = new ethers.utils.Interface([
          "function initialize(address _router, address _usdg, address _priceFeed, uint256 _liquidationFeeUsd, uint256 _fundingRateFactor, uint256 _stableFundingRateFactor) external"
        ]);
        
        const reinitializeData = vaultInterface.encodeFunctionData("initialize", [
          officialDeployment.Router,
          usdg,
          priceFeed,
          liquidationFeeUsd,
          fundingRateFactor,
          stableFundingRateFactor
        ]);
        
        const tx1 = await newTimelock.scheduleCall(
          vault.address,
          0, // 0 value
          reinitializeData
        );
        
        console.log(`Transaction sent: ${tx1.hash}`);
        await tx1.wait();
        console.log("✅ Router fix action created");
        actionsCreated.push("Fix Router in Vault");
      } catch (error) {
        console.error(`Error creating Router fix action: ${error.message}`);
      }
    } else {
      console.log("⚠️ Cannot create Router fix action - Vault not governed by new Timelock yet");
    }
  } else {
    console.log("\n1. Router already correctly configured in Vault");
  }
  
  // 2. Configure WLD token whitelist (if needed)
  if (!isWldWhitelisted) {
    console.log("\n2. Creating action to whitelist WLD token...");
    
    if (vaultGov.toLowerCase() === timelockDeployment.Timelock.toLowerCase()) {
      try {
        const vaultInterface = new ethers.utils.Interface([
          "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
        ]);
        
        const wldWhitelistData = vaultInterface.encodeFunctionData("setTokenConfig", [
          wldToken,
          18, // decimals
          10000, // weight
          0, // minProfitBps
          expandDecimals(1000000, 18), // maxUsdgAmount
          true, // isStable
          false // isShortable
        ]);
        
        const tx2 = await newTimelock.scheduleCall(
          vault.address,
          0, // 0 value
          wldWhitelistData
        );
        
        console.log(`Transaction sent: ${tx2.hash}`);
        await tx2.wait();
        console.log("✅ WLD whitelist action created");
        actionsCreated.push("Whitelist WLD token");
      } catch (error) {
        console.error(`Error creating WLD whitelist action: ${error.message}`);
      }
    } else {
      console.log("⚠️ Cannot create WLD whitelist action - Vault not governed by new Timelock yet");
    }
  } else {
    console.log("\n2. WLD token already whitelisted");
  }
  
  // 3. Configure WWORLD token whitelist (if needed)
  if (!isWworldWhitelisted) {
    console.log("\n3. Creating action to whitelist WWORLD token...");
    
    if (vaultGov.toLowerCase() === timelockDeployment.Timelock.toLowerCase()) {
      try {
        const vaultInterface = new ethers.utils.Interface([
          "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"
        ]);
        
        const wworldWhitelistData = vaultInterface.encodeFunctionData("setTokenConfig", [
          wworldToken,
          18, // decimals
          10000, // weight
          0, // minProfitBps
          expandDecimals(1000000, 18), // maxUsdgAmount
          false, // isStable
          true // isShortable
        ]);
        
        const tx3 = await newTimelock.scheduleCall(
          vault.address,
          0, // 0 value
          wworldWhitelistData
        );
        
        console.log(`Transaction sent: ${tx3.hash}`);
        await tx3.wait();
        console.log("✅ WWORLD whitelist action created");
        actionsCreated.push("Whitelist WWORLD token");
      } catch (error) {
        console.error(`Error creating WWORLD whitelist action: ${error.message}`);
      }
    } else {
      console.log("⚠️ Cannot create WWORLD whitelist action - Vault not governed by new Timelock yet");
    }
  } else {
    console.log("\n3. WWORLD token already whitelisted");
  }
  
  // 4. Configure WLD price feed (if needed)
  const targetWldPriceFeed = officialDeployment.MockPriceFeeds?.WLD || AddressZero;
  
  if (wldPriceFeed === AddressZero && targetWldPriceFeed !== AddressZero) {
    console.log("\n4. Creating action to set WLD price feed...");
    
    if (priceFeedGov.toLowerCase() === timelockDeployment.Timelock.toLowerCase()) {
      try {
        const priceFeedInterface = new ethers.utils.Interface([
          "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
        ]);
        
        const wldPriceFeedData = priceFeedInterface.encodeFunctionData("setTokenConfig", [
          wldToken,
          targetWldPriceFeed,
          8, // decimals
          true // isStable
        ]);
        
        const tx4 = await newTimelock.scheduleCall(
          vaultPriceFeed.address,
          0, // 0 value
          wldPriceFeedData
        );
        
        console.log(`Transaction sent: ${tx4.hash}`);
        await tx4.wait();
        console.log("✅ WLD price feed action created");
        actionsCreated.push("Set WLD price feed");
      } catch (error) {
        console.error(`Error creating WLD price feed action: ${error.message}`);
      }
    } else {
      console.log("⚠️ Cannot create WLD price feed action - VaultPriceFeed not governed by new Timelock yet");
    }
  } else {
    console.log("\n4. WLD price feed already configured or target feed not available");
  }
  
  // 5. Configure WWORLD price feed (if needed)
  const targetWworldPriceFeed = officialDeployment.MockPriceFeeds?.WWORLD || AddressZero;
  
  if (wworldPriceFeed === AddressZero && targetWworldPriceFeed !== AddressZero) {
    console.log("\n5. Creating action to set WWORLD price feed...");
    
    if (priceFeedGov.toLowerCase() === timelockDeployment.Timelock.toLowerCase()) {
      try {
        const priceFeedInterface = new ethers.utils.Interface([
          "function setTokenConfig(address _token, address _priceFeed, uint256 _priceDecimals, bool _isStrictStable) external"
        ]);
        
        const wworldPriceFeedData = priceFeedInterface.encodeFunctionData("setTokenConfig", [
          wworldToken,
          targetWworldPriceFeed,
          8, // decimals
          false // isStable
        ]);
        
        const tx5 = await newTimelock.scheduleCall(
          vaultPriceFeed.address,
          0, // 0 value
          wworldPriceFeedData
        );
        
        console.log(`Transaction sent: ${tx5.hash}`);
        await tx5.wait();
        console.log("✅ WWORLD price feed action created");
        actionsCreated.push("Set WWORLD price feed");
      } catch (error) {
        console.error(`Error creating WWORLD price feed action: ${error.message}`);
      }
    } else {
      console.log("⚠️ Cannot create WWORLD price feed action - VaultPriceFeed not governed by new Timelock yet");
    }
  } else {
    console.log("\n5. WWORLD price feed already configured or target feed not available");
  }
  
  console.log("\nGovernance actions created:", actionsCreated.length > 0 ? actionsCreated.join(", ") : "None");
  
  if (actionsCreated.length > 0) {
    console.log("\nNext steps:");
    console.log("1. Wait for the new Timelock buffer period (5 minutes) to elapse");
    console.log("2. Run executeNewTimelockActions.js to execute the pending actions");
    console.log("3. Run validateWorldDeployment.js to verify the configuration");
  } else {
    if (vaultGov.toLowerCase() !== timelockDeployment.Timelock.toLowerCase() || 
        priceFeedGov.toLowerCase() !== timelockDeployment.Timelock.toLowerCase()) {
      console.log("\nNo actions created because governance has not been transferred to the new Timelock yet.");
      console.log("First run signalGovTransfer.js, wait 24 hours, then executeGovTransfer.js");
    } else {
      console.log("\nNo actions needed! All configurations are already correct.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
