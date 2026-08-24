import StandardCustomerForm from '../../components/StandardCustomerForm.jsx'

function CakeCustomerForm(props) {
  const { customerInfo, onCustomerInfoChange, isDraftLoaded, ...rest } = props

  return (
    <StandardCustomerForm
      {...rest}
      details={customerInfo}
      onDetailsChange={onCustomerInfoChange}
      autofillReady={isDraftLoaded}
      title="Customer Information"
      description="Tell us how we can contact you and when you'd like to receive your custom order."
    />
  )
}

export default CakeCustomerForm
