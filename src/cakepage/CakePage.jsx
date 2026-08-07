import { useEffect, useMemo, useRef, useState } from 'react'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import chocoOneLayer from '../assets/cakepage/choco_onelayer.png'
import chocoThreeLayer from '../assets/cakepage/choco_threelayer.png'
import chocoTwoLayer from '../assets/cakepage/choco_twolayer.png'
import redVelvetOneLayer from '../assets/cakepage/redvelvet_onelayer.png'
import redVelvetThreeLayer from '../assets/cakepage/redvelvet_thirdlayer.png'
import redVelvetTwoLayer from '../assets/cakepage/redvelvet_twolayer.png'
import CakeBaseForm from './components/CakeBaseForm.jsx'
import CakeAvailabilityCalendar from './components/CakeAvailabilityCalendar.jsx'
import CakeCustomerForm from './components/CakeCustomerForm.jsx'
import CakeDesignForm from './components/CakeDesignForm.jsx'
import CakePreview from './components/CakePreview.jsx'
import CakeReferenceUpload from './components/CakeReferenceUpload.jsx'
import CakeReferenceReview from './components/CakeReferenceReview.jsx'
import CakeReviewForm from './components/CakeReviewForm.jsx'
import CakeSuccessModal from './components/CakeSuccessModal.jsx'
import CakeTabs from './components/CakeTabs.jsx'
import StepProgress from './components/StepProgress.jsx'
import './CakePage.css'

const cakePreviewMap = {
  chocolate: {
    1: chocoOneLayer,
    2: chocoTwoLayer,
    3: chocoThreeLayer,
  },
  redvelvet: {
    1: redVelvetOneLayer,
    2: redVelvetTwoLayer,
    3: redVelvetThreeLayer,
  },
}

const cakeDraftStorageKey = 'sweetbakes:cake-customization-draft'
const cakeRequestsStorageKey = 'sweetbakes:cake-requests'
const contactNumberPattern = /^\d{11}$/

const defaultSelections = {
  flavor: '',
  size: '',
  layers: '',
}

const defaultDesignDetails = {
  theme: '',
  otherTheme: '',
  message: '',
  instructions: '',
  referenceImages: [],
}

const defaultCustomerInfo = {
  customerFirstName: '',
  customerLastName: '',
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

const dataUrlToFile = (image) => {
  const [header, base64Data] = image.dataUrl.split(',')
  const mimeType = header.match(/data:(.*);base64/)?.[1] || image.type || 'image/png'
  const binary = window.atob(base64Data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new File([bytes], image.name, {
    type: mimeType,
    lastModified: image.lastModified,
  })
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        dataUrl: reader.result,
      })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const readCakeDraft = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const savedDraft = window.localStorage.getItem(cakeDraftStorageKey)

    if (!savedDraft) {
      return {}
    }

    const parsedDraft = JSON.parse(savedDraft)
    const referenceImages = Array.isArray(parsedDraft.designDetails?.referenceImages)
      ? parsedDraft.designDetails.referenceImages
          .filter((image) => image?.dataUrl && image?.name)
          .map(dataUrlToFile)
      : []

    return {
      currentStep:
        Number.isInteger(parsedDraft.currentStep) &&
        parsedDraft.currentStep >= 1 &&
        parsedDraft.currentStep <= 4
          ? parsedDraft.currentStep
          : 1,
      selections: {
        ...defaultSelections,
        ...parsedDraft.selections,
      },
      designDetails: {
        ...defaultDesignDetails,
        ...parsedDraft.designDetails,
        referenceImages,
      },
      customerInfo: {
        ...defaultCustomerInfo,
        ...parsedDraft.customerInfo,
      },
      step2Touched: parsedDraft.step2Touched || {},
      step3Touched: parsedDraft.step3Touched || {},
    }
  } catch {
    return {}
  }
}

const shouldStartAtStepOne = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('start') === '1'
}

const getSavedRequests = () => {
  try {
    return JSON.parse(window.localStorage.getItem(cakeRequestsStorageKey)) || []
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
    cakeRequestsStorageKey,
    JSON.stringify([...existingRequests, request]),
  )
}

