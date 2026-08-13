import { useState } from 'react'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import CupcakeAvailabilityCalendar from './components/CupcakeAvailabilityCalendar.jsx'
import CupcakeBaseForm from './components/CupcakeBaseForm.jsx'
import CupcakeCustomerForm from './components/CupcakeCustomerForm.jsx'
import CupcakeDesignForm from './components/CupcakeDesignForm.jsx'
import CupcakePreview from './components/CupcakePreview.jsx'
import CupcakeReferenceReview from './components/CupcakeReferenceReview.jsx'
import CupcakeReferenceUpload from './components/CupcakeReferenceUpload.jsx'
import CupcakeReviewForm from './components/CupcakeReviewForm.jsx'
import CupcakeSuccessModal from './components/CupcakeSuccessModal.jsx'
import CupcakeTabs from './components/CupcakeTabs.jsx'
import StepProgress from './components/StepProgress.jsx'
import './CupcakePage.css'

const cupcakeRequestsStorageKey = 'sweetbakes:cake-requests'
const contactNumberPattern = /^\d{11}$/

const defaultSelections = {
  flavor: '',
  quantity: '',
}

const defaultDesignDetails = {
  cupcakeTheme: '',
  cupcakeOtherTheme: '',
  cupcakeSpecialInstructions: '',
  cupcakeReferenceImages: [],
}

const defaultCustomerInfo = {
  fullName: '',
  contactNumber: '',
  email: '',
  fulfillment: '',
  deliverDifferentRecipient: false,
  recipientFirstName: '',
  recipientLastName: '',
  recipientContact: '',
  deliveryAddress: '',
  landmark: '',
  preferredPickupTime: '',
  preferredDeliveryTime: '',
  preferredDate: '',
  messengerName: '',
  agreement: false,
}

const getSavedRequests = () => {
  try {
    return JSON.parse(window.localStorage.getItem(cupcakeRequestsStorageKey)) || []
  } catch {
    return []
  }
}

const generateRequestNumber = (submittedAt) => {
  const submittedDate = new Date(submittedAt)
  const year = submittedDate.getFullYear()
  const month = String(submittedDate.getMonth() + 1).padStart(2, '0')
  const day = String(submittedDate.getDate()).padStart(2, '0')
  const sequence = String(getSavedRequests().length + 1).padStart(4, '0')

  return `SB-${year}${month}${day}-${sequence}`
}

const saveSubmittedRequest = (request) => {
  const existingRequests = getSavedRequests()

  window.localStorage.setItem(
    cupcakeRequestsStorageKey,
    JSON.stringify([...existingRequests, request]),
  )
}

