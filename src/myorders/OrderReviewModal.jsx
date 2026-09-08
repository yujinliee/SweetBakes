import { useLayoutEffect, useRef, useState } from 'react'
import { submitOrderReview } from '../services/orderReviewService.js'

export default function OrderReviewModal({ order, onClose, onSubmitted }) {
  const dialogRef = useRef(null)
  const backdropPress = useRef(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submittingRef = useRef(false)

  const handleSubmit = async () => {
    if (submittingRef.current || rating < 1 || rating > 5) return
    submittingRef.current = true
    setIsSubmitting(true)
    setError('')
    try {
      const review = await submitOrderReview(order.id, rating, comment)
      onSubmitted(review)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const root = document.documentElement
    const body = document.body
    const { scrollX, scrollY } = window
    const scrollbarWidth = window.innerWidth - root.clientWidth
    const bodyPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0
    const previousStyles = []
    const setStyle = (element, property, value) => {
      previousStyles.push([element, property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
      element.style.setProperty(property, value)
    }
    setStyle(root, 'overflow', 'hidden')
    setStyle(body, 'overflow', 'hidden')
    setStyle(body, 'position', 'fixed')
    setStyle(body, 'top', `-${scrollY}px`)
    setStyle(body, 'left', `-${scrollX}px`)
    setStyle(body, 'width', '100%')
    setStyle(body, 'box-sizing', 'border-box')
    if (scrollbarWidth > 0) setStyle(body, 'padding-right', `${bodyPadding + scrollbarWidth}px`)
    dialog.showModal()
    return () => {
      dialog.close()
      previousStyles.reverse().forEach(([element, property, value, priority]) => {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      })
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    }
  }, [])

  const isBackdrop = (event) => {
    if (event.target !== event.currentTarget) return false
    // Native dialog backdrop events target the dialog, as do clicks on its padding.
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom
  }

  return <dialog className="my-orders-review-modal" ref={dialogRef} aria-labelledby="my-orders-review-title" onCancel={(event) => { if (submittingRef.current) event.preventDefault(); else onClose() }}
    onPointerDown={(event) => { backdropPress.current = isBackdrop(event) }}
    onClick={(event) => { if (!submittingRef.current && backdropPress.current && isBackdrop(event)) onClose(); backdropPress.current = false }}>
    <h2 id="my-orders-review-title">Review Your Order</h2>
    <p className="my-orders-review-number">{order.order_number || 'Order'}</p>
    <fieldset className="my-orders-review-rating" disabled={isSubmitting}><legend>Rating</legend>
      {[1, 2, 3, 4, 5].map((value) => <label key={value}>
        <input type="radio" name="order-rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} />
        <span aria-hidden="true">{value <= rating ? '\u2605' : '\u2606'}</span>
      </label>)}
    </fieldset>
    <label className="my-orders-review-comment" htmlFor="my-orders-review-comment">Comment (optional)</label>
    <textarea id="my-orders-review-comment" rows={4} value={comment} disabled={isSubmitting} onChange={(event) => setComment(event.target.value)} />
    {error ? <p className="my-orders-payment-error" role="alert">{error}</p> : null}
    <div className="my-orders-review-actions"><button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button><button type="button" onClick={handleSubmit} disabled={!rating || isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Review'}</button></div>
  </dialog>
}
