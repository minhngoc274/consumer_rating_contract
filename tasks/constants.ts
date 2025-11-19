/**
 * Chain configurations and constants
 */

export const CHAIN_CONFIG: any = {
  // Ethereum Mainnet
  ethereum: {
    chainId: 1,
    domainId: 1,
    mailbox: "0xc005dc82818d67AF737725bD4bf75435d065D239",
    rpcUrl: "https://eth.llamarpc.com",
  },

  // Ethereum Sepolia Testnet
  sepolia: {
    chainId: 11155111,
    domainId: 11155111,
    mailbox: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
    rpcUrl: "https://rpc.sepolia.org",
  },

  // Arbitrum Mainnet
  arbitrum: {
    chainId: 42161,
    domainId: 42161,
    mailbox: "0x979Ca5202784112f4738403dBec5D0F3B9daabB9",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
  },

  // Arbitrum Sepolia Testnet
  arbitrumSepolia: {
    chainId: 421614,
    domainId: 421614,
    mailbox: "0x598facE78a4302f11E3de0bee1894Da0b2Cb71F8",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  },

  // Optimism Mainnet
  optimism: {
    chainId: 10,
    domainId: 10,
    mailbox: "0xd4C1905BB1D26BC93DAC913e13CaCC278CdCC80D",
    rpcUrl: "https://mainnet.optimism.io",
  },

  // Optimism Sepolia Testnet
  optimismSepolia: {
    chainId: 11155420,
    domainId: 11155420,
    mailbox: "0x6966b0E55883d49BFB24539356a2f8A673E02039",
    rpcUrl: "https://sepolia.optimism.io",
  },

  // Base Mainnet
  base: {
    chainId: 8453,
    domainId: 8453,
    mailbox: "0xeA87ae93Fa0019a82A727bfd3eBd1cFCa8f64f1D",
    rpcUrl: "https://mainnet.base.org",
  },

  // Base Sepolia Testnet
  baseSepolia: {
    chainId: 84532,
    domainId: 84532,
    mailbox: "0x6966b0E55883d49BFB24539356a2f8A673E02039",
    rpcUrl: "https://sepolia.base.org",
  },

  // Polygon Mainnet
  polygon: {
    chainId: 137,
    domainId: 137,
    mailbox: "0x5d934f4e2f797775e53561bB72aca21ba36B96BB",
    rpcUrl: "https://polygon-rpc.com",
  },

  // Polygon Mumbai Testnet
  polygonMumbai: {
    chainId: 80001,
    domainId: 80001,
    mailbox: "0x2d1889fe5B092CD988972261434F7E5f26041115",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
  },

  // BNB Chain Mainnet
  bsc: {
    chainId: 56,
    domainId: 56,
    mailbox: "0x2971b9Aec44bE4eb673DF1B88cDB57b96eefe8a4",
    rpcUrl: "https://bsc-dataseed.binance.org",
  },

  // BNB Chain Testnet
  bscTestnet: {
    chainId: 97,
    domainId: 97,
    mailbox: "0xF90cB82a76492614D07B82a7658917f3aC811Ac1",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
  },

  // Avalanche C-Chain Mainnet
  avalanche: {
    chainId: 43114,
    domainId: 43114,
    mailbox: "0xFf06aFcaABaDDd1fb08371f9ccA15D73D51FeBD6",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  },

  // Avalanche Fuji Testnet
  fuji: {
    chainId: 43113,
    domainId: 43113,
    mailbox: "0x5b6CFf85442B851A8e6eaBd2A4E4507B5135B3B0",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  },

  // Local development
  hardhat: {
    chainId: 31337,
    domainId: 31337,
    mailbox: null, // Will be deployed locally
    rpcUrl: "http://127.0.0.1:8545",
  },

  localhost: {
    chainId: 31337,
    domainId: 31337,
    mailbox: null, // Will be deployed locally
    rpcUrl: "http://127.0.0.1:8545",
  },
};

/**
 * Get chain configuration by network name
 * @param networkName Network name (e.g., "ethereum", "arbitrum", "sepolia")
 * @returns Chain configuration object
 */
export function getChainConfig(networkName: string): any {
  const config = CHAIN_CONFIG[networkName];
  if (!config) {
    throw new Error(`Chain configuration not found for network: ${networkName}`);
  }
  return config;
}

/**
 * Get Hyperlane Mailbox address for a network
 * @param networkName Network name
 * @returns Mailbox contract address
 */
export function getMailboxAddress(networkName: string): string {
  const config = getChainConfig(networkName);
  if (!config.mailbox) {
    throw new Error(`Mailbox address not configured for network: ${networkName}`);
  }
  return config.mailbox;
}

/**
 * Get Hyperlane domain ID for a network
 * @param networkName Network name
 * @returns Domain ID
 */
export function getDomainId(networkName: string): number {
  const config = getChainConfig(networkName);
  return config.domainId;
}
