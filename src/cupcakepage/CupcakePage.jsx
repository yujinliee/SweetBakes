import { useEffect, useRef, useState } from 'react'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import CupcakeAvailabilityCalendar from './components/CupcakeAvailabilityCalendar.jsx'
import CupcakeBaseForm from './components/CupcakeBaseForm.jsx'
import CupcakeCustomerForm from './components/CupcakeCustomerForm.jsx'
import CupcakeDesignForm from './components/CupcakeDesignForm.jsx'
import CupcakePreview from './components/CupcakePreview.jsx'
import CupcakeReferenceReview from './components/CupcakeReferenceReview.jsx'
import CupcakeReferenceUpload from './components/CupcakeReferenceUpload.jsx'
import CupcakeReviewForm from './components/CupcakeReviewForm.jsx'
import OrderRequestSuccessModal from '../components/OrderRequestSuccessModal.jsx'
import CupcakeTabs from './components/CupcakeTabs.jsx'
import StepProgress from './components/StepProgress.jsx'
import { useAvailability } from '../hooks/useAvailability.js'
import { assertCanAcceptOrderForDate } from '../admin/services/availabilityService.js'
import {
  clearCustomDraft,
  getCustomDraftScope,
  loadCustomDraft,
  saveCustomDraft,
  subscribeToCustomDraftAuth,
} from '../services/customDraftService.js'
import {
  refreshCupcakeReferenceUrls,
  removeCupcakeReference,
  uploadCupcakeReferenceImages,
} from './services/cupcakeReferenceService.js'
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
  customerFirstName: '',
  customerLastName: '',
  province: 'Cavite',
  city: '',
  barangay: '',
  address: '',
  apartment: '',
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
  embedded = false,
  onProductChange,
  onNavigate,
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selections, setSelections] = useState(defaultSelections)
  const [designDetails, setDesignDetails] = useState(defaultDesignDetails)
  const [customerInfo, setCustomerInfo] = useState(defaultCustomerInfo)
  const [step2Touched, setStep2Touched] = useState({})
  const [step3Touched, setStep3Touched] = useState({})
  const [submissionError, setSubmissionError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState(null)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const draftScopeRef = useRef(null)
  const draftLoadVersionRef = useRef(0)
  const availability = useAvailability({ active: currentStep === 3 })

  useEffect(() => {
    let isMounted = true

    async function restoreDraft(scope, reset = false) {
      const loadVersion = ++draftLoadVersionRef.current

      if (reset) {
        setIsDraftLoaded(false)
        setCurrentStep(1)
        setSelections(defaultSelections)
        setDesignDetails(defaultDesignDetails)
        setCustomerInfo(defaultCustomerInfo)
      }

      const draft = await loadCustomDraft('cupcake', scope)
      let referenceImages = draft?.designDetails?.cupcakeReferenceImages || []

      if (referenceImages.length) {
        try {
          referenceImages = await refreshCupcakeReferenceUrls(referenceImages)
        } catch (error) {
          console.error('[CUPCAKE REFERENCES] restore failed:', error)
        }
      }

      if (!isMounted || loadVersion !== draftLoadVersionRef.current) return

      draftScopeRef.current = scope
      if (draft) {
        setCurrentStep(draft.currentStep || 1)
        setSelections((current) => ({ ...current, ...(draft.selections || {}) }))
        setDesignDetails((current) => ({
          ...current,
          ...(draft.designDetails || {}),
          cupcakeReferenceImages: referenceImages,
        }))
        setCustomerInfo((current) => ({ ...current, ...(draft.customerInfo || {}) }))
      }
      setIsDraftLoaded(true)
    }

    getCustomDraftScope().then((scope) => restoreDraft(scope)).catch((error) => {
      console.error('[CUPCAKE DRAFT] restore failed:', error)
      if (isMounted) setIsDraftLoaded(true)
    })

    const unsubscribe = subscribeToCustomDraftAuth((scope) => {
      if (scope === draftScopeRef.current) return
      restoreDraft(scope, true).catch((error) => {
        console.error('[CUPCAKE DRAFT] account restore failed:', error)
        if (isMounted) setIsDraftLoaded(true)
      })
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isDraftLoaded || !draftScopeRef.current) return undefined

    saveCustomDraft('cupcake', draftScopeRef.current, {
      currentStep,
      selections,
      designDetails,
      customerInfo,
    })

    return undefined
  }, [isDraftLoaded, currentStep, selections, designDetails, customerInfo])

  const goToStep = (nextStep) => {
    setCurrentStep(nextStep)

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    })
  }

  const saveReferenceDraft = (referenceImages) => saveCustomDraft(
    'cupcake',
    draftScopeRef.current,
    {
      currentStep,
      selections,
      designDetails: { ...designDetails, cupcakeReferenceImages: referenceImages },
      customerInfo,
    },
  )

  const handleReferenceImagesChange = async (nextImages) => {
    const existingReferences = designDetails.cupcakeReferenceImages.filter((reference) => reference?.path)
    const files = nextImages.filter((reference) => reference instanceof File)

    if (files.length) {
      const optimisticReferences = [
        ...existingReferences,
        ...files.map((file) => ({
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
        })),
      ]
      setDesignDetails((current) => ({ ...current, cupcakeReferenceImages: optimisticReferences }))

      try {
        const uploadedReferences = await uploadCupcakeReferenceImages(files, existingReferences)
        setDesignDetails((current) => ({
          ...current,
          cupcakeReferenceImages: uploadedReferences,
        }))
        await saveReferenceDraft(uploadedReferences)
      } catch (error) {
        console.error('[CUPCAKE REFERENCES] upload failed:', error)
        setDesignDetails((current) => ({ ...current, cupcakeReferenceImages: existingReferences }))
      }
      return
    }

    const nextPaths = new Set(nextImages.map((reference) => reference?.path).filter(Boolean))
    const removedReferences = existingReferences.filter((reference) => !nextPaths.has(reference.path))
    let remainingReferences = existingReferences

    try {
      for (const reference of removedReferences) {
        remainingReferences = remainingReferences.filter((item) => item.path !== reference.path)
        await removeCupcakeReference(reference, remainingReferences)
      }
      setDesignDetails((current) => ({
        ...current,
        cupcakeReferenceImages: remainingReferences,
      }))
      await saveReferenceDraft(remainingReferences)
    } catch (error) {
      console.error('[CUPCAKE REFERENCES] remove failed:', error)
    }
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
        !availability.loading &&
        !availability.error &&
        availability.settings &&
        availability.isDateAvailable(customerInfo.preferredDate) &&
        preferredTime &&
        availability.isTimeAvailable(preferredTime) &&
        (customerInfo.fulfillment !== 'delivery' || customerInfo.deliveryAddress.trim()) &&
        customerInfo.agreement,
    )
  }

  const handleSubmitRequest = async () => {
    if (!isSubmissionComplete()) {
      setSubmissionError(
        'Required details are incomplete. Please go back and complete the missing information before submitting.',
      )
      return
    }

    try {
      const latestAvailability = await availability.refresh()
      if (!availability.isDateAvailable(customerInfo.preferredDate, latestAvailability)) {
        setCustomerInfo((current) => ({ ...current, preferredDate: '' }))
        setStep3Touched((current) => ({ ...current, preferredDate: true }))
        setCurrentStep(3)
        setSubmissionError('This date has just become fully booked. Please select another available date.')
        return
      }

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
          referenceImages: designDetails.cupcakeReferenceImages
            .filter((reference) => reference?.path)
            .map(({ name, type, size, path, position }) => ({
              name,
              type,
              size,
              path,
              position,
          })),
        },
        customerInfo,
      }

      assertCanAcceptOrderForDate(customerInfo.preferredDate, latestAvailability)
      saveSubmittedRequest(request)
      await clearCustomDraft('cupcake', draftScopeRef.current)
      setSubmittedRequest(request)
      setSubmissionError('')
    } catch {
      try {
        const latestAvailability = await availability.refresh()
        if (!availability.isDateAvailable(customerInfo.preferredDate, latestAvailability)) {
          setCustomerInfo((current) => ({ ...current, preferredDate: '' }))
          setStep3Touched((current) => ({ ...current, preferredDate: true }))
          setCurrentStep(3)
          setSubmissionError('This date has just become fully booked. Please select another available date.')
          return
        }
      } catch {
        // Keep the existing submission error when availability cannot refresh.
      }
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
              onReferenceImagesChange={handleReferenceImagesChange}
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
        <OrderRequestSuccessModal
          request={submittedRequest}
          productType="custom cupcake"
          onClose={() => setSubmittedRequest(null)}
          onNavigate={onNavigate}
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
