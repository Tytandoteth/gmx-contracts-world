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

async function main() {
  console.log("Setting up price feeds for local Hardhat network...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get deployment data
  const deploymentData = await getDeploymentData();
  console.log("Deployment data loaded successfully");
  
  // Get contract instances
  const vault = await ethers.getContractAt("Vault", deploymentData.Vault);
  const vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", deploymentData.VaultPriceFeed);
  
  // Set up price feeds for tokens
  console.log("Setting up price feeds for tokens...");
  
  // Define token price configurations
  const tokenConfigs = [
    {
      name: "WLD",
      address: deploymentData.WLD,
      price: ethers.utils.parseUnits("1", 8), // $1.00 with 8 decimals
      isStable: true
    },
    {
      name: "WETH",
      address: deploymentData.WETH,
      price: ethers.utils.parseUnits("3000", 8), // $3000 with 8 decimals
      isStable: false
    }
  ];
  
  // Deploy mock price feeds for each token
  console.log("Deploying mock price feeds...");
  const mockPriceFeeds = {};
  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  
  for (const token of tokenConfigs) {
    console.log(`Deploying mock price feed for ${token.name}...`);
    const mockPriceFeed = await MockPriceFeed.deploy(token.price);
    await mockPriceFeed.deployed();
    console.log(`${token.name} mock price feed deployed at: ${mockPriceFeed.address}`);
    
    mockPriceFeeds[token.name] = mockPriceFeed.address;
    
    // Set the token config in the VaultPriceFeed
    console.log(`Setting ${token.name} config in VaultPriceFeed...`);
    await vaultPriceFeed.setTokenConfig(
      token.address,
      mockPriceFeed.address,
      8, // Price feed decimals (standard for Chainlink)
      token.isStable
    );
    console.log(`${token.name} price feed configured successfully`);
  }
  
  // Save mock price feed addresses to deployment data
  await saveDeploymentData({
    MockPriceFeeds: mockPriceFeeds
  });
  
  // Now whitelist the tokens in the Vault
  console.log("\nWhitelisting tokens in Vault...");
  
  for (const token of tokenConfigs) {
    const isWhitelisted = await vault.whitelistedTokens(token.address);
    
    if (isWhitelisted) {
      console.log(`${token.name} is already whitelisted`);
      continue;
    }
    
    console.log(`Whitelisting ${token.name}...`);
    try {
      await vault.setTokenConfig(
        token.address,
        18, // Token decimals
        10000, // Token weight
        75, // Min profit bps
        ethers.utils.parseUnits("100000000", 18), // Max USDG amount (100M)
        token.isStable,
        !token.isStable // isShortable (only for non-stable tokens)
      );
      console.log(`${token.name} whitelisted successfully`);
    } catch (error) {
      console.error(`Error whitelisting ${token.name}:`, error.message);
    }
  }
  
  // Verify configuration
  console.log("\nVerifying token configuration...");
  
  for (const token of tokenConfigs) {
    const isWhitelisted = await vault.whitelistedTokens(token.address);
    console.log(`${token.name} whitelisted: ${isWhitelisted ? "✅" : "❌"}`);
    
    if (isWhitelisted) {
      // Try to get the price from the vault to verify price feed works
      try {
        const price = await vault.getMinPrice(token.address);
        console.log(`${token.name} price: $${ethers.utils.formatUnits(price, 30)}`);
      } catch (error) {
        console.error(`Error getting ${token.name} price:`, error.message);
      }
    }
  }
  
  console.log("\nPrice feed setup completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
