'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderWithHsnProduct(coupon) {
  var items = [{
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];
  var totals = pricing.computeTotals(items, coupon || '');

  return {
    id: 1,
    date: '22/11/2026',
    customer: 'In-memory customer',
    coupon: coupon || '',
    items: items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice figures match the billed amount, HSN GST, coupon, and GST split', function () {
  var order = orderWithHsnProduct('SAVE10');
  var billed = pricing.computeTotals(order.items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('Invoice applies the same HSN GST rates and totals as order pricing', function () {
  var order = orderWithHsnProduct('');
  var billed = pricing.computeTotals(order.items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 100);
  assert.equal(billed.cgst, 50);
  assert.equal(billed.sgst, 50);
  assert.equal(billed.total, 2100);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 100);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('Invoice applies the same capped coupon and post-discount GST as order pricing', function () {
  var order = orderWithHsnProduct('SAVE10');
  var billed = pricing.computeTotals(order.items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('GST reconciliation matches the invoice to the order ledger for an HSN order', function () {
  var order = orderWithHsnProduct('');
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 100);
  assert.equal(reconciliation.rows[0].invoiceTax, 100);
  assert.equal(reconciliation.rows[0].ledgerTotal, 2100);
  assert.equal(reconciliation.rows[0].invoiceTotal, 2100);
  assert.equal(reconciliation.rows[0].matched, true);
});
