# Consumer Rating Contract

## Contract Overview

### RatingSender (Source Chain)
Main contract for sending credit ratings across chains via Hyperlane.

**Key Functions:**
- `sendRating(uint32 destinationDomain, address borrower, uint8 score)` - Send single rating
- `sendRatingBatch(uint32 destinationDomain, address[] borrowers, uint8[] scores)` - Send multiple ratings
- `quoteGasPayment(uint32 destinationDomain, address borrower, uint8 score)` - Get gas quote for cross-chain message

**Admin Functions:**
- `setDestinationRecipient(uint32 destinationDomain, bytes32 recipient)` - Configure recipient on destination chain
- `authorizeRater(address rater)` - Allow address to send ratings

### RatingConsumer (Destination Chain)
Main contract for receiving and storing credit ratings.

**Key Functions:**
- `getBorrowerRating(address borrower)` - Get borrower's rating details
- `getBorrowerLTV(address borrower)` - Calculate LTV based on credit score
  - Score ≥ 80: 75% LTV
  - Score ≥ 50: 60% LTV
  - Score < 50: 40% LTV

**Admin Functions:**
- `setAuthorizedSender(uint32 sourceDomain, bytes32 sender)` - Configure authorized sender
- `setMaxRatingAge(uint256 newMaxAge)` - Set rating validity period (default: 24 hours)

## Deployment

### Prerequisites
```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
```

### Deploy to Testnets

**1. Configure Environment**
```bash
cp .env.example .env
# Edit .env and set:
# - PRIVATE_KEY (without 0x prefix)
# - RPC URLs (optional, defaults provided)
# - ETHERSCAN_API_KEY / ARBISCAN_API_KEY (for verification)
```

**2. Deploy RatingSender (Ethereum Sepolia)**
```bash
npx hardhat deployRatingSender --network sepolia --verify true
```

**3. Deploy RatingConsumer (Arbitrum Sepolia)**
```bash
npx hardhat deployRatingConsumer --network arbitrumSepolia --verify true
```

**4. Configure Cross-Chain Connection**

```bash
# On Ethereum Sepolia - set destination recipient
npx hardhat configureSender \
  --network sepolia \
  --sender SENDER_ADDRESS \
  --consumer CONSUMER_ADDRESS \
  --destination arbitrumSepolia

# On Arbitrum Sepolia - set authorized sender
npx hardhat configureConsumer \
  --network arbitrumSepolia \
  --consumer CONSUMER_ADDRESS \
  --sender SENDER_ADDRESS \
  --source sepolia
```

### Deploy to Mainnets

Same commands, replace network:
- `sepolia` → `ethereum`
- `arbitrumSepolia` → `arbitrum`

### Deploy to Other Chains

The project supports multiple chains. To deploy to additional chains, update `tasks/constants.ts` with the chain configuration:

```typescript
// Add new chain configuration
newchain: {
  chainId: 12345,
  domainId: 12345, // Hyperlane domain ID
  mailbox: "0x...", // Hyperlane Mailbox address
  rpcUrl: "https://rpc.newchain.com",
},
```

Supported chains in `tasks/constants.ts`:
- **Mainnets**: Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Chain, Avalanche
- **Testnets**: Sepolia, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia, Polygon Mumbai, BNB Testnet, Avalanche Fuji

Find Hyperlane Mailbox addresses at: https://docs.hyperlane.xyz/docs/reference/contract-addresses

## Testing

### Fork Tests
Fork tests simulate cross-chain messaging on a forked mainnet.

**Requirements:**
- Paid RPC endpoint (Alchemy/Infura) for better rate limits

**Run Fork Tests:**
```bash
# With Alchemy
FORK_ENABLED=true FORK_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY npm run test:fork

# Or set in .env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
npm run test:fork
```

## Usage Example

```javascript
// Send rating from Ethereum to Arbitrum
const ARBITRUM_DOMAIN = 42161;
const borrower = "0x...";
const score = 85; // 0-100

// Get gas quote
const gasEstimate = await ratingSender.quoteGasPayment(
  ARBITRUM_DOMAIN,
  borrower,
  score
);

// Send rating
await ratingSender.sendRating(
  ARBITRUM_DOMAIN,
  borrower,
  score,
  { value: gasEstimate }
);

// On Arbitrum, query LTV
const ltv = await ratingConsumer.getBorrowerLTV(borrower);
// Returns: 75 (75% LTV for score 85)
```
