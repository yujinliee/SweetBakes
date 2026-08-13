function PackagePreview({ imageSrc = '' }) {
  return (
    <section className="cake-preview" aria-label="Package preview">
      {imageSrc ? (
        <img className="package-preview-image" src={imageSrc} alt="Selected party package preview" />
      ) : (
        <p>Your package preview will appear here</p>
      )}
    </section>
  )
}

export default PackagePreview
