// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "./interfaces/IPriceFeed.sol";
import "./interfaces/IWitnetPriceRouter.sol";
import "../access/Governable.sol";

/**
 * @title WitnetPriceFeed
 * @notice Price feed implementation using Witnet Oracle
 * This contract replaces RedStonePriceFeed for the GMX on World Chain project
 */
contract WitnetPriceFeed is IPriceFeed, Governable {
    using SafeMath for uint256;
    
    uint256 public constant PRICE_PRECISION = 10 ** 30;
    uint256 public constant WITNET_DECIMALS = 6;
    uint256 public constant SCALING_FACTOR = 10 ** (30 - WITNET_DECIMALS);
    
    IWitnetPriceRouter public immutable witnetPriceRouter;
    
    // Mapping from token address to Witnet price feed ID
    mapping(address => bytes4) public dataFeedIds;
    
    // Maximum age of price data in seconds
    uint256 public maxPriceAge = 60 * 60; // 1 hour by default
    
    event DataFeedIdSet(address token, bytes4 dataFeedId);
    event MaxPriceAgeSet(uint256 maxPriceAge);
    
    /**
     * @notice Constructor
     * @param _witnetPriceRouter Address of the Witnet Price Router contract
     */
    constructor(address _witnetPriceRouter) public {
        witnetPriceRouter = IWitnetPriceRouter(_witnetPriceRouter);
    }
    
    /**
     * @notice Set the price feed ID for a token
     * @param _token Token address
     * @param _dataFeedId Witnet price feed ID (bytes4)
     */
    function setDataFeedId(address _token, bytes4 _dataFeedId) external onlyGov {
        require(_token != address(0), "WitnetPriceFeed: invalid token");
        require(_dataFeedId != bytes4(0), "WitnetPriceFeed: invalid data feed id");
        require(witnetPriceRouter.supportsPriceFeed(_dataFeedId), "WitnetPriceFeed: unsupported price feed");
        
        dataFeedIds[_token] = _dataFeedId;
        emit DataFeedIdSet(_token, _dataFeedId);
    }
    
    /**
     * @notice Set the maximum age for price data
     * @param _maxPriceAge Maximum age in seconds
     */
    function setMaxPriceAge(uint256 _maxPriceAge) external onlyGov {
        require(_maxPriceAge > 0, "WitnetPriceFeed: invalid max price age");
        maxPriceAge = _maxPriceAge;
        emit MaxPriceAgeSet(_maxPriceAge);
    }
    
    /**
     * @notice Get the latest price for a token
     * @param _token Token address
     * @return Price with PRICE_PRECISION decimals
     */
    function getLatestPrice(address _token) external view returns (uint256) {
        bytes4 dataFeedId = dataFeedIds[_token];
        require(dataFeedId != bytes4(0), "WitnetPriceFeed: feed not found");
        
        (int256 price, uint256 timestamp, uint256 status) = witnetPriceRouter.valueFor(dataFeedId);
        
        require(status == 0, "WitnetPriceFeed: invalid status");
        require(timestamp > block.timestamp.sub(maxPriceAge), "WitnetPriceFeed: price too old");
        require(price > 0, "WitnetPriceFeed: invalid price");
        
        // Convert from Witnet's 6 decimals to PRICE_PRECISION (10^30)
        return uint256(price).mul(SCALING_FACTOR);
    }
    
    /**
     * @notice Check if price feed is configured for a token
     * @param _token Token address
     * @return True if price feed is configured
     */
    function hasPriceFeed(address _token) public view returns (bool) {
        bytes4 dataFeedId = dataFeedIds[_token];
        return dataFeedId != bytes4(0) && witnetPriceRouter.supportsPriceFeed(dataFeedId);
    }
    
    /**
     * @notice Get description of this price feed
     * @return Description string
     */
    function description() external view override returns (string memory) {
        return "WitnetPriceFeed for GMX on World Chain";
    }
    
    /**
     * @notice Get aggregator address (not used in this implementation)
     * @return The Witnet price router address
     */
    function aggregator() external view override returns (address) {
        return address(witnetPriceRouter);
    }
    
    /**
     * @notice Get latest price as int256 (for compatibility)
     * @return Default value as this function isn't used directly
     */
    function latestAnswer() external view override returns (int256) {
        return 0;
    }
    
    /**
     * @notice Get latest round ID (for compatibility)
     * @return Default value as this function isn't used directly
     */
    function latestRound() external view override returns (uint80) {
        return 0;
    }
    
    /**
     * @notice Get data for a specific round (for compatibility)
     * @return Default values as this function isn't used directly
     */
    function getRoundData(uint80 roundId) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (0, 0, 0, 0, 0);
    }
}
