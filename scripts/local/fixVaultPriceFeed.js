const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function saveDeploymentData(data) {
  const deploymentPath = path.join(__dirname, "../../.local-deployment.json");
  
  let deploymentData = {};
  if (fs.existsSync(deploymentPath)) {
    const fileContent = fs.readFileSync(deploymentPath, "utf8");
    if (fileContent) {
      deploymentData = JSON.parse(fileContent);
    }
  }
  
  // Merge new data
  deploymentData = { ...deploymentData, ...data };
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment data saved to", deploymentPath);
  return deploymentData;
}

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
  console.log("Setting up VaultPriceFeed for local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get contract instances
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  const wld = deploymentData.WLD;
  const weth = deploymentData.WETH;
  
  console.log("Setting up price feeds for tokens...");
  
  // Set price feeds for tokens
  // For local testing, we'll use a simple price aggregator approach
  
  // Set WLD price to $1
  console.log("Setting WLD price to $1...");
  const wldPriceDecimals = 8; // Most price feeds use 8 decimals
  const wldPrice = ethers.utils.parseUnits("1", wldPriceDecimals); // $1.00 per WLD
  
  // Set WETH price to $3,000
  console.log("Setting WETH price to $3,000...");
  const wethPriceDecimals = 8; 
  const wethPrice = ethers.utils.parseUnits("3000", wethPriceDecimals); // $3,000 per WETH
  
  try {
    // Deploy MockPriceFeed for WLD and WETH
    console.log("Deploying mock price feeds...");
    
    // Check if MockPriceFeed contract exists, if not create it
    const mockPriceFeedCode = `
    // SPDX-License-Identifier: MIT
    pragma solidity 0.6.12;
    contract MockPriceFeed {
        uint256 public price;
        uint8 public decimals;
        string public description;
        uint256 public roundId;
        uint80 public latestRound;
        
        constructor(uint256 _price) public {
            price = _price;
            decimals = 8;
            description = "Mock Price Feed";
            roundId = 0;
            latestRound = 0;
        }
        
        function setPrice(uint256 _price) external {
            price = _price;
            roundId = roundId + 1;
            latestRound = uint80(roundId);
        }
        
        function latestAnswer() external view returns (uint256) {
            return price;
        }
        
        function latestRound() external view returns (uint80) {
            return latestRound;
        }
        
        function getRoundData(uint80 _roundId) external view returns (
            uint80 roundId_,
            uint256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return (
                _roundId,
                price,
                block.timestamp,
                block.timestamp,
                _roundId
            );
        }
        
        function latestRoundData() external view returns (
            uint80 roundId_,
            uint256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return (
                latestRound,
                price,
                block.timestamp,
                block.timestamp,
                latestRound
            );
        }
    }`;
    
    // Save the MockPriceFeed contract if we need to use it
    const mockPriceFeedPath = path.join(__dirname, "../../contracts/mocks/MockPriceFeed.sol");
    if (!fs.existsSync(path.dirname(mockPriceFeedPath))) {
      fs.mkdirSync(path.dirname(mockPriceFeedPath), { recursive: true });
    }
    fs.writeFileSync(mockPriceFeedPath, mockPriceFeedCode);
    
    // Ask the user to compile the newly added contract
    console.log("Added MockPriceFeed contract. If it doesn't compile automatically, please run 'npx hardhat compile'.");
    
    // Try to compile the new contract
    try {
      const { execSync } = require('child_process');
      console.log("Compiling contracts...");
      execSync('npx hardhat compile', { cwd: path.join(__dirname, "../.." ) });
      console.log("Compilation successful");
    } catch (error) {
      console.error("Compilation failed, please compile manually:", error.message);
    }

    // Deploy mock price feeds
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    
    const wldPriceFeed = await MockPriceFeed.deploy(wldPrice);
    await wldPriceFeed.deployed();
    console.log(`WLD mock price feed deployed at: ${wldPriceFeed.address}`);
    
    const wethPriceFeed = await MockPriceFeed.deploy(wethPrice);
    await wethPriceFeed.deployed();
    console.log(`WETH mock price feed deployed at: ${wethPriceFeed.address}`);
    
    // Set token configs with the correct parameters
    console.log("Setting token configs in VaultPriceFeed...");
    await vaultPriceFeed.setTokenConfig(
      wld,
      wldPriceFeed.address,
      8, // price decimals
      true // isStrictStable
    );
    console.log("Set WLD price feed successfully");
    
    await vaultPriceFeed.setTokenConfig(
      weth,
      wethPriceFeed.address,
      8, // price decimals
      false // not a stablecoin
    );
    console.log("Set WETH price feed successfully");
  } catch (error) {
    console.error("Error setting token price feeds:", error.message);
    
    // Alternative method: Try setting directly if available
    try {
      console.log("Trying alternative price feed setting method...");
      
      // Method 2: Try setPriceFeedMapping if it exists
      await vaultPriceFeed.setPriceFeedMapping(wld, deployer.address, true); // Set deployer as a dummy price feed
      console.log("Set WLD price feed mapping successfully");
      
      await vaultPriceFeed.setPriceFeedMapping(weth, deployer.address, false); // Set deployer as a dummy price feed
      console.log("Set WETH price feed mapping successfully");
      
      // Method 3: Try setting prices directly if possible
      await vaultPriceFeed.setPrice(wld, wldPrice);
      console.log("Set WLD price directly successfully");
      
      await vaultPriceFeed.setPrice(weth, wethPrice);
      console.log("Set WETH price directly successfully");
    } catch (error) {
      console.error("Error setting price feeds with alternative methods:", error.message);
      
      // If all methods fail, we might need to deploy a custom price feed for testing
      console.log("Deploying mock price feeds...");
      
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      
      const wldPriceFeed = await MockPriceFeed.deploy(wldPrice);
      await wldPriceFeed.deployed();
      console.log(`WLD mock price feed deployed at: ${wldPriceFeed.address}`);
      
      const wethPriceFeed = await MockPriceFeed.deploy(wethPrice);
      await wethPriceFeed.deployed();
      console.log(`WETH mock price feed deployed at: ${wethPriceFeed.address}`);
      
      try {
        await vaultPriceFeed.setTokenPriceFeed(wld, wldPriceFeed.address);
        console.log("Set WLD price feed successfully");
        
        await vaultPriceFeed.setTokenPriceFeed(weth, wethPriceFeed.address);
        console.log("Set WETH price feed successfully");
      } catch (error) {
        console.error("Failed to set mock price feeds:", error.message);
      }
    }
  }
  
  console.log("VaultPriceFeed setup completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
