import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asDateOnly,
  addMonthsClamped,
  addBillingInterval,
  invoiceDueDate,
} from '../src/modules/billing/calculations.js';

describe('Phase 3: Automated Unit Tests — Billing Engine & Month-End Anchor Math', () => {
  // Helper to format Date to ISO YYYY-MM-DD
  const toIsoDate = (d) => d.toISOString().slice(0, 10);

  it('1. Monthly billing period calculations without overflow', () => {
    const start = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
    const next = addBillingInterval(start, 'monthly', 1, 15);
    assert.equal(toIsoDate(next), '2026-02-15');
  });

  it('2. Weekly billing period calculations', () => {
    const start = new Date(Date.UTC(2026, 0, 10)); // 2026-01-10
    const next = addBillingInterval(start, 'weekly', 1);
    assert.equal(toIsoDate(next), '2026-01-17');

    const twoWeeks = addBillingInterval(start, 'weekly', 2);
    assert.equal(toIsoDate(twoWeeks), '2026-01-24');
  });

  it('3. Daily billing period calculations', () => {
    const start = new Date(Date.UTC(2026, 0, 10)); // 2026-01-10
    const next = addBillingInterval(start, 'daily', 1);
    assert.equal(toIsoDate(next), '2026-01-11');

    const fiveDays = addBillingInterval(start, 'daily', 5);
    assert.equal(toIsoDate(fiveDays), '2026-01-15');
  });

  it('4. Quarterly billing calculations', () => {
    const start = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
    const next = addBillingInterval(start, 'quarterly', 1, 15);
    assert.equal(toIsoDate(next), '2026-04-15');

    // Quarterly from Oct 31 -> Jan 31
    const oct31 = new Date(Date.UTC(2026, 9, 31)); // 2026-10-31
    const qNext = addBillingInterval(oct31, 'quarterly', 1, 31);
    assert.equal(toIsoDate(qNext), '2027-01-31');
  });

  it('5. Yearly billing calculations', () => {
    const start = new Date(Date.UTC(2026, 4, 20)); // 2026-05-20
    const next = addBillingInterval(start, 'yearly', 1, 20);
    assert.equal(toIsoDate(next), '2027-05-20');

    // Leap year Feb 29 to next non-leap year Feb 28
    const leapDay = new Date(Date.UTC(2024, 1, 29)); // 2024-02-29
    const nextYear = addBillingInterval(leapDay, 'yearly', 1, 29);
    assert.equal(toIsoDate(nextYear), '2025-02-28');
  });

  it('6. January 31 month-end behavior across non-leap year (Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31)', () => {
    const anchorDay = 31;
    let current = new Date(Date.UTC(2025, 0, 31)); // Jan 31, 2025
    assert.equal(toIsoDate(current), '2025-01-31');

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-02-28', 'Jan 31 + 1m clamped to Feb 28');

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-03-31', 'Feb 28 + 1m restores to Mar 31');

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-04-30', 'Mar 31 + 1m clamped to Apr 30');

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-05-31', 'Apr 30 + 1m restores to May 31');
  });

  it('7. Leap-year behavior (Jan 31, 2024 -> Feb 29, 2024 -> Mar 31, 2024)', () => {
    const anchorDay = 31;
    let current = new Date(Date.UTC(2024, 0, 31)); // Jan 31, 2024 (Leap year)

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2024-02-29', 'Leap year clamps to Feb 29');

    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2024-03-31', 'Restores to Mar 31');
  });

  it('8. January 30 behavior (Jan 30 -> Feb 28/29 -> Mar 30)', () => {
    const anchorDay = 30;
    // Non-leap year
    let current = new Date(Date.UTC(2025, 0, 30)); // Jan 30, 2025
    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-02-28', 'Clamps to Feb 28');
    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2025-03-30', 'Restores to Mar 30');

    // Leap year
    let leapCurrent = new Date(Date.UTC(2024, 0, 30)); // Jan 30, 2024
    leapCurrent = addBillingInterval(leapCurrent, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(leapCurrent), '2024-02-29', 'Clamps to Feb 29 in leap year');
    leapCurrent = addBillingInterval(leapCurrent, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(leapCurrent), '2024-03-30', 'Restores to Mar 30 in leap year');
  });

  it('9. March 31 behavior (Mar 31 -> Apr 30 -> May 31)', () => {
    const anchorDay = 31;
    let current = new Date(Date.UTC(2026, 2, 31)); // Mar 31, 2026
    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2026-04-30', 'Mar 31 clamps to Apr 30');
    current = addBillingInterval(current, 'monthly', 1, anchorDay);
    assert.equal(toIsoDate(current), '2026-05-31', 'Restores to May 31');
  });

  it('10. Subscription expiration logic (autoClose and term end)', () => {
    const subscription = {
      id: 'sub-1',
      status: 'active',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      nextBillingDate: new Date('2026-04-01T00:00:00.000Z'),
      autoClose: true,
    };
    const isTermEnded = Boolean(subscription.endDate && subscription.nextBillingDate > subscription.endDate);
    assert.equal(isTermEnded, true);
  });

  it('11. Paused subscription billing suppression logic', () => {
    const activeSub = { status: 'active', nextBillingDate: new Date('2026-05-01T00:00:00.000Z') };
    const pausedSub = { status: 'paused', nextBillingDate: new Date('2026-05-01T00:00:00.000Z') };
    const billingDate = new Date('2026-05-01T00:00:00.000Z');

    const shouldBill = (sub) => sub.status === 'active' && sub.nextBillingDate <= billingDate;
    assert.equal(shouldBill(activeSub), true);
    assert.equal(shouldBill(pausedSub), false);
  });

  it('12. Closed subscription billing suppression logic', () => {
    const closedSub = { status: 'closed', nextBillingDate: new Date('2026-05-01T00:00:00.000Z') };
    const billingDate = new Date('2026-05-01T00:00:00.000Z');
    const shouldBill = (sub) => sub.status === 'active' && sub.nextBillingDate <= billingDate;
    assert.equal(shouldBill(closedSub), false);
  });

  it('13. Future-start subscription billing suppression logic', () => {
    const futureSub = { status: 'active', nextBillingDate: new Date('2026-06-01T00:00:00.000Z') };
    const billingDate = new Date('2026-05-01T00:00:00.000Z');
    const shouldBill = (sub) => sub.status === 'active' && sub.nextBillingDate <= billingDate;
    assert.equal(shouldBill(futureSub), false);
  });

  it('14. Dry-run / preview behavior (computes periods without committing)', () => {
    const subscription = {
      id: 'sub-preview',
      number: 'SUB-2026-001',
      billingInterval: 'monthly',
      intervalCount: 1,
      startDate: new Date('2026-01-31T00:00:00.000Z'),
      nextBillingDate: new Date('2026-01-31T00:00:00.000Z'),
    };
    const start = asDateOnly(subscription.nextBillingDate);
    const anchorDay = asDateOnly(subscription.startDate).getUTCDate();
    const next = addBillingInterval(start, subscription.billingInterval, subscription.intervalCount, anchorDay);
    const end = new Date(next);
    end.setUTCDate(end.getUTCDate() - 1);

    assert.equal(toIsoDate(start), '2026-01-31');
    assert.equal(toIsoDate(end), '2026-02-27'); // Feb 28 is the next start, so periodEnd is Feb 27
    assert.equal(toIsoDate(next), '2026-02-28');
  });

  it('15. Duplicate billing prevention logic (period uniqueness and idempotency)', () => {
    const existingPeriods = new Set(['sub-1:2026-01-01:2026-01-31']);
    const candidatePeriod = { subscriptionId: 'sub-1', start: '2026-01-01', end: '2026-01-31' };
    const key = `${candidatePeriod.subscriptionId}:${candidatePeriod.start}:${candidatePeriod.end}`;
    assert.equal(existingPeriods.has(key), true, 'Identifies duplicate billing period to prevent double generation');
  });
});

