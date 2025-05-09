const { ethers } = require("hardhat");

async function main() {
  console.log("Resetting nonce issues by sending a small transaction to self...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Send a small amount of ETH to self with higher gas price to clear any pending transactions
  const tx = await deployer.sendTransaction({
    to: deployer.address,
    value: ethers.utils.parseEther("0.0001"),
    gasPrice: ethers.utils.parseUnits("10", "gwei"),
    gasLimit: 21000
  });
  
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log("Transaction confirmed, nonce reset successful");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
