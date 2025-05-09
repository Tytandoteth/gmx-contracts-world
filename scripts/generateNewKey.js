const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log("Generating a new private key for World Chain deployment...");
    
    // Generate a new random wallet
    const wallet = ethers.Wallet.createRandom();
    
    console.log("\n=== NEW WALLET GENERATED ===");
    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key (with 0x): ${wallet.privateKey}`);
    console.log(`Private Key (without 0x): ${wallet.privateKey.substring(2)}`);
    
    // Create a backup of the current env.json
    const envPath = path.join(__dirname, '..', 'env.json');
    if (fs.existsSync(envPath)) {
      const backupPath = path.join(__dirname, '..', 'env.json.backup');
      fs.copyFileSync(envPath, backupPath);
      console.log(`\nCreated backup of env.json at ${backupPath}`);
      
      // Update env.json with the new private key
      const envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      envData.WORLDCHAIN_DEPLOY_KEY = wallet.privateKey;
      fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
      console.log(`Updated env.json with the new private key`);
    }
    
    console.log("\nIMPORTANT: This wallet has no funds yet. You need to send some WORLD tokens to this address before deploying contracts.");
    console.log("\nNext steps:");
    console.log("1. Send WORLD tokens to the new wallet address");
    console.log("2. Run the deployment scripts again");
    
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
