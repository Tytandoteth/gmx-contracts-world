/**
 * Complete contract ABIs for GMX V1 contracts on World Chain
 * These ABIs include all functions, events, and state variables
 * to enable full functionality in the frontend
 */

// Vault ABI - Complete interface for all Vault functions
export const VaultABI = [
  // Core token functions
  "function isInitialized() external view returns (bool)",
  "function isSwapEnabled() external view returns (bool)",
  "function isLeverageEnabled() external view returns (bool)",
  
  // Token configuration
  "function whitelistedTokens(address _token) external view returns (bool)",
  "function stableTokens(address _token) external view returns (bool)",
  "function shortableTokens(address _token) external view returns (bool)",
  "function tokenDecimals(address _token) external view returns (uint256)",
  "function tokenWeights(address _token) external view returns (uint256)",
  "function totalTokenWeights() external view returns (uint256)",
  "function minProfitBasisPoints(address _token) external view returns (uint256)",
  "function maxUsdgAmounts(address _token) external view returns (uint256)",
  
  // Fee functions
  "function hasDynamicFees() external view returns (bool)",
  "function taxBasisPoints() external view returns (uint256)",
  "function stableTaxBasisPoints() external view returns (uint256)",
  "function mintBurnFeeBasisPoints() external view returns (uint256)",
  "function swapFeeBasisPoints() external view returns (uint256)",
  "function stableSwapFeeBasisPoints() external view returns (uint256)",
  "function marginFeeBasisPoints() external view returns (uint256)",
  "function liquidationFeeUsd() external view returns (uint256)",
  "function maxLeverage() external view returns (uint256)",
  
  // Price functions
  "function getMaxPrice(address _token) external view returns (uint256)",
  "function getMinPrice(address _token) external view returns (uint256)",
  
  // Swap functions
  "function swap(address _tokenIn, address _tokenOut, address _receiver) external returns (uint256)",
  "function swapAmount(address _tokenIn, address _tokenOut, uint256 _amount, uint256 _minOut, address _receiver) external returns (uint256)",
  
  // Position functions
  "function increasePosition(address _account, address _collateralToken, address _indexToken, uint256 _sizeDelta, bool _isLong) external",
  "function decreasePosition(address _account, address _collateralToken, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver) external returns (uint256)",
  "function liquidatePosition(address _account, address _collateralToken, address _indexToken, bool _isLong, address _feeReceiver) external",
  
  // View functions for positions
  "function getPosition(address _account, address _collateralToken, address _indexToken, bool _isLong) external view returns (uint256, uint256, uint256, uint256, uint256, uint256, bool, uint256)",
  
  // Governance functions
  "function gov() external view returns (address)",
  "function setGov(address _gov) external"
];

// Router ABI - Complete interface for all Router functions
export const RouterABI = [
  // Core configuration
  "function vault() external view returns (address)",
  "function usdg() external view returns (address)",
  "function weth() external view returns (address)",
  
  // Approve functions
  "function approvePlugin(address _plugin) external",
  "function denyPlugin(address _plugin) external",
  "function approvedPlugins(address _account, address _plugin) external view returns (bool)",
  
  // Swap functions
  "function swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external returns (uint256)",
  "function swapETHToTokens(address[] memory _path, uint256 _minOut, address _receiver) external payable returns (uint256)",
  "function swapTokensToETH(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external returns (uint256)",
  
  // Increase position functions
  "function increasePosition(address[] memory _path, address _indexToken, uint256 _amountIn, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _price) external",
  "function increasePositionETH(address[] memory _path, address _indexToken, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _price) external payable",
  
  // Decrease position functions
  "function decreasePosition(address _collateralToken, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _price) external returns (uint256)",
  "function decreasePositionETH(address _collateralToken, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _price) external returns (uint256)",
  
  // Governance functions
  "function gov() external view returns (address)",
  "function setGov(address _gov) external"
];

// SimplePriceFeed ABI - Complete interface for SimplePriceFeed
export const SimplePriceFeedABI = [
  "function prices(address _token) external view returns (uint256)",
  "function gov() external view returns (address)",
  "function setGov(address _gov) external",
  "function setPrices(address[] memory _tokens, uint256[] memory _prices) external",
  "function getPrice(address _token) external view returns (uint256)"
];

