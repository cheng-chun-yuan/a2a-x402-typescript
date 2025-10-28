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
 * AML (Anti-Money Laundering) compliance checker
 * Provides wallet risk assessment using free/affordable methods
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

export interface AMLCheckResult {
  address: string;
  riskScore: number; // 0-100 (0 = lowest risk, 100 = highest risk)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  sanctioned: boolean;
  metadata: {
    walletAge?: number; // in days
    transactionCount?: number;
    isContract?: boolean;
    hasTokens?: boolean;
  };
}

export class AMLChecker {
  private provider: ethers.JsonRpcProvider;
  private sanctionedAddresses: Set<string>;
  private riskThreshold: number;

  constructor(provider: ethers.JsonRpcProvider, riskThreshold: number = 70) {
    this.provider = provider;
    this.riskThreshold = riskThreshold;
    this.sanctionedAddresses = new Set();
    this.loadSanctionsList();
  }

  /**
   * Load sanctioned addresses from local JSON file
   */
  private loadSanctionsList(): void {
    try {
      const sanctionsPath = path.join(__dirname, 'sanctions-list.json');
      const data = fs.readFileSync(sanctionsPath, 'utf-8');
      const sanctionsList = JSON.parse(data);

      sanctionsList.addresses.forEach((addr: string) => {
        this.sanctionedAddresses.add(addr.toLowerCase());
      });

      console.log(`📋 Loaded ${this.sanctionedAddresses.size} sanctioned addresses`);
    } catch (error) {
      console.warn('⚠️  Could not load sanctions list:', error);
    }
  }

  /**
   * Check if address is on sanctions list
   */
  private isSanctioned(address: string): boolean {
    return this.sanctionedAddresses.has(address.toLowerCase());
  }

  /**
   * Analyze on-chain behavior to assess risk
   */
  private async analyzeOnChainBehavior(address: string): Promise<{
    walletAge: number;
    transactionCount: number;
    isContract: boolean;
    riskFactors: string[];
  }> {
    const riskFactors: string[] = [];

    try {
      // Check if address is a contract
      const code = await this.provider.getCode(address);
      const isContract = code !== '0x';

      if (isContract) {
        riskFactors.push('Contract address (not EOA)');
      }

      // Get transaction count
      const transactionCount = await this.provider.getTransactionCount(address);

      // Estimate wallet age by getting first transaction
      let walletAge = 0;

      if (transactionCount > 0) {
        try {
          // Get current block for age estimation
          const currentBlock = await this.provider.getBlockNumber();
          const balance = await this.provider.getBalance(address);

          // Heuristic: estimate age based on nonce
          // New wallets (< 10 tx) are higher risk
          if (transactionCount < 10) {
            riskFactors.push('New wallet (< 10 transactions)');
          }

          // Empty or very low balance is suspicious
          if (balance === 0n) {
            riskFactors.push('Zero balance');
          }

          // Estimate age in days (rough estimate: 1 block = 12 seconds on Ethereum)
          // This is a simplified heuristic
          walletAge = Math.floor(transactionCount / 10); // Rough estimate
        } catch (err) {
          console.warn('Could not analyze transaction history:', err);
        }
      } else {
        riskFactors.push('No transaction history');
      }

      return {
        walletAge,
        transactionCount,
        isContract,
        riskFactors,
      };
    } catch (error) {
      console.error('Error analyzing on-chain behavior:', error);
      return {
        walletAge: 0,
        transactionCount: 0,
        isContract: false,
        riskFactors: ['Analysis failed'],
      };
    }
  }

  /**
   * Calculate composite risk score
   */
  private calculateRiskScore(
    sanctioned: boolean,
    onChainData: {
      walletAge: number;
      transactionCount: number;
      isContract: boolean;
      riskFactors: string[];
    }
  ): number {
    let score = 0;

    // Sanctioned = automatic 100
    if (sanctioned) {
      return 100;
    }

    // Contract address = +30 points
    if (onChainData.isContract) {
      score += 30;
    }

    // New wallet risk
    if (onChainData.transactionCount === 0) {
      score += 40;
    } else if (onChainData.transactionCount < 10) {
      score += 25;
    } else if (onChainData.transactionCount < 50) {
      score += 10;
    }

    // Wallet age risk (inverse relationship)
    if (onChainData.walletAge < 1) {
      score += 20;
    } else if (onChainData.walletAge < 7) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Perform comprehensive AML check on an address
   */
  async checkAddress(address: string): Promise<AMLCheckResult> {
    console.log(`🔍 Running AML check for address: ${address}`);

    // Validate address
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }

    // Check sanctions list
    const sanctioned = this.isSanctioned(address);
    const flags: string[] = [];

    if (sanctioned) {
      flags.push('SANCTIONED - Address on OFAC/sanctions list');
    }

    // Analyze on-chain behavior
    const onChainData = await this.analyzeOnChainBehavior(address);
    flags.push(...onChainData.riskFactors);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(sanctioned, onChainData);
    const riskLevel = this.getRiskLevel(riskScore);

    const result: AMLCheckResult = {
      address,
      riskScore,
      riskLevel,
      flags,
      sanctioned,
      metadata: {
        walletAge: onChainData.walletAge,
        transactionCount: onChainData.transactionCount,
        isContract: onChainData.isContract,
        hasTokens: onChainData.transactionCount > 0,
      },
    };

    console.log(`✅ AML Check Result: ${riskLevel} (Score: ${riskScore})`);
    if (flags.length > 0) {
      console.log(`   Flags: ${flags.join(', ')}`);
    }

    return result;
  }

  /**
   * Check if an address passes AML requirements
   */
  async isAddressAllowed(address: string): Promise<{ allowed: boolean; result: AMLCheckResult }> {
    const result = await this.checkAddress(address);
    const allowed = result.riskScore < this.riskThreshold && !result.sanctioned;

    return { allowed, result };
  }
}
