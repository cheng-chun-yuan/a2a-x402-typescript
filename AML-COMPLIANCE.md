# AML Compliance System for x402 Payment Protocol

## Overview

This implementation extends the x402 payment protocol with **Anti-Money Laundering (AML)** compliance checks. The system verifies wallet security and screens transactions for risk before accepting payments, using **free and affordable methods** (no expensive third-party APIs required).

## 🔒 Features

- ✅ **Custom Modifier Architecture** - Extensible pipeline for verification hooks
- 🔍 **Wallet Risk Scoring** - Automated risk assessment (0-100 scale)
- 📋 **Sanctions List Screening** - Check against OFAC/blacklist addresses
- 🔗 **On-Chain Analysis** - Analyze wallet age, transaction history, contract detection
- ⚠️ **Manual Review Flagging** - Flag high-risk payments instead of auto-rejecting
- 💰 **Free Implementation** - No API costs (uses blockchain RPC directly)

## 🏗️ Architecture

### Payment Verification Flow

```
Payment Request
    ↓
Extract User Address
    ↓
Verify Signature ✓
    ↓
Check Balance ✓
    ↓
🔒 AML MODIFIER PIPELINE
    ├─ Check Sanctions List
    ├─ Analyze Wallet Age
    ├─ Count Transactions
    ├─ Detect Contract Address
    └─ Calculate Risk Score (0-100)
    ↓
Risk Decision
    ├─ LOW/MEDIUM (0-69) → ✅ Approve
    ├─ HIGH (70-89) → ⚠️ Flag for Review
    └─ CRITICAL (90-100) → ❌ Reject
    ↓
Settle Payment On-Chain
```

## 📁 Project Structure

```
x402_a2a/
├── core/
│   ├── modifiers/
│   │   ├── BaseModifier.ts          # Abstract modifier interface
│   │   └── AMLModifier.ts           # AML compliance implementation
│   └── compliance/
│       ├── AMLChecker.ts             # Risk scoring engine
│       └── sanctions-list.json       # Blacklisted addresses
│
merchant-agent/
├── src/facilitator/
│   └── RealFacilitator.ts            # Enhanced with modifier support
├── .env                               # Configuration with AML settings
└── test-aml-flow.ts                  # AML test script
```

## 🚀 Quick Start

### 1. Configuration

Add to `merchant-agent/.env`:

```env
# AML Configuration
AML_ENABLED=true                      # Enable AML checks
AML_RISK_THRESHOLD=70                 # Reject score >= 70
AML_REQUIRE_MANUAL_REVIEW=true       # Flag HIGH risk for review
FACILITATOR_MODE=real                 # Use RealFacilitator with AML
```

### 2. Run Merchant Agent

```bash
cd merchant-agent
bun install
bun run dev
```

Expected output:
```
💼 Merchant account loaded: 0x30eC...
📋 Loaded 4 sanctioned addresses
🔒 AML checks enabled (threshold: 70, manual review: true)
✅ Server running at http://localhost:10000
```

### 3. Test AML System

```bash
cd merchant-agent
npx ts-node test-aml-flow.ts
```

## 📊 Risk Scoring System

### Score Calculation

The AML checker calculates a composite risk score based on:

| Factor | Points | Description |
|--------|--------|-------------|
| **Sanctioned Address** | 100 | On OFAC/blacklist → Auto-reject |
| **Contract Address** | +30 | EOA vs Smart Contract |
| **No Transactions** | +40 | Never used wallet |
| **< 10 Transactions** | +25 | Very new wallet |
| **< 50 Transactions** | +10 | New-ish wallet |
| **Age < 1 day** | +20 | Freshly created |
| **Age < 7 days** | +10 | Recently created |

**Total Score: 0-100**

### Risk Levels

| Score | Level | Action |
|-------|-------|--------|
| 0-39 | ✅ **LOW** | Auto-approve |
| 40-69 | ⚠️ **MEDIUM** | Auto-approve |
| 70-89 | 🔶 **HIGH** | Flag for manual review* |
| 90-100 | ❌ **CRITICAL** | Auto-reject |

