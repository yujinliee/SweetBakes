import { supabase } from '../lib/supabase.js'

export async function fetchCustomerReviews(customerId) {
  const reviews = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('order_reviews')
      .select('id, order_id, rating, comment, created_at').eq('customer_id', customerId)
      .order('id').range(offset, offset + 499)
    if (error) throw error
    reviews.push(...(data || []))
    if (!data || data.length < 500) return reviews
  }
}

export async function submitOrderReview(orderId, rating, comment) {
  const { data, error } = await supabase.rpc('submit_order_review', {
    p_order_id: orderId, p_rating: rating, p_comment: comment.trim() || null,
  })
  if (error) {
    const messages = {
      '23505': 'You have already reviewed this order.',
      '42501': 'This order is not available for you to review. Please check your signed-in account.',
      '22023': 'Select 1–5 stars. Only completed, paid orders can be reviewed.',
    }
    throw new Error(messages[error.code] || 'Unable to submit your review. Please try again.')
  }
  return data
}
