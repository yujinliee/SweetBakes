import { useEffect, useMemo, useRef, useState } from 'react'
import image1Cake12Chocolate from '../assets/packagepage/1cake_12cupcakes_chocolate.png'
import image1Cake12RedVelvet from '../assets/packagepage/1cake_12cupcakes_redvelvet.png'
import image1Cake18Chocolate from '../assets/packagepage/1cake_18cupcakes_chocolate.png'
import image1Cake18RedVelvet from '../assets/packagepage/1cake_18cupcakes_redvelvet.png'
import image1Cake6Chocolate from '../assets/packagepage/1cake_6cupcakes_chocolate.png'
import image1Cake6RedVelvet from '../assets/packagepage/1cake_6cupcakes_redvelvet.png'
import image2Cake12Chocolate from '../assets/packagepage/2cake_12cupcakes_chocolate.png'
import image2Cake12RedVelvet from '../assets/packagepage/2cake_12cupcakes_redvelvet.png'
import image2Cake18Chocolate from '../assets/packagepage/2cake_18cupcakes_chocolate.png'
import image2Cake18RedVelvet from '../assets/packagepage/2cake_18cupcakes_redvelvet.png'
import image2Cake6Chocolate from '../assets/packagepage/2cake_6cupcakes_chocolate.png'
import image2Cake6RedVelvet from '../assets/packagepage/2cake_6cupcakes_redvelvet.png'
import image3Cake12Chocolate from '../assets/packagepage/3cake_12cupcakes_chocolate.png'
import image3Cake12RedVelvet from '../assets/packagepage/3cake_12cupcakes_redvelvet.png'
import image3Cake18Chocolate from '../assets/packagepage/3cake_18cupcakes_chocolate.png'
import image3Cake18RedVelvet from '../assets/packagepage/3cake_18cupcakes_redvelvet.png'
import image3Cake6Chocolate from '../assets/packagepage/3cake_6cupcakes_chocolate.png'
import image3Cake6RedVelvet from '../assets/packagepage/3cake_6cupcakes_redvelvet.png'
import CakeTabs from '../cakepage/components/CakeTabs.jsx'
import CupcakeAvailabilityCalendar from '../cupcakepage/components/CupcakeAvailabilityCalendar.jsx'
import CupcakeCustomerForm from '../cupcakepage/components/CupcakeCustomerForm.jsx'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import PackageCustomizeForm from './components/PackageCustomizeForm.jsx'
import PackagePreview from './components/PackagePreview.jsx'
import PackageReferenceReview from './components/PackageReferenceReview.jsx'
import PackageReviewForm from './components/PackageReviewForm.jsx'
import PackageSelectionForm from './components/PackageSelectionForm.jsx'
import PackageSuccessModal from './components/PackageSuccessModal.jsx'
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
import './PackagePage.css'

const packageRequestsStorageKey = 'sweetbakes:cake-requests'
const contactNumberPattern = /^\d{11}$/

const packagePreviewMap = {
  chocolate: {
    '1-6': image1Cake6Chocolate,
    '1-12': image1Cake12Chocolate,
    '1-18': image1Cake18Chocolate,
    '2-6': image2Cake6Chocolate,
    '2-12': image2Cake12Chocolate,
    '2-18': image2Cake18Chocolate,
    '3-6': image3Cake6Chocolate,
    '3-12': image3Cake12Chocolate,
    '3-18': image3Cake18Chocolate,
  },
  redvelvet: {
    '1-6': image1Cake6RedVelvet,
    '1-12': image1Cake12RedVelvet,
    '1-18': image1Cake18RedVelvet,
    '2-6': image2Cake6RedVelvet,
    '2-12': image2Cake12RedVelvet,
    '2-18': image2Cake18RedVelvet,
    '3-6': image3Cake6RedVelvet,
    '3-12': image3Cake12RedVelvet,
    '3-18': image3Cake18RedVelvet,
  },
}

const defaultPackageSelection = {
  selectedPackage: '',
  cakeQuantity: '',
  cupcakeQuantity: '',
}

const defaultPackageCustomization = {
  packageCakeFlavor: '',
  packageCakeSize: '',
  packageCakeLayers: '',
  packageCakeTheme: '',
  packageCakeOtherTheme: '',
  packageCakeMessage: '',
  packageCakeSpecialInstructions: '',
  packageReferenceImages: [],
  packageCupcakeTheme: '',
  packageCupcakeOtherTheme: '',
  packageCupcakeSpecialInstructions: '',
}

