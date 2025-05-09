const fs = require('fs');
const path = require('path');

// Check if env.json exists, otherwise create from example
if (!fs.existsSync(path.join(__dirname, '..', 'env.json'))) {
  console.log('Creating env.json from env.example.json...');
  const exampleEnv = require('../env.example.json');
  
  // Add World Chain configuration
  const worldchainEnv = {
    ...exampleEnv,
    WORLDCHAIN_URL: "https://rpc.worldchain.network",
    WORLDCHAIN_DEPLOY_KEY: "${PRIVATE_KEY}" // Will be replaced by actual private key
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'env.json'),
    JSON.stringify(worldchainEnv, null, 2)
  );
  
  console.log('Created env.json with World Chain configuration.');
  console.log('IMPORTANT: Update env.json with your actual private key before deployment.');
}

// Update hardhat.config.js to use env.json values
const configPath = path.join(__dirname, '..', 'hardhat.config.js');
let hardhatConfig = fs.readFileSync(configPath, 'utf8');

// Check if we need to add imports for env.json variables
if (!hardhatConfig.includes('WORLDCHAIN_URL')) {
  console.log('Updating hardhat.config.js to use World Chain environment variables...');
  
  // Find the env.json import section
  const envImportRegex = /const \{\s*.*\s*\} = require\("\.\/env\.json"\)/;
  const envImportMatch = hardhatConfig.match(envImportRegex);
  
  if (envImportMatch) {
    const envImport = envImportMatch[0];
    const lastBracketIndex = envImport.lastIndexOf('}');
    
    // Add World Chain variables to import
    const updatedEnvImport = 
      envImport.substring(0, lastBracketIndex) + 
      ',\n  WORLDCHAIN_URL,\n  WORLDCHAIN_DEPLOY_KEY\n}' + 
      envImport.substring(lastBracketIndex + 1);
    
    hardhatConfig = hardhatConfig.replace(envImportRegex, updatedEnvImport);
    
    // Update worldchain network config to use env variables
    const worldchainConfigRegex = /worldchain:\s*{[^}]*}/;
    const worldchainConfigReplacement = `worldchain: {
      url: WORLDCHAIN_URL,
      chainId: 12345,
      accounts: getEnvAccounts(WORLDCHAIN_DEPLOY_KEY)
    }`;
    
    hardhatConfig = hardhatConfig.replace(worldchainConfigRegex, worldchainConfigReplacement);
    
    fs.writeFileSync(configPath, hardhatConfig);
    console.log('Updated hardhat.config.js to use environment variables from env.json');
  }
}

console.log('\nEnvironment setup complete for World Chain deployment.');
console.log('Next steps:');
console.log('1. Update env.json with your private key (WORLDCHAIN_DEPLOY_KEY)');
console.log('2. Run deployment scripts in the following order:');
console.log('   - npx hardhat run scripts/tokens/deployWLDToken.js --network worldchain');
console.log('   - npx hardhat run scripts/deploy-core.js --network worldchain');
console.log('   - npx hardhat run scripts/deploy-periphery.js --network worldchain');
console.log('   - npx hardhat run scripts/deployGovToken.js --network worldchain (optional)');
