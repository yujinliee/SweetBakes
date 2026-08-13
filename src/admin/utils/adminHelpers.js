export const formatAdminDate = (value) => {
  if (!value) {
    return 'Not set'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export const normalizeAdminSearch = (value) => value.trim().toLowerCase()
