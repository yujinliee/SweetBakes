export const getProducts = () => []

export const getProductById = (productId) =>
  getProducts().find((product) => product.id === productId) || null
