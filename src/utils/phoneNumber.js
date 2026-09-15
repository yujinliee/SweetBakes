const LOCAL_MOBILE_PATTERN = /^09\d{9}$/

export function normalizePhoneNumber(value) {
  const digits = String(value || '').trim().replace(/\D/g, '')

  if (!digits) return ''

  if (digits.length === 12 && digits.startsWith('639')) return `0${digits.slice(2)}`

  if (digits.length === 13 && digits.startsWith('6309')) return `0${digits.slice(3)}`

  return digits
}

export function sanitizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

export function isValidPhoneNumber(value) {
  return LOCAL_MOBILE_PATTERN.test(String(value || ''))
}

export function formatPhoneDisplay(value) {
  const digits = String(value || '').trim().replace(/\D/g, '')

  let national = digits

  if (digits.length >= 12 && digits.startsWith('63')) {
    national = `0${digits.slice(digits.length - 10)}`
  }

  if (!LOCAL_MOBILE_PATTERN.test(national)) return value || ''

  return `+63 ${national.slice(1, 4)} ${national.slice(4, 7)} ${national.slice(7)}`
}
export function handlePhonePaste(event, onChange) {
  event.preventDefault()
  const input = event.currentTarget
  const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  onChange(sanitizePhoneNumber(input.value.slice(0, start) + pasted + input.value.slice(end)))
}
