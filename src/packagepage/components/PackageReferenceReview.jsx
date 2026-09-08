import { useEffect, useMemo } from 'react'

function PackageReferenceReview({ referenceImages }) {
  const previews = useMemo(
    () =>
      referenceImages.slice(0, 3).map((reference) => {
        const file = reference?.file || reference
        const objectUrl = file instanceof File ? URL.createObjectURL(file) : ''
        return {
          reference,
          file,
          url: reference?.previewUrl || objectUrl,
          objectUrl,
        }
      }),
    [referenceImages],
  )

  useEffect(
    () => () => {
      previews.forEach((preview) => {
        if (preview.objectUrl) URL.revokeObjectURL(preview.objectUrl)
      })
    },
    [previews],
  )

  return (
    <section className="cake-reference-review package-reference-review" aria-label="Reference images review">
      <h3>Reference Images</h3>
      {previews.length ? (
        <div className="cake-reference-thumbnails" aria-label="Uploaded reference images">
          {previews.map((preview) => (
            <div className="cake-reference-thumbnail" key={`${preview.reference.path || preview.file.name}-${preview.url}`}>
              <img src={preview.url} alt={preview.file.name} />
            </div>
          ))}
        </div>
      ) : (
        <p>No reference images uploaded.</p>
      )}
    </section>
  )
}

export default PackageReferenceReview
