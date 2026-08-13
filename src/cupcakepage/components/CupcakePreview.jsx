import chocolateSixPcs from '../../assets/cupcakepage/chocolate_sixpcs.png'
import chocolateTwelvePcs from '../../assets/cupcakepage/chocolate_twelvepcs.png'
import chocolateEighteenPcs from '../../assets/cupcakepage/chocolate_eighteenpcs.png'
import redVelvetSixPcs from '../../assets/cupcakepage/redvelvet_sixpcs.png'
import redVelvetTwelvePcs from '../../assets/cupcakepage/redvelvet_twelvepcs.png'
import redVelvetEighteenPcs from '../../assets/cupcakepage/redvelvet_eighteenpcs.png'

const cupcakePreviewMap = {
  chocolate: {
    6: chocolateSixPcs,
    12: chocolateTwelvePcs,
    18: chocolateEighteenPcs,
  },
  redvelvet: {
    6: redVelvetSixPcs,
    12: redVelvetTwelvePcs,
    18: redVelvetEighteenPcs,
  },
}

function CupcakePreview({ selectedFlavor, selectedQuantity }) {
  const imageSrc =
    selectedFlavor && selectedQuantity
      ? cupcakePreviewMap[selectedFlavor]?.[selectedQuantity] ?? null
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
