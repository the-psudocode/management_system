import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { customerRecordSelect, customerSelect, serializeCustomer, parseCustomerInput } from '../src/modules/customers/customerDto.js';

describe('customer DTO for the live Neon customer schema', () => {
  const row = {
    id: 'customer-1',
    userId: 'user-1',
    companyName: 'Brightloop Customer',
    phone: '+91 98765 43210',
    billingAddress: '1 MG Road',
    accountBalancePaise: 1200n,
    creditLimitPaise: 9000n,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-03T03:04:05.000Z'),
    user: { id: 'user-1', name: 'A. Customer', email: 'a@example.test', status: 'active' },
  };

  it('selects only live customer columns and required user fields', () => {
    assert.deepEqual(Object.keys(customerRecordSelect), [
      'id', 'userId', 'companyName', 'phone', 'billingAddress',
      'accountBalancePaise', 'creditLimitPaise', 'createdAt', 'updatedAt',
    ]);
    assert.deepEqual(Object.keys(customerSelect), [...Object.keys(customerRecordSelect), 'user']);
    assert.deepEqual(customerSelect.user.select, { id: true, name: true, email: true, status: true });
  });

  it('maps linked user identity/status and supported customer fields into the frontend DTO', () => {
    assert.deepEqual(serializeCustomer(row), {
      id: 'customer-1',
      name: 'A. Customer',
      email: 'a@example.test',
      phone: '+91 98765 43210',
      company: 'Brightloop Customer',
      address: '1 MG Road',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      createdAt: row.createdAt,
      status: 'active',
      accountBalancePaise: 1200n,
      creditLimitPaise: 9000n,
    });
  });

  it('maps inactive user status without converting it to active', () => {
    assert.equal(serializeCustomer({ ...row, user: { ...row.user, status: 'inactive' } }).status, 'inactive');
  });

  it('uses safe empty values for nullable customer and user profile fields', () => {
    const result = serializeCustomer({ ...row, companyName: null, phone: null, billingAddress: null, createdAt: null, user: { id: 'u', name: null, email: null, status: 'active' } });
    assert.equal(result.name, '');
    assert.equal(result.email, '');
    assert.equal(result.phone, '');
    assert.equal(result.company, '');
    assert.equal(result.address, '');
    assert.equal(result.createdAt, '');
    assert.equal(Object.values(result).includes(undefined), false);
  });

  it('rejects a missing User relation and unexpected status explicitly', () => {
    assert.throws(() => serializeCustomer({ ...row, user: null }), /missing its related user account/);
    assert.throws(() => serializeCustomer({ ...row, user: { ...row.user, status: 'suspended' } }), /unsupported status/);
    assert.throws(() => serializeCustomer({ ...row, user: { ...row.user, status: null } }), /unsupported status/);
  });

  it('maps supported frontend company/address fields and preserves paise inputs for create and update', () => {
    assert.deepEqual(parseCustomerInput({ userId: 'user-2', company: 'Example Co', address: '2 Park Street', phone: '123', creditLimitPaise: '15000' }), {
      userId: 'user-2', companyName: 'Example Co', billingAddress: '2 Park Street', phone: '123', creditLimitPaise: 15000n,
    });
    assert.deepEqual(parseCustomerInput({ company: 'Updated Co' }, true), { companyName: 'Updated Co' });
  });

  it('rejects unsupported location fields and attempts to write user-owned fields', () => {
    for (const field of ['city', 'state', 'pincode', 'gstin', 'billingCity', 'billingStateCode', 'postalCode']) {
      assert.throws(() => parseCustomerInput({ userId: 'u', [field]: 'value' }), /not supported by the current database schema/);
      assert.throws(() => parseCustomerInput({ [field]: 'value' }, true), /not supported by the current database schema/);
    }
    assert.throws(() => parseCustomerInput({ userId: 'u', name: 'Name' }), /belong to the linked user account/);
    assert.throws(() => parseCustomerInput({ status: 'inactive' }, true), /belong to the linked user account/);
  });
});
