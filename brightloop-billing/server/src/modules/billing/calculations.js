import { ApiError } from '../../utils/ApiError.js';

export function asDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('billingDate must be a valid date.');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addMonthsClamped(date, months, anchorDay = null) {
  const targetAnchorDay = anchorDay ?? date.getUTCDate();
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(targetAnchorDay, lastDayOfTargetMonth)));
}

export function addBillingInterval(value, interval, count = 1, anchorDay = null) {
  const date = asDateOnly(value);
  const amount = Math.max(1, Number(count) || 1);
  const effectiveAnchorDay = anchorDay ?? date.getUTCDate();
  switch (String(interval).toLowerCase()) {
    case 'daily':
    case 'day':
      date.setUTCDate(date.getUTCDate() + amount);
      return date;
    case 'weekly':
    case 'week':
      date.setUTCDate(date.getUTCDate() + amount * 7);
      return date;
    case 'quarterly':
      return addMonthsClamped(date, amount * 3, effectiveAnchorDay);
    case 'monthly':
    case 'month':
      return addMonthsClamped(date, amount, effectiveAnchorDay);
    case 'yearly':
    case 'year':
      return addMonthsClamped(date, amount * 12, effectiveAnchorDay);
    default:
      throw ApiError.unprocessableEntity(`Unsupported billing interval: ${interval}`);
  }
}

const roundBasisPoints = (amount, rateBps) => (amount * BigInt(rateBps) + 5000n) / 10000n;

function eligibleDiscountAmount(discount, invoiceItems, remainingItems) {
  const allowedProducts = new Set(discount.products.map(({ productId }) => productId));
  const eligibleIndexes = invoiceItems.flatMap((item, index) => (
    discount.wholeSubscription || allowedProducts.has(item.productId) ? [index] : []
  ));
  const eligibleSubtotal = eligibleIndexes.reduce((sum, index) => sum + remainingItems[index], 0n);
  const eligibleQuantity = eligibleIndexes.reduce((sum, index) => sum + BigInt(invoiceItems[index].quantity), 0n);
  if (eligibleIndexes.length === 0 || eligibleSubtotal === 0n) return { amount: 0n, eligibleIndexes };
  if (discount.minimumPurchasePaise != null && eligibleSubtotal < discount.minimumPurchasePaise) return { amount: 0n, eligibleIndexes };
  if (discount.minimumQuantity != null && eligibleQuantity < BigInt(discount.minimumQuantity)) return { amount: 0n, eligibleIndexes };

  const candidate = discount.type === 'percentage'
    ? roundBasisPoints(eligibleSubtotal, discount.value)
    : discount.value;
  return { amount: candidate > eligibleSubtotal ? eligibleSubtotal : candidate, eligibleIndexes };
}

function taxRulesForLocation(rules, originState, customerState, billingDate) {
  const inDateRange = rules.filter((rule) => rule.isActive
    && (!rule.validFrom || rule.validFrom <= billingDate)
    && (!rule.validUntil || rule.validUntil >= billingDate));
  if (inDateRange.length === 0) return [];

  if (!originState || !customerState) {
    const generic = inDateRange.filter((rule) => rule.type === 'GST' && !rule.stateCode);
    if (generic.length) return generic;
    throw ApiError.unprocessableEntity('BUSINESS_STATE_CODE and the customer billing state are required for CGST/SGST/IGST calculation.');
  }

  const valid = inDateRange.filter((rule) => !rule.stateCode || rule.stateCode === customerState);

  const sameState = originState.toLowerCase() === customerState.toLowerCase();
  if (sameState) {
    const components = valid.filter((rule) => ['CGST', 'SGST'].includes(rule.type));
    if (components.length) {
      if (!components.some((rule) => rule.type === 'CGST') || !components.some((rule) => rule.type === 'SGST')) {
        throw ApiError.unprocessableEntity('Both CGST and SGST rules are required for an intra-state invoice.');
      }
      return components;
    }
  } else {
    const integrated = valid.filter((rule) => rule.type === 'IGST');
    if (integrated.length) return integrated;
  }
  const generic = valid.filter((rule) => rule.type === 'GST');
  if (generic.length) return generic;
  throw ApiError.unprocessableEntity(`No applicable tax rule is configured for ${sameState ? 'intra-state' : 'inter-state'} billing.`);
}

export function calculateInvoice({ items, discounts, taxRules, customerState, billingDate, originState }) {
  const lineBases = items.map((item) => item.unitPricePaise * BigInt(item.quantity));
  const remaining = [...lineBases];
  const appliedDiscounts = [];

  for (const discount of discounts) {
    const { amount, eligibleIndexes } = eligibleDiscountAmount(discount, items, remaining);
    if (amount <= 0n) continue;

    let remainingDiscount = amount;
    const totalEligible = eligibleIndexes.reduce((sum, index) => sum + remaining[index], 0n);
    for (const [position, index] of eligibleIndexes.entries()) {
      if (remainingDiscount === 0n || totalEligible === 0n) break;
      const share = position === eligibleIndexes.length - 1
        ? remainingDiscount
        : (amount * remaining[index]) / totalEligible;
      const allocation = share > remaining[index] ? remaining[index] : share;
      remaining[index] -= allocation;
      remainingDiscount -= allocation;
    }
    if (remainingDiscount > 0n) {
      for (const index of eligibleIndexes) {
        const extra = remaining[index] < remainingDiscount ? remaining[index] : remainingDiscount;
        remaining[index] -= extra;
        remainingDiscount -= extra;
        if (remainingDiscount === 0n) break;
      }
    }
    appliedDiscounts.push({ discountId: discount.id, amountPaise: amount - remainingDiscount });
  }

  const invoiceItems = items.map((item, index) => {
    const lineDiscount = lineBases[index] - remaining[index];
    const taxes = taxRulesForLocation(taxRules, originState, customerState, billingDate).map((rule) => ({
      name: rule.name,
      type: rule.type,
      rateBps: rule.rateBps,
      taxablePaise: remaining[index],
      taxPaise: roundBasisPoints(remaining[index], rule.rateBps),
    }));
    const taxPaise = taxes.reduce((sum, tax) => sum + tax.taxPaise, 0n);
    return {
      productId: item.productId,
      variantId: item.variantId,
      planId: item.planId || null,
      description: item.description,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      discountPaise: lineDiscount,
      taxPaise,
      totalPaise: remaining[index] + taxPaise,
      taxes,
    };
  });

  const subtotalPaise = lineBases.reduce((sum, amount) => sum + amount, 0n);
  const discountPaise = appliedDiscounts.reduce((sum, item) => sum + item.amountPaise, 0n);
  const taxPaise = invoiceItems.reduce((sum, item) => sum + item.taxPaise, 0n);
  return {
    items: invoiceItems,
    appliedDiscounts,
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise: subtotalPaise - discountPaise + taxPaise,
  };
}

export function invoiceDueDate(billingDate, paymentTerms) {
  const date = asDateOnly(billingDate);
  const netDays = String(paymentTerms || '').match(/\bnet\s+(\d+)\b/i);
  date.setUTCDate(date.getUTCDate() + (netDays ? Number(netDays[1]) : 7));
  return date;
}
