import { CUSTOM_CUPCAKE_PREVIEW_IMAGES } from '../../components/customOrderPreviewImages.js'

function CupcakePreview({ selectedFlavor, selectedQuantity }) {
  const imageSrc =
    selectedFlavor && selectedQuantity
      ? CUSTOM_CUPCAKE_PREVIEW_IMAGES[selectedFlavor]?.[selectedQuantity] ?? null
      : null

  return (
    <section className="cake-preview cupcake-preview" aria-label="Cupcake preview">
      {imageSrc ? (
        <img src={imageSrc} alt="Selected cupcake preview" />
      ) : (
        <p>Your cupcake preview will appear here</p>
      )}
    </section>
  )
}

export default CupcakePreview