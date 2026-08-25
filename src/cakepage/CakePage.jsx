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
import OrderRequestSuccessModal from '../components/OrderRequestSuccessModal.jsx'
import CakeTabs from './components/CakeTabs.jsx'
import StepProgress from './components/StepProgress.jsx'
import { useAvailability } from '../hooks/useAvailability.js'
import { assertCanAcceptOrderForDate } from '../admin/services/availabilityService.js'
import {
  createRequestUploadId,
  completeCustomCakeDraft,
  createCustomCakeOrderRequest,
  fetchCustomCakeDraft,
  mapCustomCakeSubmitError,
  removeCustomCakeDraftReference,
  saveCustomCakeDraft,
  uploadCustomCakeDraftReferences,
} from './services/customCakeOrderService.js'
import {
  clearCustomDraft,
  getCustomDraftScope,
  loadCustomDraft,
  saveCustomDraft,
  subscribeToCustomDraftAuth,
} from '../services/customDraftService.js'
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

const shouldStartAtStepOne = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('start') === '1'
}

function CakePage({
  embedded = false,
  onProductChange,
  onNavigate,
}) {
  const [shouldCleanStartUrl] = useState(shouldStartAtStepOne)
  const [currentStep, setCurrentStep] = useState(1)
  const visitedStepsRef = useRef(new Set([1]))
  const stepScrollPositionsRef = useRef({ 1: 0 })
  const requestUploadIdRef = useRef(createRequestUploadId())
  const draftIdRef = useRef(null)
  const draftSaveQueueRef = useRef(Promise.resolve())
  const draftScopeRef = useRef(null)
  const draftLoadVersionRef = useRef(0)
  const localReferenceUrlsRef = useRef(new Set())
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [selections, setSelections] = useState(defaultSelections)
  const [designDetails, setDesignDetails] = useState(defaultDesignDetails)
  const [customerInfo, setCustomerInfo] = useState(defaultCustomerInfo)
  const [step2Touched, setStep2Touched] = useState({})
  const [step3Touched, setStep3Touched] = useState({})
  const [submittedRequest, setSubmittedRequest] = useState(null)
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const availability = useAvailability({ active: currentStep === 3 })

  useEffect(() => () => {
    localReferenceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    localReferenceUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    let isActive = true

    async function restoreCakeDraft(scope, reset = false) {
      const loadVersion = ++draftLoadVersionRef.current

      if (reset) {
        if (import.meta.env.DEV) console.log('[CAKE DRAFT] reset', 'auth scope changed')
        setIsDraftLoaded(false)
        setCurrentStep(1)
        setSelections(defaultSelections)
        setDesignDetails(defaultDesignDetails)
        setCustomerInfo(defaultCustomerInfo)
        draftIdRef.current = null
      }

      const [localResult, remoteResult] = await Promise.allSettled([
        loadCustomDraft('cake', scope),
        fetchCustomCakeDraft(),
      ])

      if (!isActive || loadVersion !== draftLoadVersionRef.current) return

      const localDraft = localResult.status === 'fulfilled' ? localResult.value : null
      const remoteDraft = remoteResult.status === 'fulfilled' ? remoteResult.value : null
      const draft = localDraft || remoteDraft

      if (localResult.status === 'rejected') {
        console.error('[CAKE DRAFT] local restore failed:', localResult.reason)
      }
      if (remoteResult.status === 'rejected') {
        console.error('[CAKE DRAFT] storage restore failed:', remoteResult.reason)
      }

      draftScopeRef.current = scope

      if (draft) {
        draftIdRef.current = remoteDraft?.id || null
        if (!shouldStartAtStepOne()) {
          setCurrentStep(draft.currentStep || draft.current_step || 1)
        }
        setSelections((current) => ({ ...current, ...(draft.selections || {}) }))
        setDesignDetails((current) => ({
          ...current,
          ...(draft.designDetails || draft.design_details || {}),
          referenceImages: remoteDraft?.reference_images || [],
        }))
        setCustomerInfo((current) => ({
          ...current,
          ...(draft.customerInfo || draft.customer_info || {}),
        }))
      }

      if (import.meta.env.DEV) {
        console.log('[CAKE DRAFT] auth resolved', scope)
        console.log('[CAKE DRAFT] key', `sweetbakes_custom_draft:cake:${scope}`)
        console.log('[CAKE DRAFT] raw saved', {
          local: Boolean(localDraft),
          storage: Boolean(remoteDraft),
        })
        console.log('[CAKE DRAFT] restored', Boolean(draft))
        console.log('[CAKE DRAFT] current step restored', draft?.currentStep || draft?.current_step || 1)
      }

      setIsDraftLoaded(true)
    }

    getCustomDraftScope()
      .then((scope) => restoreCakeDraft(scope))
      .catch((error) => {
        console.error('[CAKE DRAFT] auth/restore failed:', error)
        if (isActive) setIsDraftLoaded(true)
      })

    const unsubscribe = subscribeToCustomDraftAuth((scope) => {
      if (scope === draftScopeRef.current) return
      restoreCakeDraft(scope, true).catch((error) => {
        console.error('[CAKE DRAFT] account restore failed:', error)
        if (isActive) setIsDraftLoaded(true)
      })
    })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

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
      ...(
        availability.loading ||
        availability.error ||
        !availability.settings ||
        !customerInfo.preferredDate ||
        !availability.isDateAvailable(customerInfo.preferredDate)
          ? { preferredDate: true }
          : {}
      ),
      ...(customerInfo.fulfillment === 'pickup' && !customerInfo.preferredPickupTime
        ? { preferredPickupTime: true }
        : {}),
      ...(customerInfo.fulfillment === 'pickup' &&
      customerInfo.preferredPickupTime &&
      !availability.isTimeAvailable(customerInfo.preferredPickupTime)
        ? { preferredPickupTime: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' && !customerInfo.deliveryAddress.trim()
        ? { deliveryAddress: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' && !customerInfo.preferredDeliveryTime
        ? { preferredDeliveryTime: true }
        : {}),
      ...(customerInfo.fulfillment === 'delivery' &&
      customerInfo.preferredDeliveryTime &&
      !availability.isTimeAvailable(customerInfo.preferredDeliveryTime)
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

  const handleSubmitRequest = async () => {
    if (isSubmittingRequest) {
      return
    }

    if (isUploadingReferences) {
      setSubmissionError('Please wait for your reference images to finish uploading.')
      return
    }

    setSubmissionError('')
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
      const latestAvailability = await availability.refresh()
      if (!availability.isDateAvailable(customerInfo.preferredDate, latestAvailability)) {
        setCustomerInfo((current) => ({ ...current, preferredDate: '' }))
        setStep3Touched((current) => ({ ...current, preferredDate: true }))
        setCurrentStep(3)
        setSubmissionError('This date has just become fully booked. Please select another available date.')
        return
      }

      assertCanAcceptOrderForDate(customerInfo.preferredDate, latestAvailability)
      setIsSubmittingRequest(true)

      const { order, referenceImages } = await createCustomCakeOrderRequest({
        selections,
        designDetails,
        customerInfo,
        referenceImages: designDetails.referenceImages,
      })
      const submittedAt = order?.created_at || new Date().toISOString()
      const request = {
        orderId: order?.id,
        requestNumber: order?.order_number,
        submittedAt,
        status: 'Pending',
        selections,
        designDetails: {
          ...designDetails,
          referenceImages,
        },
        customerInfo,
      }

      setSubmittedRequest(request)
      try {
        await completeCustomCakeDraft(draftIdRef.current)
      } catch (draftError) {
        console.error('[CUSTOM CAKE DRAFT] complete failed:', draftError)
      }
      await clearCustomDraft('cake', draftScopeRef.current)
      requestUploadIdRef.current = createRequestUploadId()
    } catch (error) {
      console.error('[CUSTOM CAKE REQUEST]', error)
      const message = mapCustomCakeSubmitError(error?.message)
      if (message.includes('fully booked')) {
        setCustomerInfo((current) => ({ ...current, preferredDate: '' }))
        setStep3Touched((current) => ({ ...current, preferredDate: true }))
        setCurrentStep(3)
      }
      setSubmissionError(message)
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  useEffect(() => {
    if (!isDraftLoaded || !draftScopeRef.current) return undefined

    saveCustomDraft('cake', draftScopeRef.current, {
      currentStep,
      selections,
      designDetails: {
        ...designDetails,
        referenceImages: [],
      },
      customerInfo,
    })

    if (import.meta.env.DEV) {
      console.log('[CAKE DRAFT] autosave', {
        currentStep,
        scope: draftScopeRef.current,
      })
    }

    draftSaveQueueRef.current = draftSaveQueueRef.current
      .then(async () => {
        const saved = await saveCustomCakeDraft({
          draftId: draftIdRef.current,
          currentStep,
          selections,
          designDetails,
          customerInfo,
          referenceImages: designDetails.referenceImages,
        })
        draftIdRef.current = saved.id
      })
      .catch((error) => {
        console.error('[CUSTOM CAKE DRAFT] save failed:', error)
      })

    return undefined
  }, [isDraftLoaded, currentStep, selections, designDetails, customerInfo])

  const handleReferenceImagesChange = async (nextImages) => {
    const files = nextImages.filter((item) => item instanceof File)
    const currentReferences = designDetails.referenceImages || []
    const remoteReferences = currentReferences.filter((item) => item?.path)
    let optimisticReferences = []

    try {
      setIsUploadingReferences(true)
      if (files.length) {
        optimisticReferences = files.map((file) => {
          const previewUrl = URL.createObjectURL(file)
          localReferenceUrlsRef.current.add(previewUrl)
          return {
            file,
            name: file.name,
            type: file.type,
            size: file.size,
            previewUrl,
            status: 'uploading',
          }
        })
        setDesignDetails((current) => ({
          ...current,
          referenceImages: [...current.referenceImages, ...optimisticReferences],
        }))

        const result = await uploadCustomCakeDraftReferences(
          files,
          draftIdRef.current,
          remoteReferences,
          { currentStep, selections, designDetails, customerInfo },
        )
        draftIdRef.current = result.draftId
        const remainingLocalPreviews = [...optimisticReferences]
        const uploadedReferences = result.referenceImages.map((reference) => {
          const localIndex = remainingLocalPreviews.findIndex(
            (localReference) =>
              localReference.name === reference.name && localReference.size === reference.size,
          )
          const localReference = localIndex >= 0 ? remainingLocalPreviews.splice(localIndex, 1)[0] : null
          return {
            ...reference,
            file: null,
            previewUrl: localReference?.previewUrl || reference.previewUrl,
            persistentPreviewUrl: reference.previewUrl,
            status: 'uploaded',
          }
        })
        setDesignDetails((current) => ({
          ...current,
          referenceImages: [
            ...current.referenceImages.filter(
              (reference) => !optimisticReferences.some((item) => item.file === reference.file),
            ),
            ...uploadedReferences,
          ],
        }))
        return
      }

      const removed = remoteReferences.filter(
        (reference) => !nextImages.some((item) => item?.path === reference.path),
      )
      const removedTransient = currentReferences.filter(
        (reference) =>
          !reference.path &&
          !(reference instanceof File) &&
          !nextImages.includes(reference),
      )
      removedTransient.forEach((reference) => {
        if (reference.previewUrl && localReferenceUrlsRef.current.has(reference.previewUrl)) {
          URL.revokeObjectURL(reference.previewUrl)
          localReferenceUrlsRef.current.delete(reference.previewUrl)
        }
      })
      let remaining = remoteReferences
      for (const reference of removed) {
        if (reference.previewUrl && localReferenceUrlsRef.current.has(reference.previewUrl)) {
          URL.revokeObjectURL(reference.previewUrl)
          localReferenceUrlsRef.current.delete(reference.previewUrl)
        }
        remaining = await removeCustomCakeDraftReference(
          reference.path,
          draftIdRef.current,
          remaining,
          { currentStep, selections, designDetails, customerInfo },
        )
      }
      const remainingTransient = nextImages.filter(
        (item) => !(item instanceof File) && !item?.path,
      )
      setDesignDetails((current) => ({
        ...current,
        referenceImages: [...remaining, ...remainingTransient],
      }))
    } catch (error) {
      console.error('[CUSTOM CAKE DRAFT] reference update failed:', error)
      const errorReferences = optimisticReferences.map((reference) => ({
        ...reference,
        file: null,
        status: 'error',
      }))
      setDesignDetails((current) => ({
        ...current,
        referenceImages: [
          ...current.referenceImages.filter(
            (reference) => !optimisticReferences.some((item) => item.previewUrl === reference.previewUrl),
          ),
          ...errorReferences,
        ],
      }))
      setSubmissionError(mapCustomCakeSubmitError(error?.message))
    } finally {
      setIsUploadingReferences(false)
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
              onReferenceImagesChange={handleReferenceImagesChange}
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
            isDraftLoaded={isDraftLoaded}
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
            isSubmitting={isSubmittingRequest}
            submissionError={submissionError}
          />
        )}
      </div>
      {submittedRequest ? (
        <OrderRequestSuccessModal
          request={submittedRequest}
          productType="custom cake"
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
            activeTab="Cakes"
            onTabChange={(tab) => {
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

export default CakePage
