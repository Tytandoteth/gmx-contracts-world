/**
 * Central registry for contract addresses on World Chain
 * This provides a single source of truth for all contract addresses
 */

export interface ContractInfo {
  address: string;
  name: string;
  verified: boolean;
  implementsInterface: boolean; // Determined at runtime
}

/**
 * All contract addresses for GMX V1 on World Chain
 * Keeping this centralized makes it easier to update and maintain
 */
export const WORLD_CHAIN_CONTRACTS: Record<string, ContractInfo> = {
  Vault: {
    address: "0x6519e08ecc9b2763fbef360132a8303dc2e9cce5",
    name: "Vault",
    verified: false,
    implementsInterface: false
  },
  Router: {
    address: "0x1958f6cba8eb87902bdc1805a2a3bd5842be645b",
    name: "Router",
    verified: false,
    implementsInterface: false
  },
  SimplePriceFeed: {
    address: "0x7e402dE1894f3dCed30f9bECBc51aD08F2016095",
    name: "SimplePriceFeed", 
    verified: true, // Our new working contract
    implementsInterface: false
  },
  PositionRouter: {
    address: "0x566e66c17a6dfe5b0964fa0afc85cf3cc5963daf",
    name: "PositionRouter",
    verified: false,
    implementsInterface: false
  },
  PositionManager: {
    address: "0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D",
    name: "PositionManager",
    verified: false,
    implementsInterface: false
  },
  OrderBook: {
    address: "0x0AC8566466e68678d2d32F625d2d3CD9e6cf088D",
    name: "OrderBook",
    verified: false,
    implementsInterface: false
  }
};

/**
 * Test tokens available on World Chain for GMX V1
 */
export const WORLD_CHAIN_TOKENS: Record<string, {address: string, decimals: number, symbol: string}> = {
  TUSD: {
    address: "0xc99E5FC1A556bD42A6dAff82Fb585814E41431dc",
    decimals: 18,
    symbol: "TUSD"
  },
  TBTC: {
    address: "0x0d84b9be12240Ee0BDFacbE0378DAd3810bC37a8",
    decimals: 8,
    symbol: "TBTC"
  },
  TETH: {
    address: "0x38CC615b73092e145cb38795C91180Ac5a8700E1",
    decimals: 18,
    symbol: "TETH"
  }
};

/**
 * Get a contract address safely with type checking
 * @param contractName The name of the contract
 * @returns The contract address or null if contract doesn't exist
 */
export const getContractAddress = (contractName: string): string | null => {
  const contract = WORLD_CHAIN_CONTRACTS[contractName];
  if (!contract) {
    console.warn(`Contract ${contractName} not found in registry`);
    return null;
  }
  return contract.address;
};

/**
 * Get a token address safely with type checking
 * @param symbol The token symbol (e.g., "TUSD")
 * @returns The token address or null if token doesn't exist
 */
export const getTokenAddress = (symbol: string): string | null => {
  const token = WORLD_CHAIN_TOKENS[symbol];
  if (!token) {
    console.warn(`Token ${symbol} not found in registry`);
    return null;
  }
  return token.address;
};

/**
 * Get token decimals
 * @param symbol The token symbol
 * @returns The token's decimal places or 18 as default
 */
export const getTokenDecimals = (symbol: string): number => {
  const token = WORLD_CHAIN_TOKENS[symbol];
  if (!token) {
    console.warn(`Token ${symbol} not found in registry, using default decimals (18)`);
    return 18;
  }
  return token.decimals;
};
