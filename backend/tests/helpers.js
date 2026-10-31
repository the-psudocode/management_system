import { query } from '../src/database/index.js';

export const cleanDatabase = async () => {
  const sql = `
    DELETE FROM payment_allocations;
    DELETE FROM payments;
    DELETE FROM invoice_item_taxes;
    DELETE FROM invoice_items;
    DELETE FROM discount_redemptions;
    DELETE FROM invoices;
    DELETE FROM billing_periods;
    DELETE FROM subscription_discounts;
    DELETE FROM subscription_items;
    DELETE FROM subscriptions;
    DELETE FROM quotation_item_taxes;
    DELETE FROM quotation_items;
    DELETE FROM quotation_template_items;
    DELETE FROM quotations;
    DELETE FROM quotation_templates;
    DELETE FROM subscription_plans;
    DELETE FROM product_variants;
    DELETE FROM discount_products;
    DELETE FROM products;
    DELETE FROM customers;
    DELETE FROM users;
  `;
  await query(sql);
};

