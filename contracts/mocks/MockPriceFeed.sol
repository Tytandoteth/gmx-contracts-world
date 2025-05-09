
// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract MockPriceFeed {
    uint256 public price;
    uint8 public decimals;
    string public description;
    uint256 public roundId;
    
    constructor(uint256 _price) public {
        price = _price;
        decimals = 8;
        description = "Mock Price Feed";
        roundId = 0;
    }
    
    function setPrice(uint256 _price) external {
        price = _price;
        roundId = roundId + 1;
    }
    
    function latestAnswer() external view returns (int256) {
        return int256(price);
    }
    
    function latestRoundData() external view returns (
        uint80 roundId_,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            uint80(roundId),
            int256(price),
            block.timestamp,
            block.timestamp,
            uint80(roundId)
        );
    }
    
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId_,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        require(_roundId <= uint80(roundId), "MockPriceFeed: Invalid round id");
        return (
            _roundId,
            int256(price),
            block.timestamp,
            block.timestamp,
            _roundId
        );
    }
}