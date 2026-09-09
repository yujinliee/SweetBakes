import { useState } from 'react'
import {
  getOrderProgressStages,
  getOrderProgressStage,
  isRegularProgressOrder,
} from '../../../services/orderStatusDisplay.js'
import chocolateCakeImage from '../../../assets/othersweettreats/regular_chocolate.jpg'
import redVelvetCakeImage from '../../../assets/othersweettreats/regular_redvelvet.png'
import cheesecakeImage from '../../../assets/othersweettreats/halfordozen_cheesecake.png'
import ubeImage from '../../../assets/othersweettreats/ube.png'
import grahamImage from '../../../assets/othersweettreats/graham de leche.png'
import lecheFlanImage from '../../../assets/othersweettreats/leche_flan.png'
import putoImage from '../../../assets/othersweettreats/puto.jpg'
import './OrderModal.css'

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

const PRODUCT_TYPE_LABELS = {
  cake: 'Cakes',
  cupcake: 'Cupcakes',
  party_package: 'Party Packages',
  sweet_treat: 'Sweet Treats',
}

const STATIC_FALLBACK_IMAGES = {
  'chocolate cake': chocolateCakeImage,
  'red velvet cake': redVelvetCakeImage,
  cheesecake: cheesecakeImage,
  'blueberry cheesecake': cheesecakeImage,
  'mango cheesecake': cheesecakeImage,
  'strawberry cheesecake': cheesecakeImage,
  'oreo cheesecake': cheesecakeImage,
  ube: ubeImage,
  'graham de leche': grahamImage,
  'leche flan': lecheFlanImage,
  puto: putoImage,
}

function normalize(value) {
  return String(value ?? '').toLowerCase()
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value) {
  return value || '—'
}

function resolveItemThumbnail(item, order) {
  if (order?.thumbnailUrl) return order.thumbnailUrl
  const name = normalize(item?.product_name || '')
  for (const [key, img] of Object.entries(STATIC_FALLBACK_IMAGES)) {
    if (name.includes(key)) return img
  }
  return null
}

function ItemThumbnail({ item, order }) {
  const [errored, setErrored] = useState(false)
  const src = resolveItemThumbnail(item, order)
  if (!src || errored) {
    return <span className="om-thumb om-thumb--placeholder" aria-hidden="true" />
  }
  return (
    <span className="om-thumb" aria-hidden="true">
      <img src={src} alt="" onError={() => setErrored(true)} />
    </span>
  )
}

function PaymentBadge({ paymentStatus }) {
  const key = normalize(paymentStatus)
  const label =
    key === 'paid'
      ? 'Paid'
      : key === 'partial'
        ? 'Partial'
        : key === 'pending'
          ? 'Pending'
          : toTitleCase(paymentStatus)
  return <span className={`om-payment-badge om-payment-badge--${key}`}>{label}</span>
}

function StatusStepper({ order }) {
  const stages = getOrderProgressStages(order)
  const currentIndex = getOrderProgressStage({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    isRegularOrder: isRegularProgressOrder(order),
  })
  const isTerminal =
    normalize(order.order_status) === 'cancelled' ||
    normalize(order.order_status) === 'rejected'

  if (isTerminal) {
    return (
      <div className="om-stepper">
        <span className={`om-stepper-terminal om-stepper-terminal--${normalize(order.order_status)}`}>
          {toTitleCase(order.order_status)}
        </span>
      </div>
    )
  }

  return (
    <div className="om-stepper">
      {stages.map((stage, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        const label = stage === 'Preparing Cake' ? 'Preparing Order' : stage
        return (
          <div
            key={stage}
            className={`om-stepper-step${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`}
          >
            <span className="om-stepper-dot">
              {isComplete ? '✓' : isCurrent ? index + 1 : ''}
            </span>
            {index < stages.length - 1 && <i className="om-stepper-line" />}
            <strong>{label}</strong>
          </div>
        )
      })}
    </div>
  )
}

