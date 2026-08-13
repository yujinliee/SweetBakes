const adminOrdersStorageKey = 'sweetbakes:cake-requests'

export const getOrders = () => {
  try {
    return JSON.parse(window.localStorage.getItem(adminOrdersStorageKey)) || []
  } catch {
    return []
  }
}

export const getOrderByRequestNumber = (requestNumber) =>
  getOrders().find((order) => order.requestNumber === requestNumber) || null
