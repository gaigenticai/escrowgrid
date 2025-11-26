import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
// - 20 significant digits covers most currency needs
// - ROUND_HALF_UP is standard for financial rounding
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Maximum safe amount that can be represented precisely in JSON.
 * JavaScript's Number.MAX_SAFE_INTEGER is 2^53 - 1 = 9,007,199,254,740,991
 * With 8 decimal places for the smallest currency units, this gives us
 * ~90 trillion in the largest unit (e.g., dollars).
 */
export const MAX_SAFE_AMOUNT = new Decimal('9007199254740991');

/**
 * Maximum decimal places supported for amounts.
 * 8 decimal places covers all currencies including crypto (Bitcoin has 8).
 */
export const MAX_DECIMAL_PLACES = 8;

/**
 * Money represents a monetary amount with arbitrary precision.
 * Uses Decimal.js internally to avoid floating-point precision issues.
 *
 * @example
 * ```typescript
 * const amount = Money.fromNumber(100.50);
 * const fee = Money.fromString('0.01');
 * const total = amount.add(fee);
 * console.log(total.toString()); // "100.51"
 * console.log(total.toNumber()); // 100.51
 * ```
 */
export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  /**
   * Creates a Money instance from a number.
   * Validates that the number doesn't exceed safe precision.
   *
   * @throws Error if the number has more decimal places than allowed
   * @throws Error if the number exceeds the maximum safe amount
   */
  static fromNumber(n: number): Money {
    if (!Number.isFinite(n)) {
      throw new Error('Amount must be a finite number');
    }

    const decimal = new Decimal(n);

    // Check decimal places
    const dp = decimal.decimalPlaces();
    if (dp !== null && dp > MAX_DECIMAL_PLACES) {
      throw new Error(
        `Amount has ${dp} decimal places, maximum allowed is ${MAX_DECIMAL_PLACES}`,
      );
    }

    // Check safe range
    if (decimal.abs().greaterThan(MAX_SAFE_AMOUNT)) {
      throw new Error(
        `Amount exceeds maximum safe value of ${MAX_SAFE_AMOUNT.toString()}`,
      );
    }

    return new Money(decimal);
  }

  /**
   * Creates a Money instance from a string.
   * This is the preferred method when precision is critical.
   */
  static fromString(s: string): Money {
    const decimal = new Decimal(s);

    if (!decimal.isFinite()) {
      throw new Error('Amount must be a finite number');
    }

    // Check decimal places
    const dp = decimal.decimalPlaces();
    if (dp !== null && dp > MAX_DECIMAL_PLACES) {
      throw new Error(
        `Amount has ${dp} decimal places, maximum allowed is ${MAX_DECIMAL_PLACES}`,
      );
    }

    return new Money(decimal);
  }

  /**
   * Creates a Money instance from a database NUMERIC string.
   * Database NUMERIC values should be retrieved as strings to preserve precision.
   */
  static fromDbNumeric(dbValue: string | number): Money {
    if (typeof dbValue === 'number') {
      return Money.fromNumber(dbValue);
    }
    return Money.fromString(dbValue);
  }

  /**
   * Returns true if the amount is positive.
   */
  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  /**
   * Returns true if the amount is negative.
   */
  isNegative(): boolean {
    return this.value.lessThan(0);
  }

  /**
   * Returns true if the amount is zero.
   */
  isZero(): boolean {
    return this.value.isZero();
  }

  /**
   * Returns true if this amount is greater than the other.
   */
  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  /**
   * Returns true if this amount is less than the other.
   */
  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  /**
   * Returns true if this amount is greater than or equal to the other.
   */
  greaterThanOrEqual(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  /**
   * Returns true if this amount is less than or equal to the other.
   */
  lessThanOrEqual(other: Money): boolean {
    return this.value.lessThanOrEqualTo(other.value);
  }

  /**
   * Returns true if this amount equals the other.
   */
  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  /**
   * Adds another amount to this one, returning a new Money instance.
   */
  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  /**
   * Subtracts another amount from this one, returning a new Money instance.
   */
  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  /**
   * Multiplies this amount by a factor, returning a new Money instance.
   */
  multiply(factor: number | string | Decimal): Money {
    return new Money(this.value.times(factor));
  }

  /**
   * Divides this amount by a divisor, returning a new Money instance.
   * Result is rounded to MAX_DECIMAL_PLACES.
   */
  divide(divisor: number | string | Decimal): Money {
    const result = this.value.dividedBy(divisor);
    return new Money(result.toDecimalPlaces(MAX_DECIMAL_PLACES));
  }

  /**
   * Returns the absolute value of this amount.
   */
  abs(): Money {
    return new Money(this.value.abs());
  }

  /**
   * Returns the amount as a number.
   * Use with caution - may lose precision for very large or precise values.
   * Prefer toString() when serializing.
   */
  toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * Returns the amount as a string with full precision.
   * This is the recommended method for serialization.
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Returns the amount as a fixed decimal string.
   * Useful for display with consistent decimal places.
   */
  toFixed(decimalPlaces: number): string {
    return this.value.toFixed(decimalPlaces);
  }

  /**
   * Returns the underlying Decimal instance.
   * For advanced operations not covered by Money methods.
   */
  toDecimal(): Decimal {
    return this.value;
  }
}

/**
 * Validates that an amount can be safely represented.
 * Use this to validate incoming API amounts before processing.
 *
 * @param amount - The amount to validate
 * @returns An object with isValid and optional error message
 */
export function validateAmount(amount: unknown): { isValid: boolean; error?: string } {
  if (typeof amount !== 'number') {
    return { isValid: false, error: 'Amount must be a number' };
  }

  if (!Number.isFinite(amount)) {
    return { isValid: false, error: 'Amount must be a finite number' };
  }

  if (amount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  try {
    Money.fromNumber(amount);
    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : 'Invalid amount' };
  }
}
