const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Creating all Timelock governance actions for World Chain...");
  
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
    console.warn("You won't be able to create or execute actions.");
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
  
  // Action 1: Set Router in Vault
  console.log("\n1. Creating action to set Router in Vault...");
  const setRouterData = vaultInterface.encodeFunctionData("initialize", [
    deploymentData.Router,
    usdg,
    priceFeed,
    liquidationFeeUsd,
    fundingRateFactor,
    stableFundingRateFactor
  ]);
  
  const setRouterActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setRouter", vault.address, setRouterData]
    )
  );
  
  try {
    // Check if already scheduled
    const routerTimestamp = await timelock.pendingActions(setRouterActionId);
    if (!routerTimestamp.isZero()) {
      console.log("Router action already scheduled at timestamp:", new Date(routerTimestamp.toNumber() * 1000).toISOString());
    } else {
      // Schedule the action
      const tx = await timelock.scheduleAction(
        vault.address,
        0, // value
        setRouterData,
        setRouterActionId,
        0 // buffer override, 0 means use default
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("setRouter action scheduled successfully");
    }
  } catch (error) {
    console.error("Error scheduling setRouter action:", error.message);
  }
  
  // Action 2: Set WLD Price Feed
  console.log("\n2. Creating action to set WLD Price Feed...");
  const wldPriceFeedData = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    deploymentData.MockPriceFeeds.WLD,
    8, // decimals
    true // isStable
  ]);
  
  const wldPriceFeedActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setWLDPriceFeed", vaultPriceFeed.address, wldPriceFeedData]
    )
  );
  
  try {
    // Check if already scheduled
    const wldPriceFeedTimestamp = await timelock.pendingActions(wldPriceFeedActionId);
    if (!wldPriceFeedTimestamp.isZero()) {
      console.log("WLD price feed action already scheduled at timestamp:", new Date(wldPriceFeedTimestamp.toNumber() * 1000).toISOString());
    } else {
      // Schedule the action
      const tx = await timelock.scheduleAction(
        vaultPriceFeed.address,
        0, // value
        wldPriceFeedData,
        wldPriceFeedActionId,
        0 // buffer override
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD price feed action scheduled successfully");
    }
  } catch (error) {
    console.error("Error scheduling WLD price feed action:", error.message);
  }
  
  // Action 3: Set WWORLD Price Feed
  console.log("\n3. Creating action to set WWORLD Price Feed...");
  const wworldPriceFeedData = vaultPriceFeedInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    deploymentData.MockPriceFeeds.WWORLD,
    8, // decimals
    false // isStable
  ]);
  
  const wworldPriceFeedActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["setWWORLDPriceFeed", vaultPriceFeed.address, wworldPriceFeedData]
    )
  );
  
  try {
    // Check if already scheduled
    const wworldPriceFeedTimestamp = await timelock.pendingActions(wworldPriceFeedActionId);
    if (!wworldPriceFeedTimestamp.isZero()) {
      console.log("WWORLD price feed action already scheduled at timestamp:", new Date(wworldPriceFeedTimestamp.toNumber() * 1000).toISOString());
    } else {
      // Schedule the action
      const tx = await timelock.scheduleAction(
        vaultPriceFeed.address,
        0, // value
        wworldPriceFeedData,
        wworldPriceFeedActionId,
        0 // buffer override
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD price feed action scheduled successfully");
    }
  } catch (error) {
    console.error("Error scheduling WWORLD price feed action:", error.message);
  }
  
  // Action 4: Whitelist WLD Token
  console.log("\n4. Creating action to whitelist WLD Token...");
  const wldWhitelistData = vaultInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    true, // isStable
    false // isShortable
  ]);
  
  const wldWhitelistActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["whitelistWLD", vault.address, wldWhitelistData]
    )
  );
  
  try {
    // Check if already scheduled
    const wldWhitelistTimestamp = await timelock.pendingActions(wldWhitelistActionId);
    if (!wldWhitelistTimestamp.isZero()) {
      console.log("WLD whitelist action already scheduled at timestamp:", new Date(wldWhitelistTimestamp.toNumber() * 1000).toISOString());
    } else {
      // Schedule the action
      const tx = await timelock.scheduleAction(
        vault.address,
        0, // value
        wldWhitelistData,
        wldWhitelistActionId,
        0 // buffer override
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WLD whitelist action scheduled successfully");
    }
  } catch (error) {
    console.error("Error scheduling WLD whitelist action:", error.message);
  }
  
  // Action 5: Whitelist WWORLD Token
  console.log("\n5. Creating action to whitelist WWORLD Token...");
  const wworldWhitelistData = vaultInterface.encodeFunctionData("setTokenConfig", [
    deploymentData.WWORLD,
    18, // decimals
    10000, // weight
    0, // minProfitBps
    ethers.utils.parseUnits("1000000", 18), // maxUsdgAmount
    false, // isStable
    true // isShortable
  ]);
  
  const wworldWhitelistActionId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "bytes"],
      ["whitelistWWORLD", vault.address, wworldWhitelistData]
    )
  );
  
  try {
    // Check if already scheduled
    const wworldWhitelistTimestamp = await timelock.pendingActions(wworldWhitelistActionId);
    if (!wworldWhitelistTimestamp.isZero()) {
      console.log("WWORLD whitelist action already scheduled at timestamp:", new Date(wworldWhitelistTimestamp.toNumber() * 1000).toISOString());
    } else {
      // Schedule the action
      const tx = await timelock.scheduleAction(
        vault.address,
        0, // value
        wworldWhitelistData,
        wworldWhitelistActionId,
        0 // buffer override
      );
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("WWORLD whitelist action scheduled successfully");
    }
  } catch (error) {
    console.error("Error scheduling WWORLD whitelist action:", error.message);
  }
  
  console.log("\nAll Timelock actions have been created!");
  console.log("Wait for the buffer period (default 24 hours) before executing these actions.");
  console.log("Then run the executeGovernanceActions.js script to execute all pending actions.");
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