function CupcakePage({
  latestRequest,
  onRequestSubmitted,
  onTrackOrder,
  embedded = false,
  onProductChange,
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selections, setSelections] = useState(defaultSelections)
  const [designDetails, setDesignDetails] = useState(defaultDesignDetails)
  const [customerInfo, setCustomerInfo] = useState(defaultCustomerInfo)
  const [step2Touched, setStep2Touched] = useState({})
  const [step3Touched, setStep3Touched] = useState({})
  const [submissionError, setSubmissionError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState(null)

  const goToStep = (nextStep) => {
    setCurrentStep(nextStep)

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    })
  }

  const isSubmissionComplete = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const preferredTime =
      customerInfo.fulfillment === 'pickup'
        ? customerInfo.preferredPickupTime
        : customerInfo.preferredDeliveryTime

    return Boolean(
      selections.flavor &&
        selections.quantity &&
        designDetails.cupcakeTheme &&
        (designDetails.cupcakeTheme !== 'Other' || designDetails.cupcakeOtherTheme.trim()) &&
        customerInfo.fullName.trim() &&
        contactNumberPattern.test(customerInfo.contactNumber) &&
        emailPattern.test(customerInfo.email.trim()) &&
        customerInfo.fulfillment &&
        customerInfo.preferredDate &&
        preferredTime &&
        (customerInfo.fulfillment !== 'delivery' || customerInfo.deliveryAddress.trim()) &&
        customerInfo.agreement,
    )
  }

  const handleSubmitRequest = () => {
    if (!isSubmissionComplete()) {
      setSubmissionError(
        'Required details are incomplete. Please go back and complete the missing information before submitting.',
      )
      return
    }

    try {
      const submittedAt = new Date().toISOString()
      const request = {
        requestNumber: generateRequestNumber(submittedAt),
        submittedAt,
        status: 'Pending Review',
        productType: 'Cupcakes',
        selections,
        designDetails: {
          theme: designDetails.cupcakeTheme,
          otherTheme: designDetails.cupcakeOtherTheme,
          specialInstructions: designDetails.cupcakeSpecialInstructions,
          referenceImages: designDetails.cupcakeReferenceImages.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
          })),
        },
        customerInfo,
      }

      saveSubmittedRequest(request)
      onRequestSubmitted?.(request.requestNumber)
      setSubmittedRequest(request)
      setSubmissionError('')
    } catch {
      setSubmissionError('We could not submit your request right now. Please try again.')
    }
  }

  const customizationContent = (
    <>
      <StepProgress currentStep={currentStep} />

      <div className={`cake-customization-grid${currentStep === 3 ? ' step3-content' : ''}`}>
        <div
          className={`cake-preview-column${
            currentStep === 3 ? ' step3-left available-dates-sticky' : ''
          }${currentStep === 4 ? ' step4-left' : ''}`}
        >
          {currentStep === 3 ? (
            <CupcakeAvailabilityCalendar
              selectedDate={customerInfo.preferredDate}
              validationError={
                step3Touched.preferredDate && !customerInfo.preferredDate
                  ? 'Please select an available date.'
                  : ''
              }
              onDateChange={(date) =>
                setCustomerInfo((current) => ({
                  ...current,
                  preferredDate: date,
                }))
              }
            />
          ) : (
            <CupcakePreview
              selectedFlavor={selections.flavor}
              selectedQuantity={selections.quantity}
            />
          )}
          {currentStep === 2 ? (
            <CupcakeReferenceUpload
              referenceImages={designDetails.cupcakeReferenceImages}
              onReferenceImagesChange={(files) =>
                setDesignDetails((current) => ({
                  ...current,
                  cupcakeReferenceImages: files,
                }))
              }
            />
          ) : null}
          {currentStep === 4 ? (
            <CupcakeReferenceReview referenceImages={designDetails.cupcakeReferenceImages} />
          ) : null}
        </div>

        {currentStep === 1 ? (
          <CupcakeBaseForm
            selections={selections}
            onSelectionsChange={setSelections}
            onContinue={() => goToStep(2)}
          />
        ) : currentStep === 2 ? (
          <CupcakeDesignForm
            details={designDetails}
            onDetailsChange={setDesignDetails}
            validationTouched={step2Touched}
            onValidationTouchedChange={setStep2Touched}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        ) : currentStep === 3 ? (
          <CupcakeCustomerForm
            customerInfo={customerInfo}
            onCustomerInfoChange={setCustomerInfo}
            validationTouched={step3Touched}
            onValidationTouchedChange={setStep3Touched}
            onBack={() => goToStep(2)}
            onContinue={() => goToStep(4)}
          />
        ) : currentStep === 4 ? (
          <CupcakeReviewForm
            selections={selections}
            designDetails={designDetails}
            customerInfo={customerInfo}
            submissionError={submissionError}
            onBack={() => goToStep(3)}
            onSubmit={handleSubmitRequest}
          />
        ) : null}
      </div>
      {submittedRequest ? (
        <CupcakeSuccessModal
          request={submittedRequest}
          onTrackOrder={(requestNumber) => {
            setSubmittedRequest(null)
            onTrackOrder?.(requestNumber)
          }}
        />
      ) : null}
    </>
  )

  if (embedded) {
    return customizationContent
  }

  return (
    <div className="page-shell cake-page-shell">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="#contact"
        latestRequest={latestRequest}
        onTrackOrder={onTrackOrder}
      />

      <main className="cake-main">
        <header className="cake-page-header">
          <h1>Custom Creations</h1>
          <CupcakeTabs
            activeTab="Cupcakes"
            onTabChange={(tab) => {
              if (tab === 'Cakes') {
                onProductChange?.('cakes')
              }
            }}
          />
        </header>

        {customizationContent}
      </main>

      <SiteFooter />
    </div>
  )
}

export default CupcakePage
