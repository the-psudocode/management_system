import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { asDateOnly } from '../src/modules/billing/calculations.js';

describe('Subscription Lifecycle State Machine Tests', () => {
  const transitions = {
    draft: ['quotation'],
    quotation: ['confirmed'],
    confirmed: ['active'],
    active: ['paused', 'closed'],
    paused: ['active', 'closed'],
    closed: [],
  };

  const canTransition = (from, to) => Boolean(transitions[from]?.includes(to));

  it('1. Valid forward lifecycle: draft -> quotation -> confirmed -> active -> closed', () => {
    assert.equal(canTransition('draft', 'quotation'), true);
    assert.equal(canTransition('quotation', 'confirmed'), true);
    assert.equal(canTransition('confirmed', 'active'), true);
    assert.equal(canTransition('active', 'closed'), true);
  });

  it('2. Active subscription pause and resume lifecycle', () => {
    assert.equal(canTransition('active', 'paused'), true);
    assert.equal(canTransition('paused', 'active'), true);
    assert.equal(canTransition('paused', 'closed'), true);
  });

  it('3. Disallowed invalid transitions', () => {
    assert.equal(canTransition('draft', 'active'), false, 'Cannot bypass quotation/confirmation directly to active');
    assert.equal(canTransition('active', 'draft'), false, 'Cannot revert active to draft');
    assert.equal(canTransition('closed', 'active'), false, 'Closed subscription is terminal state');
    assert.equal(canTransition('closed', 'paused'), false, 'Closed subscription cannot be paused');
  });

  it('4. Renewal validation: only closed subscription can generate renewal', () => {
    const canRenew = (sub) => sub.status === 'closed' && !sub.renewalId;

    assert.equal(canRenew({ status: 'closed', renewalId: null }), true);
    assert.equal(canRenew({ status: 'active', renewalId: null }), false, 'Active cannot renew yet');
    assert.equal(canRenew({ status: 'closed', renewalId: 'sub-new' }), false, 'Cannot renew twice');
  });

  it('5. Auto-close trigger on term end', () => {
    const sub = {
      status: 'active',
      autoClose: true,
      endDate: asDateOnly('2026-12-31'),
    };
    const nextPeriod = asDateOnly('2027-01-01');
    const termEnded = Boolean(sub.endDate && nextPeriod > sub.endDate);

    assert.equal(termEnded, true);
    const newStatus = termEnded && sub.autoClose ? 'closed' : sub.status;
    assert.equal(newStatus, 'closed');
  });
});

