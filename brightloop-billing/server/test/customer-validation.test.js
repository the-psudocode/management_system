import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCustomerInput,
  MAX_BIGINT_PAISE,
  unsupportedCustomerFields,
} from '../src/modules/customers/customerDto.js';

describe('Customer Security, Validation & BIGINT Boundary Tests', () => {
  it('accepts creditLimitPaise at non-negative lower bound (0)', () => {
    const input = {
      userId: 'valid-user-1',
      creditLimitPaise: '0',
    };
    const parsed = parseCustomerInput(input);
    assert.equal(parsed.creditLimitPaise, 0n);
  });

  it('accepts creditLimitPaise at maximum signed PostgreSQL BIGINT (9223372036854775807)', () => {
    const input = {
      userId: 'valid-user-1',
      creditLimitPaise: '9223372036854775807',
    };
    const parsed = parseCustomerInput(input);
    assert.equal(parsed.creditLimitPaise, MAX_BIGINT_PAISE);
  });

  it('rejects creditLimitPaise exceeding PostgreSQL BIGINT maximum (9223372036854775808)', () => {
    const input = {
      userId: 'valid-user-1',
      creditLimitPaise: '9223372036854775808',
    };
    assert.throws(
      () => parseCustomerInput(input),
      /Amount cannot exceed PostgreSQL BIGINT maximum/
    );
  });

  it('rejects negative creditLimitPaise strings', () => {
    const input = {
      userId: 'valid-user-1',
      creditLimitPaise: '-100',
    };
    assert.throws(
      () => parseCustomerInput(input),
      /Amount must be a non-negative integer string in paise/
    );
  });

  it('rejects floating point creditLimitPaise strings', () => {
    const input = {
      userId: 'valid-user-1',
      creditLimitPaise: '100.50',
    };
    assert.throws(
      () => parseCustomerInput(input),
      /Amount must be a non-negative integer string in paise/
    );
  });

  it('rejects attempts to inject unpersisted/unsupported columns', () => {
    for (const field of unsupportedCustomerFields) {
      assert.throws(
        () => parseCustomerInput({ userId: 'u', [field]: 'test' }),
        /Customer fields are not supported by the current database schema/
      );
      assert.throws(
        () => parseCustomerInput({ [field]: 'test' }, true),
        /Customer fields are not supported by the current database schema/
      );
    }
  });

  it('rejects customer attempts to modify role or identity fields', () => {
    assert.throws(
      () => parseCustomerInput({ userId: 'u', role: 'admin' }),
      /Unrecognized key/
    );
    assert.throws(
      () => parseCustomerInput({ role: 'admin' }, true),
      /Unrecognized key/
    );
  });
});

