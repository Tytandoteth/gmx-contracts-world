const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log("Updating the private key for World Chain deployment...");
    
    // New private key provided by the user
    const privateKey = "5adf6f5907f05eef5a22e2b1faa89fa139f5c367cca84d9a52dcb408c43cb4b2";
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    // Create a backup of the current env.json
    const envPath = path.join(__dirname, '..', 'env.json');
    if (fs.existsSync(envPath)) {
      const backupPath = path.join(__dirname, '..', 'env.json.backup');
      fs.copyFileSync(envPath, backupPath);
      console.log(`Created backup of env.json at ${backupPath}`);
      
      // Update env.json with the new private key
      const envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      envData.WORLDCHAIN_DEPLOY_KEY = formattedKey;
      fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
      console.log(`Updated env.json with the new private key`);
    }
    
    console.log("\nPrivate key updated successfully. Now you can run the deployment scripts again.");
    
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
