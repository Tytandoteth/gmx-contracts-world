require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-contract-sizer")
require('@typechain/hardhat')

const {
  BSC_URL,
  BSC_DEPLOY_KEY,
  BSCSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  SNOWTRACE_API_KEY,
  ARBISCAN_API_KEY,
  ETHERSCAN_API_KEY,
  BSC_TESTNET_URL,
  BSC_TESTNET_DEPLOY_KEY,
  ARBITRUM_TESTNET_DEPLOY_KEY,
  ARBITRUM_TESTNET_URL,
  ARBITRUM_DEPLOY_KEY,
  ARBITRUM_URL,
  AVAX_DEPLOY_KEY,
  AVAX_URL,
  POLYGON_DEPLOY_KEY,
  POLYGON_URL,
  MAINNET_URL,
  MAINNET_DEPLOY_KEY,
  WORLDCHAIN_URL,
  WORLDCHAIN_DEPLOY_KEY
} = require("./env.json")

const getEnvAccounts = (DEFAULT_DEPLOYER_KEY) => {
  return [DEFAULT_DEPLOYER_KEY];
};

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners()

  for (const account of accounts) {
    console.info(account.address)
  }
})

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs) => {
    const balance = await ethers.provider.getBalance(taskArgs.account);

    console.log(ethers.utils.formatEther(balance), "ETH");
  });

task("processFees", "Processes fees")
  .addParam("steps", "The steps to run")
  .setAction(async (taskArgs) => {
    const { processFees } = require("./scripts/core/processFees")
    await processFees(taskArgs)
  })

task("distributeFees", "Distribute fees")
  .addParam("steps", "The steps to run")
  .setAction(async (taskArgs) => {
    const { distributeFees } = require("./scripts/fees/distributeFees")
    await distributeFees(taskArgs)
  })

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  etherscan: {
    apiKey: {
      // World Chain explorer (worldscan.org)
      worldchain: "BY7PSJ47E1223NWXGXANKBC4YD8S8SBAYU"
    },
    customChains: [
      {
        network: "worldchain",
        chainId: 480,
        urls: {
          apiURL: "https://api.worldscan.org/api",
          browserURL: "https://worldscan.org"
        }
      }
    ]
  },
  networks: {
    localhost: {
      timeout: 120000
    },
    worldchain: {
      url: "https://sleek-little-leaf.worldchain-mainnet.quiknode.pro/49cff082c3f8db6bc60bd05d7256d2fda94a42cd/",
      chainId: 480,                         // World Chain's correct chainId
      accounts: [WORLDCHAIN_DEPLOY_KEY],    // Use direct key reference
      gas: 5000000,                         // Default gas limit
      gasPrice: 1000000000,                 // 1 gwei
      timeout: 120000                       // Longer timeout for World Chain
    },
    hardhat: {
      allowUnlimitedContractSize: true
    },
    bsc: {
      url: BSC_URL,
      chainId: 56,
      gasPrice: 10000000000,
      accounts: getEnvAccounts(BSC_DEPLOY_KEY)
    },
    testnet: {
      url: BSC_TESTNET_URL,
      chainId: 97,
      gasPrice: 20000000000,
      accounts: getEnvAccounts(BSC_TESTNET_DEPLOY_KEY)
    },
    arbitrumTestnet: {
      url: ARBITRUM_TESTNET_URL,
      gasPrice: 10000000000,
      chainId: 421611,
      accounts: getEnvAccounts(ARBITRUM_TESTNET_DEPLOY_KEY)
    },
    arbitrum: {
      url: ARBITRUM_URL,
      gasPrice: 30000000000,
      chainId: 42161,
      accounts: getEnvAccounts(ARBITRUM_DEPLOY_KEY)
    },
    base: {
      url: "https://base.llamarpc.com",
      gasPrice: 30000000000,
      chainId: 8453,
      accounts: getEnvAccounts(ARBITRUM_DEPLOY_KEY)
    },
    avax: {
      url: AVAX_URL,
      gasPrice: 100000000000,
      chainId: 43114,
      accounts: getEnvAccounts(AVAX_DEPLOY_KEY)
    },
    polygon: {
      url: POLYGON_URL,
      gasPrice: 100000000000,
      chainId: 137,
      accounts: getEnvAccounts(POLYGON_DEPLOY_KEY)
    },
    mainnet: {
      url: MAINNET_URL,
      gasPrice: 50000000000,
      accounts: getEnvAccounts(MAINNET_DEPLOY_KEY)
    }
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      avalanche: SNOWTRACE_API_KEY,
      bsc: BSCSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10
          }
        }
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
}
