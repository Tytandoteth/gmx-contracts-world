# Manual Contract Verification Guide for World Chain

Since the World Chain explorer may require manual verification, this guide provides instructions for verifying your contracts directly through the explorer UI.

## Contracts to Verify

| Contract Name | Address | Source File |
|---------------|---------|-------------|
| SimplePriceFeed (New) | 0x7e402dE1894f3dCed30f9bECBc51aD08F2016095 | contracts/core/SimplePriceFeed.sol |
| Vault | 0x6519E08ecC9B2763FbEf360132a8303dc2E9ccE5 | contracts/core/Vault.sol |
| VaultPriceFeed | 0x8727D91C1174b4ab7CfD5780296aAE8Ef4b0E6Bf | contracts/core/VaultPriceFeed.sol |
| Router | 0x1958F6Cba8eb87902bDc1805A2a3bD5842BE645b | contracts/core/Router.sol |

## Manual Verification Steps

1. **Visit the World Chain Explorer**:
   - Go to [https://worldscan.org](https://worldscan.org)

2. **Search for the Contract**:
   - Enter the contract address in the search bar
   - Click on the "Contract" tab

3. **Start Verification Process**:
   - Click on "Verify & Publish" button

4. **Enter Contract Details**:
   - Contract Name: The name from the table above
   - Compiler Type: Solidity (Single file)
   - Compiler Version: 0.6.12
   - Optimization: Yes
   - Optimization Runs: 200

5. **Enter Contract Source Code**:
   - Copy the entire source code from the corresponding file
   - Make sure to include all imports and the SPDX license identifier

6. **Add Constructor Arguments (if applicable)**:
   - For SimplePriceFeed: No constructor arguments needed
   - For other contracts: You'll need the original deployment arguments

7. **Submit for Verification**

## Verifying SimplePriceFeed (New Priority)

Since this is our newly deployed contract that's critical for the frontend integration, here's the specific code for SimplePriceFeed:

```solidity
// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "./interfaces/IPriceFeed.sol";

contract SimplePriceFeed is IPriceFeed {
    using SafeMath for uint256;

    mapping (address => uint256) public prices;
    address public gov;

    constructor() public {
        gov = msg.sender;
    }

    modifier onlyGov() {
        require(msg.sender == gov, "SimplePriceFeed: forbidden");
        _;
    }

    function setGov(address _gov) external onlyGov {
        gov = _gov;
    }

    function setPrices(address[] memory _tokens, uint256[] memory _prices) external onlyGov {
        for (uint256 i = 0; i < _tokens.length; i++) {
            prices[_tokens[i]] = _prices[i];
        }
    }

    function getPrice(address _token) external view override returns (uint256) {
        require(prices[_token] > 0, "SimplePriceFeed: invalid price");
        return prices[_token];
    }
}
```

## Alternative: Automated Verification

If you want to try hardhat verification, you'll need to add your World Chain explorer API key to the configuration:

1. **Get an API Key**:
   - Register on the World Chain explorer 
   - Apply for an API key in your account settings

2. **Update hardhat.config.js**:
   ```javascript
   etherscan: {
     apiKey: {
       worldchain: "YOUR_API_KEY_HERE"
     },
     // ... rest of config
   }
   ```

3. **Run Verification Command**:
   ```bash
   npx hardhat verify --network worldchain 0x7e402dE1894f3dCed30f9bECBc51aD08F2016095
   ```

## Verification Status

After verification, your contracts will show verified status on the explorer, allowing users to:
- View and interact with contract code
- Read contract state
- Verify contract functions
- Trust the deployed implementation

## Note on Existing Contracts

Many of the existing contracts in your deployment might already be verified. You can check their status by visiting their addresses on the explorer.
