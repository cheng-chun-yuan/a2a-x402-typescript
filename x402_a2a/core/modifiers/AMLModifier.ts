//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * AML Modifier - Integrates AML compliance checks into payment verification
 */

import { BaseModifier, ModifierContext, ModifierResult } from './BaseModifier';
import { AMLChecker, AMLCheckResult, AMLCheckerConfig } from '../compliance/AMLChecker';
import { ethers } from 'ethers';

export interface AMLModifierConfig {
  enabled: boolean;
  riskThreshold: number; // 0-100
  requireManualReview: boolean; // Flag high-risk for manual review instead of auto-reject
  provider: ethers.JsonRpcProvider;
  useOracle?: boolean; // Use Chainalysis Oracle (default: true)
  oracleAddress?: string; // Custom oracle address
  fallbackToLocal?: boolean; // Fallback to local list if oracle fails (default: true)
}

export class AMLModifier extends BaseModifier {
  private amlChecker: AMLChecker;
  private config: AMLModifierConfig;

  constructor(config: AMLModifierConfig) {
    super();
    this.config = config;

    // Pass Oracle config to AMLChecker
    const checkerConfig: AMLCheckerConfig = {
      useOracle: config.useOracle ?? true,
      oracleAddress: config.oracleAddress,
      fallbackToLocal: config.fallbackToLocal ?? true,
    };

    this.amlChecker = new AMLChecker(
      config.provider,
      config.riskThreshold,
      checkerConfig
    );
  }

  get priority(): number {
    return 10; // Run early in the verification pipeline
  }

  get name(): string {
    return 'AMLModifier';
  }

  async execute(context: ModifierContext): Promise<ModifierResult> {
    // Skip if AML not enabled
    if (!this.config.enabled) {
      return {
        allowed: true,
        metadata: { amlEnabled: false },
      };
    }

    // Extract payer address
    const payer = context.payer;
    if (!payer) {
      return {
        allowed: false,
        reason: 'Cannot perform AML check: payer address not found',
      };
    }

    try {
      // Perform AML check
      const { allowed, result } = await this.amlChecker.isAddressAllowed(payer);

      // Build metadata
      const metadata = {
        aml: {
          checked: true,
          address: result.address,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          sanctioned: result.sanctioned,
          flags: result.flags,
          walletAge: result.metadata.walletAge,
          transactionCount: result.metadata.transactionCount,
        },
      };

      // Format risk level with emoji
      const riskEmoji = {
        'LOW': '✅',
        'MEDIUM': '⚠️',
        'HIGH': '🚨',
        'CRITICAL': '🔴'
      }[result.riskLevel] || '❓';

      // Log AML result
      console.log(`   ${riskEmoji} AML: ${result.riskLevel} risk (score: ${result.riskScore}/100)`);
      if (result.flags.length > 0) {
        console.log(`      Flags: ${result.flags.join(', ')}`);
      }

      // Handle sanctioned addresses (always reject)
      if (result.sanctioned) {
        console.log(`   🚫 AML: REJECTED - Address is sanctioned`);
        return {
          allowed: false,
          reason: `SANCTIONED address`,
          metadata,
        };
      }

      // Handle high-risk addresses
      if (!allowed) {
        // If manual review enabled, flag but don't auto-reject
        if (this.config.requireManualReview && result.riskLevel === 'HIGH') {
          console.log(`   ⚠️  AML: PASSED (flagged for manual review)`);
          return {
            allowed: true, // Allow but flag for review
            reason: `HIGH RISK - Requires manual review`,
            metadata: {
              ...metadata,
              requiresManualReview: true,
            },
          };
        }

        // Otherwise reject
        console.log(`   🚫 AML: REJECTED - Risk score ${result.riskScore} > threshold ${this.config.riskThreshold}`);
        return {
          allowed: false,
          reason: `Risk score too high (${result.riskScore}/${this.config.riskThreshold})`,
          metadata,
        };
      }

      // Address passed AML checks
      console.log(`   ✅ AML: PASSED`);
      return {
        allowed: true,
        metadata,
      };
    } catch (error) {
      console.error(`   ❌ AML: ERROR - ${error instanceof Error ? error.message : String(error)}`);

      // Fail safe: reject on error to prevent bypassing checks
      return {
        allowed: false,
        reason: `AML check error`,
        metadata: {
          aml: {
            checked: false,
            error: String(error),
          },
        },
      };
    }
  }
}
