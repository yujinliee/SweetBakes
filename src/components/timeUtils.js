export const pad2 = (numberValue) => String(numberValue).padStart(2, '0')

export const parseTimeValue = (value) => {
  if (!value && value !== 0) {
    return null
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{1,2})?$/.exec(String(value).trim())

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (hour > 23 || minute > 59) {
    return null
  }

  return { hour, minute }
}

export const timeToMinutes = (value) => {
  const parsed = parseTimeValue(value)
  return parsed ? parsed.hour * 60 + parsed.minute : 0
}

export const isTimeWithinWindow = (value, minValue, maxValue) =>
  timeToMinutes(value) >= timeToMinutes(minValue) && timeToMinutes(value) <= timeToMinutes(maxValue)

export const to24hTime = (hour12, minute, period) => {
  let hour24 = hour12 % 12

  if (period === 'PM') {
    hour24 += 12
  }

  return `${pad2(hour24)}:${pad2(minute)}`
}

export const formatDisplayTime = (value, fallback = '') => {
  const parsed = parseTimeValue(value)

  if (!parsed) {
    return fallback
  }

  const period = parsed.hour >= 12 ? 'PM' : 'AM'
  const displayHour = parsed.hour % 12 || 12

  return `${displayHour}:${pad2(parsed.minute)} ${period}`
}

export const wheelIndexForScrollTop = (scrollTop, cycleLength) => {
  const virtualIndex = Math.max(0, Math.round(scrollTop / 40))
  return virtualIndex % cycleLength
}