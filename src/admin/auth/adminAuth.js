const adminAuthStorageKey = 'sweetBakesAdmin'

export const adminCredentials = {
  email: 'admin@sweetbakes.com',
  password: 'admin123',
}

export const isAdminAuthenticated = () =>
  window.localStorage.getItem(adminAuthStorageKey) === 'true'

export const setAdminAuthenticated = () => {
  window.localStorage.setItem(adminAuthStorageKey, 'true')
}

export const clearAdminAuthenticated = () => {
  window.localStorage.removeItem(adminAuthStorageKey)
}
