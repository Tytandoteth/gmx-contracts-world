/**
 * GMX V1 Integration: Manual Governance Actions
 * ==============================================
 * 
 * This file contains all the necessary function calls for
 * configuring prices and whitelisting tokens for the GMX V1
 * deployment on World Chain.
 * 
 * IMPORTANT: Execute these actions from an account that:
 * 1. Has sufficient WORLD tokens for gas
 * 2. Has ownership/governance permissions on the contracts
 * 
 * ⚠️ Execute the actions in the order specified below:
 * Step 1: Set prices in SimplePriceFeed
 * Step 2: Configure VaultPriceFeed to use SimplePriceFeed
 * Step 3: Whitelist tokens in the Vault
 */

// Contract addresses from .world-custom-deployment.json
const CONTRACT_ADDRESSES = {
  // Main contracts  
  CUSTOM_VAULT: "0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5",
  CUSTOM_VAULT_PRICE_FEED: "0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf",
  SIMPLE_PRICE_FEED: "0xf63caB0D3aB8a3593f0Ed6b2a46Cd4dF45E4B05b",
  
  // Test tokens
  TUSD: "0xc99E5FC1A556bD42A6dAff82Fb585814E41431dc",
  TETH: "0x38CC615b73092e145cb38795C91180Ac5a8700E1",
  TBTC: "0x0d84b9be12240Ee0BDFacbE0378DAd3810bC37a8"
};

// Latest prices from Oracle Keeper (as of May 12, 2025)
const PRICES = {
  WLD: 1.30,       // For TUSD
  WETH: 2540.00,   // For TETH
  BTC: 40000.00    // For TBTC
};

// =========================================================
// STEP 1: Set Prices in SimplePriceFeed
// =========================================================

/**
 * This function sets prices for all tokens at once
 * 
 * Connect to the SimplePriceFeed contract at:
 * 0xf63caB0D3aB8a3593f0Ed6b2a46Cd4dF45E4B05b
 */
