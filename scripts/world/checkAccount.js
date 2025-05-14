async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
