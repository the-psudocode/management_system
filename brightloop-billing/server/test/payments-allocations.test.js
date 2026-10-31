import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { asDateOnly } from '../src/modules/billing/calculations.js';

describe('Phase 6: Payment, Allocation, Overdue & Cancellation Tests', () => {
  // Pure logic simulations of payment allocation and invoice status state machine

  function allocatePayment(invoices, allocations, paymentAmountPaise, paymentCurrency, paymentDate = new Date()) {
    const allocationTotal = allocations.reduce((sum, item) => sum + item.amountPaise, 0n);
    if (allocationTotal !== paymentAmountPaise) {
      throw new Error('Payment amount must equal the sum of its invoice allocations.');
    }

    const invoiceById = new Map(invoices.map((inv) => [inv.id, { ...inv }]));

    for (const alloc of allocations) {
      const invoice = invoiceById.get(alloc.invoiceId);
      if (!invoice) throw new Error(`Invoice ${alloc.invoiceId} not found.`);
      if (invoice.currency !== paymentCurrency) {
        throw new Error('Payment and invoice currencies must match.');
      }
      if (!['confirmed', 'partially_paid', 'overdue'].includes(invoice.status)) {
        throw new Error(`Invoice ${invoice.number} is not open for payment.`);
      }
      const outstanding = invoice.totalPaise - invoice.amountPaidPaise;
      if (alloc.amountPaise > outstanding) {
        throw new Error(`Allocation exceeds the outstanding balance for invoice ${invoice.number}.`);
      }
    }

    const updatedInvoices = [];
    for (const alloc of allocations) {
      const invoice = invoiceById.get(alloc.invoiceId);
      const nextPaid = invoice.amountPaidPaise + alloc.amountPaise;
      const remaining = invoice.totalPaise - nextPaid;
      const today = asDateOnly(paymentDate);
      const overdue = invoice.dueDate < today;
      const nextStatus = remaining === 0n ? 'paid' : overdue ? 'overdue' : 'partially_paid';

      invoice.amountPaidPaise = nextPaid;
      invoice.status = nextStatus;
      updatedInvoices.push(invoice);
    }

    return updatedInvoices;
  }

  it('1. Single full payment transitions invoice to paid', () => {
    const invoices = [
      {
        id: 'inv-1',
        number: 'INV-2026-001',
        currency: 'INR',
        totalPaise: 50000n, // Rs 500.00
        amountPaidPaise: 0n,
        dueDate: asDateOnly('2026-06-01'),
        status: 'confirmed',
      },
    ];
    const allocations = [{ invoiceId: 'inv-1', amountPaise: 50000n }];
    const [result] = allocatePayment(invoices, allocations, 50000n, 'INR');

    assert.equal(result.amountPaidPaise, 50000n);
    assert.equal(result.status, 'paid');
  });

  it('2. Partial payment transitions invoice to partially_paid', () => {
    const invoices = [
      {
        id: 'inv-2',
        number: 'INV-2026-002',
        currency: 'INR',
        totalPaise: 100000n, // Rs 1000.00
        amountPaidPaise: 0n,
        dueDate: asDateOnly('2026-06-01'),
        status: 'confirmed',
      },
    ];
    const allocations = [{ invoiceId: 'inv-2', amountPaise: 40000n }];
    const [result] = allocatePayment(invoices, allocations, 40000n, 'INR', asDateOnly('2026-05-15'));

    assert.equal(result.amountPaidPaise, 40000n);
    assert.equal(result.status, 'partially_paid');
    assert.equal(result.totalPaise - result.amountPaidPaise, 60000n, 'Outstanding balance is 60000 paise');
  });

  it('3. Multiple payments accumulating on the same invoice until paid', () => {
    let invoice = {
      id: 'inv-3',
      number: 'INV-2026-003',
      currency: 'INR',
      totalPaise: 100000n,
      amountPaidPaise: 0n,
      dueDate: asDateOnly('2026-06-01'),
      status: 'confirmed',
    };

    // First payment: 30,000 paise
    const [step1] = allocatePayment([invoice], [{ invoiceId: 'inv-3', amountPaise: 30000n }], 30000n, 'INR', asDateOnly('2026-05-01'));
    assert.equal(step1.status, 'partially_paid');
    assert.equal(step1.amountPaidPaise, 30000n);

    // Second payment: 70,000 paise
    const [step2] = allocatePayment([step1], [{ invoiceId: 'inv-3', amountPaise: 70000n }], 70000n, 'INR', asDateOnly('2026-05-10'));
    assert.equal(step2.status, 'paid');
    assert.equal(step2.amountPaidPaise, 100000n);
  });

  it('4. Payment allocation across multiple invoices', () => {
    const invoices = [
      { id: 'inv-A', number: 'INV-A', currency: 'INR', totalPaise: 30000n, amountPaidPaise: 0n, dueDate: asDateOnly('2026-06-01'), status: 'confirmed' },
      { id: 'inv-B', number: 'INV-B', currency: 'INR', totalPaise: 50000n, amountPaidPaise: 0n, dueDate: asDateOnly('2026-06-01'), status: 'confirmed' },
    ];
    const allocations = [
      { invoiceId: 'inv-A', amountPaise: 30000n },
      { invoiceId: 'inv-B', amountPaise: 20000n },
    ];
    const results = allocatePayment(invoices, allocations, 50000n, 'INR', asDateOnly('2026-05-15'));

    assert.equal(results[0].status, 'paid');
    assert.equal(results[0].amountPaidPaise, 30000n);
    assert.equal(results[1].status, 'partially_paid');
    assert.equal(results[1].amountPaidPaise, 20000n);
  });

  it('5. Overpayment prevention throws an error', () => {
    const invoices = [
      { id: 'inv-4', number: 'INV-2026-004', currency: 'INR', totalPaise: 50000n, amountPaidPaise: 20000n, dueDate: asDateOnly('2026-06-01'), status: 'partially_paid' },
    ];
    // Outstanding is 30,000, attempt to allocate 30,001
    const allocations = [{ invoiceId: 'inv-4', amountPaise: 30001n }];

    assert.throws(
      () => allocatePayment(invoices, allocations, 30001n, 'INR'),
      /Allocation exceeds the outstanding balance/
    );
  });

  it('6. Outstanding balance computation', () => {
    const invoice = { totalPaise: 150000n, amountPaidPaise: 45000n };
    const outstanding = invoice.totalPaise - invoice.amountPaidPaise;
    assert.equal(outstanding, 105000n);
  });

  it('7. Overdue calculation when dueDate is in the past', () => {
    const invoices = [
      {
        id: 'inv-past',
        number: 'INV-PAST',
        currency: 'INR',
        totalPaise: 100000n,
        amountPaidPaise: 0n,
        dueDate: asDateOnly('2026-04-01'), // Past due date
        status: 'confirmed',
      },
    ];
    // Pay partial 20,000 on May 01
    const [result] = allocatePayment(invoices, [{ invoiceId: 'inv-past', amountPaise: 20000n }], 20000n, 'INR', asDateOnly('2026-05-01'));
    assert.equal(result.status, 'overdue', 'Invoice with remaining balance past dueDate must be marked overdue');
  });

  it('8. Cancellation behavior rules', () => {
    const canCancel = (invoice) => ['draft', 'confirmed', 'overdue'].includes(invoice.status) && (invoice.allocations || []).length === 0;

    assert.equal(canCancel({ status: 'draft', allocations: [] }), true);
    assert.equal(canCancel({ status: 'confirmed', allocations: [] }), true);
    assert.equal(canCancel({ status: 'overdue', allocations: [] }), true);
    assert.equal(canCancel({ status: 'partially_paid', allocations: [{ id: 'alloc-1' }] }), false, 'Cannot cancel partially paid invoice');
    assert.equal(canCancel({ status: 'paid', allocations: [{ id: 'alloc-2' }] }), false, 'Cannot cancel paid invoice');
  });
});

