import { useEffect, useMemo, useState } from 'react'

const maxReferenceImages = 3
const maxFileSize = 10 * 1024 * 1024
const acceptedTypes = ['image/jpeg', 'image/png']

function CupcakeReferenceUpload({ referenceImages, onReferenceImagesChange }) {
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState('')
  const isLimitReached = referenceImages.length >= maxReferenceImages

  const previews = useMemo(
    () =>
      referenceImages.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [referenceImages],
  )

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url))
    },
    [previews],
  )

  const addFiles = (fileList) => {
    if (isLimitReached) {
      setMessage("You've reached the maximum of 3 reference images. Remove one to upload another.")
      return
    }

    const availableSlots = maxReferenceImages - referenceImages.length
    const validFiles = Array.from(fileList)
      .filter((file) => acceptedTypes.includes(file.type) && file.size <= maxFileSize)
      .slice(0, availableSlots)

    if (validFiles.length) {
      onReferenceImagesChange([...referenceImages, ...validFiles])
    }

    setMessage(
      referenceImages.length + validFiles.length >= maxReferenceImages
        ? "You've reached the maximum of 3 reference images. Remove one to upload another."
        : '',
    )
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)

    addFiles(event.dataTransfer.files)
  }

  const removeFile = (fileToRemove) => {
    onReferenceImagesChange(referenceImages.filter((file) => file !== fileToRemove))
    setMessage('')
  }

  return (
    <section className="cake-reference-upload" aria-labelledby="cupcake-reference-image-title">
      <div className="cake-reference-upload-heading">
        <h3 id="cupcake-reference-image-title">
          Reference Image <span className="cake-optional-label">Optional</span>
        </h3>
        <span>{referenceImages.length} / 3 uploaded</span>
      </div>
      <label
        className={`cake-upload-area${isDragging ? ' cake-upload-area--active' : ''}${
          isLimitReached ? ' cake-upload-area--disabled' : ''
        }`}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!isLimitReached) {
            setIsDragging(true)
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={isLimitReached}
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 17.5v1.75A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.25V17.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Upload Inspiration Photo</span>
        <small>Upload up to 3 inspiration photos</small>
        <small>JPG, PNG up to 10MB each</small>
      </label>
      {previews.length ? (
        <div className="cake-reference-thumbnails" aria-label="Uploaded reference images">
          {previews.map((preview) => (
            <div className="cake-reference-thumbnail" key={`${preview.file.name}-${preview.url}`}>
              <img src={preview.url} alt={preview.file.name} />
              <button
                type="button"
                aria-label={`Remove ${preview.file.name}`}
                onClick={() => removeFile(preview.file)}
              >
                X
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {message ? (
        <div className="cake-upload-message" role="status">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 9v4M12 17h.01M10.29 4.86 2.82 17.5A1.7 1.7 0 0 0 4.28 20h15.44a1.7 1.7 0 0 0 1.46-2.5L13.71 4.86a1.7 1.7 0 0 0-2.92 0Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{message}</span>
        </div>
      ) : null}
    </section>
  )
}

export default CupcakeReferenceUpload
