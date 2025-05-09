// Script to validate and fix private key format
const fs = require('fs');
const path = require('path');
const { ethers } = require("ethers");

async function main() {
  try {
    console.log("Validating private key format...");
    
    // Read env.json
    const envPath = path.join(__dirname, '..', 'env.json');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envJson = JSON.parse(envContent);
    
    // Get the current private key
    const currentKey = envJson.WORLDCHAIN_DEPLOY_KEY;
    console.log("Current key format:", 
      currentKey.startsWith('0x') ? "Has 0x prefix" : "No 0x prefix", 
      `Length: ${currentKey.length}`
    );
    
    // Format the key correctly
    let formattedKey = currentKey;
    
    // Remove 0x prefix if it exists
    if (formattedKey.startsWith('0x')) {
      formattedKey = formattedKey.substring(2);
    }
    
    // Ensure the key is 64 characters (32 bytes)
    if (formattedKey.length !== 64) {
      console.error(`Invalid key length: ${formattedKey.length}. Expected 64 hex characters.`);
      return;
    }
    
    // Add 0x prefix and save
    formattedKey = `0x${formattedKey}`;
    console.log(`Formatted key: ${formattedKey.substring(0, 6)}...${formattedKey.substring(formattedKey.length - 4)}`);
    
    // Test if key is valid
    try {
      const wallet = new ethers.Wallet(formattedKey);
      console.log(`Valid key! Derived address: ${wallet.address}`);
      
      // Update the key in env.json
      envJson.WORLDCHAIN_DEPLOY_KEY = formattedKey;
      fs.writeFileSync(envPath, JSON.stringify(envJson, null, 2));
      console.log("Updated env.json with correctly formatted key");
    } catch (error) {
      console.error("Error creating wallet with the key:", error.message);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