export default function OrderModal({ order, onClose, onProgressOrder, onStatusChange, updatingOrderId, statusUpdateError, customPriceItems, customReviewError, onAddPriceItem, onRemovePriceItem, onUpdatePriceItem, onReviewCustomOrder }) {
  const [previewImage, setPreviewImage] = useState(null)
  const [previewZoom, setPreviewZoom] = useState(1)

  const isDelivery = normalize(order.order_method) === 'delivery'
  const orderMethod = isDelivery ? 'Delivery' : 'Store Pickup'
  const paymentStatus = normalize(order.payment_status)
  const orderStatus = normalize(order.order_status)
  const isTerminal = ['completed', 'cancelled', 'rejected'].includes(orderStatus)
  const paymentVerified = ['paid', 'verified', 'payment_verified'].includes(paymentStatus)

  const isPricePending =
    order.isCustomized &&
    orderStatus === 'pending' &&
    Number(order.total) === 0

  const formatPrice = (value) =>
    isPricePending ? 'Price Pending' : formatCurrency(value)

  const address = [
    order.address,
    [order.barangay, order.city_municipality].filter(Boolean).join(', '),
    [order.province, order.postal_code].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const primaryItem = order.order_items?.[0] || null
  const referenceImages = (order.order_items || [])
    .flatMap((item) =>
      Array.isArray(item.customization_data?.reference_images)
        ? item.customization_data.reference_images
        : [],
    )
    .filter((img) => img?.signed_url || img?.url)

  const customPriceTotal = (customPriceItems || []).reduce((sum, item) => {
    const amount = Number(item.amount)
    return sum + (Number.isFinite(amount) && amount >= 0 ? amount : 0)
  }, 0)
  const customDownPayment = customPriceTotal * 0.5

  const ORDER_STATUS_OPTIONS = [
    'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'rejected',
  ]

  return (
    <>
      <div
        className="om-backdrop"
        role="presentation"
        onMouseDown={onClose}
      >
        <aside
          className="om-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="om-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="om-header">
            <div>
              <p className="om-eyebrow">ORDER ID</p>
              <h2 id="om-title">{order.displayId || order.order_number}</h2>
            </div>
            <button
              type="button"
              className="om-close"
              onClick={onClose}
              aria-label="Close order details"
            >
              ×
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="om-scroll">

            {/* ── Status Stepper Card ── */}
            <section className="om-card">
              <h3 className="om-card-title">Order Status</h3>
              <StatusStepper order={order} />
            </section>

            {/* ── Order Information Card ── */}
            <section className="om-card">
              <div className="om-card-header">
                <h3 className="om-card-title">Order Information</h3>
                <div className="om-card-header-right">
                  <PaymentBadge paymentStatus={order.payment_status} />
                  <span className="om-order-method-label">{orderMethod}</span>
                </div>
              </div>

              <div className="om-products">
                {(order.order_items || []).length === 0 ? (
                  <p className="om-muted">No order items found.</p>
                ) : (
                  order.order_items.map((item) => {
                    const itemName =
                      item.customization_data?.request_type === 'custom_cake'
                        ? 'Custom Cake'
                        : item.product_name || 'Product'
                    const itemCategory =
                      [
                        PRODUCT_TYPE_LABELS[normalize(item.product_type)] ||
                          toTitleCase(item.product_type),
                        item.variant_name,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sweet Treats'

                    return (
                      <div className="om-product-row" key={item.id}>
                        <ItemThumbnail item={item} order={order} />
                        <div className="om-product-info">
                          <strong>{itemName}</strong>
                          <span>{itemCategory}</span>
                          <span>
                            Qty: {item.quantity || 0} · {orderMethod}
                          </span>
                        </div>
                        <div className="om-product-price">
                          <strong>{formatPrice(item.subtotal)}</strong>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {referenceImages.length > 0 && (
                <div className="om-references">
                  <h4 className="om-references-title">Reference Images</h4>
                  <div className="om-reference-images">
                    {referenceImages.map((img, index) => (
                      <button
                        type="button"
                        key={img.path || img.signed_url || index}
                        className="om-reference-btn"
                        onClick={() => { setPreviewImage(img); setPreviewZoom(1) }}
                      >
                        <img src={img.signed_url || img.url} alt={img.name || 'Reference'} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="om-order-total">
                <span>Order Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>
            </section>

            {/* ── Order Summary Card ── */}
            <section className="om-card">
              {order.isCustomized ? (
                <>
                  <div className="om-pricing-heading">
                    <div>
                      <h3 className="om-card-title">Price Breakdown</h3>
                      <p className="om-pricing-note">Itemize the agreed quotation for this customized order.</p>
                    </div>
                    <span className="om-pricing-currency">PHP</span>
                  </div>
                  <div className="om-price-items">
                    {(customPriceItems || []).map((item, index) => (
                      <div className="om-price-item" key={item.id || index}>
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          aria-label={`Price item ${index + 1} description`}
                          onChange={(e) => onUpdatePriceItem?.(index, 'description', e.target.value)}
                          disabled={updatingOrderId === order.id}
                        />
                        <div className="om-price-amount">
                          <span>₱</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={item.amount}
                            aria-label={`Price item ${index + 1} amount`}
                            onChange={(e) => onUpdatePriceItem?.(index, 'amount', e.target.value)}
                            disabled={updatingOrderId === order.id}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove price item ${index + 1}`}
                          onClick={() => onRemovePriceItem?.(index)}
                          disabled={updatingOrderId === order.id}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="om-add-price-item"
                    onClick={onAddPriceItem}
                    disabled={updatingOrderId === order.id}
                  >
                    ＋ Add Price Item
                  </button>
                  <dl className="om-price-totals">
                    <div>
                      <dt>Final Price</dt>
                      <dd>₱{customPriceTotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</dd>
                    </div>
                    <div>
                      <dt>Required Down Payment (50%)</dt>
                      <dd>₱{customDownPayment.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <h3 className="om-card-title">Order Summary</h3>
                  <dl className="om-summary-list">
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatPrice(order.subtotal)}</dd>
                    </div>
                    <div>
                      <dt>Delivery Fee</dt>
                      <dd>{formatPrice(order.deliveryFee ?? order.delivery_fee)}</dd>
                    </div>
                    <div className="om-summary-total">
                      <dt>Total</dt>
                      <dd>{formatPrice(order.total)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </section>

            {/* ── Fulfillment Details Card ── */}
            <section className="om-card">
              <h3 className="om-card-title">Fulfillment Details</h3>
              <dl className="om-fulfillment-grid">
                <div>
                  <dt>Preferred Date</dt>
                  <dd>{formatDate(order.preferred_date)}</dd>
                </div>
                <div>
                  <dt>Preferred Time</dt>
                  <dd>{formatTime(order.preferred_time)}</dd>
                </div>
                <div>
                  <dt>Order Method</dt>
                  <dd>{orderMethod}</dd>
                </div>
                {isDelivery ? (
                  <div className="om-fulfillment-wide">
                    <dt>Delivery Address</dt>
                    <dd>{address || '—'}</dd>
                  </div>
                ) : (
                  <div>
                    <dt>Pickup Location</dt>
                    <dd>Sweet Bakes store</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* ── Order Actions ── */}
            {!isTerminal && (
              <section className="om-card om-actions-card">
                <h3 className="om-card-title">Order Actions</h3>

                <label htmlFor="om-status-select" className="om-status-label">
                  Update Status
                </label>
                <select
                  id="om-status-select"
                  className="om-status-select"
                  value={normalize(order.order_status) || 'pending'}
                  onChange={onStatusChange}
                  disabled={
                    updatingOrderId === order.id ||
                    (order.isCustomized && orderStatus === 'pending')
                  }
                >
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {toTitleCase(s)}
                    </option>
                  ))}
                </select>

                {orderStatus === 'pending' && order.isCustomized && (
                  <div className="om-action-buttons">
                    <button
                      type="button"
                      className="om-btn om-btn--danger"
                      onClick={() => onReviewCustomOrder?.('reject')}
                      disabled={updatingOrderId === order.id}
                    >
                      Reject Order
                    </button>
                    <button
                      type="button"
                      className="om-btn om-btn--primary"
                      onClick={onProgressOrder}
                      disabled={updatingOrderId === order.id}
                    >
                      Confirm Order
                    </button>
                  </div>
                )}

                {orderStatus === 'pending' && !order.isCustomized && (
                  <button
                    type="button"
                    className="om-btn om-btn--primary om-btn--full"
                    onClick={onProgressOrder}
                    disabled={updatingOrderId === order.id}
                  >
                    Confirm Order
                  </button>
                )}

                {orderStatus === 'confirmed' && !paymentVerified && (
                  <p className="om-awaiting-payment">Payment Pending · awaiting verification</p>
                )}

                {(['preparing', 'ready'].includes(orderStatus) ||
                  (orderStatus === 'confirmed' && paymentVerified)) && (
                  <button
                    type="button"
                    className="om-btn om-btn--primary om-btn--full"
                    onClick={onProgressOrder}
                    disabled={updatingOrderId === order.id}
                  >
                    {{ confirmed: 'Start Preparing', preparing: 'Mark as Ready', ready: 'Complete Order' }[orderStatus]}
                  </button>
                )}

                {statusUpdateError && <p className="om-error">{statusUpdateError}</p>}
                {customReviewError && <p className="om-error">{customReviewError}</p>}
              </section>
            )}

            {isTerminal && orderStatus === 'completed' && (
              <p className="om-completed-note">✓ Order Completed</p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Image Lightbox ── */}
      {previewImage && (
        <div
          className="om-lightbox"
          role="presentation"
          onMouseDown={() => setPreviewImage(null)}
        >
          <div
            className="om-lightbox-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Order image preview"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="om-lightbox-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
            >
              ×
            </button>
            <div className="om-lightbox-stage">
              <img
                src={previewImage.signed_url || previewImage.url}
                alt={previewImage.name || 'Order reference'}
                style={{ transform: `scale(${previewZoom})` }}
              />
            </div>
            <div className="om-lightbox-controls" aria-label="Image zoom controls">
              <button type="button" onClick={() => setPreviewZoom((z) => Math.max(1, z - 0.25))}>−</button>
              <button type="button" onClick={() => setPreviewZoom(1)}>Reset</button>
              <button type="button" onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.25))}>+</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
