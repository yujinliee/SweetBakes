import chocoCakeImage from '../assets/cakepage/choco_onelayer.png'
import redvelvetCakeImage from '../assets/cakepage/redvelvet_onelayer.png'

export const SWEET_TREATS_CATEGORIES = [
  { id: 'regularCakes', label: 'Regular Cakes' },
  { id: 'cheesecake', label: 'Cheesecake' },
  { id: 'ube', label: 'Ube' },
  { id: 'graham', label: 'Graham de Leche' },
  { id: 'lecheFlan', label: 'Leche Flan' },
]

export const REGULAR_CAKES = [
  {
    name: 'Chocolate Cake',
    description: 'Moist chocolate cake layered with rich chocolate frosting.',
    price: 650,
    image: chocoCakeImage,
  },
  {
    name: 'Red Velvet Cake',
    description: 'Classic red velvet with creamy, velvety cream cheese frosting.',
    price: 700,
    image: redvelvetCakeImage,
  },
]

export const CHEESECAKE_FLAVORS = [
  { id: 'Blueberry', price: 850 },
  { id: 'Mango', price: 850 },
  { id: 'Strawberry', price: 850 },
  { id: 'Oreo', price: 850 },
]

export const CHEESECAKE_SIZES = [
  { id: 'halfDozen', label: 'Half Dozen', pieces: 6, detail: '6 mini cheesecakes' },
  { id: 'dozen', label: 'Dozen', pieces: 12, detail: '12 mini cheesecakes' },
  { id: 'whole', label: 'Large / Whole', pieces: 1, detail: '1 whole cheesecake' },
]

export const CHEESECAKE_FLAVOR_TYPES = [
  { id: 'single', label: 'Single Flavor' },
  { id: 'assorted', label: 'Assorted Flavors' },
]

export const CHEESECAKE_WHOLE_PRICE = 850

export const CHEESECAKE_MINI_PRICES = {
  halfDozen: 300,
  dozen: 600,
}

export const UBE_PRODUCT = {
  name: 'Ube',
  description: 'Soft and fluffy ube chiffon cake with a light, nutty flavor.',
  price: 200,
  image: null,
}

export const GRAHAM_PRODUCT = {
  name: 'Graham de Leche',
  description: 'Chilled layers of graham crackers, cream, and sweet caramel.',
  price: 180,
  image: null,
}

export const LECHE_FLAN_PRODUCT = {
  name: 'Leche Flan',
  description: 'Silky, golden caramel custard that melts in your mouth.',
  price: 120,
  image: null,
}

export const SWEET_TREATS_PRODUCT_PRICES = {
  'Chocolate Cake': 650,
  'Red Velvet Cake': 700,
  'Ube': 200,
  'Graham de Leche': 180,
  'Leche Flan': 120,
  'Blueberry Cheesecake': 850,
  'Mango Cheesecake': 850,
  'Strawberry Cheesecake': 850,
  'Oreo Cheesecake': 850,
}

export function resolveSweetTreatsPrice(productName) {
  if (productName in SWEET_TREATS_PRODUCT_PRICES) {
    return SWEET_TREATS_PRODUCT_PRICES[productName]
  }

  if (productName.includes('(Half Dozen)')) {
    return CHEESECAKE_MINI_PRICES.halfDozen
  }

  if (productName.includes('(Dozen)')) {
    return CHEESECAKE_MINI_PRICES.dozen
  }

  return null
}
