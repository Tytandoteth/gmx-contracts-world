const { ethers } = require("hardhat");

async function main() {
  try {
    console.log("Checking account nonce on World Chain...");
    
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Account address: ${deployer.address}`);
    
    // Get the current nonce from the network
    const currentNonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log(`Current nonce on World Chain: ${currentNonce}`);
    
    // Get wallet balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
    
    // Send a simple transaction with a specific nonce to reset nonce tracking
    if (balance.gt(ethers.utils.parseEther("0.01"))) {
      console.log("Sending a tiny transaction to reset nonce...");
      
      // Send a small amount to yourself with the correct nonce
      const tx = await deployer.sendTransaction({
        to: deployer.address,
        value: ethers.utils.parseEther("0.001"),
        nonce: currentNonce,
        gasPrice: ethers.utils.parseUnits("10", "gwei"),
        gasLimit: 21000
      });
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      await tx.wait();
      
      console.log("Transaction confirmed!");
      console.log("Nonce reset successful");
      
      // Get the new nonce
      const newNonce = await ethers.provider.getTransactionCount(deployer.address);
      console.log(`New nonce: ${newNonce}`);
    } else {
      console.log("Insufficient balance to reset nonce. Please fund your account first.");
    }
    
    console.log("\nNext steps:");
    console.log("1. Try deploying again with: npx hardhat run scripts/worldchain/deployWLD.js --network worldchain");
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
