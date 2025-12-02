/**
 * Recurring bill service
 * Detects recurring bill patterns and identifies amount anomalies
 */

import 'server-only';

import { getDb, initDb } from '../db';
import { invoices } from '../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export interface RecurringBillAnalysis {
  isRecurring: boolean;
  recurringPattern?: string;
  hasAmountAnomaly: boolean;
  amountAnomalyReason?: string;
  expectedAmount?: number;
  amountDeviationPercent?: number;
  historicalCount: number;
  averageAmount: number;
  medianAmount: number;
  minAmount: number;
  maxAmount: number;
}

/**
 * Analyze if an invoice is part of a recurring bill pattern
 * and detect amount anomalies
 */
export async function analyzeRecurringBill(
  vendorName: string,
  currentAmount: number,
  currentDate: string
): Promise<RecurringBillAnalysis> {
  await initDb();
  const db = getDb();

  // Get historical invoices from the same vendor within the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoTimestamp = Math.floor(twelveMonthsAgo.getTime() / 1000);

  const historicalInvoices = await db
    .select({
      totalAmount: invoices.totalAmount,
      invoiceDate: invoices.invoiceDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.vendorName, vendorName),
        gte(invoices.createdAt, sql`${twelveMonthsAgoTimestamp}`)
      )
    )
    .orderBy(desc(invoices.invoiceDate))
    .then(rows => 
      rows
        .filter(row => row.totalAmount !== null && row.totalAmount !== undefined)
        .map(row => ({
          amount: Number(row.totalAmount),
          date: row.invoiceDate,
          createdAt: row.createdAt,
        }))
    );

  // Need at least 2 historical invoices to establish a pattern
  if (historicalInvoices.length < 2) {
    return {
      isRecurring: false,
      hasAmountAnomaly: false,
      historicalCount: historicalInvoices.length,
      averageAmount: currentAmount,
      medianAmount: currentAmount,
      minAmount: currentAmount,
      maxAmount: currentAmount,
    };
  }

  // Calculate statistics
  const amounts = historicalInvoices.map(inv => inv.amount);
  const averageAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const medianAmount = sortedAmounts.length % 2 === 0
    ? (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2
    : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);

  // Detect recurring pattern by analyzing date intervals
  const recurringPattern = detectRecurringPattern(historicalInvoices, currentDate);
  const isRecurring = recurringPattern !== null;

  // Calculate expected amount (use median for robustness against outliers)
  const expectedAmount = medianAmount;

  // Detect amount anomaly
  // Flag if current amount deviates by more than 15% from expected (or more than $50 difference for small amounts)
  const deviation = Math.abs(currentAmount - expectedAmount);
  const deviationPercent = expectedAmount > 0 ? (deviation / expectedAmount) * 100 : 0;
  const thresholdPercent = 15; // 15% threshold
  const thresholdAbsolute = 50; // $50 absolute threshold for small amounts

  const hasAmountAnomaly = deviationPercent > thresholdPercent || 
                          (expectedAmount < 500 && deviation > thresholdAbsolute);

  let amountAnomalyReason: string | undefined;
  if (hasAmountAnomaly) {
    if (currentAmount > expectedAmount) {
      amountAnomalyReason = `Amount is ${deviationPercent.toFixed(1)}% higher than expected ($${expectedAmount.toFixed(2)}). Historical range: $${minAmount.toFixed(2)} - $${maxAmount.toFixed(2)}.`;
    } else {
      amountAnomalyReason = `Amount is ${deviationPercent.toFixed(1)}% lower than expected ($${expectedAmount.toFixed(2)}). Historical range: $${minAmount.toFixed(2)} - $${maxAmount.toFixed(2)}.`;
    }
  }

  return {
    isRecurring,
    recurringPattern: recurringPattern || undefined,
    hasAmountAnomaly,
    amountAnomalyReason,
    expectedAmount,
    amountDeviationPercent: deviationPercent,
    historicalCount: historicalInvoices.length,
    averageAmount,
    medianAmount,
    minAmount,
    maxAmount,
  };
}

/**
 * Detect recurring pattern by analyzing date intervals
 */
function detectRecurringPattern(
  historicalInvoices: Array<{ amount: number; date: string | null; createdAt: number | Date | null }>,
  currentDate: string
): string | null {
  if (historicalInvoices.length < 2) return null;

  // Parse dates and sort chronologically
  const dates = [
    ...historicalInvoices
      .filter(inv => inv.date)
      .map(inv => new Date(inv.date!))
      .filter(date => !isNaN(date.getTime())),
    new Date(currentDate),
  ].sort((a, b) => a.getTime() - b.getTime());

  if (dates.length < 3) return null;

  // Calculate intervals between consecutive dates
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const daysDiff = Math.abs((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }

  // Check for monthly pattern (25-35 days)
  const monthlyIntervals = intervals.filter(days => days >= 25 && days <= 35);
  if (monthlyIntervals.length >= intervals.length * 0.7) {
    return 'monthly';
  }

  // Check for quarterly pattern (85-95 days)
  const quarterlyIntervals = intervals.filter(days => days >= 85 && days <= 95);
  if (quarterlyIntervals.length >= intervals.length * 0.7) {
    return 'quarterly';
  }

  // Check for bi-monthly pattern (55-65 days)
  const biMonthlyIntervals = intervals.filter(days => days >= 55 && days <= 65);
  if (biMonthlyIntervals.length >= intervals.length * 0.7) {
    return 'bi-monthly';
  }

  // Check for weekly pattern (5-9 days)
  const weeklyIntervals = intervals.filter(days => days >= 5 && days <= 9);
  if (weeklyIntervals.length >= intervals.length * 0.7) {
    return 'weekly';
  }

  // If intervals are relatively consistent (within 20% variance), mark as recurring
  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1;

    // Low variance indicates a recurring pattern
    if (coefficientOfVariation < 0.3 && avgInterval >= 20) {
      if (avgInterval >= 25 && avgInterval <= 35) return 'monthly';
      if (avgInterval >= 55 && avgInterval <= 65) return 'bi-monthly';
      if (avgInterval >= 85 && avgInterval <= 95) return 'quarterly';
      return 'recurring';
    }
  }

  return null;
}





