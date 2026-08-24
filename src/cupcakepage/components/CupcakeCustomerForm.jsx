import StandardCustomerForm from '../../components/StandardCustomerForm.jsx'

function CupcakeCustomerForm(props) {
  const { customerInfo, onCustomerInfoChange, ...rest } = props

  return (
    <StandardCustomerForm
      {...rest}
      details={customerInfo}
      onDetailsChange={onCustomerInfoChange}
      title="Customer Information"
      description="Tell us how we can contact you and when you'd like to receive your custom order."
    />
  )
}

export default CupcakeCustomerForm
