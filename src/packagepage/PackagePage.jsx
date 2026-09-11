import { useEffect, useMemo, useRef, useState } from 'react'
import { CUSTOM_PACKAGE_PREVIEW_IMAGES as packagePreviewMap } from '../components/customOrderPreviewImages.js'
import CakeTabs from '../cakepage/components/CakeTabs.jsx'
import CupcakeAvailabilityCalendar from '../cupcakepage/components/CupcakeAvailabilityCalendar.jsx'
import CupcakeCustomerForm from '../cupcakepage/components/CupcakeCustomerForm.jsx'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import PackageCustomizeForm from './components/PackageCustomizeForm.jsx'
import PackagePreview from './components/PackagePreview.jsx'
import PackageReferenceReview from './components/PackageReferenceReview.jsx'
import PackageReviewForm from './components/PackageReviewForm.jsx'
import PackageSelectionForm from './components/PackageSelectionForm.jsx'
import OrderRequestSuccessModal from '../components/OrderRequestSuccessModal.jsx'
import StepProgress from './components/StepProgress.jsx'
import { useAvailability } from '../hooks/useAvailability.js'
import { assertCanAcceptOrderForDate } from '../admin/services/availabilityService.js'
import { createCustomCustomerOrder } from '../services/customCustomerOrderService.js'
import {
  refreshReferenceImageUrls,
  removeReferenceImage,
  uploadReferenceImages,
} from '../services/referenceImageStorageService.js'
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
  packageReferenceDraftId: '',
  packageCupcakeSpecialInstructions: '',
}

