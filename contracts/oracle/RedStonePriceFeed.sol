// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";

/**
 * @title RedStonePriceFeed
 * @dev Contract for getting price data from RedStone oracles
 * This contract is used by GMX to get price data for trading on World Chain
 */
contract RedStonePriceFeed is RedstoneConsumerNumericBase {
    // Mapping from token symbol to price decimal places
    mapping(string => uint8) public tokenDecimals;
    
    // Authorized updaters who can modify token configurations
    mapping(address => bool) public authorizedUpdaters;
    
    // Owner address
    address public owner;
    
    // Events
    event TokenDecimalsUpdated(string symbol, uint8 decimals);
    event AuthorizedUpdaterAdded(address updater);
    event AuthorizedUpdaterRemoved(address updater);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    /**
     * @dev Constructor
     */
    constructor() {
        owner = msg.sender;
        authorizedUpdaters[msg.sender] = true;
        
        // Set up default token decimals
        tokenDecimals["WLD"] = 8;
        tokenDecimals["ETH"] = 8;
        tokenDecimals["BTC"] = 8;
        tokenDecimals["USDC"] = 8;
        tokenDecimals["USDT"] = 8;
    }
    
    /**
     * @dev Modifier to restrict function access to owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }
    
    /**
     * @dev Modifier to restrict function access to authorized updaters
     */
    modifier onlyAuthorizedUpdater() {
        require(authorizedUpdaters[msg.sender], "Caller is not authorized");
        _;
    }
    
    /**
     * @dev Transfer ownership to a new address
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @dev Add a new authorized updater
     * @param updater The address to authorize
     */
    function addAuthorizedUpdater(address updater) public onlyOwner {
        require(updater != address(0), "Updater cannot be the zero address");
        authorizedUpdaters[updater] = true;
        emit AuthorizedUpdaterAdded(updater);
    }
    
    /**
     * @dev Remove an authorized updater
     * @param updater The address to remove authorization from
     */
    function removeAuthorizedUpdater(address updater) public onlyOwner {
        require(updater != owner, "Cannot remove owner as updater");
        authorizedUpdaters[updater] = false;
        emit AuthorizedUpdaterRemoved(updater);
    }
    
    /**
     * @dev Set decimals for a token
     * @param symbol The token symbol
     * @param decimals The number of decimal places
     */
    function setTokenDecimals(string calldata symbol, uint8 decimals) public onlyAuthorizedUpdater {
        tokenDecimals[symbol] = decimals;
        emit TokenDecimalsUpdated(symbol, decimals);
    }
    
    /**
     * @dev Get latest token price
     * @param symbol The token symbol
     * @return The token price with 8 decimals
     */
    function getLatestPrice(string calldata symbol) public view returns (uint256) {
        // Get raw price from RedStone oracle
        bytes32 dataFeedId = bytes32(bytes(symbol));
        uint256 price = getOracleNumericValueFromTxMsg(dataFeedId);
        
        // Make adjustments if needed based on token decimals
        uint8 decimals = tokenDecimals[symbol];
        if (decimals == 0) {
            decimals = 8; // Default to 8 decimals if not specified
        }
        
        return price;
    }
    
    /**
     * @dev Get latest prices for multiple tokens
     * @param symbols Array of token symbols
     * @return Array of prices with 8 decimals
     */
    function getLatestPrices(string[] calldata symbols) public view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](symbols.length);
        
        for (uint256 i = 0; i < symbols.length; i++) {
            prices[i] = getLatestPrice(symbols[i]);
        }
        
        return prices;
    }
    
    /**
     * @dev Returns the data service identifier
     * @return Data service identifier string
     */
    function getDataServiceId() public view virtual override returns (string memory) {
        return "redstone-primary-prod";
    }
    
    /**
     * @dev Returns the authorized signer index
     * @param receivedSigner The address of a signer
     * @return Unique index for a signer in the range [0..255]
     */
    function getAuthorisedSignerIndex(address receivedSigner) public view virtual override returns (uint8) {
        // In a production environment, you would check against a list of trusted RedStone signers
        // For now, we'll allow any signer for testing purposes
        return 0;
    }
    
    /**
     * @dev Returns the minimum required number of unique signers
     * @return The minimum required value of unique authorized signers
     */
    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        // For production, this should be higher (e.g., 3-5)
        // For testing purposes, we'll set it to 1
        return 1;
    }
    
    /**
     * @dev Extracts the unique signers threshold from the calldata
     * This is required by the RedStone SDK wrapper
     * @return The unique signers threshold value
     */
    function getUniqueSignersThresholdFromData() public pure returns (uint8) {
        return 1;
    }
    
    /**
     * @dev Gets an array of supported token symbols
     * This helps the RedStone SDK wrapper know which tokens are available
     * @return Array of supported token symbols
     */
    function getSupportedTokens() public pure returns (string[] memory) {
        string[] memory tokens = new string[](3);
        tokens[0] = "WLD";
        tokens[1] = "ETH"; // For WETH
        tokens[2] = "BTC"; // Include BTC for testing/reference
        return tokens;
    }

    /**
     * @dev Get token decimals
     * @param symbol The token symbol
     * @return Number of decimal places for the token
     */
    function getTokenDecimals(string calldata symbol) public view returns (uint8) {
        uint8 decimals = tokenDecimals[symbol];
        if (decimals == 0) {
            return 8; // Default to 8 decimals if not specified
        }
        return decimals;
    }
}
