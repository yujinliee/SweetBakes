import {
  adminAuthenticatedStorageKey,
  TEMP_ADMIN,
  userRoleStorageKey,
} from '../../auth/tempAuth.js'

export const adminCredentials = TEMP_ADMIN

export const isAdminAuthenticated = () =>
  window.sessionStorage.getItem(adminAuthenticatedStorageKey) === 'true' &&
  window.sessionStorage.getItem(userRoleStorageKey) === 'admin'

export const setAdminAuthenticated = () => {
  window.sessionStorage.setItem(adminAuthenticatedStorageKey, 'true')
  window.sessionStorage.setItem(userRoleStorageKey, 'admin')
}

export const clearAdminAuthenticated = () => {
  window.sessionStorage.removeItem(adminAuthenticatedStorageKey)
  window.sessionStorage.removeItem(userRoleStorageKey)
}
