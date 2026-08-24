import { useState } from 'react'

const maxReferenceImages = 3
const maxFileSize = 5 * 1024 * 1024
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

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
      {status === 'error' ? (
        <span className="cake-reference-image-error">
          {reference.status === 'error' ? 'Upload failed. Try again.' : 'Image unavailable'}
        </span>
      ) : null}
    </div>
  )
}

function CakeReferenceUpload({ referenceImages, onReferenceImagesChange }) {
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState('')
  const isLimitReached = referenceImages.length >= maxReferenceImages

  const addFiles = (fileList) => {
    if (isLimitReached) {
      setMessage("You've reached the maximum of 3 reference images. Remove one to upload another.")
      return
    }

    const availableSlots = maxReferenceImages - referenceImages.length
    const selectedFiles = Array.from(fileList)
    const invalidFile = selectedFiles.find(
      (file) => !acceptedTypes.includes(file.type) || file.size > maxFileSize,
    )
    const validFiles = selectedFiles
      .filter((file) => acceptedTypes.includes(file.type) && file.size <= maxFileSize)
      .slice(0, availableSlots)

    if (validFiles.length) {
      onReferenceImagesChange([...referenceImages, ...validFiles])
    }

    if (invalidFile) {
      setMessage(`${invalidFile.name} is not supported or is larger than 5MB.`)
      return
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
    <section className="cake-reference-upload" aria-labelledby="reference-image-title">
      <div className="cake-reference-upload-heading">
        <h3 id="reference-image-title">
          Reference Image <span className="cake-optional-label">Optional</span>
        </h3>
        <span>{referenceImages.length} / 3 selected</span>
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
          accept="image/jpeg,image/png,image/webp"
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
        <small>JPG, PNG, WebP up to 5MB each</small>
      </label>
      {referenceImages.length ? (
        <div className="cake-reference-thumbnails" aria-label="Selected reference images">
          {referenceImages.map((reference, index) => (
            <div className="cake-reference-thumbnail-wrapper" key={`${reference.path || `${reference.name}-${index}`}-${reference.previewUrl || ''}`}>
              <CakeReferenceImage reference={reference} />
              <button
                type="button"
                aria-label={`Remove ${reference.name}`}
                onClick={() => removeFile(reference)}
              >
                ×
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

export default CakeReferenceUpload
