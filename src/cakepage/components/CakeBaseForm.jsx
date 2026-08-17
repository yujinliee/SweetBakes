import { getActiveCustomizationOptions } from '../../admin/services/customizationOptionsService.js'

function CakeBaseForm({ selections, onSelectionsChange, onContinue }) {
  const optionGroups = [
    {
      name: 'flavor',
      label: 'Base Flavor',
      options: getActiveCustomizationOptions('Cake', 'Flavors'),
    },
    {
      name: 'size',
      label: 'Size',
      options: getActiveCustomizationOptions('Cake', 'Sizes'),
    },
    {
      name: 'layers',
      label: 'Layers',
      options: getActiveCustomizationOptions('Cake', 'Layers'),
    },
  ]
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
              {group.options.length === 0 ? (
                <p className="cake-field-empty">No active options available for this category.</p>
              ) : (
                group.options.map((option) => (
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
                ))
              )}
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
