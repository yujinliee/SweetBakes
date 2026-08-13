const steps = ['Package', 'Customize', 'Customer Information', 'Review & Submit']

function StepProgress({ currentStep = 1 }) {
  return (
    <ol className="step-progress" aria-label="Order progress">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const state =
          stepNumber < currentStep
            ? 'complete'
            : stepNumber === currentStep
              ? 'current'
              : 'upcoming'

        return (
          <li className={`step-progress-item step-progress-item--${state}`} key={step}>
            <span className="step-progress-circle">{stepNumber}</span>
            <span className="step-progress-label">{step}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default StepProgress