const defaultPackageCustomerInfo = {
  customerFirstName: '',
  customerLastName: '',
  fullName: '',
  contactNumber: '',
  email: '',
  fulfillment: '',
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
    return JSON.parse(window.localStorage.getItem(packageRequestsStorageKey)) || []
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
    packageRequestsStorageKey,
    JSON.stringify([...existingRequests, request]),
  )
}

function PackagePage({
  embedded = false,
  onProductChange,
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [packageSelection, setPackageSelection] = useState(defaultPackageSelection)
  const [packageCustomization, setPackageCustomization] = useState(defaultPackageCustomization)
  const [packageCustomerInfo, setPackageCustomerInfo] = useState(defaultPackageCustomerInfo)
  const [step1Touched, setStep1Touched] = useState(false)
  const [step2Touched, setStep2Touched] = useState({})
  const [step3Touched, setStep3Touched] = useState({})
  const [submissionError, setSubmissionError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState(null)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const draftScopeRef = useRef(null)
  const draftLoadVersionRef = useRef(0)
  const availability = useAvailability()

  useEffect(() => {
    let isMounted = true

    async function restoreDraft(scope, reset = false) {
      const loadVersion = ++draftLoadVersionRef.current

      if (reset) {
        setIsDraftLoaded(false)
        setCurrentStep(1)
        setPackageSelection(defaultPackageSelection)
        setPackageCustomization(defaultPackageCustomization)
        setPackageCustomerInfo(defaultPackageCustomerInfo)
      }

      const draft = await loadCustomDraft('party-package', scope)

      if (!isMounted || loadVersion !== draftLoadVersionRef.current) return

      draftScopeRef.current = scope
      if (draft) {
        setCurrentStep(draft.currentStep || 1)
        setPackageSelection((current) => ({ ...current, ...(draft.packageSelection || {}) }))
        setPackageCustomization((current) => ({ ...current, ...(draft.packageCustomization || {}) }))
        setPackageCustomerInfo((current) => ({ ...current, ...(draft.customerInfo || {}) }))
      }
      setIsDraftLoaded(true)
    }

    getCustomDraftScope().then((scope) => restoreDraft(scope)).catch((error) => {
      console.error('[PACKAGE DRAFT] restore failed:', error)
      if (isMounted) setIsDraftLoaded(true)
    })

    const unsubscribe = subscribeToCustomDraftAuth((scope) => {
      if (scope === draftScopeRef.current) return
      restoreDraft(scope, true).catch((error) => {
        console.error('[PACKAGE DRAFT] account restore failed:', error)
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

    saveCustomDraft('party-package', draftScopeRef.current, {
      currentStep,
      packageSelection,
      packageCustomization,
      customerInfo: packageCustomerInfo,
    })

    return undefined
  }, [isDraftLoaded, currentStep, packageSelection, packageCustomization, packageCustomerInfo])

  const previewImage = useMemo(() => {
    const selectedBase = packageCustomization.packageCakeFlavor
    const selectedCakeCount = packageCustomization.packageCakeLayers
    const selectedCupcakeCount = packageSelection.cupcakeQuantity
    const previewKey = `${selectedCakeCount}-${selectedCupcakeCount}`

    return packagePreviewMap[selectedBase]?.[previewKey] ?? null
  }, [
    packageCustomization.packageCakeFlavor,
    packageCustomization.packageCakeLayers,
    packageSelection.cupcakeQuantity,
  ])

  const goToStep = (nextStep) => {
    setCurrentStep(nextStep)

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    })
  }

  const handlePackageChange = (packageOption) => {
    setPackageSelection(packageOption)
    setPackageCustomization((current) => ({
      ...current,
      packageCakeFlavor: 'chocolate',
      packageCakeLayers: String(packageOption.cakeQuantity),
    }))
  }

  const scrollToValidationField = (field) => {
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
  }

  const getStep2Errors = () => ({
    ...(!packageCustomization.packageCakeFlavor ? { packageCakeFlavor: true } : {}),
    ...(!packageCustomization.packageCakeSize ? { packageCakeSize: true } : {}),
    ...(!packageCustomization.packageCakeLayers ? { packageCakeLayers: true } : {}),
    ...(!packageCustomization.packageCakeTheme ? { packageCakeTheme: true } : {}),
    ...(packageCustomization.packageCakeTheme === 'Other' &&
    !packageCustomization.packageCakeOtherTheme.trim()
      ? { packageCakeOtherTheme: true }
      : {}),
    ...(!packageCustomization.packageCupcakeTheme ? { packageCupcakeTheme: true } : {}),
    ...(packageCustomization.packageCupcakeTheme === 'Other' &&
    !packageCustomization.packageCupcakeOtherTheme.trim()
      ? { packageCupcakeOtherTheme: true }
      : {}),
  })

  const getStep3Errors = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    return {
      ...(!packageCustomerInfo.fullName.trim() ? { fullName: true } : {}),
      ...(!packageCustomerInfo.contactNumber.trim() ||
      !contactNumberPattern.test(packageCustomerInfo.contactNumber)
        ? { contactNumber: true }
        : {}),
      ...(!packageCustomerInfo.email.trim() ||
      !emailPattern.test(packageCustomerInfo.email.trim())
        ? { email: true }
        : {}),
      ...(!packageCustomerInfo.fulfillment ? { fulfillment: true } : {}),
      ...(
        availability.loading ||
        availability.error ||
        !availability.settings ||
        !packageCustomerInfo.preferredDate ||
        !availability.isDateAvailable(packageCustomerInfo.preferredDate)
          ? { preferredDate: true }
          : {}
      ),
      ...(packageCustomerInfo.fulfillment === 'pickup' && !packageCustomerInfo.preferredPickupTime
        ? { preferredPickupTime: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'pickup' &&
      packageCustomerInfo.preferredPickupTime &&
      !availability.isTimeAvailable(packageCustomerInfo.preferredPickupTime)
        ? { preferredPickupTime: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      !packageCustomerInfo.deliveryAddress.trim()
        ? { deliveryAddress: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      !packageCustomerInfo.preferredDeliveryTime
        ? { preferredDeliveryTime: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      packageCustomerInfo.preferredDeliveryTime &&
      !availability.isTimeAvailable(packageCustomerInfo.preferredDeliveryTime)
        ? { preferredDeliveryTime: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      packageCustomerInfo.deliverDifferentRecipient &&
      !packageCustomerInfo.recipientLastName.trim()
        ? { recipientLastName: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      packageCustomerInfo.deliverDifferentRecipient &&
      !packageCustomerInfo.recipientFirstName.trim()
        ? { recipientFirstName: true }
        : {}),
      ...(packageCustomerInfo.fulfillment === 'delivery' &&
      packageCustomerInfo.deliverDifferentRecipient &&
      (!packageCustomerInfo.recipientContact.trim() ||
        !contactNumberPattern.test(packageCustomerInfo.recipientContact))
        ? { recipientContact: true }
        : {}),
      ...(!packageCustomerInfo.agreement ? { agreement: true } : {}),
    }
  }

  const findInvalidSubmissionField = (step2Errors, step3Errors) => {
    if (!packageSelection.selectedPackage) {
      return { step: 1, field: 'selectedPackage' }
    }

    const step2Order = [
      'packageCakeFlavor',
      'packageCakeSize',
      'packageCakeLayers',
      'packageCakeTheme',
      ...(packageCustomization.packageCakeTheme === 'Other' ? ['packageCakeOtherTheme'] : []),
      'packageCupcakeTheme',
      ...(packageCustomization.packageCupcakeTheme === 'Other'
        ? ['packageCupcakeOtherTheme']
        : []),
    ]
    const step3Order = [
      'fullName',
      'contactNumber',
      'email',
      'fulfillment',
      'preferredDate',
      ...(packageCustomerInfo.fulfillment === 'delivery'
        ? [
            'deliveryAddress',
            'preferredDeliveryTime',
            ...(packageCustomerInfo.deliverDifferentRecipient
              ? ['recipientLastName', 'recipientFirstName', 'recipientContact']
              : []),
          ]
        : []),
      ...(packageCustomerInfo.fulfillment === 'pickup' ? ['preferredPickupTime'] : []),
      'agreement',
    ]
    const firstStep2Field = step2Order.find((field) => step2Errors[field])

    if (firstStep2Field) {
      return { step: 2, field: firstStep2Field }
    }

    const firstStep3Field = step3Order.find((field) => step3Errors[field])

    return firstStep3Field ? { step: 3, field: firstStep3Field } : null
  }

  const handleSubmitRequest = async () => {
    const step2Errors = getStep2Errors()
    const step3Errors = getStep3Errors()
    const invalidField = findInvalidSubmissionField(step2Errors, step3Errors)

    if (invalidField) {
      setStep1Touched(!packageSelection.selectedPackage)
      setStep2Touched((current) => ({
        ...current,
        ...step2Errors,
      }))
      setStep3Touched((current) => ({
        ...current,
        ...step3Errors,
      }))
      setSubmissionError(
        'Required details are incomplete. Please go back and complete the missing information before submitting.',
      )
      setCurrentStep(invalidField.step)
      scrollToValidationField(invalidField.field)
      return
    }

    try {
      const submittedAt = new Date().toISOString()
      const request = {
        requestNumber: generateRequestNumber(submittedAt),
        submittedAt,
        status: 'Pending Review',
        productType: 'Party Package',
        packageSelection,
        packageCustomization: {
          ...packageCustomization,
          packageReferenceImages: packageCustomization.packageReferenceImages.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
          })),
        },
        customerInfo: packageCustomerInfo,
      }

      assertCanAcceptOrderForDate(packageCustomerInfo.preferredDate, availability.settings)
      saveSubmittedRequest(request)
      await clearCustomDraft('party-package', draftScopeRef.current)
      setSubmittedRequest(request)
      setSubmissionError('')
    } catch {
      setSubmissionError('We could not submit your request right now. Please try again.')
    }
  }

  const customizationContent = (
    <>
      <StepProgress currentStep={currentStep} />

      {currentStep === 1 ? (
        <div className="cake-customization-grid">
          <div className="cake-preview-column">
            <PackagePreview imageSrc={previewImage} />
          </div>

          <PackageSelectionForm
            selectedPackage={packageSelection}
            validationTouched={step1Touched}
            onPackageChange={handlePackageChange}
            onValidationTouchedChange={setStep1Touched}
            onContinue={() => goToStep(2)}
          />
        </div>
      ) : currentStep === 2 ? (
          <PackageCustomizeForm
            details={packageCustomization}
            cupcakeQuantity={packageSelection.cupcakeQuantity}
            previewImage={previewImage}
            validationTouched={step2Touched}
          onDetailsChange={setPackageCustomization}
          onValidationTouchedChange={setStep2Touched}
          onBack={() => goToStep(1)}
          onContinue={() => goToStep(3)}
        />
      ) : currentStep === 3 ? (
        <div className="cake-customization-grid step3-content">
          <div className="cake-preview-column step3-left available-dates-sticky">
            <CupcakeAvailabilityCalendar
              selectedDate={packageCustomerInfo.preferredDate}
              validationError={
                step3Touched.preferredDate && !packageCustomerInfo.preferredDate
                  ? 'Please select an available date.'
                  : ''
              }
              onDateChange={(date) =>
                setPackageCustomerInfo((current) => ({
                  ...current,
                  preferredDate: date,
                }))
              }
            />
          </div>

          <CupcakeCustomerForm
            customerInfo={packageCustomerInfo}
            onCustomerInfoChange={setPackageCustomerInfo}
            validationTouched={step3Touched}
            onValidationTouchedChange={setStep3Touched}
            onBack={() => goToStep(2)}
            onContinue={() => goToStep(4)}
          />
        </div>
      ) : currentStep === 4 ? (
        <div className="cake-customization-grid">
          <div className="cake-preview-column step4-left">
            <PackagePreview imageSrc={previewImage} />
            <PackageReferenceReview
              referenceImages={packageCustomization.packageReferenceImages}
            />
          </div>

          <PackageReviewForm
            packageSelection={packageSelection}
            packageCustomization={packageCustomization}
            customerInfo={packageCustomerInfo}
            submissionError={submissionError}
            onBack={() => goToStep(3)}
            onSubmit={handleSubmitRequest}
          />
        </div>
      ) : null}

      {submittedRequest ? (
        <PackageSuccessModal
          request={submittedRequest}
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
          <CakeTabs
            activeTab="Party Packages"
            onTabChange={(tab) => {
              if (tab === 'Cakes') {
                onProductChange?.('cakes')
              }
              if (tab === 'Cupcakes') {
                onProductChange?.('cupcakes')
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

export default PackagePage
