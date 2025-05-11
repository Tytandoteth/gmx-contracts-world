// Sources flattened with hardhat v2.12.0 https://hardhat.org

// File contracts/access/Governable.sol

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

contract Governable {
    address public gov;

    constructor() public {
        gov = msg.sender;
    }

    modifier onlyGov() {
        require(msg.sender == gov, "Governable: forbidden");
        _;
    }

    function setGov(address _gov) external onlyGov {
        gov = _gov;
    }
}


// File contracts/oracle/interfaces/IPriceFeed.sol



pragma solidity 0.6.12;

interface IPriceFeed {
    function description() external view returns (string memory);
    function aggregator() external view returns (address);
    function latestAnswer() external view returns (int256);
    function latestRound() external view returns (uint80);
    function getRoundData(uint80 roundId) external view returns (uint80, int256, uint256, uint256, uint80);
}


// File contracts/libraries/math/SafeMath.sol



pragma solidity 0.6.12;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}


// File contracts/oracle/SimplePriceFeed.sol



pragma solidity 0.6.12;



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
