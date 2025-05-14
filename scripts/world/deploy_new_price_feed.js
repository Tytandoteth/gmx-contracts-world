const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Gas settings
const GAS_OPTIONS = {
  gasPrice: ethers.utils.parseUnits("0.5", "gwei"),
  gasLimit: 5000000
};

async function main() {
  console.log("\n=== Deploying New SimplePriceFeed for GMX V1 ===\n");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.001"))) {
    console.error("Warning: ETH balance is very low, deployment might fail");
  }
  
  // Load custom deployment data
  console.log("\nLoading custom deployment data...");
  const deploymentPath = path.join(__dirname, "../../.world-custom-deployment.json");
  const customDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get contract addresses
  const vaultAddress = customDeployment.CustomVault;
  const vaultPriceFeedAddress = customDeployment.CustomVaultPriceFeed;
  const oldSimplePriceFeedAddress = customDeployment.SimplePriceFeed;
  
  console.log(`- Vault: ${vaultAddress}`);
  console.log(`- VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`- Old SimplePriceFeed: ${oldSimplePriceFeedAddress}`);
  
  // Get test tokens
  const testTokens = customDeployment.TestDeployment.tokens;
  console.log(`\nTest Tokens:`);
  Object.entries(testTokens).forEach(([symbol, token]) => {
    console.log(`- ${symbol}: ${token.address} (${token.decimals} decimals)`);
  });
  
  // Step 1: Deploy new SimplePriceFeed
  console.log("\n--- Step 1: Deploying New SimplePriceFeed ---");
  
  // Get SimplePriceFeed source code from the repository
  const simplePriceFeedSourcePath = path.join(__dirname, "../core/SimplePriceFeed.sol");
  
  // Check if source file exists
  if (!fs.existsSync(simplePriceFeedSourcePath)) {
    console.log("SimplePriceFeed source file not found at expected path. Creating it...");
    
    // Create SimplePriceFeed.sol file
    const simplePriceFeedSource = `// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "./interfaces/IPriceFeed.sol";

contract SimplePriceFeed is IPriceFeed {
    using SafeMath for uint256;

    mapping (address => uint256) public prices;
    address public gov;

    constructor() public {
        gov = msg.sender;
    }

    modifier onlyGov() {
        require(msg.sender == gov, "SimplePriceFeed: forbidden");
        _;
    }

    function setGov(address _gov) external onlyGov {
        gov = _gov;
    }

    function setPrices(address[] memory _tokens, uint256[] memory _prices) external onlyGov {
        for (uint256 i = 0; i < _tokens.length; i++) {
            prices[_tokens[i]] = _prices[i];
        }
    }

    function getPrice(address _token) external view override returns (uint256) {
        require(prices[_token] > 0, "SimplePriceFeed: invalid price");
        return prices[_token];
    }
}`;
    
    // Create directories if they don't exist
    const simplePriceFeedDir = path.dirname(simplePriceFeedSourcePath);
    if (!fs.existsSync(simplePriceFeedDir)) {
      fs.mkdirSync(simplePriceFeedDir, { recursive: true });
    }
    
    // Write the source to file
    fs.writeFileSync(simplePriceFeedSourcePath, simplePriceFeedSource);
    console.log("SimplePriceFeed source file created");
    
    // Create the interfaces directory and IPriceFeed.sol if needed
    const interfacesDir = path.join(path.dirname(simplePriceFeedSourcePath), "interfaces");
    if (!fs.existsSync(interfacesDir)) {
      fs.mkdirSync(interfacesDir, { recursive: true });
    }
    
    const priceFeedInterfacePath = path.join(interfacesDir, "IPriceFeed.sol");
    if (!fs.existsSync(priceFeedInterfacePath)) {
      const priceFeedInterfaceSource = `// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IPriceFeed {
    function getPrice(address _token) external view returns (uint256);
}`;
      fs.writeFileSync(priceFeedInterfacePath, priceFeedInterfaceSource);
      console.log("IPriceFeed interface created");
    }
  }
  
  // Now either compile and deploy SimplePriceFeed, or use hardhat artifacts if already compiled
  console.log("Deploying new SimplePriceFeed contract...");
  
  // Import compiled contract artifacts
  const SimplePriceFeedArtifact = require("../../artifacts/contracts/core/SimplePriceFeed.sol/SimplePriceFeed.json");
  const SimplePriceFeedFactory = new ethers.ContractFactory(
    SimplePriceFeedArtifact.abi,
    SimplePriceFeedArtifact.bytecode,
    deployer
  );
  
  let newSimplePriceFeed;
  try {
    newSimplePriceFeed = await SimplePriceFeedFactory.deploy(GAS_OPTIONS);
    const deployTx = newSimplePriceFeed.deployTransaction;
    console.log(`Deployment transaction submitted: ${deployTx.hash}`);
    
    console.log("Waiting for deployment to be confirmed...");
    await newSimplePriceFeed.deployed();
    
    console.log(`✅ New SimplePriceFeed deployed at: ${newSimplePriceFeed.address}`);
  } catch (error) {
    console.error(`Error deploying SimplePriceFeed: ${error.message}`);
    console.log("\nAlternative approach: Using manual deployment...");
    
    // Generate the bytecode and ABI message for manual deployment
    console.log(`To deploy manually, use this bytecode: ${SimplePriceFeedArtifact.bytecode.substring(0, 100)}...`);
    console.log("Then update the script with the deployed address before continuing");
    return;
  }
  
  // Step 2: Set prices in the new SimplePriceFeed
  console.log("\n--- Step 2: Setting Prices in New SimplePriceFeed ---");
  
  // Token prices (in USD with 30 decimals as per GMX standard)
  const tokenPrices = {
    TUSD: ethers.utils.parseUnits("1", 30), // $1.00
    TBTC: ethers.utils.parseUnits("60000", 30), // $60,000.00
    TETH: ethers.utils.parseUnits("3000", 30) // $3,000.00
  };
  
  try {
    const tokenAddresses = [];
    const prices = [];
    
    for (const [symbol, token] of Object.entries(testTokens)) {
      tokenAddresses.push(token.address);
      prices.push(tokenPrices[symbol]);
      console.log(`- Setting ${symbol} price: ${ethers.utils.formatUnits(tokenPrices[symbol], 30)} USD`);
    }
    
    const tx = await newSimplePriceFeed.setPrices(tokenAddresses, prices, GAS_OPTIONS);
    console.log(`Transaction submitted: ${tx.hash}`);
    
    await tx.wait();
    console.log("✅ Prices set successfully");
    
    // Verify prices
    for (const [symbol, token] of Object.entries(testTokens)) {
      const price = await newSimplePriceFeed.getPrice(token.address);
      console.log(`- Verified ${symbol} price: ${ethers.utils.formatUnits(price, 30)} USD`);
    }
  } catch (error) {
    console.error(`Error setting prices: ${error.message}`);
    return;
  }
  
  // Step 3: Update VaultPriceFeed to use the new SimplePriceFeed
  console.log("\n--- Step 3: Updating VaultPriceFeed ---");
  
  const vaultPriceFeedAbi = [
    "function gov() external view returns (address)",
    "function priceFeeds(address _token) external view returns (address)",
    "function setPriceFeed(address _token, address _priceFeed) external",
    "function setTokenConfig(address _token, bool _isStrictStable) external",
    "function setIsAmmEnabled(bool _isEnabled) external",
    "function setIsSecondaryPriceEnabled(bool _isEnabled) external",
    "function getPrice(address _token, bool _maximise, bool _includeAmmPrice, bool _useSwapPricing) external view returns (uint256)"
  ];
  
  const vaultPriceFeed = new ethers.Contract(
    vaultPriceFeedAddress,
    vaultPriceFeedAbi,
    deployer
  );
  
  try {
    // First disable AMM and secondary price if needed
    console.log("Disabling AMM and secondary price sources...");
    const disableAmmTx = await vaultPriceFeed.setIsAmmEnabled(false, GAS_OPTIONS);
    await disableAmmTx.wait();
    console.log("- AMM disabled");
    
    const disableSecondaryTx = await vaultPriceFeed.setIsSecondaryPriceEnabled(false, GAS_OPTIONS);
    await disableSecondaryTx.wait();
    console.log("- Secondary price disabled");
    
    // Update price feed for each token
    for (const [symbol, token] of Object.entries(testTokens)) {
      console.log(`\nUpdating price feed for ${symbol}...`);
      
      // Set the new price feed
      const setPriceFeedTx = await vaultPriceFeed.setPriceFeed(
        token.address,
        newSimplePriceFeed.address,
        GAS_OPTIONS
      );
      console.log(`- Transaction submitted: ${setPriceFeedTx.hash}`);
      
      await setPriceFeedTx.wait();
      console.log(`- Price feed updated`);
      
      // Configure token as stable if it's TUSD
      const isStable = symbol === "TUSD";
      const setConfigTx = await vaultPriceFeed.setTokenConfig(
        token.address,
        isStable, // isStrictStable
        GAS_OPTIONS
      );
      console.log(`- Setting token config (isStrictStable: ${isStable})...`);
      
      await setConfigTx.wait();
      console.log(`- Token config updated`);
      
      // Verify price is accessible
      const price = await vaultPriceFeed.getPrice(token.address, true, false, false);
      console.log(`- Verified ${symbol} price from VaultPriceFeed: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
    }
  } catch (error) {
    console.error(`Error updating VaultPriceFeed: ${error.message}`);
    return;
  }
  
  // Step 4: Whitelist tokens in Vault
  console.log("\n--- Step 4: Whitelisting Tokens in Vault ---");
  
  const vaultAbi = [
    "function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external",
    "function whitelistedTokens(address _token) external view returns (bool)",
    "function tokenDecimals(address _token) external view returns (uint256)",
    "function tokenWeights(address _token) external view returns (uint256)",
    "function totalTokenWeights() external view returns (uint256)",
    "function getMaxPrice(address _token) external view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(
    vaultAddress,
    vaultAbi,
    deployer
  );
  
  // Token configuration
  const tokenConfigs = {
    TUSD: {
      weight: 10000, // 10%
      minProfitBps: 75, // 0.75%
      maxUsdgAmount: ethers.utils.parseUnits("10000000", 18), // $10M
      isStable: true,
      isShortable: false
    },
    TBTC: {
      weight: 20000, // 20%
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M
      isStable: false,
      isShortable: true
    },
    TETH: {
      weight: 20000, // 20%
      minProfitBps: 150, // 1.5%
      maxUsdgAmount: ethers.utils.parseUnits("30000000", 18), // $30M
      isStable: false,
      isShortable: true
    }
  };
  
  // First check Vault can access prices
  console.log("Verifying Vault can access price data...");
  
  for (const [symbol, token] of Object.entries(testTokens)) {
    try {
      const price = await vault.getMaxPrice(token.address);
      console.log(`- ${symbol} price from Vault: ${ethers.utils.formatUnits(price, 30)} USD ✅`);
    } catch (error) {
      console.log(`- Could not get ${symbol} price from Vault: ${error.message.slice(0, 100)}... ❌`);
      console.log("  Whitelisting will likely fail for this token");
    }
  }
  
  // Whitelist tokens
  let successCount = 0;
  
  for (const [symbol, token] of Object.entries(testTokens)) {
    console.log(`\nWhitelisting ${symbol}...`);
    
    try {
      // Check if already whitelisted
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      if (isWhitelisted) {
        console.log(`- ${symbol} is already whitelisted ✅`);
        successCount++;
        continue;
      }
      
      // Get token config
      const config = tokenConfigs[symbol];
      
      // Whitelist token
      console.log(`- Setting token config for ${symbol}...`);
      const tx = await vault.setTokenConfig(
        token.address,
        token.decimals,
        config.weight,
        config.minProfitBps,
        config.maxUsdgAmount,
        config.isStable,
        config.isShortable,
        GAS_OPTIONS
      );
      
      console.log(`- Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`- ${symbol} successfully whitelisted ✅`);
        
        // Verify token configuration
        const decimals = await vault.tokenDecimals(token.address);
        console.log(`  > Decimals: ${decimals}`);
        
        const weight = await vault.tokenWeights(token.address);
        console.log(`  > Weight: ${weight}`);
        
        successCount++;
      } else {
        console.log(`- Transaction completed but failed ❌`);
      }
    } catch (error) {
      console.error(`- Error whitelisting ${symbol}: ${error.message}`);
    }
  }
  
  // Step 5: Final verification
  console.log("\n--- Step 5: Final Verification ---");
  
  try {
    // Check total token weights
    const totalWeights = await vault.totalTokenWeights();
    console.log(`Total token weights: ${totalWeights}`);
    
    if (totalWeights.gt(0)) {
      console.log("✅ Token weights have been successfully set");
    } else {
      console.log("❌ No token weights set - whitelisting may have failed");
    }
    
    // Verify each token
    console.log("\nToken Status:");
    for (const [symbol, token] of Object.entries(testTokens)) {
      const isWhitelisted = await vault.whitelistedTokens(token.address);
      console.log(`- ${symbol}: ${isWhitelisted ? '✅ Whitelisted' : '❌ Not whitelisted'}`);
      
      if (isWhitelisted) {
        const weight = await vault.tokenWeights(token.address);
        console.log(`  > Weight: ${weight}`);
      }
    }
  } catch (error) {
    console.error(`Error in final verification: ${error.message}`);
  }
  
  // Step 6: Update deployment JSON file
  console.log("\n--- Step 6: Updating Deployment Configuration ---");
  
  // Update the SimplePriceFeed address in the deployment configuration
  customDeployment.SimplePriceFeed = newSimplePriceFeed.address;
  
  try {
    fs.writeFileSync(deploymentPath, JSON.stringify(customDeployment, null, 2));
    console.log(`✅ Updated deployment configuration file with new SimplePriceFeed address`);
  } catch (error) {
    console.error(`Error updating deployment file: ${error.message}`);
  }
  
  // Step 7: Create environment variables file for frontend
  console.log("\n--- Step 7: Creating Environment Variables for Frontend ---");
  
  const envVars = `# GMX V1 on World Chain - Custom Deployment
VITE_WORLD_RPC_URL=https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/
VITE_VAULT_ADDRESS=${vaultAddress}
VITE_ROUTER_ADDRESS=${customDeployment.CustomRouter}
VITE_VAULT_PRICE_FEED_ADDRESS=${vaultPriceFeedAddress}
VITE_SIMPLE_PRICE_FEED_ADDRESS=${newSimplePriceFeed.address}

# Additional Contract Addresses
VITE_POSITION_ROUTER=${customDeployment.PositionRouter || ''}
VITE_POSITION_MANAGER=${customDeployment.PositionManager || ''}
VITE_ORDER_BOOK=${customDeployment.OrderBook || ''}
`;
  
  const envFilePath = path.join(__dirname, "../../.env.world.custom");
  fs.writeFileSync(envFilePath, envVars);
  console.log(`✅ Created environment variables file: ${envFilePath}`);
  
  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`New SimplePriceFeed deployed at: ${newSimplePriceFeed.address}`);
  console.log(`Price feeds updated in VaultPriceFeed: ${vaultPriceFeedAddress}`);
  console.log(`Tokens whitelisted successfully: ${successCount} out of ${Object.keys(testTokens).length}`);
  
  if (successCount > 0) {
    console.log("\n✅ MVP Integration Complete!");
    console.log("You can now connect your frontend to these contracts using the environment variables file");
  } else {
    console.log("\n⚠️ Integration incomplete. Some tokens could not be whitelisted.");
    console.log("Please check the logs for details and debug further if needed");
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
