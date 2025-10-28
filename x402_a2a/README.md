# x402 A2A Payment Protocol Extension with AML Compliance

Complete TypeScript implementation of the x402 payment protocol extension for A2A with built-in **Anti-Money Laundering (AML)** compliance checks.

## Features

- 🚀 Exception-based payment requirements
- 💰 Dynamic pricing based on request parameters
- 🔒 Type-safe TypeScript implementation
- 🛡️ **Built-in AML compliance with Chainalysis Oracle**
- 📊 Risk scoring and wallet screening
- 🎯 ADK-compatible executors
- 📦 Zero configuration required

## Installation

```bash
npm install a2a-x402
```

## Quick Start

### Server-Side (Merchant Agent)

```typescript
import { x402PaymentRequiredException } from 'a2a-x402';

// Request payment with automatic AML screening
throw x402PaymentRequiredException.forService({
  price: "$5.00",
  payToAddress: "0x123...",
  resource: "/premium-feature"
});
```

### Client-Side (Wallet/Signing)

```typescript
import { processPayment, x402Utils } from 'a2a-x402';
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey);
const utils = new x402Utils();

const paymentRequired = utils.getPaymentRequirements(task);
const paymentPayload = await processPayment(paymentRequired.accepts[0], wallet);
```

## AML Compliance

### Automatic Wallet Screening

The library includes **free, built-in AML checks** using:

1. **Chainalysis Oracle** (Ethereum Mainnet) - Real-time sanctions screening
2. **On-chain Analysis** - Transaction history, wallet age, balance checks
3. **Local Sanctions List** - Fallback for offline checks

### Risk Scoring

Each wallet receives a risk score (0-100):

- **0-39**: LOW risk ✅
- **40-69**: MEDIUM risk ⚠️
- **70-89**: HIGH risk 🚨
- **90-100**: CRITICAL risk 🔴

### Configuration

```env
# Enable/disable AML checks
AML_ENABLED=true

# Risk threshold (payments above this require manual review)
AML_RISK_THRESHOLD=70

# Require manual review for high-risk wallets
AML_REQUIRE_MANUAL_REVIEW=true

# Use Chainalysis Oracle (Ethereum mainnet)
AML_USE_ORACLE=true
```

### How It Works

```typescript
import { AMLChecker, AMLModifier } from 'a2a-x402';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const amlChecker = new AMLChecker(provider, 70, { useOracle: true });

// Check a wallet address
const result = await amlChecker.checkAddress('0x...');

console.log(result);
// {
//   address: '0x...',
//   riskScore: 45,
//   riskLevel: 'MEDIUM',
//   sanctioned: false,
//   flags: ['New wallet (< 10 transactions)'],
//   metadata: {
//     walletAge: 2,
//     transactionCount: 8,
//     isContract: false
//   }
// }
```

### Sanctions Sources

The AML system checks against:

1. **Chainalysis Oracle** (`0x40C57923924B5c5c5455c48D93317139ADDaC8fb` on Ethereum Mainnet)
   - Real-time OFAC sanctions list
   - Automatically updated
   - Free to use

2. **Local Sanctions List** (`core/compliance/sanctions-list.json`)
   - Fallback when Oracle is unavailable
   - Includes known sanctioned addresses (Tornado Cash, Lazarus Group, etc.)
   - Can be manually updated

## Custom Facilitators with AML

Extend the payment facilitator with custom AML policies:

```typescript
import { AMLModifier, BaseModifier } from 'a2a-x402';

// Initialize AML modifier
const amlModifier = new AMLModifier({
  enabled: true,
  riskThreshold: 70,
  requireManualReview: true,
  provider: ethersProvider,
  useOracle: true,
  fallbackToLocal: true,
});

// Add to your facilitator's modifier pipeline
facilitator.addModifier(amlModifier);
```

## Architecture

```
x402_a2a/
├── core/
│   ├── compliance/          # AML compliance engine
│   │   ├── AMLChecker.ts   # Risk scoring and Oracle integration
│   │   └── sanctions-list.json
│   ├── modifiers/           # Extensible verification pipeline
│   │   ├── BaseModifier.ts # Modifier interface
│   │   └── AMLModifier.ts  # AML integration
│   ├── merchant.ts          # Payment requirements
│   ├── wallet.ts            # Payment signing
│   └── protocol.ts          # Verification & settlement
├── types/                   # TypeScript definitions
└── executors/               # ADK middleware
```

## Verification Flow

```
1. Client submits payment
   ↓
2. Extract payer address from signature
   ↓
3. Verify signature validity
   ↓
4. Check wallet balance
   ↓
5. Run AML checks (Modifiers)
   ├── Check Chainalysis Oracle (Ethereum mainnet)
   ├── Analyze on-chain behavior
   ├── Calculate risk score
   └── Apply business rules
   ↓
6. Approve or reject payment
```

## Environment Variables

```env
# Blockchain
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
MERCHANT_WALLET=0x...

# AML Compliance
AML_ENABLED=true
AML_RISK_THRESHOLD=70
AML_REQUIRE_MANUAL_REVIEW=true
AML_USE_ORACLE=true

# Facilitator Mode
FACILITATOR_MODE=real  # or 'mock' for testing

# Debug
X402_DEBUG=true
```

## Testing

```bash
# Run with AML checks enabled
bun run dev

# Test AML flow
cd merchant-agent
bun test-aml-flow.ts
```

## License

Apache-2.0
