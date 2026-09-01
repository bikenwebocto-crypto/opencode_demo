/**
 * Simple, synchronous check — runs inline during the PATCH request, no
 * background jobs, no AuditLog writes, no RenewalGamingAlert. Just computes
 * an expected saving from the offer's pricing config and compares it to
 * what the employee entered.
 *
 * BOGO / FREE_ITEM (or any pricingType without a computable formula) are
 * treated as NOT_VERIFIABLE, which counts as passing — the schema has no
 * per-item price data to check them against, so blocking employees on
 * those offer types would be a false positive, not a real catch.
 */

const TOLERANCE_ABSOLUTE = 1.0; // EUR
const TOLERANCE_RELATIVE = 0.1; // 10%

export type SavingValidationResult =
  | { status: "VALID"; message: string }
  | { status: "INVALID"; message: string }
  | { status: "NOT_VERIFIABLE"; message: string }
  | { status: "SKIPPED"; message: string };

function computeExpectedSaving(
  pricingType: string,
  configuration: Record<string, unknown>,
  billAmount: number,
): { expected: number; tolerance: number } | null {
  switch (pricingType) {
    case "percentage":
    case "PERCENTAGE": {
      const pct = Number(configuration.percentage);

      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        return null;
      }

      // billAmount = amount actually paid after discount
      const original = billAmount / (1 - pct / 100);
      const expected = original - billAmount;

      return {
        expected,
        tolerance: Math.max(TOLERANCE_ABSOLUTE, expected * TOLERANCE_RELATIVE),
      };
    }

    case "flat":
    case "FLAT":
    case "flat_rate":
    case "fixed_amount": {
      const amount = Number(configuration.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      return {
        expected: amount,
        tolerance: TOLERANCE_ABSOLUTE,
      };
    }

    case "buy_x_get_y":
    case "BUY_X_GET_Y": {
      // Cannot validate from billAmount alone.
      // No item price is available to calculate the actual saving.
      return null;
    }

    default:
      return null;
  }
}

export function validateSaving(
  pricingType: string | undefined,
  configuration: Record<string, unknown> | undefined,
  billAmount: number,
  enteredSaving: number,
): SavingValidationResult {
  if (!pricingType) {
    return {
      status: "NOT_VERIFIABLE",
      message:
        "Saving validation cannot be performed because the offer type is missing.",
    };
  }

  if (pricingType === "buy_x_get_y" || pricingType === "BUY_X_GET_Y") {
    return {
      status: "SKIPPED",
      message: "Saving validation is skipped for Buy X Get Y offers.",
    };
  }
  const computed = computeExpectedSaving(
    pricingType,
    configuration ?? {},
    billAmount,
  );

  if (!computed) {
    return {
      status: "NOT_VERIFIABLE",
      message: "Saving validation cannot be performed for this offer type.",
    };
  }

  const { expected, tolerance } = computed;
  const deviation = Math.abs(enteredSaving - expected);

  if (deviation <= tolerance) {
    return { status: "VALID", message: "Saving amount is valid." };
  }

  return {
    status: "INVALID",
    message: `This saving amount isn't possible for this offer. Expected around €${expected.toFixed(2)}, based on your bill amount.`,
  };
}
