#!/usr/bin/env ts-node
//
// AML Test Script - Tests the complete payment flow with AML checks
//

import { ethers } from 'ethers';
import { RealFacilitator } from './src/facilitator/RealFacilitator';
import { PaymentPayload, PaymentRequirements } from 'a2a-x402';
import * as dotenv from 'dotenv';

dotenv.config();

async function testAMLFlow() {
  console.log('🧪 Starting AML Flow Test\n');
  console.log('=' .repeat(60));

  // Setup
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia.g.alchemy.com/v2/C9elmLC3dvKeR-2rN0zCAU0DTl0TaH_g';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Test wallet (client/payer)
  const testWalletPrivateKey = '0x4d484ed925598679524d9663f91c03ba3a23c2904923043bb2c77c7e61e97f53';
  const testWallet = new ethers.Wallet(testWalletPrivateKey, provider);

  console.log('\n📋 Test Configuration:');
  console.log(`   Payer: ${testWallet.address}`);
  console.log(`   Merchant: ${process.env.MERCHANT_WALLET_ADDRESS}`);
  console.log(`   Network: base-sepolia`);
  console.log(`   USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e`);

  // Check balances
  console.log('\n💰 Checking Balances...');
  const ethBalance = await provider.getBalance(testWallet.address);
  console.log(`   ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

  const usdcContract = new ethers.Contract(
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  const usdcBalance = await usdcContract.balanceOf(testWallet.address);
  console.log(`   USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

  if (ethBalance === 0n) {
    console.log('\n❌ ERROR: No ETH balance!');
    console.log('   Get testnet ETH: https://www.alchemy.com/faucets/base-sepolia');
    console.log(`   Address: ${testWallet.address}`);
    return;
  }

  if (usdcBalance < BigInt(1_000000)) {
    console.log('\n⚠️  WARNING: Low USDC balance (need at least 1 USDC)');
    console.log('   Get testnet USDC: https://faucet.circle.com/');
    console.log(`   Address: ${testWallet.address}`);
    console.log('\n   Continuing with test anyway...\n');
  }

  // Create payment requirements
  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'base-sepolia',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC
    payTo: process.env.MERCHANT_WALLET_ADDRESS || '0x30eC3d610071b341c4577c15CCF0459db9bE94Cd',
    maxAmountRequired: '1000000', // 1 USDC
    resource: '/test-banana',
    description: 'Test payment for AML verification',
    mimeType: 'application/json',
    maxTimeoutSeconds: 1200,
  };

  // Sign payment message
  console.log('\n✍️  Signing Payment...');
  const message = `Chain ID: ${requirements.network}
Contract: ${requirements.asset}
User: ${testWallet.address}
Receiver: ${requirements.payTo}
Amount: ${requirements.maxAmountRequired}
`;

  const signature = await testWallet.signMessage(message);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);

  // Create payment payload
  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'base-sepolia',
    payload: {
      signature,
      authorization: {
        from: testWallet.address,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: ethers.hexlify(ethers.randomBytes(32)),
      },
    },
  };

  console.log('\n' + '='.repeat(60));
  console.log('🔒 TESTING AML VERIFICATION FLOW');
  console.log('='.repeat(60));

  // Initialize RealFacilitator with AML
  const facilitator = new RealFacilitator();

  // Test verification (includes AML checks)
  console.log('\n▶️  Step 1: Verify Payment (with AML checks)...\n');
  const verifyResult = await facilitator.verify(payload, requirements);

  console.log('\n📊 VERIFICATION RESULT:');
  console.log('   Valid:', verifyResult.isValid);
  console.log('   Payer:', verifyResult.payer);

  if (verifyResult.amlCheck) {
    console.log('\n🔒 AML CHECK DETAILS:');
    console.log('   Checked:', verifyResult.amlCheck.checked);
    console.log('   Risk Score:', verifyResult.amlCheck.riskScore);
    console.log('   Risk Level:', verifyResult.amlCheck.riskLevel);
    console.log('   Sanctioned:', verifyResult.amlCheck.sanctioned);

    if (verifyResult.amlCheck.flags && verifyResult.amlCheck.flags.length > 0) {
      console.log('   Flags:');
      verifyResult.amlCheck.flags.forEach(flag => {
        console.log(`      - ${flag}`);
      });
    }

    if (verifyResult.amlCheck.requiresManualReview) {
      console.log('\n   ⚠️  REQUIRES MANUAL REVIEW');
    }
  }

  if (!verifyResult.isValid) {
    console.log('\n   Reason:', verifyResult.invalidReason);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ AML TEST COMPLETE');
  console.log('='.repeat(60));

  // Summary
  console.log('\n📝 SUMMARY:');
  console.log(`   Payment Valid: ${verifyResult.isValid ? '✅ YES' : '❌ NO'}`);

  if (verifyResult.amlCheck) {
    const riskEmoji =
      verifyResult.amlCheck.riskLevel === 'LOW' ? '✅' :
      verifyResult.amlCheck.riskLevel === 'MEDIUM' ? '⚠️' :
      verifyResult.amlCheck.riskLevel === 'HIGH' ? '🔶' : '❌';

    console.log(`   Risk Level: ${riskEmoji} ${verifyResult.amlCheck.riskLevel} (Score: ${verifyResult.amlCheck.riskScore}/100)`);
    console.log(`   Sanctioned: ${verifyResult.amlCheck.sanctioned ? '❌ YES' : '✅ NO'}`);
  }

  console.log('\n💡 What this means:');
  if (verifyResult.isValid && verifyResult.amlCheck) {
    if (verifyResult.amlCheck.riskLevel === 'LOW' || verifyResult.amlCheck.riskLevel === 'MEDIUM') {
      console.log('   ✅ This payment would be APPROVED automatically');
    } else if (verifyResult.amlCheck.requiresManualReview) {
      console.log('   ⚠️  This payment is FLAGGED for manual review');
      console.log('      Merchant can approve/reject manually');
    } else {
      console.log('   ❌ This payment would be REJECTED (high risk)');
    }
  } else {
    console.log('   ❌ Payment verification failed - would be rejected');
  }

  console.log('\n');
}

// Run test
testAMLFlow()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