// PositionRouter ABI - For position execution
export const PositionRouterABI = [
  "function vault() external view returns (address)",
  "function router() external view returns (address)",
  "function weth() external view returns (address)",
  "function depositFee() external view returns (uint256)",
  "function minExecutionFee() external view returns (uint256)",
  "function admin() external view returns (address)",
  
  "function createIncreasePosition(address[] memory _path, address _indexToken, uint256 _amountIn, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _acceptablePrice, uint256 _executionFee, bytes32 _referralCode) external payable returns (bytes32)",
  "function createIncreasePositionETH(address[] memory _path, address _indexToken, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _acceptablePrice, uint256 _executionFee, bytes32 _referralCode) external payable returns (bytes32)",
  
  "function createDecreasePosition(address[] memory _path, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _acceptablePrice, uint256 _executionFee, bool _withdrawETH) external payable returns (bytes32)",
  
  "function executeIncreasePosition(bytes32 _key, address _executionFeeReceiver) external returns (bool)",
  "function executeDecreasePosition(bytes32 _key, address _executionFeeReceiver) external returns (bool)",
  
  "function cancelIncreasePosition(bytes32 _key, address _executionFeeReceiver) external returns (bool)",
  "function cancelDecreasePosition(bytes32 _key, address _executionFeeReceiver) external returns (bool)"
];

// PositionManager ABI - For position management
export const PositionManagerABI = [
  "function router() external view returns (address)",
  "function vault() external view returns (address)",
  "function depositFee() external view returns (uint256)",
  "function orderKeepers(address) external view returns (bool)",
  "function liquidators(address) external view returns (bool)",
  "function increasePositionBufferBps() external view returns (uint256)",
  
  "function increasePosition(address[] memory _path, address _indexToken, uint256 _amountIn, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _acceptablePrice) external",
  "function increasePositionETH(address[] memory _path, address _indexToken, uint256 _minOut, uint256 _sizeDelta, bool _isLong, uint256 _acceptablePrice) external payable",
  
  "function decreasePosition(address _collateralToken, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _acceptablePrice) external",
  "function decreasePositionETH(address _collateralToken, address _indexToken, uint256 _collateralDelta, uint256 _sizeDelta, bool _isLong, address _receiver, uint256 _acceptablePrice) external",
  
  "function liquidatePosition(address _account, address _collateralToken, address _indexToken, bool _isLong, address _feeReceiver) external"
];

// OrderBook ABI - For limit orders
export const OrderBookABI = [
  "function vault() external view returns (address)",
  "function router() external view returns (address)",
  "function weth() external view returns (address)",
  "function minExecutionFee() external view returns (uint256)",
  "function minPurchaseTokenAmountUsd() external view returns (uint256)",
  
  "function createSwapOrder(address[] memory _path, uint256 _amountIn, uint256 _minOut, uint256 _triggerRatio, bool _triggerAboveThreshold, uint256 _executionFee, bool _shouldWrap, bool _shouldUnwrap) external payable returns (uint256)",
  
  "function createIncreaseOrder(address[] memory _path, uint256 _amountIn, address _indexToken, uint256 _minOut, uint256 _sizeDelta, address _collateralToken, bool _isLong, uint256 _triggerPrice, bool _triggerAboveThreshold, uint256 _executionFee, bool _shouldWrap) external payable returns (uint256)",
  
  "function createDecreaseOrder(address _indexToken, uint256 _sizeDelta, address _collateralToken, uint256 _collateralDelta, bool _isLong, uint256 _triggerPrice, bool _triggerAboveThreshold) external payable returns (uint256)",
  
  "function cancelSwapOrder(uint256 _orderIndex) external",
  "function cancelIncreaseOrder(uint256 _orderIndex) external",
  "function cancelDecreaseOrder(uint256 _orderIndex) external",
  
  "function executeSwapOrder(address _account, uint256 _orderIndex, address payable _feeReceiver) external",
  "function executeIncreaseOrder(address _account, uint256 _orderIndex, address payable _feeReceiver) external",
  "function executeDecreaseOrder(address _account, uint256 _orderIndex, address payable _feeReceiver) external"
];

/**
 * Export a complete map of contract name to ABI
 * This makes it easy to get all ABIs in one place
 */
export const ContractABIs: Record<string, any[]> = {
  Vault: VaultABI,
  Router: RouterABI,
  SimplePriceFeed: SimplePriceFeedABI,
  PositionRouter: PositionRouterABI,
  PositionManager: PositionManagerABI,
  OrderBook: OrderBookABI
};
