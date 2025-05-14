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