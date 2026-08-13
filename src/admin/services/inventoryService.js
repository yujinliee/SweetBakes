export const getInventoryItems = () => []

export const getInventoryItemById = (itemId) =>
  getInventoryItems().find((item) => item.id === itemId) || null