\* If `AML_REQUIRE_MANUAL_REVIEW=true`, otherwise auto-reject

### Example Scores

```
New wallet (0 tx): 40 points → MEDIUM ✅
New wallet (5 tx) + young: 45 points → MEDIUM ✅
Contract + no tx: 70 points → HIGH ⚠️ (manual review)
Sanctioned address: 100 points → CRITICAL ❌
```

## 🔧 Implementation Details

### 1. BaseModifier Interface

All modifiers extend `BaseModifier` with priority-based execution:

```typescript
abstract class BaseModifier {
  abstract execute(context: ModifierContext): Promise<ModifierResult>;
  abstract get priority(): number;  // Lower = earlier execution
  abstract get name(): string;
}
```

### 2. AMLModifier

Integrates AML checks into payment verification:

```typescript
const amlModifier = new AMLModifier({
  enabled: true,
  riskThreshold: 70,
  requireManualReview: true,
  provider: ethersProvider
});
```

**Key Features:**
- Runs after signature/balance verification (efficient)
- Returns detailed risk metadata
- Configurable threshold and review policy
- Fail-safe: rejects on error

### 3. AMLChecker

Core risk assessment engine:

```typescript
const checker = new AMLChecker(provider, riskThreshold);
const result = await checker.checkAddress(walletAddress);

// Result includes:
// - riskScore: 0-100
// - riskLevel: LOW | MEDIUM | HIGH | CRITICAL
// - sanctioned: boolean
// - flags: string[]
// - metadata: { walletAge, transactionCount, isContract }
```

### 4. RealFacilitator Integration

The `RealFacilitator` now supports modifiers:

```typescript
// Modifiers are loaded at initialization
this.modifiers = [amlModifier];
this.modifiers.sort((a, b) => a.priority - b.priority);

// Execute during verification
for (const modifier of this.modifiers) {
  const result = await modifier.execute(modifierContext);
  if (!result.allowed) {
    return { isValid: false, invalidReason: result.reason };
  }
}
```

### 5. Enhanced VerifyResponse

AML data is returned in verification response:

```typescript
interface VerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  amlCheck?: {
    checked: boolean;
    riskScore?: number;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sanctioned?: boolean;
    flags?: string[];
    requiresManualReview?: boolean;
  };
}
```

## 🧪 Testing

### Run Test Script

```bash
cd merchant-agent
npx ts-node test-aml-flow.ts
```

**Test Output:**
```
🧪 Starting AML Flow Test
============================================================
📋 Test Configuration:
   Payer: 0xa942...D6
   Merchant: 0x30eC...Cd
   Network: base-sepolia
   USDC: 0x036C...7e

💰 Checking Balances...
   ETH Balance: 0.1 ETH
   USDC Balance: 10.0 USDC

🔒 TESTING AML VERIFICATION FLOW
============================================================
✅ Signature and balance verified
🔍 Running 1 modifier(s)...
  ▶ Executing AMLModifier...
🔍 Running AML check for address: 0xa942...D6
✅ AML Check Result: MEDIUM (Score: 60)
   Flags: No transaction history
  ✅ AMLModifier passed
✅ Payment fully verified

📊 VERIFICATION RESULT:
   Valid: true
   Risk Score: 60
   Risk Level: MEDIUM
   Sanctioned: false

📝 SUMMARY:
   Payment Valid: ✅ YES
   Risk Level: ⚠️ MEDIUM (Score: 60/100)
   Sanctioned: ✅ NO

💡 What this means:
   ✅ This payment would be APPROVED automatically
```

### Test Different Scenarios

#### 1. Test High-Risk Rejection

Edit `.env`:
```env
AML_RISK_THRESHOLD=50  # Lower threshold
```

#### 2. Test Sanctioned Address