const stripLegacyPackageCupcakeTheme = (customization = {}) => {
  const {
    packageCupcakeTheme: _legacyCupcakeTheme,
    packageCupcakeOtherTheme: _legacyCupcakeOtherTheme,
    ...currentCustomization
  } = customization

  return currentCustomization
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
  onNavigate,
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
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const draftScopeRef = useRef(null)
  const draftLoadVersionRef = useRef(0)
  const referenceDraftIdRef = useRef('')
  const availability = useAvailability({ active: currentStep === 3 })

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
        referenceDraftIdRef.current = ''
      }

      const draft = await loadCustomDraft('party-package', scope)
      let referenceImages = draft?.packageCustomization?.packageReferenceImages || []
      const savedDraftId = draft?.packageCustomization?.packageReferenceDraftId || ''
      const storedPath = referenceImages.find((reference) => reference?.path)?.path || ''
      const pathParts = storedPath.split('/')
      referenceDraftIdRef.current = savedDraftId || (
        pathParts[0] === 'drafts' && pathParts[2] ? pathParts[2] : ''
      )

      if (referenceImages.length) {
        referenceImages = await refreshReferenceImageUrls(referenceImages, {
          productType: 'party-package',
        })
      }

      if (!isMounted || loadVersion !== draftLoadVersionRef.current) return

      draftScopeRef.current = scope
      if (draft) {
        setCurrentStep(draft.currentStep || 1)
        setPackageSelection((current) => ({ ...current, ...(draft.packageSelection || {}) }))
        setPackageCustomization((current) => ({
          ...current,
          ...stripLegacyPackageCupcakeTheme(draft.packageCustomization || {}),
          packageReferenceImages: referenceImages,
          packageReferenceDraftId: referenceDraftIdRef.current,
        }))
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
    if (!isDraftLoaded || !draftScopeRef.current || isUploadingReferences) return undefined

    saveCustomDraft('party-package', draftScopeRef.current, {
      currentStep,
      packageSelection,
      packageCustomization,
      customerInfo: packageCustomerInfo,
    })

    return undefined
  }, [isDraftLoaded, isUploadingReferences, currentStep, packageSelection, packageCustomization, packageCustomerInfo])

  const handlePackageReferenceImagesChange = async (nextImages) => {
    const existingReferences = packageCustomization.packageReferenceImages.filter((reference) => reference?.path)
    const files = nextImages.filter((reference) => reference instanceof File)

    if (files.length) {
      setIsUploadingReferences(true)
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
      setPackageCustomization((current) => ({
        ...current,
        packageReferenceImages: optimisticReferences,
      }))

      try {
        const uploadedReferences = await uploadReferenceImages(files, existingReferences, {
          productType: 'party-package',
          draftId: referenceDraftIdRef.current,
        })
        const uploadedPath = uploadedReferences.find((reference) => reference?.path)?.path || ''
        const uploadedPathParts = uploadedPath.split('/')
        if (!referenceDraftIdRef.current && uploadedPathParts[0] === 'drafts' && uploadedPathParts[2]) {
          referenceDraftIdRef.current = uploadedPathParts[2]
        }
        setPackageCustomization((current) => ({
          ...current,
          packageReferenceImages: uploadedReferences,
          packageReferenceDraftId: referenceDraftIdRef.current,
        }))
      } catch (error) {
        console.error('[PACKAGE REFERENCES] upload failed:', error)
        setPackageCustomization((current) => ({
          ...current,
          packageReferenceImages: existingReferences,
        }))
      } finally {
        setIsUploadingReferences(false)
      }
      return
    }

    const nextPaths = new Set(nextImages.map((reference) => reference?.path).filter(Boolean))
    const removedReferences = existingReferences.filter((reference) => !nextPaths.has(reference.path))
    const remainingReferences = existingReferences.filter((reference) => nextPaths.has(reference.path))

    setPackageCustomization((current) => ({
      ...current,
      packageReferenceImages: remainingReferences,
    }))

    try {
      for (const reference of removedReferences) {
        await removeReferenceImage(reference, remainingReferences, {
          productType: 'party-package',
        })
      }
    } catch (error) {
      console.error('[PACKAGE REFERENCES] remove failed:', error)
    }
  }

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
      const latestAvailability = await availability.refresh()
      if (!availability.isDateAvailable(packageCustomerInfo.preferredDate, latestAvailability)) {
        setPackageCustomerInfo((current) => ({ ...current, preferredDate: '' }))
        setStep3Touched((current) => ({ ...current, preferredDate: true }))
        setCurrentStep(3)
        setSubmissionError('This date has just become fully booked. Please select another available date.')
        return
      }

      const referenceImages = packageCustomization.packageReferenceImages
        .filter((reference) => reference?.path)
        .map(({ name, type, size, path, position }) => ({
          name,
          type,
          size,
          path,
          position,
        }))
      const order = await createCustomCustomerOrder({
        productType: 'custom_party_package',
        productName: 'Party Package',
        quantity: 1,
        customerInfo: packageCustomerInfo,
        preferredDate: packageCustomerInfo.preferredDate,
        preferredTime: packageCustomerInfo.fulfillment === 'pickup'
          ? packageCustomerInfo.preferredPickupTime
          : packageCustomerInfo.preferredDeliveryTime,
        customizationData: {
          package_selection: packageSelection,
          package_customization: {
            ...packageCustomization,
            packageReferenceImages: referenceImages,
          },
        },
      })
      const submittedAt = order?.created_at || new Date().toISOString()
      const request = {
        orderId: order?.id,
        requestNumber: order?.order_number,
        requestNumber: generateRequestNumber(submittedAt),
        submittedAt,
        status: 'Pending Review',
        productType: 'Party Package',
        packageSelection,
        packageCustomization: {
          ...packageCustomization,
          packageReferenceImages: referenceImages,
        },
        customerInfo: packageCustomerInfo,
      }

      assertCanAcceptOrderForDate(packageCustomerInfo.preferredDate, latestAvailability)
      saveSubmittedRequest(request)
      await clearCustomDraft('party-package', draftScopeRef.current)
      setSubmittedRequest(request)
      setSubmissionError('')
    } catch {
      try {
        const latestAvailability = await availability.refresh()
        if (!availability.isDateAvailable(packageCustomerInfo.preferredDate, latestAvailability)) {
          setPackageCustomerInfo((current) => ({ ...current, preferredDate: '' }))
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
            onReferenceImagesChange={handlePackageReferenceImagesChange}
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
        <OrderRequestSuccessModal
          request={submittedRequest}
          productType="party package"
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
