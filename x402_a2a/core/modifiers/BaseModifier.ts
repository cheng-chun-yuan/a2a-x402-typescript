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
 * Base modifier interface for extending payment verification flow
 */

import { PaymentPayload, PaymentRequirements } from '../../types/state';

export interface ModifierContext {
  payer?: string;
  payload: PaymentPayload;
  requirements: PaymentRequirements;
  metadata?: Record<string, any>;
}

export interface ModifierResult {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Base class for payment verification modifiers
 * Modifiers can inject custom validation logic into the payment flow
 */
export abstract class BaseModifier {
  /**
   * Execute modifier validation
   * @param context - Payment context including payer address, payload, and requirements
   * @returns ModifierResult indicating whether to allow the payment
   */
  abstract execute(context: ModifierContext): Promise<ModifierResult>;

  /**
   * Priority for modifier execution (lower = earlier)
   * AML checks should run early (e.g., priority 10)
   * Balance checks run later (e.g., priority 100)
   */
  abstract get priority(): number;

  /**
   * Modifier name for logging and debugging
   */
  abstract get name(): string;
}