function CakePage({ latestRequest, onRequestSubmitted, onTrackOrder }) {
  const [shouldCleanStartUrl] = useState(shouldStartAtStepOne)
  const [savedDraft] = useState(() => {
    const draft = readCakeDraft()

    return shouldStartAtStepOne() ? { ...draft, currentStep: 1 } : draft
  })
  const [currentStep, setCurrentStep] = useState(savedDraft.currentStep || 1)
  const visitedStepsRef = useRef(new Set([savedDraft.currentStep || 1]))
  const stepScrollPositionsRef = useRef({ [savedDraft.currentStep || 1]: 0 })
  const [selections, setSelections] = useState(savedDraft.selections || defaultSelections)
  const [designDetails, setDesignDetails] = useState(
    savedDraft.designDetails || defaultDesignDetails,
  )
  const [customerInfo, setCustomerInfo] = useState(savedDraft.customerInfo || defaultCustomerInfo)
  const [step2Touched, setStep2Touched] = useState(savedDraft.step2Touched || {})
  const [step3Touched, setStep3Touched] = useState(savedDraft.step3Touched || {})
  const [submittedRequest, setSubmittedRequest] = useState(null)

  useEffect(() => {
    if (!shouldCleanStartUrl) {
      return
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash}`
    window.history.replaceState({}, '', cleanUrl)
  }, [shouldCleanStartUrl])

  const previewImage = useMemo(
    () => {
      const previewLayer = selections.layers || '1'

      return selections.flavor
        ? cakePreviewMap[selections.flavor]?.[previewLayer] ?? null
        : null
    },
    [selections.flavor, selections.layers],
  )

  const goToStep = (nextStep) => {
    stepScrollPositionsRef.current[currentStep] = window.scrollY

    setCurrentStep(nextStep)

    window.requestAnimationFrame(() => {
      const hasVisitedStep = visitedStepsRef.current.has(nextStep)
      const nextScrollPosition = hasVisitedStep
        ? stepScrollPositionsRef.current[nextStep] ?? 0
        : 0

      window.scrollTo({
        top: nextScrollPosition,
        behavior: 'auto',
      })

      visitedStepsRef.current.add(nextStep)
    })
  }

  const scrollToValidationField = (field) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.querySelector(`[data-validation-field="${field}"]`)

        if (!target) {
          return
        }

        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })

        const focusTarget = target.matches('input, textarea, select, button')
          ? target
          : target.querySelector('input, textarea, select, button')

        if (focusTarget) {
          window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 280)
        }
      })
    })
  }

  const getStep2Errors = () => ({
    ...(!designDetails.theme ? { theme: true } : {}),
    ...(designDetails.theme === 'Other' && !designDetails.otherTheme.trim()
      ? { otherTheme: true }
      : {}),
  })

  const getStep3Errors = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    return {
      ...(!customerInfo.customerLastName.trim() ? { customerLastName: true } : {}),
      ...(!customerInfo.customerFirstName.trim() ? { customerFirstName: true } : {}),
      ...(!customerInfo.contactNumber.trim() || !contactNumberPattern.test(customerInfo.contactNumber)
        ? { contactNumber: true }
        : {}),
      ...(!customerInfo.email.trim() || !emailPattern.test(customerInfo.email.trim())
        ? { email: true }
        : {}),
      ...(!customerInfo.fulfillment ? { fulfillment: true } : {}),
      ...(!customerInfo.preferredDate ? { preferredDate: true } : {}),
      ...(customerInfo.fulfillment === 'pickup' && !customerInfo.preferredPickupTime
        ? { preferredPickupTime: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' && !customerInfo.deliveryAddress.trim()
        ? { deliveryAddress: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' && !customerInfo.preferredDeliveryTime
        ? { preferredDeliveryTime: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' &&
      customerInfo.deliverDifferentRecipient &&
      !customerInfo.recipientLastName.trim()
        ? { recipientLastName: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' &&
      customerInfo.deliverDifferentRecipient &&
      !customerInfo.recipientFirstName.trim()
        ? { recipientFirstName: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' &&
      customerInfo.deliverDifferentRecipient &&
      (!customerInfo.recipientContact.trim() ||
        !contactNumberPattern.test(customerInfo.recipientContact))
        ? { recipientContact: true }
        : {}),
      ...(!customerInfo.agreement ? { agreement: true } : {}),
    }
  }

  const findInvalidSubmissionField = (step2Errors, step3Errors) => {
    const step2Order = ['theme', 'otherTheme']
    const step3Order = [
      'customerLastName',
      'customerFirstName',
      'contactNumber',
      'email',
      'fulfillment',
      'preferredDate',
      ...(customerInfo.fulfillment === 'delivery'
        ? [
            'deliveryAddress',
            'preferredDeliveryTime',
            ...(customerInfo.deliverDifferentRecipient
              ? ['recipientLastName', 'recipientFirstName', 'recipientContact']
              : []),
          ]
        : []),
      ...(customerInfo.fulfillment === 'pickup' ? ['preferredPickupTime'] : []),
      'agreement',
    ]

    const firstStep2Field = step2Order.find((field) => step2Errors[field])

    if (firstStep2Field) {
      return { step: 2, field: firstStep2Field }
    }

    const firstStep3Field = step3Order.find((field) => step3Errors[field])

    return firstStep3Field ? { step: 3, field: firstStep3Field } : null
  }

  const handleSubmitRequest = () => {
    const step2Errors = getStep2Errors()
    const step3Errors = getStep3Errors()
    const invalidField = findInvalidSubmissionField(step2Errors, step3Errors)

    if (invalidField) {
      setStep2Touched((current) => ({
        ...current,
        ...step2Errors,
      }))
      setStep3Touched((current) => ({
        ...current,
        ...step3Errors,
      }))
      stepScrollPositionsRef.current[currentStep] = window.scrollY
      setCurrentStep(invalidField.step)
      visitedStepsRef.current.add(invalidField.step)
      scrollToValidationField(invalidField.field)
      return
    }

    try {
      const submittedAt = new Date().toISOString()
      const request = {
        requestNumber: generateRequestNumber(submittedAt),
        submittedAt,
        status: 'Pending Review',
        selections,
        designDetails: {
          ...designDetails,
          referenceImages: designDetails.referenceImages.map((file) => ({
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
    } catch {
      // Keep the user on the review step if local saving fails; no success modal is shown.
    }
  }

  useEffect(() => {
    let isActive = true

    const saveDraft = async () => {
      try {
        const referenceImages = await Promise.all(
          designDetails.referenceImages.map((file) => fileToDataUrl(file)),
        )

        if (!isActive) {
          return
        }

        window.localStorage.setItem(
          cakeDraftStorageKey,
          JSON.stringify({
            currentStep,
            selections,
            designDetails: {
              ...designDetails,
              referenceImages,
            },
            customerInfo,
            step2Touched,
            step3Touched,
          }),
        )
      } catch {
        try {
          window.localStorage.setItem(
            cakeDraftStorageKey,
            JSON.stringify({
              currentStep,
              selections,
              designDetails: {
                ...designDetails,
                referenceImages: [],
              },
              customerInfo,
              step2Touched,
              step3Touched,
            }),
          )
        } catch {
          // Ignore storage quota or privacy-mode failures; the form still works in memory.
        }
      }
    }

    saveDraft()

    return () => {
      isActive = false
    }
  }, [currentStep, selections, designDetails, customerInfo, step2Touched, step3Touched])

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
          <CakeTabs activeTab="Cakes" />
        </header>

        <StepProgress currentStep={currentStep} />

        <div className={`cake-customization-grid${currentStep === 3 ? ' step3-content' : ''}`}>
          <div
            className={`cake-preview-column${
              currentStep === 3 ? ' step3-left available-dates-sticky' : ''
            }${currentStep === 4 ? ' step4-left' : ''}`}
          >
            {currentStep !== 3 ? (
              <CakePreview
                imageSrc={previewImage}
                flavor={selections.flavor}
                layers={selections.layers}
              />
            ) : null}
            {currentStep === 2 ? (
              <CakeReferenceUpload
                referenceImages={designDetails.referenceImages}
                onReferenceImagesChange={(files) =>
                  setDesignDetails((current) => ({
                    ...current,
                    referenceImages: files,
                  }))
                }
              />
            ) : null}
            {currentStep === 3 ? (
              <CakeAvailabilityCalendar
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
            ) : null}
            {currentStep === 4 ? (
              <CakeReferenceReview referenceImages={designDetails.referenceImages} />
            ) : null}
          </div>
          {currentStep === 1 ? (
            <CakeBaseForm
              selections={selections}
              onSelectionsChange={setSelections}
              onContinue={() => goToStep(2)}
            />
          ) : currentStep === 2 ? (
            <CakeDesignForm
              details={designDetails}
              onDetailsChange={setDesignDetails}
              validationTouched={step2Touched}
              onValidationTouchedChange={setStep2Touched}
              onBack={() => goToStep(1)}
              onContinue={() => goToStep(3)}
            />
          ) : currentStep === 3 ? (
            <CakeCustomerForm
              customerInfo={customerInfo}
              onCustomerInfoChange={setCustomerInfo}
              validationTouched={step3Touched}
              onValidationTouchedChange={setStep3Touched}
              onBack={() => goToStep(2)}
              onContinue={() => goToStep(4)}
            />
          ) : (
            <CakeReviewForm
              selections={selections}
              designDetails={designDetails}
              customerInfo={customerInfo}
              onBack={() => goToStep(3)}
              onSubmit={handleSubmitRequest}
            />
          )}
        </div>
      </main>

      <SiteFooter />
      {submittedRequest ? (
        <CakeSuccessModal
          request={submittedRequest}
          onTrackOrder={(requestNumber) => {
            setSubmittedRequest(null)
            onTrackOrder?.(requestNumber)
          }}
        />
      ) : null}
    </div>
  )
}

export default CakePage