async function setPricesInSimplePriceFeed() {
  // Setup 
  const simplePriceFeed = await ethers.getContractAt(
    ["function setPrices(address[] memory _tokens, uint256[] memory _prices) external"],
    CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED
  );
  
  // Set prices for all tokens at once
  const tokenAddresses = [
    CONTRACT_ADDRESSES.TUSD,
    CONTRACT_ADDRESSES.TETH,
    CONTRACT_ADDRESSES.TBTC
  ];
  
  const tokenPrices = [
    ethers.utils.parseUnits(PRICES.WLD.toString(), 30),  // TUSD
    ethers.utils.parseUnits(PRICES.WETH.toString(), 30), // TETH
    ethers.utils.parseUnits(PRICES.BTC.toString(), 30)   // TBTC
  ];
  
  const tx = await simplePriceFeed.setPrices(tokenAddresses, tokenPrices, {
    gasLimit: 5000000
  });
  
  console.log(`Transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ Prices set successfully in SimplePriceFeed");
}

// =========================================================
// STEP 2: Configure VaultPriceFeed to use SimplePriceFeed
// =========================================================

/**
 * This function sets SimplePriceFeed as primary price feed for tokens
 * 
 * Connect to the VaultPriceFeed contract at:
 * 0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf
 */
async function configureVaultPriceFeed() {
  // Setup
  const vaultPriceFeed = await ethers.getContractAt(
    ["function setPriceFeed(address _token, address _priceFeed) external"],
    CONTRACT_ADDRESSES.CUSTOM_VAULT_PRICE_FEED
  );
  
  // Set price feed for TUSD
  let tx = await vaultPriceFeed.setPriceFeed(
    CONTRACT_ADDRESSES.TUSD,
    CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED,
    { gasLimit: 5000000 }
  );
  
  console.log(`TUSD price feed transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TUSD price feed configured");
  
  // Set price feed for TETH
  tx = await vaultPriceFeed.setPriceFeed(
    CONTRACT_ADDRESSES.TETH,
    CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED,
    { gasLimit: 5000000 }
  );
  
  console.log(`TETH price feed transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TETH price feed configured");
  
  // Set price feed for TBTC
  tx = await vaultPriceFeed.setPriceFeed(
    CONTRACT_ADDRESSES.TBTC,
    CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED,
    { gasLimit: 5000000 }
  );
  
  console.log(`TBTC price feed transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TBTC price feed configured");
}

// =========================================================
// STEP 3: Whitelist Tokens in Vault
// =========================================================

/**
 * This function whitelists tokens in the Vault
 * 
 * Connect to the Vault contract at:
 * 0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5
 */
async function whitelistTokensInVault() {
  // Setup
  const vault = await ethers.getContractAt(
    ["function setTokenConfig(address _token, uint256 _tokenDecimals, uint256 _tokenWeight, uint256 _minProfitBps, uint256 _maxUsdgAmount, bool _isStable, bool _isShortable) external"],
    CONTRACT_ADDRESSES.CUSTOM_VAULT
  );
  
  // Whitelist TUSD
  let tx = await vault.setTokenConfig(
    CONTRACT_ADDRESSES.TUSD,
    18,                                         // decimals
    10000,                                      // 10% weight
    75,                                         // 0.75% min profit
    ethers.utils.parseUnits("50000000", 18),   // 50M max
    true,                                       // is stable
    false,                                      // not shortable
    { gasLimit: 5000000 }
  );
  
  console.log(`TUSD whitelisting transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TUSD whitelisted");
  
  // Whitelist TETH
  tx = await vault.setTokenConfig(
    CONTRACT_ADDRESSES.TETH,
    18,                                         // decimals
    20000,                                      // 20% weight
    150,                                        // 1.5% min profit
    ethers.utils.parseUnits("100000000", 18),  // 100M max
    false,                                      // not stable
    true,                                       // is shortable
    { gasLimit: 5000000 }
  );
  
  console.log(`TETH whitelisting transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TETH whitelisted");
  
  // Whitelist TBTC
  tx = await vault.setTokenConfig(
    CONTRACT_ADDRESSES.TBTC,
    8,                                          // decimals
    20000,                                      // 20% weight
    150,                                        // 1.5% min profit
    ethers.utils.parseUnits("50000000", 18),   // 50M max
    false,                                      // not stable
    true,                                       // is shortable
    { gasLimit: 5000000 }
  );
  
  console.log(`TBTC whitelisting transaction submitted: ${tx.hash}`);
  await tx.wait();
  console.log("✅ TBTC whitelisted");
}

// =========================================================
// RUN GOVERNANCE ACTIONS
// =========================================================

/**
 * How to run these actions:
 * 1. Fund your account with sufficient WORLD tokens
 * 2. Ensure your account has governance permissions
 * 3. Run the script with:
 *    npx hardhat run scripts/world/governance_actions.js --network worldchain
 * 
 * You can also uncomment just the actions you want to run
 */
async function main() {
  console.log("Starting governance actions execution...");
  console.log("Make sure your account is funded with WORLD tokens");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  try {
    // Step 1: Set prices in SimplePriceFeed
    console.log("\n=== STEP 1: Setting prices in SimplePriceFeed ===");
    await setPricesInSimplePriceFeed();
    
    // Step 2: Configure VaultPriceFeed
    console.log("\n=== STEP 2: Configuring VaultPriceFeed ===");
    await configureVaultPriceFeed();
    
    // Step 3: Whitelist tokens in Vault
    console.log("\n=== STEP 3: Whitelisting tokens in Vault ===");
    await whitelistTokensInVault();
    
    console.log("\n✅ All governance actions completed successfully!");
  } catch (error) {
    console.error("❌ Error executing governance actions:", error.message);
  }
}

// Uncomment to run the script
// main()
//   .then(() => process.exit(0))
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   });

// =========================================================
// ALTERNATIVE: JSON FORMAT FOR GOVERNANCE TOOLS
// =========================================================

/**
 * If you're using a multi-sig wallet or governance tool,
 * you can use these JSON formatted actions instead
 */
const GOVERNANCE_ACTIONS = {
  // Step 1: Set prices in SimplePriceFeed
  setPricesAction: {
    target: CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED,
    action: "setPrices",
    args: [
      [
        CONTRACT_ADDRESSES.TUSD,
        CONTRACT_ADDRESSES.TETH,
        CONTRACT_ADDRESSES.TBTC
      ],
      [
        "1300000000000000000000000000000",  // 1.30 USD with 30 decimals
        "2540000000000000000000000000000000", // 2540.00 USD with 30 decimals
        "40000000000000000000000000000000000" // 40000.00 USD with 30 decimals
      ]
    ]
  },
  
  // Step 2: Configure VaultPriceFeed actions
  setPriceFeedTUSD: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT_PRICE_FEED,
    action: "setPriceFeed",
    args: [
      CONTRACT_ADDRESSES.TUSD,
      CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED
    ]
  },
  
  setPriceFeedTETH: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT_PRICE_FEED,
    action: "setPriceFeed",
    args: [
      CONTRACT_ADDRESSES.TETH,
      CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED
    ]
  },
  
  setPriceFeedTBTC: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT_PRICE_FEED,
    action: "setPriceFeed",
    args: [
      CONTRACT_ADDRESSES.TBTC,
      CONTRACT_ADDRESSES.SIMPLE_PRICE_FEED
    ]
  },
  
  // Step 3: Whitelist tokens in Vault actions
  whitelistTUSD: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT,
    action: "setTokenConfig",
    args: [
      CONTRACT_ADDRESSES.TUSD,
      18,
      10000,
      75,
      "50000000000000000000000000",
      true,
      false
    ]
  },
  
  whitelistTETH: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT,
    action: "setTokenConfig",
    args: [
      CONTRACT_ADDRESSES.TETH,
      18,
      20000,
      150,
      "100000000000000000000000000",
      false,
      true
    ]
  },
  
  whitelistTBTC: {
    target: CONTRACT_ADDRESSES.CUSTOM_VAULT,
    action: "setTokenConfig",
    args: [
      CONTRACT_ADDRESSES.TBTC,
      8,
      20000,
      150,
      "50000000000000000000000000",
      false,
      true
    ]
  }
};
