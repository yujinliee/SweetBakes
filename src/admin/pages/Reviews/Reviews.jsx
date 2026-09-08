import { useEffect, useState } from 'react'
import { fetchAdminReviews } from '../../services/reviewService.js'
import './Reviews.css'

export default function Reviews({ onNavigate }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState('')
  useEffect(() => {
    let mounted = true
    fetchAdminReviews().then((data) => { if (mounted) setReviews(data) })
      .catch(() => { if (mounted) setError('Unable to load reviews. Please try again.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])
  const rows = reviews.filter((review) => {
    const order = review.orders || {}
    const text = [order.order_number, order.first_name, order.last_name, order.email, review.comment,
      ...(order.order_items || []).map((item) => item.product_name)].join(' ').toLowerCase()
    return (!rating || review.rating === Number(rating)) && text.includes(search.trim().toLowerCase())
  })
  return <section className="admin-reviews-page">
    <div className="admin-page-heading"><h2>Reviews</h2></div>
    <div className="admin-reviews-toolbar">
      <input type="search" aria-label="Search reviews" placeholder="Search reviews" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="Filter by rating" value={rating} onChange={(event) => setRating(event.target.value)}><option value="">All Ratings</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'Star' : 'Stars'}</option>)}</select>
    </div>
    {loading ? <p role="status">Loading reviews...</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p>No reviews found.</p> : <div className="admin-reviews-table-wrap"><table>
      <thead><tr>{['Rating', 'Customer', 'Order ID', 'Product', 'Comment', 'Date', 'Actions'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((review) => {
        const order = review.orders || {}
        const items = [...(order.order_items || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
        return <tr key={review.id}>
          <td><span className="admin-reviews-stars" aria-label={`${review.rating} out of 5 stars`}>{'\u2605'.repeat(review.rating)}{'\u2606'.repeat(5 - review.rating)}</span></td>
          <td>{[order.first_name, order.last_name].filter(Boolean).join(' ') || 'Customer'}<small>{order.email}</small></td>
          <td>{order.order_number || 'Unavailable'}</td>
          <td>{items[0]?.product_name || 'Order'}{items.length > 1 ? ` +${items.length - 1} more` : ''}</td>
          <td className="admin-reviews-comment">{review.comment || 'No comment'}</td>
          <td>{new Date(review.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
          <td><button type="button" onClick={() => onNavigate(`/admin/orders?order=${encodeURIComponent(review.order_id)}`)}>View Order</button></td>
        </tr>
      })}</tbody>
    </table></div>}
  </section>
}
