function CakePreview({ imageSrc }) {
  return (
    <section className="cake-preview" aria-label="Cake preview">
      {imageSrc ? (
        <img src={imageSrc} alt="Selected cake preview" />
      ) : (
        <p>Your cake preview will appear here</p>
      )}
    </section>
  )
}

export default CakePreview
