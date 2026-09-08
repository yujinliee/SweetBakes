import { supabase } from '../../lib/supabase.js'

export async function fetchAdminReviews() {
  const reviews = []
  const batchSize = 500
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from('order_reviews')
      .select('id, order_id, rating, comment, created_at, orders(order_number, first_name, last_name, email, order_items(id, product_name))')
      .order('created_at', { ascending: false }).order('id')
      .range(offset, offset + batchSize - 1)
    if (error) throw error
    reviews.push(...(data || []))
    if (!data || data.length < batchSize) return reviews
  }
}