Add to `x402_a2a/core/compliance/sanctions-list.json`:
```json
{
  "addresses": [
    "0xa942A089F32aeebd5627A2EDb302B568de3430D6"
  ]
}
```

#### 3. Test Manual Review

Use default settings with a wallet scoring 70-89 points.

## 🔐 Security Considerations

### Free vs Paid Solutions

**This Implementation (Free):**
- ✅ Sanctions list screening
- ✅ Basic on-chain analysis
- ✅ Wallet age/transaction heuristics
- ❌ Advanced pattern detection
- ❌ Mixer/tumbler detection
- ❌ Real-time threat intelligence

**Paid Services (Chainalysis, TRM, Elliptic):**
- ✅ All free features
- ✅ Advanced ML-based risk scoring
- ✅ Mixer/tornado detection
- ✅ Cross-chain analysis
- ✅ Real-time updates
- ❌ Expensive ($$$)

### Recommendations

**For Testing/Small Volume:**
- ✅ Use this free implementation
- ✅ Set conservative thresholds (60-70)
- ✅ Enable manual review

**For Production/High Volume:**
- ⚠️ Consider paid AML services
- ⚠️ Implement multi-layer checks
- ⚠️ Regular sanctions list updates
- ⚠️ Monitor false positive rates

### Best Practices

1. **Update Sanctions Lists Regularly**
   - OFAC updates: https://sanctionssearch.ofac.treas.gov/
   - Chainalysis free tier: Public addresses

2. **Monitor Risk Score Distribution**
   - Track approval/rejection rates
   - Adjust thresholds based on data
   - Review flagged transactions

3. **Tune for Your Use Case**
   - High-value transactions: Lower threshold (50-60)
   - Small transactions: Higher threshold (70-80)
   - Enable manual review for borderline cases

4. **Keep Private Keys Secure**
   - Never commit `.env` files
   - Use hardware wallets for production
   - Separate hot/cold wallets

## 📝 Configuration Reference

### Environment Variables

```env
# AML Settings
AML_ENABLED=true                      # Enable/disable AML checks
AML_RISK_THRESHOLD=70                 # Risk score threshold (0-100)
AML_REQUIRE_MANUAL_REVIEW=true       # Flag HIGH risk for review

# Facilitator Mode
FACILITATOR_MODE=real                 # Use RealFacilitator with AML

# Blockchain
BASE_SEPOLIA_RPC_URL=https://...      # Your RPC endpoint
MERCHANT_PRIVATE_KEY=0x...            # Merchant wallet private key

# Optional: Future enhancements
ETHERSCAN_API_KEY=your_key            # For enhanced on-chain analysis
```

### Sanctions List Format

`x402_a2a/core/compliance/sanctions-list.json`:
```json
{
  "description": "Sanctioned wallet addresses",
  "lastUpdated": "2025-10-28",
  "sources": ["OFAC SDN List", "Community reports"],
  "addresses": [
    "0x7F367cC41522cE07553e823bf3be79A889DEbe1B",
    "0xd882cFc20F52f2599D84b8e8D58C7FB62cfE344b"
  ]
}
```

## 🔄 Future Enhancements

### Planned Features

1. **Enhanced On-Chain Analysis**
   - Token diversity score
   - DEX/CEX interaction detection
   - Gas pattern analysis
   - Transaction velocity monitoring

2. **Integration Options**
   - Etherscan API integration
   - Basescan API for Base network
   - TRM Labs free tier
   - Chainalysis KYT

3. **Machine Learning**
   - Pattern-based risk scoring
   - Historical fraud detection
   - Behavioral analysis

4. **Reporting & Dashboard**
   - Real-time risk metrics
   - Transaction audit logs
   - Compliance reports

## 📞 Support

For issues or questions:
- GitHub Issues: [x402-aml repository]
- Documentation: This README
- Test Script: `merchant-agent/test-aml-flow.ts`

## 📄 License

Apache-2.0 - See LICENSE for details

---

**Built with ❤️ for secure, compliant crypto payments**
