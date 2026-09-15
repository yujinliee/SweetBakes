import { beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

let sessionResult
let sessionRead
let result
let calls
const client = {
  auth: {
    getSession: async () => sessionRead ? sessionRead() : sessionResult,
    getUser: () => { throw new Error('Address CRUD must not call /auth/v1/user') },
  },
  from(table) {
    calls.push(['from', table])
    const query = {
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) },
    }
    for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle']) {
      query[method] = (...args) => { calls.push([method, ...args]); return query }
    }
    return query
  },
  rpc: async (...args) => { calls.push(['rpc', ...args]); return result },
}

mock.module('../lib/supabase.js', { namedExports: { supabase: client } })
const service = await import('./customerAddressService.js')
const { isMissingCustomerSession } = await import('../auth/customerSession.js')
const { isValidPhoneNumber, sanitizePhoneNumber } = await import('../utils/phoneNumber.js')

const payload = {
  phone_number: '09283232783', province: 'Cavite', city_municipality: 'General Trias City',
  barangay: 'Navarro', postal_code: '4107', address: 'Blk 6 Lot 23, Riverside St',
  apartment_unit: '', landmark: '', user_id: 'untrusted-customer', is_default: true,
}

beforeEach(() => {
  sessionResult = { data: { session: { user: { id: 'customer-a' }, access_token: 'test-only' } }, error: null }
  sessionRead = null
  result = { data: [], error: null }
  calls = []
})

test('Add uses the screenshot values and canonical owner without a getUser request', async () => {
  await service.createCustomerAddress(payload)
  const inserted = calls.find(([method]) => method === 'insert')[1]
  assert.equal(inserted.user_id, 'customer-a')
  assert.equal(inserted.phone_number, '09283232783')
  assert.equal(inserted.address, payload.address)
  assert.equal(inserted.is_default, true)
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'customer-a'))
})

test('Add preserves the existing default when another address exists', async () => {
  result.data = [{ id: 'address-a', is_default: true }]
  await service.createCustomerAddress(payload)
  assert.equal(calls.find(([method]) => method === 'insert')[1].is_default, false)
})

test('Edit scopes the update to the current customer and excludes ownership/default payloads', async () => {
  await service.updateCustomerAddress('address-a', payload)
  const updated = calls.find(([method]) => method === 'update')[1]
  assert.equal(updated.user_id, undefined)
  assert.equal(updated.is_default, undefined)
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'customer-a'))
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'address-a'))
})

test('Delete scopes ownership; Set Default retains the existing RPC', async () => {
  await service.deleteCustomerAddress('address-a')
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'customer-a'))
  await service.setDefaultCustomerAddress('address-b')
  assert.deepEqual(calls.at(-1), ['rpc', 'set_default_customer_address', { p_address_id: 'address-b' }])
})

test('all mutations block a missing session before querying the database', async () => {
  sessionResult.data.session = null
  for (const operation of [
    () => service.createCustomerAddress(payload),
    () => service.updateCustomerAddress('a', payload),
    () => service.deleteCustomerAddress('a'),
    () => service.setDefaultCustomerAddress('a'),
  ]) await assert.rejects(operation, isMissingCustomerSession)
  assert.deepEqual(calls, [])
})

test('restoration/refresh must finish before a mutation can start', async () => {
  let restore
  sessionRead = () => new Promise((resolve) => { restore = resolve })
  const pending = service.createCustomerAddress(payload)
  assert.deepEqual(calls, [])
  restore(sessionResult)
  await pending
  assert.ok(calls.some(([method]) => method === 'insert'))
})

test('network/refresh errors block writes without being mislabelled as expired sessions', async () => {
  const offline = new Error('Network unavailable')
  sessionResult.error = offline
  await assert.rejects(() => service.createCustomerAddress(payload), (error) => error === offline)
  assert.equal(isMissingCustomerSession(offline), false)
  assert.deepEqual(calls, [])
})

test('a database rejection is propagated rather than reported as a successful save', async () => {
  const denied = { code: '42501', message: 'permission denied' }
  result.error = denied
  await assert.rejects(() => service.updateCustomerAddress('other-customer-address', payload), (error) => error === denied)
})

test('guest reads stay empty and phone enforcement is unchanged', async () => {
  sessionResult.data.session = null
  assert.deepEqual(await service.fetchCustomerAddresses(), { addresses: [], userId: null })
  assert.equal(await service.fetchDefaultCustomerAddress(), null)
  assert.deepEqual(calls, [])
  assert.equal(isValidPhoneNumber(payload.phone_number), true)
  assert.equal(sanitizePhoneNumber(payload.phone_number + '123'), payload.phone_number)
  assert.equal(isValidPhoneNumber('08283232783'), false)
})
