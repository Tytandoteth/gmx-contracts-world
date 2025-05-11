// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

/**
 * @title IWitnetPriceRouter
 * @notice Interface for Witnet Price Router contracts
 */
interface IWitnetPriceRouter {
    /// @notice Estimate the current price of an asset from a specific price feed.
    /// @param _id The bytes4 ID of the price feed.
    /// @return _price The asset price in USD with 6 decimals.
    /// @return _timestamp The timestamp of the last price update.
    /// @return _status The status code of the price feed.
    function valueFor(bytes4 _id) external view returns (int256 _price, uint256 _timestamp, uint256 _status);
    
    /// @notice Check if a price feed is supported.
    /// @param _id The bytes4 ID of the price feed.
    /// @return True if the price feed is supported, false otherwise.
    function supportsPriceFeed(bytes4 _id) external view returns (bool);
    
    /// @notice Get the latest timestamp for a price feed.
    /// @param _id The bytes4 ID of the price feed.
    /// @return The timestamp of the last price update.
    function lastTimestamp(bytes4 _id) external view returns (uint256);
}
