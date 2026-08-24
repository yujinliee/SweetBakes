import { useEffect, useMemo, useState } from 'react'

function CupcakeReferenceImage({ preview }) {
  const [status, setStatus] = useState(preview.url ? 'loading' : 'error')

  return (
    <div className={`cake-reference-thumbnail cake-reference-thumbnail--${status}`}>
      {preview.url ? (
        <img
          src={preview.url}
          alt={preview.name}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
      {status === 'error' ? <span className="cake-reference-image-error">Image unavailable</span> : null}
    </div>
  )
}

function CupcakeReferenceReview({ referenceImages }) {
  const previews = useMemo(() => referenceImages.slice(0, 3).map((reference) => {
    const file = reference?.file || reference
    const objectUrl = file instanceof File ? URL.createObjectURL(file) : ''
    return {
      reference,
      name: reference?.name || file?.name || 'reference image',
      url: reference?.previewUrl || objectUrl,
      objectUrl,
    }
  }), [referenceImages])

  useEffect(
    () => () => {
      previews.forEach((preview) => {
        if (preview.objectUrl) URL.revokeObjectURL(preview.objectUrl)
      })
    },
    [previews],
  )

  return (
    <section className="cake-reference-review" aria-label="Reference image review">
      {previews.length ? (
        <div className="cake-reference-thumbnails" aria-label="Uploaded reference images">
          {previews.map((preview) => (
            <CupcakeReferenceImage
              key={`${preview.reference.path || preview.name}-${preview.url}`}
              preview={preview}
            />
          ))}
        </div>
      ) : (
        <p>No reference images uploaded.</p>
      )}
    </section>
  )
}

export default CupcakeReferenceReview
