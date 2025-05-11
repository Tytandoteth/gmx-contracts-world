// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "./interfaces/IPriceFeed.sol";
import "../access/Governable.sol";

/**
 * @title SimplePriceFeed
 * @notice A simplified price feed implementation that doesn't require complex Oracle wrapping
 * This serves as a bridge solution while we finalize Witnet Oracle integration
 */
contract SimplePriceFeed is IPriceFeed, Governable {
    using SafeMath for uint256;
    
    uint256 public constant PRICE_PRECISION = 10 ** 30;
    
    // Price storage for each token
    mapping(address => uint256) public prices;
    
    // Timestamp of last price update for each token
    mapping(address => uint256) public lastUpdatedTimestamps;
    
    // Maximum age of price data in seconds
    uint256 public maxPriceAge = 1 days; // 1 day by default - more lenient for this simplified version
    
    event PriceUpdate(address token, uint256 price, uint256 timestamp);
    event MaxPriceAgeUpdate(uint256 maxPriceAge);
    
    constructor() public {}
    
    /**
     * @notice Set the maximum age for price data
     * @param _maxPriceAge Maximum age in seconds
     */
    function setMaxPriceAge(uint256 _maxPriceAge) external onlyGov {
        require(_maxPriceAge > 0, "SimplePriceFeed: invalid max price age");
        maxPriceAge = _maxPriceAge;
        emit MaxPriceAgeUpdate(_maxPriceAge);
    }
    
    /**
     * @notice Update price for a token
     * @param _token Token address
     * @param _price Price value with PRICE_PRECISION decimals
     */
    function updatePrice(address _token, uint256 _price) external onlyGov {
        require(_token != address(0), "SimplePriceFeed: invalid token");
        require(_price > 0, "SimplePriceFeed: invalid price");
        
        prices[_token] = _price;
        lastUpdatedTimestamps[_token] = block.timestamp;
        
        emit PriceUpdate(_token, _price, block.timestamp);
    }
    
    /**
     * @notice Batch update prices for multiple tokens
     * @param _tokens Array of token addresses
     * @param _prices Array of price values with PRICE_PRECISION decimals
     */
    function updatePrices(address[] calldata _tokens, uint256[] calldata _prices) external onlyGov {
        require(_tokens.length == _prices.length, "SimplePriceFeed: length mismatch");
        
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "SimplePriceFeed: invalid token");
            require(_prices[i] > 0, "SimplePriceFeed: invalid price");
            
            prices[_tokens[i]] = _prices[i];
            lastUpdatedTimestamps[_tokens[i]] = block.timestamp;
            
            emit PriceUpdate(_tokens[i], _prices[i], block.timestamp);
        }
    }
    
    /**
     * @notice Get the latest price for a token
     * @param _token Token address
     * @return Price with PRICE_PRECISION decimals
     */
    function getLatestPrice(address _token) external view returns (uint256) {
        require(prices[_token] > 0, "SimplePriceFeed: no price for token");
        
        uint256 lastUpdated = lastUpdatedTimestamps[_token];
        require(lastUpdated > 0, "SimplePriceFeed: price not set");
        require(block.timestamp.sub(lastUpdated) <= maxPriceAge, "SimplePriceFeed: price too old");
        
        return prices[_token];
    }
    
    /**
     * @notice Get description of this price feed
     * @return Description string
     */
    function description() external view override returns (string memory) {
        return "SimplePriceFeed for GMX on World Chain";
    }
    
    /**
     * @notice Get aggregator address (not used in this implementation)
     * @return Zero address as this doesn't use an aggregator
     */
    function aggregator() external view override returns (address) {
        return address(0);
    }
    
    /**
     * @notice Get latest price as int256 (for compatibility)
     * @return Default value as this function isn't used
     */
    function latestAnswer() external view override returns (int256) {
        return 0;
    }
    
    /**
     * @notice Get latest round ID (for compatibility)
     * @return Default value as this function isn't used
     */
    function latestRound() external view override returns (uint80) {
        return 0;
    }
    
    /**
     * @notice Get data for a specific round (for compatibility)
     * @return Default values as this function isn't used
     */
    function getRoundData(uint80 roundId) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (0, 0, 0, 0, 0);
    }
    
    /**
     * @notice Check if price is available for a token
     * @param _token Token address
     * @return True if price is available
     */
    function hasPriceFeed(address _token) public view returns (bool) {
        return prices[_token] > 0 && lastUpdatedTimestamps[_token] > 0;
    }
}
