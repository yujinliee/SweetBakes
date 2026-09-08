import { supabase } from '../lib/supabase.js'
import { referenceImages } from './orderHistory.js'
import cakeIcon from '../assets/landingpage/cakes.svg'
import cupcakeIcon from '../assets/landingpage/cupcakes.svg'
import packageIcon from '../assets/landingpage/party_package.svg'
import logo from '../assets/landingpage/sweetbakes_logo.svg'
import chocolate from '../assets/othersweettreats/regular_chocolate.jpg'
import redVelvet from '../assets/othersweettreats/regular_redvelvet.png'
import cheesecake from '../assets/othersweettreats/halfordozen_cheesecake.png'
import ube from '../assets/othersweettreats/ube.png'
import graham from '../assets/othersweettreats/graham de leche.png'
import flan from '../assets/othersweettreats/leche_flan.png'
import puto from '../assets/othersweettreats/puto.jpg'

const localProducts = { 'chocolate-cake': chocolate, 'red-velvet-cake': redVelvet, cheesecake, ube, 'graham-de-leche': graham, 'leche-flan': flan, puto }
const normalize = (value) => String(value || '').trim().toLowerCase()

export function itemFallback(item) {
  if (localProducts[item.product_slug]) return localProducts[item.product_slug]
  const type = normalize(item.customization_data?.request_type || item.product_type)
  if (type.includes('package')) return packageIcon
  if (type.includes('cupcake')) return cupcakeIcon
  if (type.includes('cake')) return cakeIcon
  return logo
}

export function itemImage(item) {
  return referenceImages(item).find((image) => image.signed_url)?.signed_url
    || item.customization_data?.imageUrl || item.history_image || ''
}

// Read only the catalog records linked to this customer's canonical order items.
// Catalog images use the existing public product-images bucket; custom references
// are signed separately with the customer's authenticated Storage permissions.
export async function attachCatalogImages(items) {
  const ids = [...new Set(items.map((item) => item.product_id).filter(Boolean))]
  if (!ids.length) return items
  const results = await Promise.allSettled([
    supabase.from('products').select('id, slug, image_url').in('id', ids),
    supabase.from('product_images').select('product_id, label, image_url, sort_order').in('product_id', ids).order('sort_order'),
  ])
  const rows = results.map((result) => {
    if (result.status === 'rejected' || result.value.error) {
      console.warn('[MY ORDERS] Catalog thumbnails unavailable')
      return []
    }
    return result.value.data || []
  })
  return items.map((item) => {
    const product = rows[0].find((row) => row.id === item.product_id)
    const labels = [item.variant_name, item.customization_data?.flavor].map(normalize).filter(Boolean)
    const variant = rows[1].find((row) => row.product_id === item.product_id && labels.includes(normalize(row.label)))
    return { ...item, product_slug: product?.slug, history_image: variant?.image_url || product?.image_url || '' }
  })
}
