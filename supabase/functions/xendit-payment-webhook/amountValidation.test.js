import test from "node:test"
import assert from "node:assert/strict"
import { expectedPaymentAmount, paymentAmountMatches } from "./amountValidation.js"

test("regular cart without reward uses persisted payable amount", () => {
  assert.equal(expectedPaymentAmount({ total: 180, payment_amount_due: 180 }, true), 180)
  assert.equal(paymentAmountMatches(180, 180), true)
})

test("regular cart reward validates the discounted payable amount", () => {
  assert.equal(expectedPaymentAmount({ total: 180, payment_amount_due: 144 }, true), 144)
  assert.equal(paymentAmountMatches(144, 144), true)
  assert.equal(paymentAmountMatches(144, 180), false)
})

test("custom payment amount behavior remains unchanged", () => {
  assert.equal(expectedPaymentAmount({ required_down_payment: 200, payment_amount_due: 150 }, false), 150)
  assert.equal(expectedPaymentAmount({ required_down_payment: 200, payment_amount_due: null }, false), 200)
})
