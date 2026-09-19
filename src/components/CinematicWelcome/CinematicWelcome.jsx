import { useCallback, useEffect, useRef, useState } from 'react'
import './CinematicWelcome.css'

const STORIES = [
  {
    id: 'sweetbakes-story',
    src: '/videos/Create_a_NEW_version_of_the_Sw.mp4',
    label: 'Sweet Bakes Story',
  },
  {
    id: 'puto-family-story',
    src: '/videos/Man_ordering_puto_for_family_20260917215341.mp4',
    label: 'Puto Family Story',
  },
]

const MINIMIZE_MS = 400
const COLLAPSE_MS = 280
const MINI_HOLD_DESKTOP = 5500
const MINI_HOLD_MOBILE = 3500
const SWAP_OUT_MS = 130

const PHASE = {
  IDLE: 'idle',
  CINEMATIC: 'cinematic',
  MINIMIZING: 'minimizing',
  MINI: 'mini',
  COLLAPSING: 'collapsing',
  PILL: 'pill',
}

function CinematicWelcome() {
  const [phase, setPhase] = useState(PHASE.PILL)
  const [muted, setMuted] = useState(true)
  const [ready, setReady] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [slideDir, setSlideDir] = useState(1)
  const [slideOut, setSlideOut] = useState(false)
  const [progress, setProgress] = useState(0)
  const [miniFrame, setMiniFrame] = useState('')

  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const closeRef = useRef(null)
  const pillButtonRef = useRef(null)
  const timers = useRef({})
  const reducedMotion = useRef(false)
  const isMobile = useRef(false)
  const pendingPillFocus = useRef(false)
  const switchingRef = useRef(false)
  const mutedRef = useRef(true)

  const setTimer = useCallback((key, fn, ms) => {
    window.clearTimeout(timers.current[key])
    timers.current[key] = window.setTimeout(fn, ms)
  }, [])

  const clearTimers = useCallback(() => {
    for (const key of Object.keys(timers.current)) {
      window.clearTimeout(timers.current[key])
    }
    timers.current = {}
  }, [])

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    isMobile.current = window.matchMedia('(max-width: 640px)').matches

    return clearTimers
  }, [clearTimers])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  /* RED playback progress = actual currentTime / duration */
  const updateProgress = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const duration = video.duration
    if (!(duration > 0)) {
      setProgress(0)
      return
    }
    const pct = (video.currentTime / duration) * 100
    const clamped = pct < 0 ? 0 : pct > 100 ? 100 : pct
    setProgress(clamped)
  }, [])

  const handleProgressClick = useCallback(
    (event) => {
      const video = videoRef.current
      if (!video || phase !== PHASE.CINEMATIC) return
      const duration = video.duration
      if (!(duration > 0)) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      try {
        video.currentTime = ratio * duration
        updateProgress()
      } catch {
        /* ignore */
      }
    },
    [phase, updateProgress]
  )

  const captureMiniFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth || video.videoHeight <= 0) return
    try {
      const canvas = document.createElement('canvas')
      const scale = 480 / video.videoWidth
      canvas.width = 480
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setMiniFrame(canvas.toDataURL('image/jpeg', 0.55))
    } catch {
      /* canvas capture unavailable — fall back to plain dark tile */
    }
  }, [])

  const collapseToPill = useCallback(() => {
    setPhase(PHASE.COLLAPSING)
    setTimer('pill', () => setPhase(PHASE.PILL), COLLAPSE_MS)
  }, [setTimer])

  const handleClose = useCallback(
    (fromUser) => {
      switchingRef.current = false
      setSlideOut(false)
      const video = videoRef.current
      if (video) {
        try {
          video.pause()
        } catch {
          /* ignore */
        }
        captureMiniFrame()
      }

      if (fromUser && wrapRef.current && wrapRef.current.contains(document.activeElement)) {
        pendingPillFocus.current = true
      }

      clearTimers()

      if (reducedMotion.current) {
        setPhase(PHASE.PILL)
        return
      }

      setPhase(PHASE.MINIMIZING)
      setTimer('mini', () => setPhase(PHASE.MINI), MINIMIZE_MS)
      setTimer(
        'collapse',
        () => collapseToPill(),
        MINIMIZE_MS + (isMobile.current ? MINI_HOLD_MOBILE : MINI_HOLD_DESKTOP)
      )
    },
    [captureMiniFrame, collapseToPill, clearTimers, setTimer]
  )

  /* a video that ends docks to mini — it never auto-plays the next story */
  const handleEnded = useCallback(() => {
    if (switchingRef.current) return
    updateProgress()
    handleClose(false)
  }, [handleClose, updateProgress])

  const handleSoundToggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.muted) {
      video.muted = false
      setMuted(false)
      if (video.paused) {
        const attempt = video.play()
        if (attempt && attempt.catch) {
          attempt.catch(() => {
            video.muted = true
            setMuted(true)
            setReady(true)
          })
        }
      }
    } else {
      video.muted = true
      setMuted(true)
    }
  }, [])

  const handleReadyPlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.ended) {
      try {
        video.currentTime = 0
      } catch {
        /* ignore */
      }
    }
    video.muted = false
    setMuted(false)
    const attempt = video.play()
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        video.muted = true
        setMuted(true)
        setReady(true)
      })
    }
  }, [])

  const handleReplay = useCallback(
    (fromPill = false) => {
      switchingRef.current = false
      setSlideOut(false)
      clearTimers()

      const video = videoRef.current
      if (fromPill && activeIndex !== 0) {
        setActiveIndex(0)
        if (video) {
          video.src = STORIES[0].src
          video.load()
        }
      }

      if (video) {
        try {
          video.currentTime = 0
        } catch {
          /* ignore */
        }
        updateProgress()
        video.muted = false
        setMuted(false)
        const attempt = video.play()
        if (attempt && attempt.catch) {
          attempt.catch(() => {
            video.muted = true
            setMuted(true)
            setReady(true)
          })
        }
      }

      setPhase(PHASE.CINEMATIC)
    },
    [activeIndex, clearTimers, updateProgress]
  )

  const selectStory = useCallback(
    (index) => {
      const count = STORIES.length
      if (count <= 1 || switchingRef.current) return
      const next = ((index % count) + count) % count
      if (next === activeIndex) return

      switchingRef.current = true
      const dir = next === (activeIndex + 1) % count ? 1 : -1
      setSlideDir(dir)
      setSlideOut(true)

      const video = videoRef.current
      if (video) {
        try {
          video.pause()
        } catch {
          /* ignore */
        }
      }

      setTimer('story-swap', () => {
        setActiveIndex(next)
        setSlideOut(false)
        const v = videoRef.current
        if (v) {
          v.muted = mutedRef.current
          try {
            v.currentTime = 0
          } catch {
            /* ignore */
          }
          v.src = STORIES[next].src
          v.load()
          updateProgress()
          const attempt = v.play()
          if (attempt && attempt.catch) {
            attempt.catch(() => {
              v.muted = true
              setMuted(true)
              setReady(true)
            })
          }
        }
        switchingRef.current = false
      }, SWAP_OUT_MS)
    },
    [activeIndex, setTimer, updateProgress]
  )

  useEffect(() => {
    if (phase === PHASE.CINEMATIC) {
      document.body.classList.add('cw-scroll-locked')
      return () => document.body.classList.remove('cw-scroll-locked')
    }
    return undefined
  }, [phase])

  useEffect(() => {
    if (phase !== PHASE.CINEMATIC) {
      return undefined
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, handleClose])

  useEffect(() => {
    if (phase === PHASE.CINEMATIC) {
      setTimer('focus', () => {
        if (closeRef.current) closeRef.current.focus({ preventScroll: true })
      }, 450)
    }
    if (phase === PHASE.PILL) {
      if (pendingPillFocus.current) {
        pendingPillFocus.current = false
        if (pillButtonRef.current) pillButtonRef.current.focus({ preventScroll: true })
      }
    }
  }, [phase, setTimer])

  let stateClass = ''
  if (phase === PHASE.CINEMATIC) stateClass = 'cw--cinematic'
  else if (phase === PHASE.MINIMIZING) stateClass = 'cw--minimizing'
  else if (phase === PHASE.MINI) stateClass = 'cw--mini'
  else if (phase === PHASE.COLLAPSING) stateClass = 'cw--collapsing'
  else if (phase === PHASE.PILL) stateClass = 'cw--pill'

  const slideClass = slideDir >= 0 ? ' cw--slide-next' : ' cw--slide-prev'
  const classes = `cw-wrap ${stateClass}${slideOut ? ' cw--slide-out' : ''}${slideClass}${ready && phase === PHASE.CINEMATIC ? ' cw--ready' : ''}`

  const activeStory = STORIES[activeIndex]

  return (
    <div ref={wrapRef} className={classes}>
      <div className="cw-backdrop" aria-hidden="true" />

      <div className="cw-stage">
        <div className="cw-switch-frame" key={activeStory.id}>
          <video
            ref={videoRef}
            className="cw-video"
            src={activeStory.src}
            preload="auto"
            muted={muted}
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            onTimeUpdate={updateProgress}
            onSeeked={updateProgress}
            onLoadedMetadata={updateProgress}
            onEnded={handleEnded}
            onPlaying={() => setReady(false)}
            aria-label={activeStory.label}
          />
        </div>

        <div className="cw-ready" aria-hidden={!ready || phase !== PHASE.CINEMATIC}>
          <button
            type="button"
            className="cw-btn cw-ready-play"
            onClick={handleReadyPlay}
            aria-label={`Play ${activeStory.label}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        <div className="cw-controls">
          <button
            type="button"
            className="cw-btn cw-sound"
            onClick={handleSoundToggle}
            aria-label={muted ? 'Enable sound' : 'Disable sound'}
          >
            <span className="cw-sound-icon" aria-hidden="true">
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 7.97v8.05a1.5 1.5 0 0 1-2.4 1.2L10 14.5H7a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3l3.6-2.72a1.5 1.5 0 0 1 2.4 1.19z" />
                  <path d="M17 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 7.97v8.05a1.5 1.5 0 0 1-2.4 1.2L10 14.5H7a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3l3.6-2.72a1.5 1.5 0 0 1 2.4 1.19z" />
                  <path d="M19 9a5 5 0 0 1 0 6M21.5 6.5a9 9 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </span>
            {muted ? 'Sound On' : 'Sound Off'}
          </button>

          <button
            ref={closeRef}
            type="button"
            className="cw-btn cw-close"
            onClick={() => handleClose(true)}
            aria-label="Close cinematic video"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="cw-progress"
          onClick={handleProgressClick}
          role="progressbar"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="cw-progress-track" />
          <div className="cw-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {STORIES.length > 1 && (
          <div className="cw-nav">
            {activeIndex > 0 && (
              <button
                type="button"
                className="cw-btn cw-nav-btn cw-nav-prev"
                onClick={() => selectStory(activeIndex - 1)}
                aria-label="Previous story"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            )}
            {activeIndex < STORIES.length - 1 && (
              <button
                type="button"
                className="cw-btn cw-nav-btn cw-nav-next"
                onClick={() => selectStory(activeIndex + 1)}
                aria-label="Next story"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="cw-story-nav" role="group" aria-label="Cinematic stories">
        {STORIES.map((story, index) => (
          <button
            key={story.id}
            type="button"
            className={`cw-btn cw-story-dot${index === activeIndex ? ' cw-story-dot--active' : ''}`}
            onClick={() => selectStory(index)}
            aria-label={`Play story ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>

      <div className="cw-mini">
        {miniFrame && (
          <div className="cw-mini-frame" style={{ backgroundImage: `url(${miniFrame})` }} aria-hidden="true" />
        )}
        <div
          className="cw-mini-overlay"
          onClick={() => {
            if (phase !== PHASE.MINI) return
            handleReplay(false)
          }}
        >
          <button
            type="button"
            className="cw-btn cw-mini-play"
            onClick={() => handleReplay(false)}
            aria-label={`Replay ${activeStory.label}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <span className="cw-mini-label">Watch Again</span>
          <button
            type="button"
            className="cw-btn cw-mini-close"
            onClick={(event) => {
              event.stopPropagation()
              collapseToPill()
            }}
            aria-label="Close mini player"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <button
        ref={pillButtonRef}
        type="button"
        className="cw-btn cw-pill"
        onClick={() => handleReplay(true)}
        aria-label="Replay Sweet Bakes story"
      >
        <span className="cw-pill-icon" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="cw-pill-text">Our Story</span>
      </button>
    </div>
  )
}

export default CinematicWelcome
