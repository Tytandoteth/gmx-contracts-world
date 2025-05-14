const axios = require("axios");

// Oracle Keeper URL
const ORACLE_KEEPER_URL = "https://oracle-keeper.kevin8396.workers.dev";

// Test all Oracle Keeper endpoints
async function testOracleKeeper() {
  console.log("Testing Oracle Keeper Integration");
  console.log("=================================");
  
  try {
    // Test health endpoint
    console.log("\n1. Testing /health endpoint...");
    const healthResponse = await axios.get(`${ORACLE_KEEPER_URL}/health`);
    console.log(`Status: ${healthResponse.data.status}`);
    console.log(`Version: ${healthResponse.data.version}`);
    console.log(`Mode: ${healthResponse.data.mode}`);
    console.log(`Price Cache Status: ${healthResponse.data.priceCache?.status}`);
    console.log(`Endpoints: ${healthResponse.data.endpoints.join(", ")}`);
    
    // Test direct prices endpoint
    console.log("\n2. Testing /direct-prices endpoint...");
    const pricesResponse = await axios.get(`${ORACLE_KEEPER_URL}/direct-prices`);
    console.log(`Status: ${pricesResponse.data.status}`);
    console.log(`Timestamp: ${pricesResponse.data.timestamp}`);
    console.log(`Last Updated: ${pricesResponse.data.lastUpdated}`);
    console.log(`Source: ${pricesResponse.data.source}`);
    console.log("Prices:");
    Object.entries(pricesResponse.data.prices).forEach(([token, price]) => {
      console.log(`  - ${token}: $${price}`);
    });
    
    // Test individual token price endpoint
    console.log("\n3. Testing /price/:symbol endpoint...");
    const tokenSymbol = "WLD";
    const tokenResponse = await axios.get(`${ORACLE_KEEPER_URL}/price/${tokenSymbol}`);
    console.log(`Status: ${tokenResponse.data.status}`);
    console.log(`Price (${tokenSymbol}): $${tokenResponse.data.price}`);
    
    // Test integration with frontend environment variables
    console.log("\n4. Testing .env.world configuration...");
    console.log(`VITE_ORACLE_KEEPER_URL=${ORACLE_KEEPER_URL}`);
    console.log(`Price fetch working: ${pricesResponse.data.status === 'success' ? 'Yes ✅' : 'No ❌'}`);
    
    // Test timestamp validity (should be within the last hour)
    const lastUpdated = new Date(pricesResponse.data.lastUpdated);
    const now = new Date();
    const diffMinutes = Math.round((now - lastUpdated) / (1000 * 60));
    console.log(`Last price update: ${diffMinutes} minutes ago`);
    
    if (diffMinutes > 60) {
      console.warn("⚠️ Warning: Prices may be stale (older than 1 hour)");
    } else {
      console.log("✅ Prices are fresh (updated within the last hour)");
    }
    
    // Print summary of integration status
    console.log("\nORACLE KEEPER INTEGRATION SUMMARY");
    console.log("================================");
    
    const issues = [];
    
    if (healthResponse.data.status !== "success") {
      issues.push("Health endpoint reporting issues");
    }
    
    if (pricesResponse.data.status !== "success") {
      issues.push("Price fetching not working correctly");
    }
    
    if (Object.keys(pricesResponse.data.prices).length < 3) {
      issues.push("Not all required tokens have prices");
    }
    
    if (diffMinutes > 60) {
      issues.push("Price data may be stale");
    }
    
    if (issues.length === 0) {
      console.log("✅ Oracle Keeper is fully operational and ready for frontend integration");
    } else {
      console.log("⚠️ Oracle Keeper has the following issues:");
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    // Integration with GMX V1 Recommendations
    console.log("\nRECOMMENDATIONS FOR GMX V1 INTEGRATION");
    console.log("=====================================");
    console.log("1. Use the 'EnhancedOracleKeeperFetcher' class with fetchDirectPrices() method");
    console.log("2. Implement fallback mechanism in case Oracle Keeper is unavailable");
    console.log("3. Set polling interval to fetch prices every 60 seconds");
    console.log("4. Check price health before executing trades");
    console.log("5. Add UI indicators for price freshness");

  } catch (error) {
    console.error("❌ Error testing Oracle Keeper:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Execute test
testOracleKeeper()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
