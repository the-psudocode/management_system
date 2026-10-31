import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoice, asDateOnly } from '../src/modules/billing/calculations.js';
import { sendSuccess } from '../src/utils/response.js';

describe('Phase 4: Financial Calculation Tests (BigInt Paise Precision & Tax Rules)', () => {
  const billingDate = asDateOnly('2026-05-01');

  it('1. Product price × quantity (integer paise calculation)', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Pro Subscription',
        quantity: 3,
        unitPricePaise: 49900n, // Rs 499.00
      },
    ];
    const result = calculateInvoice({
      items,
      discounts: [],
      taxRules: [],
      billingDate,
    });

    assert.equal(result.subtotalPaise, 149700n); // 3 * 49900n = 149700n (Rs 1,497.00)
    assert.equal(result.totalPaise, 149700n);
  });

  it('2. Fixed discounts application', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Standard Plan',
        quantity: 1,
        unitPricePaise: 100000n, // Rs 1000.00
      },
    ];
    const discounts = [
      {
        id: 'disc-fixed',
        type: 'fixed',
        value: 20000n, // Rs 200.00 off
        wholeSubscription: true,
        products: [],
      },
    ];
    const result = calculateInvoice({
      items,
      discounts,
      taxRules: [],
      billingDate,
    });

    assert.equal(result.subtotalPaise, 100000n);
    assert.equal(result.discountPaise, 20000n);
    assert.equal(result.totalPaise, 80000n); // Rs 800.00
  });

  it('3. Percentage discounts with basis point precision (10% = 1000 bps)', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Plan A',
        quantity: 1,
        unitPricePaise: 99900n, // Rs 999.00
      },
    ];
    const discounts = [
      {
        id: 'disc-pct',
        type: 'percentage',
        value: 1000, // 10% = 1000 bps
        wholeSubscription: true,
        products: [],
      },
    ];
    const result = calculateInvoice({
      items,
      discounts,
      taxRules: [],
      billingDate,
    });

    // 99900n * 1000n + 5000n / 10000n = 9990n (Rs 99.90)
    assert.equal(result.subtotalPaise, 99900n);
    assert.equal(result.discountPaise, 9990n);
    assert.equal(result.totalPaise, 89910n); // Rs 899.10
  });

  it('4. Minimum purchase conditions for discount eligibility', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Small Plan',
        quantity: 1,
        unitPricePaise: 40000n, // Rs 400.00
      },
    ];
    const discountRequiring500 = {
      id: 'disc-min',
      type: 'fixed',
      value: 10000n,
      minimumPurchasePaise: 50000n, // Rs 500.00 min purchase
      wholeSubscription: true,
      products: [],
    };

    const result = calculateInvoice({
      items,
      discounts: [discountRequiring500],
      taxRules: [],
      billingDate,
    });

    assert.equal(result.discountPaise, 0n, 'Discount should not apply when subtotal < minimumPurchasePaise');
    assert.equal(result.totalPaise, 40000n);
  });

  it('5. Discount limits (discount cannot exceed eligible subtotal)', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Mini Plan',
        quantity: 1,
        unitPricePaise: 15000n, // Rs 150.00
      },
    ];
    const excessDiscount = {
      id: 'disc-huge',
      type: 'fixed',
      value: 50000n, // Rs 500.00 off
      wholeSubscription: true,
      products: [],
    };

    const result = calculateInvoice({
      items,
      discounts: [excessDiscount],
      taxRules: [],
      billingDate,
    });

    assert.equal(result.discountPaise, 15000n, 'Discount must be capped at line subtotal');
    assert.equal(result.totalPaise, 0n, 'Total cannot be negative');
  });

  it('6. CGST and SGST intra-state tax calculation (9% CGST + 9% SGST = 18% GST)', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Cloud Service',
        quantity: 1,
        unitPricePaise: 100000n, // Rs 1000.00
      },
    ];
    const taxRules = [
      { name: 'CGST 9%', type: 'CGST', rateBps: 900, isActive: true },
      { name: 'SGST 9%', type: 'SGST', rateBps: 900, isActive: true },
    ];

    const result = calculateInvoice({
      items,
      discounts: [],
      taxRules,
      originState: 'KA',
      customerState: 'KA', // Intra-state
      billingDate,
    });

    // 100000n * 900 / 10000 = 9000n CGST, 9000n SGST
    assert.equal(result.subtotalPaise, 100000n);
    assert.equal(result.taxPaise, 18000n);
    assert.equal(result.totalPaise, 118000n);

    const taxes = result.items[0].taxes;
    assert.equal(taxes.length, 2);
    assert.equal(taxes[0].taxPaise, 9000n);
    assert.equal(taxes[1].taxPaise, 9000n);
  });

  it('7. IGST inter-state tax calculation (18% IGST)', () => {
    const items = [
      {
        productId: 'prod-1',
        description: 'Cloud Service',
        quantity: 1,
        unitPricePaise: 100000n, // Rs 1000.00
      },
    ];
    const taxRules = [
      { name: 'CGST 9%', type: 'CGST', rateBps: 900, isActive: true },
      { name: 'SGST 9%', type: 'SGST', rateBps: 900, isActive: true },
      { name: 'IGST 18%', type: 'IGST', rateBps: 1800, isActive: true },
    ];

    const result = calculateInvoice({
      items,
      discounts: [],
      taxRules,
      originState: 'KA',
      customerState: 'MH', // Inter-state
      billingDate,
    });

    assert.equal(result.subtotalPaise, 100000n);
    assert.equal(result.taxPaise, 18000n); // 18% IGST = 18000 paise
    assert.equal(result.totalPaise, 118000n);

    const taxes = result.items[0].taxes;
    assert.equal(taxes.length, 1);
    assert.equal(taxes[0].type, 'IGST');
    assert.equal(taxes[0].taxPaise, 18000n);
  });

  it('8. Tax rounding half-up basis points behavior', () => {
    // 333 paise at 18% (1800 bps)
    // 333 * 1800 = 599,400. (599,400 + 5000) / 10000 = 604,400 / 10000 = 60n
    const items = [
      {
        productId: 'prod-1',
        description: 'Small Item',
        quantity: 1,
        unitPricePaise: 333n,
      },
    ];
    const taxRules = [{ name: 'IGST 18%', type: 'IGST', rateBps: 1800, isActive: true }];

    const result = calculateInvoice({
      items,
      discounts: [],
      taxRules,
      originState: 'KA',
      customerState: 'TN',
      billingDate,
    });

    assert.equal(result.items[0].taxes[0].taxPaise, 60n);
  });

  it('9. Proportional discount allocation across multiple line items', () => {
    const items = [
      { productId: 'p1', description: 'Item 1', quantity: 1, unitPricePaise: 60000n }, // Rs 600 (60%)
      { productId: 'p2', description: 'Item 2', quantity: 1, unitPricePaise: 40000n }, // Rs 400 (40%)
    ];
    const discount = {
      id: 'd1',
      type: 'fixed',
      value: 10000n, // Rs 100 total discount
      wholeSubscription: true,
      products: [],
    };

    const result = calculateInvoice({
      items,
      discounts: [discount],
      taxRules: [],
      billingDate,
    });

    assert.equal(result.subtotalPaise, 100000n);
    assert.equal(result.discountPaise, 10000n);
    assert.equal(result.items[0].discountPaise, 6000n, 'Item 1 receives 60% of discount');
    assert.equal(result.items[1].discountPaise, 4000n, 'Item 2 receives 40% of discount');
  });

  it('10. Invoice totals reconciliation: total = subtotal - discount + tax', () => {
    const items = [
      { productId: 'p1', description: 'Item 1', quantity: 2, unitPricePaise: 50000n }, // 100,000 paise
    ];
    const discounts = [
      { id: 'd1', type: 'fixed', value: 15000n, wholeSubscription: true, products: [] }, // 15,000 paise off -> 85,000 taxable
    ];
    const taxRules = [
      { name: 'IGST 18%', type: 'IGST', rateBps: 1800, isActive: true }, // 18% of 85,000 = 15,300 paise
    ];

    const result = calculateInvoice({
      items,
      discounts,
      taxRules,
      originState: 'KA',
      customerState: 'DL',
      billingDate,
    });

    assert.equal(result.subtotalPaise, 100000n);
    assert.equal(result.discountPaise, 15000n);
    assert.equal(result.taxPaise, 15300n);
    assert.equal(result.totalPaise, 100000n - 15000n + 15300n); // 100300n
  });

  it('11. Proration ratio math using integer paise', () => {
    const fullCycleAmount = 300000n; // Rs 3,000.00 for 30 days
    const totalDays = 30n;
    const elapsedDays = 10n;

    // Prorated amount = (fullCycleAmount * elapsedDays + totalDays / 2n) / totalDays
    const proratedPaise = (fullCycleAmount * elapsedDays + totalDays / 2n) / totalDays;
    assert.equal(proratedPaise, 100000n); // Rs 1,000.00
  });

  it('12. BigInt serialization in API responses (stringified numbers)', () => {
    const rawData = {
      subtotalPaise: 125000n,
      discountPaise: 25000n,
      details: {
        taxPaise: 18000n,
      },
      tags: ['billing', 'active'],
    };

    let responsePayload = null;
    const fakeRes = {
      status: (code) => ({
        json: (body) => {
          responsePayload = body;
        },
      }),
    };

    sendSuccess(fakeRes, rawData, 'Success');

    assert.equal(typeof responsePayload.data.subtotalPaise, 'string');
    assert.equal(responsePayload.data.subtotalPaise, '125000');
    assert.equal(responsePayload.data.details.taxPaise, '18000');
  });
});

