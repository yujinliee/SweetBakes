import { useState } from 'react'

function CakeReferenceImage({ reference }) {
  const source = reference.previewUrl || ''
  const [status, setStatus] = useState(source ? 'loading' : 'error')

  return (
    <div className={`cake-reference-thumbnail cake-reference-thumbnail--${status}`}>
      {source ? (
        <img
          src={source}
          alt={reference.name}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
      {status === 'error' ? <span className="cake-reference-image-error">Image unavailable</span> : null}
    </div>
  )
}

function CakeReferenceReview({ referenceImages }) {
  return (
    <section className="cake-reference-review" aria-label="Reference image review">
      {referenceImages.length ? (
        <div className="cake-reference-thumbnails" aria-label="Uploaded reference images">
          {referenceImages.slice(0, 3).map((reference, index) => (
            <CakeReferenceImage
              key={`${reference.path || `${reference.name}-${index}`}-${reference.previewUrl || ''}`}
              reference={reference}
            />
          ))}
        </div>
      ) : (
        <p>No reference images uploaded.</p>
      )}
    </section>
  )
}

export default CakeReferenceReview
