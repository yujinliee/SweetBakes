import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDisplayTime,
  isTimeWithinWindow,
  parseTimeValue,
  timeToMinutes,
  to24hTime,
  wheelIndexForScrollTop,
} from './timeUtils.js'

const SERVICE_START = '09:00'
const SERVICE_END = '19:00'

test('selected minutes are preserved exactly: 9:45 must never become 9:00', () => {
  assert.equal(to24hTime(9, 45, 'AM'), '09:45')
  assert.equal(formatDisplayTime('09:45'), '9:45 AM')
  assert.notEqual(to24hTime(9, 45, 'AM'), '09:00')
  assert.notEqual(formatDisplayTime('09:45'), '9:00 AM')
})

test('every supported time round-trips from picker payload to display', () => {
  const cases = [
    ['09:00', '9:00 AM'],
    ['09:15', '9:15 AM'],
    ['09:30', '9:30 AM'],
    ['09:45', '9:45 AM'],
    ['12:30', '12:30 PM'],
    ['18:45', '6:45 PM'],
    ['19:00', '7:00 PM'],
  ]

  for (const [stored, display] of cases) {
    const parsed = parseTimeValue(stored)
    const roundTrip = to24hTime(parsed.hour % 12 || 12, parsed.minute, parsed.hour < 12 ? 'AM' : 'PM')
    assert.equal(roundTrip, stored, `${stored} must round-trip through the picker payload`)
    assert.equal(formatDisplayTime(stored), display, `${stored} must display as ${display}`)
  }
})

test('picker wheel commit keeps the selected minute, never the initial 00', () => {
  const MINUTES = [0, 15, 30, 45]
  const hours = Array.from({ length: 12 }, (_, index) => index + 1)
  const periods = ['AM', 'PM']

  const wheelSelection = { hourIndex: 8, minuteIndex: 3, periodIndex: 0 }
  const committed = to24hTime(hours[wheelSelection.hourIndex], MINUTES[wheelSelection.minuteIndex], periods[wheelSelection.periodIndex])
  assert.equal(committed, '09:45')
})

test('DB time values returned with seconds still display the selected minute', () => {
  assert.equal(parseTimeValue('09:45:00').minute, 45)
  assert.equal(formatDisplayTime('09:45:00'), '9:45 AM')
})

test('boundary validation accepts every valid minute and rejects out-of-window times', () => {
  const valid = ['09:00', '09:15', '09:30', '09:45', '10:30', '12:30', '18:45', '19:00']
  const invalid = ['08:00', '08:45', '07:00', '19:15', '20:00']

  for (const value of valid) {
    assert.equal(isTimeWithinWindow(value, SERVICE_START, SERVICE_END), true, `${value} must be within service hours`)
  }

  for (const value of invalid) {
    assert.equal(isTimeWithinWindow(value, SERVICE_START, SERVICE_END), false, `${value} must be rejected`)
  }
})

test('timeToMinutes normalizes minutes, not hours', () => {
  assert.equal(timeToMinutes('09:45'), 585)
  assert.equal(timeToMinutes('18:45'), 1125)
  assert.equal(timeToMinutes('19:00'), 1140)
  assert.equal(timeToMinutes('09:15') - timeToMinutes('09:00'), 15)
  assert.equal(timeToMinutes('09:45') - timeToMinutes('09:00'), 45)
})

test('Done reads the wheel position: a wheel visually on 45 always commits minute 45', () => {
  const ROW_HEIGHT = 40
  const MINUTE_ROWS = [0, 1, 2, 3]
  const minuteWheelPosition = 203 * ROW_HEIGHT

  const minuteIndex = wheelIndexForScrollTop(minuteWheelPosition, 4)
  assert.equal(minuteIndex, 3)
  assert.equal(MINUTE_ROWS[minuteIndex], 3)
  assert.equal(to24hTime(9, MINUTE_ROWS[minuteIndex] * 15, 'AM'), '09:45')
})

test('wheel-derived selection maps every wrapped virtual row to the same logical minute', () => {
  const ROW_HEIGHT = 40
  const expectedMinuteValues = [0, 15, 30, 45]

  for (let virtualRow = 0; virtualRow < 404; virtualRow += 1) {
    if (virtualRow % 4 === 3) {
      const minuteIndex = wheelIndexForScrollTop(virtualRow * ROW_HEIGHT, 4)
      assert.equal(expectedMinuteValues[minuteIndex], 45, `row ${virtualRow} must stay on minute 45`)
    }
  }
})

test('wheel-derived hour keeps hour 9 stable across wrapped virtual rows', () => {
  const ROW_HEIGHT = 40

  for (let virtualRow = 8; virtualRow < 1212; virtualRow += 12) {
    const hourIndex = wheelIndexForScrollTop(virtualRow * ROW_HEIGHT, 12)
    assert.equal(hourIndex, 8, `row ${virtualRow} must map to hour 9`)
  }
})