export const COURSE_VALUE_NAIRA = 2300;
export const COURSE_VALUE_KOBO = 230_000;

export const TOTAL_STUDENT_PAYABLE_NAIRA = 2350;
export const TOTAL_STUDENT_PAYABLE_KOBO = 235_000;

export const STANDARD_CURRENCY = 'NGN';
export const FEE_ABSORBER_LABEL = 'Acadet CBT';

// Paystack Nigeria standard fee schedule
const PAYSTACK_LOCAL_RATE = 0.015; // 1.5%
const PAYSTACK_LOCAL_FLAT_KOBO = 10_000; // ₦100 flat surcharge
const PAYSTACK_LOCAL_FLAT_WAIVER_THRESHOLD_KOBO = 250_000; // Waived strictly below ₦2,500
const PAYSTACK_LOCAL_CAP_KOBO = 200_000; // ₦2,000 cap on local NGN transactions

const PAYSTACK_INTL_RATE = 0.039; // 3.9%
const PAYSTACK_INTL_FLAT_KOBO = 10_000; // ₦100

export type PaystackFeeSource = 'paystack_actual' | 'schedule_computed';
export type ReconciliationStatus = 'pending' | 'reconciled' | 'shortfall' | 'not_applicable';

export interface FeeComputationInput {
  amountKobo: number;
  currency?: string | null;
  channel?: string | null;
  countryCode?: string | null;
  gatewayReportedFeesKobo?: number | null;
}

export interface FeeComputationResult {
  paystackFeeKobo: number;
  paystackFeeNaira: number;
  feeSource: PaystackFeeSource;
  isInternational: boolean;
}

export interface SettlementReconciliationResult extends FeeComputationResult {
  courseValueKobo: number;
  courseValueNaira: number;
  totalChargedKobo: number;
  totalChargedNaira: number;
  netSettlementKobo: number;
  netSettlementNaira: number;
  settlementVarianceKobo: number;
  settlementVarianceNaira: number;
  coversCourseValue: boolean;
  reconciliationStatus: 'reconciled' | 'shortfall';
}

export function koboToNaira(kobo: number): number {
  return Number((kobo / 100).toFixed(2));
}

export function computeApplicablePaystackFeeKobo(
  input: FeeComputationInput
): FeeComputationResult {
  const amountKobo = Math.max(0, Math.round(input.amountKobo));
  const currency = (input.currency || STANDARD_CURRENCY).trim().toUpperCase();
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  const isInternational =
    currency !== 'NGN' || (countryCode !== null && countryCode !== '' && countryCode !== 'NG');

  if (
    typeof input.gatewayReportedFeesKobo === 'number' &&
    Number.isFinite(input.gatewayReportedFeesKobo) &&
    input.gatewayReportedFeesKobo >= 0
  ) {
    const actualFeeKobo = Math.round(input.gatewayReportedFeesKobo);
    return {
      paystackFeeKobo: actualFeeKobo,
      paystackFeeNaira: koboToNaira(actualFeeKobo),
      feeSource: 'paystack_actual',
      isInternational,
    };
  }

  let computedFeeKobo: number;
  if (isInternational) {
    computedFeeKobo = Math.round(amountKobo * PAYSTACK_INTL_RATE) + PAYSTACK_INTL_FLAT_KOBO;
  } else {
    const percentageFee = Math.round(amountKobo * PAYSTACK_LOCAL_RATE);
    const flatFee =
      amountKobo < PAYSTACK_LOCAL_FLAT_WAIVER_THRESHOLD_KOBO ? 0 : PAYSTACK_LOCAL_FLAT_KOBO;
    computedFeeKobo = Math.min(PAYSTACK_LOCAL_CAP_KOBO, percentageFee + flatFee);
  }

  return {
    paystackFeeKobo: computedFeeKobo,
    paystackFeeNaira: koboToNaira(computedFeeKobo),
    feeSource: 'schedule_computed',
    isInternational,
  };
}

export function reconcileCoursePayment(params: {
  totalChargedKobo: number;
  courseValueKobo?: number;
  currency?: string | null;
  channel?: string | null;
  countryCode?: string | null;
  gatewayReportedFeesKobo?: number | null;
}): SettlementReconciliationResult {
  const totalChargedKobo = Math.round(params.totalChargedKobo);
  const courseValueKobo = Math.round(params.courseValueKobo ?? COURSE_VALUE_KOBO);

  const feeResult = computeApplicablePaystackFeeKobo({
    amountKobo: totalChargedKobo,
    currency: params.currency,
    channel: params.channel,
    countryCode: params.countryCode,
    gatewayReportedFeesKobo: params.gatewayReportedFeesKobo,
  });

  const netSettlementKobo = totalChargedKobo - feeResult.paystackFeeKobo;
  const settlementVarianceKobo = netSettlementKobo - courseValueKobo;
  const coversCourseValue = netSettlementKobo >= courseValueKobo;

  return {
    ...feeResult,
    courseValueKobo,
    courseValueNaira: koboToNaira(courseValueKobo),
    totalChargedKobo,
    totalChargedNaira: koboToNaira(totalChargedKobo),
    netSettlementKobo,
    netSettlementNaira: koboToNaira(netSettlementKobo),
    settlementVarianceKobo,
    settlementVarianceNaira: koboToNaira(settlementVarianceKobo),
    coversCourseValue,
    reconciliationStatus: coversCourseValue ? 'reconciled' : 'shortfall',
  };
}
