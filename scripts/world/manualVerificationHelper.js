const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const solc = require('solc');

/**
 * Helper script to prepare contract verification data for manual submission
 * to worldscan.org explorers
 */
async function main() {
  console.log("======================================================");
  console.log("MANUAL CONTRACT VERIFICATION HELPER");
  console.log("======================================================");
  
  // Load deployment data
  const deploymentFilePath = path.join(__dirname, '../../.world-custom-deployment.json');
  let deploymentData;
  
  try {
    const data = fs.readFileSync(deploymentFilePath, 'utf8');
    deploymentData = JSON.parse(data);
    console.log("✅ Successfully loaded deployment data");
  } catch (error) {
    console.error("❌ Error loading deployment data:", error);
    process.exit(1);
  }
  
  // Get SimplePriceFeed address
  const simplePriceFeedAddress = deploymentData.TestEnvironment?.contracts?.SimplePriceFeed 
    || deploymentData.SimplePriceFeed;
    
  if (!simplePriceFeedAddress) {
    console.error("❌ SimplePriceFeed address not found in deployment data");
    process.exit(1);
  }
  
  console.log(`\nPreparing verification data for SimplePriceFeed at ${simplePriceFeedAddress}`);
  
  // Get compiler version from the compiler output
  const compilerVersion = await getCompilerVersion();
  console.log(`\nCompiler version: ${compilerVersion}`);
  
  // Get source code and ABI
  const sourceCode = fs.readFileSync(
    path.join(__dirname, '../../contracts/oracle/SimplePriceFeed.sol'),
    'utf8'
  );
  
  // Get flattened source code
  console.log("\nFlattening source code...");
  await flattenSourceCode(
    path.join(__dirname, '../../contracts/oracle/SimplePriceFeed.sol'),
    path.join(__dirname, '../../flatten-SimplePriceFeed.sol')
  );
  
  const flattenedSourceCode = fs.readFileSync(
    path.join(__dirname, '../../flatten-SimplePriceFeed.sol'),
    'utf8'
  );
  
  // Create verification guide
  console.log("\nCreating verification guide...");
  
  const verificationGuide = `
======================================================
MANUAL VERIFICATION GUIDE FOR SIMPLEPRICEFEED
======================================================

Contract Address: ${simplePriceFeedAddress}
Contract Name: SimplePriceFeed
Compiler Version: ${compilerVersion}
Optimization: Yes
Optimization Runs: 200
License: MIT

Constructor Arguments: []

Steps to verify on worldscan.org:

1. Go to https://worldscan.org
2. Search for the contract address: ${simplePriceFeedAddress}
3. Click on "Contract" tab
4. Click "Verify and Publish"
5. Enter the following details:
   - Contract Name: SimplePriceFeed
   - Compiler Version: ${compilerVersion}
   - Optimization: Yes
   - Optimization Runs: 200
   - License: MIT
6. Paste the flattened source code (saved to flatten-SimplePriceFeed.sol)
7. Click "Verify and Publish"

The flattened source code has been saved to:
- flatten-SimplePriceFeed.sol

======================================================

If you need to verify test tokens, you can use a similar process
for each token address.
`;
  
  // Save the guide to a file
  fs.writeFileSync(
    path.join(__dirname, '../../VERIFICATION_GUIDE.md'),
    verificationGuide
  );
  
  console.log("\n✅ Verification guide saved to VERIFICATION_GUIDE.md");
  console.log("✅ Flattened source code saved to flatten-SimplePriceFeed.sol");
  
  console.log("\n======================================================");
  console.log("VERIFICATION PREPARATION COMPLETE");
  console.log("======================================================");
  
  console.log(`
Next Steps:
1. Use the guide in VERIFICATION_GUIDE.md to manually verify on worldscan.org
2. Proceed with frontend integration after verification
  `);
}

/**
 * Get compiler version from package.json or hardhat config
 */
async function getCompilerVersion() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    );
    
    const solcVersion = packageJson.devDependencies.solc;
    
    if (solcVersion) {
      return solcVersion.replace('^', 'v').replace('~', 'v');
    }
    
    // If not found in package.json, try hardhat config
    const hardhatConfig = require('../../hardhat.config');
    return `v${hardhatConfig.solidity.version || hardhatConfig.solidity.compilers[0].version || '0.6.12'}`;
  } catch (error) {
    console.warn(`Warning: Could not determine compiler version: ${error.message}`);
    return 'v0.6.12'; // Default for GMX contracts
  }
}

/**
 * Flatten source code using hardhat flatten
 */
async function flattenSourceCode(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    exec(`npx hardhat flatten ${sourcePath} > ${outputPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error flattening source code: ${error.message}`);
        reject(error);
        return;
      }
      
      // Remove duplicate SPDX license identifiers
      let flattened = fs.readFileSync(outputPath, 'utf8');
      const licenseLine = '// SPDX-License-Identifier: MIT';
      
      // Count occurrences
      const count = (flattened.match(new RegExp(licenseLine, 'g')) || []).length;
      
      if (count > 1) {
        // Replace all but the first occurrence
        flattened = flattened.replace(
          new RegExp(`(${licenseLine}\\n)`, 'g'), 
          (match, p1, offset) => {
            return offset === flattened.indexOf(licenseLine) ? match : '\n';
          }
        );
        
        fs.writeFileSync(outputPath, flattened);
      }
      
      resolve();
    });
  });
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
