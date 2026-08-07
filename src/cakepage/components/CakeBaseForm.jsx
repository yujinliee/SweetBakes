const optionGroups = [
  {
    name: 'flavor',
    label: 'Base Flavor',
    options: [
      { label: 'Chocolate', value: 'chocolate' },
      { label: 'Red Velvet', value: 'redvelvet' },
    ],
  },
  {
    name: 'size',
    label: 'Size',
    options: [
      { label: '6"', value: '6' },
      { label: '8"', value: '8' },
      { label: '10"', value: '10' },
      { label: '12"', value: '12' },
    ],
  },
  {
    name: 'layers',
    label: 'Layers',
    options: [
      { label: '1 Layer', value: '1' },
      { label: '2 Layers', value: '2' },
      { label: '3 Layers', value: '3' },
    ],
  },
]

function CakeBaseForm({ selections, onSelectionsChange, onContinue }) {
  const handleChange = (groupName, value) => {
    onSelectionsChange((current) => ({
      ...current,
      [groupName]: value,
      ...(groupName === 'flavor' ? { layers: '1' } : {}),
    }))
  }

  const isComplete = Boolean(selections.flavor && selections.size && selections.layers)

  return (
    <section className="cake-base-form" aria-labelledby="cake-base-title">
      <div className="cake-form-heading">
        <h2 id="cake-base-title">Choose Your Cake Base</h2>
        <p>Start by selecting the cake flavor and size that best suits your celebration.</p>
      </div>

      <form>
        {optionGroups.map((group) => (
          <fieldset className="cake-option-group" key={group.name}>
            <legend>{group.label}</legend>
            <div className="cake-option-list">
              {group.options.map((option) => (
                <label className="cake-radio" key={option.value}>
                  <input
                    type="radio"
                    name={group.name}
                    value={option.value}
                    checked={selections[group.name] === option.value}
                    onChange={() => handleChange(group.name, option.value)}
                  />
                  <span className="cake-radio-control" aria-hidden="true" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="cake-form-actions">
          <button
            className="cake-continue-button"
            type="button"
            disabled={!isComplete}
            onClick={onContinue}
          >
            <span>Continue</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default CakeBaseForm
