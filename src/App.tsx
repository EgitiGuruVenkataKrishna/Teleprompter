import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Video,
  Type,
  Maximize2,
  X,
  Keyboard,
  FileText,
  Clock,
  Sparkles,
  RefreshCw,
  HelpCircle,
  Eye,
  Sliders,
  AlertCircle,
  Circle
} from 'lucide-react'

// Default sample script to show on first load
const DEFAULT_SCRIPT = `Welcome to ProPrompter Recording Studio! 

This professional-grade teleprompter is built with a built-in video recorder and eye-line optimization.

Here is how to operate the app:

1. TOP-EDGE LOCK: Look directly at the webcam at the top of your screen. The scrolling text is locked to the top 40% of the viewport, ensuring your eyes stay fixed on the lens level.

2. GRADIENT TEXT MASKING: As new text enters from the bottom, it smoothly fades in, keeping your reading attention focused exclusively on the active top line.

3. RAW WEBCAM RECORDING: Press the red "Record" button in the control bar. ProPrompter will capture your webcam and microphone feed. 

Because we capture the raw stream, the final video ignores this scrolling text overlay entirely. You get a clean, professional recording.

4. AUTOMATIC DOWNLOAD: When you click "Stop Recording," ProPrompter compiles your video and triggers a direct download of the video file (.webm) to your computer.

Adjust scroll speed, text size, and margins using the sliders. Press Space to play/pause scrolling and Escape to return to setup.

Happy recording!`;

const PRESETS = [
  {
    name: 'Recording Demo Intro',
    description: 'A walkthrough of ProPrompter recording features.',
    content: DEFAULT_SCRIPT
  },
  {
    name: 'Elevator Pitch Structure',
    description: 'A 60-second product pitch designed to hook the audience.',
    content: `[Hook]
Have you ever struggled to look natural while recording video presentations? You look at your notes, then the screen, then the camera—it looks disconnected.

[Problem]
Physical teleprompters are expensive, bulky, and hard to set up. Software solutions are often clunky and lack camera integration.

[Solution]
That's why we created ProPrompter. It puts a live feed of your camera directly behind your scrolling text. You look at the camera lens because the text is right on top of it.

[Value Prop]
It is entirely client-side, runs in any browser, and features hardware mirroring, smooth scrolling calibrated for gaming monitors, and dark overlay filters.

[Call to Action]
Give it a try today and take your video production quality to the next level!`
  },
  {
    name: 'YouTube Channel Intro',
    description: 'Energetic hook and channel subscription request.',
    content: `Hey everyone, welcome back to the channel! 

In today's video, we're talking about a game-changing tool that will immediately improve your camera presence. 

If you've ever felt awkward, forgot your lines, or spent hours editing out your pauses, this video is for you.

Before we dive in, make sure to hit that subscribe button, turn on notifications, and drop a comment below on what you're working on. 

Alright, let's get started!`
  }
];

const TEXT_COLORS = [
  { name: 'Soft Cream', value: '#fffdd0', shadowColor: 'rgba(0,0,0,0.95)' },
  { name: 'Pure White', value: '#ffffff', shadowColor: 'rgba(0,0,0,0.95)' },
  { name: 'Pale Yellow', value: '#fef08a', shadowColor: 'rgba(0,0,0,0.95)' },
  { name: 'Soft Cyan', value: '#cffafe', shadowColor: 'rgba(0,0,0,0.95)' }
];

export default function App() {
  // --- Persistent States (localStorage) ---
  const [script, setScript] = useState(() => {
    return localStorage.getItem('prompter_script') || DEFAULT_SCRIPT
  })
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    return Number(localStorage.getItem('prompter_speed')) || 5
  })
  const [fontSize, setFontSize] = useState(() => {
    return Number(localStorage.getItem('prompter_font_size')) || 40
  })
  const [lineHeight, setLineHeight] = useState(() => {
    return Number(localStorage.getItem('prompter_line_height')) || 1.6
  })
  const [textWidth, setTextWidth] = useState(() => {
    return Number(localStorage.getItem('prompter_text_width')) || 60
  })
  const [isMirrored, setIsMirrored] = useState(() => {
    return localStorage.getItem('prompter_is_mirrored') === 'true'
  })
  const [isCameraActive, setIsCameraActive] = useState(() => {
    const saved = localStorage.getItem('prompter_is_camera_active')
    return saved === null ? true : saved === 'true'
  })
  const [flipVideo, setFlipVideo] = useState(() => {
    const saved = localStorage.getItem('prompter_flip_video')
    return saved === null ? true : saved === 'true'
  })
  const [overlayOpacity, setOverlayOpacity] = useState(() => {
    return Number(localStorage.getItem('prompter_overlay_opacity')) || 60
  })
  const [textColor, setTextColor] = useState(() => {
    return localStorage.getItem('prompter_text_color') || '#fffdd0'
  })
  const [countdownDuration, setCountdownDuration] = useState(() => {
    return Number(localStorage.getItem('prompter_countdown_duration')) || 3
  })
  const [showReadingGuide, setShowReadingGuide] = useState(() => {
    const saved = localStorage.getItem('prompter_show_reading_guide')
    return saved === null ? true : saved === 'true'
  })

  // --- Runtime States ---
  const [mode, setMode] = useState<'setup' | 'prompter'>('setup')
  const [isPlaying, setIsPlaying] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showControlOverlay, setShowControlOverlay] = useState(true)

  // --- Recording States ---
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  // --- Refs for Animation Engine, Stream Control, & Recording ---
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const textContainerRef = useRef<HTMLDivElement | null>(null)
  const textWrapperRef = useRef<HTMLDivElement | null>(null)
  const textContentRef = useRef<HTMLDivElement | null>(null)
  
  // Refs to bypass React closures in requestAnimationFrame loop
  const scrollOffsetRef = useRef<number>(0)
  const isPlayingRef = useRef<boolean>(isPlaying)
  const scrollSpeedRef = useRef<number>(scrollSpeed)
  const isMirroredRef = useRef<boolean>(isMirrored)
  
  const lastTimeRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)

  // Timer Ref for reading duration
  const timerRef = useRef<any>(null)
  // Mouse movement timeout ref for hiding control bar
  const mouseMoveTimeoutRef = useRef<any>(null)

  // Keep Refs synchronized with React States
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    scrollSpeedRef.current = scrollSpeed
  }, [scrollSpeed])

  useEffect(() => {
    isMirroredRef.current = isMirrored
  }, [isMirrored])

  // --- Local Storage Syncing Effects ---
  useEffect(() => {
    localStorage.setItem('prompter_script', script)
  }, [script])

  useEffect(() => {
    localStorage.setItem('prompter_speed', String(scrollSpeed))
  }, [scrollSpeed])

  useEffect(() => {
    localStorage.setItem('prompter_font_size', String(fontSize))
  }, [fontSize])

  useEffect(() => {
    localStorage.setItem('prompter_line_height', String(lineHeight))
  }, [lineHeight])

  useEffect(() => {
    localStorage.setItem('prompter_text_width', String(textWidth))
  }, [textWidth])

  useEffect(() => {
    localStorage.setItem('prompter_is_mirrored', String(isMirrored))
  }, [isMirrored])

  useEffect(() => {
    localStorage.setItem('prompter_is_camera_active', String(isCameraActive))
  }, [isCameraActive])

  useEffect(() => {
    localStorage.setItem('prompter_flip_video', String(flipVideo))
  }, [flipVideo])

  useEffect(() => {
    localStorage.setItem('prompter_overlay_opacity', String(overlayOpacity))
  }, [overlayOpacity])

  useEffect(() => {
    localStorage.setItem('prompter_text_color', textColor)
  }, [textColor])

  useEffect(() => {
    localStorage.setItem('prompter_countdown_duration', String(countdownDuration))
  }, [countdownDuration])

  useEffect(() => {
    localStorage.setItem('prompter_show_reading_guide', String(showReadingGuide))
  }, [showReadingGuide])

  // --- Reading Stats Helpers ---
  const getWordCount = () => {
    return script.trim() ? script.trim().split(/\s+/).length : 0
  }

  const getEstimatedTime = () => {
    const words = getWordCount()
    // Average reading speed is around 140 words per minute
    const minutes = words / 140
    const mins = Math.floor(minutes)
    const secs = Math.round((minutes - mins) * 60)
    return `${mins}m ${secs}s`
  }

  // --- Camera Access Hook with Strict Cleanup ---
  useEffect(() => {
    let active = true

    const initWebcam = async () => {
      if (mode !== 'prompter' || !isCameraActive) return
      setIsCameraLoading(true)
      setCameraError(null)

      // Stop any existing stream before starting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      try {
        // Request both audio and video for recording capability
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        }

        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (audioErr) {
          console.warn("Could not capture audio stream, falling back to video only:", audioErr)
          // Fallback to video only if mic is missing or blocked
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          })
        }

        if (!active) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error("Autoplay prevented:", error)
            })
          }
        }
      } catch (err: any) {
        console.error("Error accessing webcam:", err)
        if (active) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Webcam permission denied. Please grant access in your browser settings.'
              : `Could not access camera: ${err.message || 'Unknown error'}`
          )
        }
      } finally {
        if (active) {
          setIsCameraLoading(false)
        }
      }
    }

    initWebcam()

    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [mode, isCameraActive])

  // --- Unbreakable requestAnimationFrame Scrolling Loop (Direct DOM mutations) ---
  const animateScroll = (timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }
    const deltaTime = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    // Only scroll if play state ref is active
    if (isPlayingRef.current) {
      // 1 speed units = ~14 pixels per second
      const pixelsPerSecond = scrollSpeedRef.current * 14
      // Increment offset based on true elapsed time in seconds (fps-independent)
      scrollOffsetRef.current += pixelsPerSecond * (deltaTime / 1000)

      if (textContainerRef.current) {
        // Direct DOM write prevents React state re-render lags/closures
        const transformValue = isMirroredRef.current
          ? `translateY(-${scrollOffsetRef.current}px) scaleX(-1)`
          : `translateY(-${scrollOffsetRef.current}px)`
        textContainerRef.current.style.transform = transformValue
      }

      // Auto pause when the last line has scrolled past the eye line
      if (textContentRef.current) {
        const textContentHeight = textContentRef.current.offsetHeight
        // Once the offset exceeds textContentHeight, the bottom of the script has reached 4vh (the Reading Guide).
        // Let's add a small clearance of 40px
        if (scrollOffsetRef.current > textContentHeight + 40) {
          isPlayingRef.current = false
          setIsPlaying(false)
        }
      }
    }

    // Keep loop active to handle delta time continuously, avoiding time jumps on resume
    animationFrameRef.current = requestAnimationFrame(animateScroll)
  }

  // Effect to manage animation frame loop lifespans
  useEffect(() => {
    if (mode === 'prompter') {
      lastTimeRef.current = 0
      animationFrameRef.current = requestAnimationFrame(animateScroll)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [mode])

  // --- Keyboard Event Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'prompter') return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(prev => !prev)
      } else if (e.code === 'Escape') {
        e.preventDefault()
        handleExitPrompter()
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        setScrollSpeed(prev => Math.min(prev + 1, 20))
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        setScrollSpeed(prev => Math.max(prev - 1, 1))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        setFontSize(prev => Math.min(prev + 4, 120))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setFontSize(prev => Math.max(prev - 4, 20))
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        handleResetScroll()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode])

  // --- Reading Session Timer ---
  useEffect(() => {
    if (isPlaying && mode === 'prompter') {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isPlaying, mode])

  // --- Control Overlay Auto-Hide on Idle ---
  const handleMouseMove = () => {
    setShowControlOverlay(true)
    if (mouseMoveTimeoutRef.current) {
      clearTimeout(mouseMoveTimeoutRef.current)
    }
    
    if (isPlaying) {
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setShowControlOverlay(false)
      }, 3500)
    }
  }

  useEffect(() => {
    if (mode === 'prompter') {
      window.addEventListener('mousemove', handleMouseMove)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current)
      }
    }
  }, [mode, isPlaying])

  // --- Video Recording Logic (MediaRecorder API) ---
  const handleStartRecording = () => {
    if (!streamRef.current) {
      alert("Webcam stream is not active. Make sure camera is enabled in settings.")
      return
    }
    
    chunksRef.current = []
    
    try {
      // Find supported container type
      let options = { mimeType: 'video/webm;codecs=vp9,opus' }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' }
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' }
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' }
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' } // default browser selection
      }

      const recorder = new MediaRecorder(streamRef.current, options)
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      recorder.onstop = () => {
        const fileType = chunksRef.current[0]?.type || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: fileType })
        const url = URL.createObjectURL(blob)
        
        // Compile download link
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        const extension = fileType.includes('mp4') ? 'mp4' : 'webm'
        a.download = `proprompter-recording-${timestamp}.${extension}`
        
        document.body.appendChild(a)
        a.click()
        
        // Revoke URL to free resources
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 100)
      }
      
      mediaRecorderRef.current = recorder
      recorder.start(1000) // retrieve chunks every second
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err)
      alert("Could not start MediaRecorder: " + err)
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  // --- Action Handlers ---
  const handleLaunchPrompter = () => {
    scrollOffsetRef.current = 0
    setTimeElapsed(0)
    setMode('prompter')
    setIsPlaying(false)
    
    if (countdownDuration > 0) {
      setCountdown(countdownDuration)
    } else {
      setIsPlaying(true)
    }
  }

  // Countdown timer loop
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setCountdown(null)
      setIsPlaying(true)
      return
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  const handleExitPrompter = () => {
    if (isRecording) {
      handleStopRecording()
    }
    setMode('setup')
    setIsPlaying(false)
    setCountdown(null)
    scrollOffsetRef.current = 0
    if (textContainerRef.current) {
      textContainerRef.current.style.transform = `translateY(0px)`
    }
  }

  const handleResetScroll = () => {
    scrollOffsetRef.current = 0
    if (textContainerRef.current) {
      const transformValue = isMirroredRef.current
        ? `translateY(0px) scaleX(-1)`
        : `translateY(0px)`
      textContainerRef.current.style.transform = transformValue
    }
    setIsPlaying(false)
    if (countdownDuration > 0) {
      setCountdown(countdownDuration)
    } else {
      setIsPlaying(true)
    }
  }

  const loadPreset = (presetContent: string) => {
    setScript(presetContent)
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen text-stone-800 flex flex-col font-sans transition-colors duration-300">
      
      {/* -------------------- SETUP MODE UI (COOL CREAM) -------------------- */}
      {mode === 'setup' && (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 lg:py-12 flex flex-col gap-8">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-stone-300 blur-md opacity-30 rounded-xl"></div>
                <div className="relative bg-white text-stone-800 p-2.5 rounded-xl border border-stone-200 shadow-sm">
                  <Play className="w-6 h-6 fill-stone-800" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-stone-800 m-0 flex items-center gap-2">
                  ProPrompter
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                    Recording Studio
                  </span>
                </h1>
                <p className="text-sm text-stone-500 mt-1 font-medium font-sans">100% Client-Side Teleprompter & Video Capture</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800 hover:border-stone-400 px-4 py-2.5 rounded-xl bg-white border border-stone-200 shadow-sm transition-all duration-200"
                id="btn-shortcuts"
              >
                <Keyboard className="w-4 h-4 text-stone-500" />
                Hotkeys
              </button>
              
              <button
                onClick={handleLaunchPrompter}
                className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                id="btn-launch-prompter"
              >
                <Maximize2 className="w-4 h-4 text-stone-200" />
                Launch Teleprompter
              </button>
            </div>
          </header>

          {/* Quick Presets Slider */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-stone-600 font-semibold text-sm">
              <Sparkles className="w-4.5 h-4.5 text-[#8c7853]" />
              <span>Select Script Preset</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => loadPreset(preset.content)}
                  className="flex flex-col text-left p-4.5 rounded-xl bg-white/80 border border-stone-200/60 hover:border-stone-400 hover:bg-white transition-all duration-200 shadow-sm group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-stone-100 rounded-bl-full translate-x-4 -translate-y-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all duration-200"></div>
                  <span className="font-bold text-stone-800 group-hover:text-[#8c7853] transition-colors duration-200 text-sm">
                    {preset.name}
                  </span>
                  <span className="text-xs text-stone-500 mt-1.5 line-clamp-1 font-medium">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Workspace Area: Script & Settings */}
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Column 1: Text Area Editor (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between text-sm text-stone-500 font-medium px-1">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#8c7853]" />
                  Script Editor
                </span>
                <span className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Est. Time: <strong className="text-stone-700 ml-0.5">{getEstimatedTime()}</strong>
                  </span>
                  <span>
                    Words: <strong className="text-stone-700">{getWordCount()}</strong>
                  </span>
                </span>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-[#8c7853]/10 rounded-2xl blur opacity-30 group-focus-within:opacity-60 transition duration-300"></div>
                <textarea
                  id="script-input"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste your presentation or recording script here..."
                  className="relative w-full h-[520px] p-6 rounded-2xl bg-white border border-stone-200 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 resize-none font-sans text-base leading-relaxed overflow-y-auto shadow-inner"
                />
              </div>
            </div>

            {/* Column 2: Controls Card (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              <div className="cream-glassmorphism p-6 rounded-2xl flex flex-col gap-6 animated-cream-border border shadow-md">
                <h2 className="text-lg font-extrabold text-stone-800 flex items-center gap-2 border-b border-stone-200/60 pb-3">
                  <Sliders className="w-5 h-5 text-[#8c7853]" />
                  Settings Panel
                </h2>

                {/* Speed Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600 font-semibold">Scroll Speed</span>
                    <span className="text-stone-800 font-bold">{scrollSpeed}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                    id="slider-speed"
                  />
                  <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                    <span>Slower</span>
                    <span>Faster</span>
                  </div>
                </div>

                {/* Font Size Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600 font-semibold">Font Size</span>
                    <span className="text-stone-800 font-bold">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    step="2"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                    id="slider-font-size"
                  />
                </div>

                {/* Line Height Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600 font-semibold">Line Height</span>
                    <span className="text-stone-800 font-bold">{lineHeight}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.5"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                    id="slider-line-height"
                  />
                </div>

                {/* Text Area Width Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600 font-semibold">Reading Width</span>
                    <span className="text-stone-800 font-bold">{textWidth}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={textWidth}
                    onChange={(e) => setTextWidth(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                    id="slider-width"
                  />
                  <div className="text-[10px] text-stone-500 font-medium italic">
                    Narrower text reduces horizontal eye movement.
                  </div>
                </div>

                {/* Background Overlay Opacity Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600 font-semibold">Overlay Darkness</span>
                    <span className="text-stone-800 font-bold">{overlayOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                    id="slider-opacity"
                  />
                </div>

                {/* Text Color Picker */}
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-stone-600 font-semibold">Text Color</span>
                  <div className="flex gap-3 mt-1">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setTextColor(color.value)}
                        className={`w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                          textColor === color.value ? 'border-stone-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Countdown Duration */}
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-stone-600 font-semibold">Start Countdown</span>
                  <select
                    value={countdownDuration}
                    onChange={(e) => setCountdownDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg bg-white border border-stone-200 focus:outline-none focus:border-stone-400 text-sm text-stone-700 shadow-sm"
                    id="select-countdown"
                  >
                    <option value="0">Immediate Start</option>
                    <option value="3">3 Seconds</option>
                    <option value="5">5 Seconds</option>
                    <option value="10">10 Seconds</option>
                  </select>
                </div>

                <div className="border-t border-stone-200/60 my-1"></div>

                {/* Toggle Controls */}
                <div className="flex flex-col gap-4">
                  {/* Camera Background Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group" id="label-camera-bg">
                    <span className="text-sm text-stone-600 font-semibold flex items-center gap-2 group-hover:text-stone-800 transition-colors duration-200">
                      <Video className="w-4 h-4 text-stone-500" />
                      Live Video Background
                    </span>
                    <input
                      type="checkbox"
                      checked={isCameraActive}
                      onChange={(e) => setIsCameraActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800 peer-checked:after:bg-white peer-checked:after:border-stone-800"></div>
                  </label>

                  {/* Mirror Video Toggle */}
                  {isCameraActive && (
                    <label className="flex items-center justify-between cursor-pointer group" id="label-mirror-video">
                      <span className="text-sm text-stone-600 font-semibold flex items-center gap-2 group-hover:text-stone-800 transition-colors duration-200">
                        <RefreshCw className="w-4 h-4 text-stone-500" />
                        Mirror Video (Reflection)
                      </span>
                      <input
                        type="checkbox"
                        checked={flipVideo}
                        onChange={(e) => setFlipVideo(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800 peer-checked:after:bg-white peer-checked:after:border-stone-800"></div>
                    </label>
                  )}

                  {/* Mirror Text Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group" id="label-mirror-text">
                    <span className="text-sm text-stone-600 font-semibold flex items-center gap-2 group-hover:text-stone-800 transition-colors duration-200">
                      <Type className="w-4 h-4 text-stone-500" />
                      Mirror Text (Glass Rig)
                    </span>
                    <input
                      type="checkbox"
                      checked={isMirrored}
                      onChange={(e) => setIsMirrored(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800 peer-checked:after:bg-white peer-checked:after:border-stone-800"></div>
                  </label>

                  {/* Reading Guide Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group" id="label-reading-guide">
                    <span className="text-sm text-stone-600 font-semibold flex items-center gap-2 group-hover:text-stone-800 transition-colors duration-200">
                      <Eye className="w-4 h-4 text-stone-500" />
                      Eye-Line Reading Bar
                    </span>
                    <input
                      type="checkbox"
                      checked={showReadingGuide}
                      onChange={(e) => setShowReadingGuide(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800 peer-checked:after:bg-white peer-checked:after:border-stone-800"></div>
                  </label>
                </div>

              </div>

              {/* Tips Container */}
              <div className="cream-glassmorphism-light p-5 rounded-2xl border border-stone-200/50 flex gap-3 text-xs text-stone-600">
                <HelpCircle className="w-5 h-5 text-[#8c7853] shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1.5 font-medium font-sans">
                  <span className="font-bold text-stone-800">Video Capture Built-in</span>
                  <span>Click record in teleprompter mode. ProPrompter records your webcam directly, omitting the overlay.</span>
                </div>
              </div>

            </div>

          </main>
        </div>
      )}

      {/* -------------------- TELEPROMPTER MODE UI (DARK VIEW W/ CAMERA BACKGROUND) -------------------- */}
      {mode === 'prompter' && (
        <div className="relative w-full h-screen overflow-hidden bg-black select-none">
          
          {/* CAMERA FEED BACKGROUND */}
          {isCameraActive ? (
            <div className="absolute inset-0 z-0 bg-black">
              {isCameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 text-stone-400">
                  <div className="w-8 h-8 border-4 border-stone-700 border-t-white rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold tracking-wider uppercase font-sans">Loading feed...</span>
                </div>
              )}
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3 z-10 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-600" />
                  <span className="text-sm text-stone-300 font-semibold">{cameraError}</span>
                  <button
                    onClick={() => {
                      setIsCameraActive(false)
                      setCameraError(null)
                    }}
                    className="mt-2 text-xs font-bold px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-200 transition duration-200"
                  >
                    Use Dark Background
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: flipVideo ? 'scaleX(-1)' : 'scaleX(1)'
                  }}
                />
              )}
            </div>
          ) : (
            // Solid dark background fallback
            <div className="absolute inset-0 z-0 bg-[#0c0c0e]"></div>
          )}

          {/* BACKDROP OVERLAY FILTER */}
          <div
            className="absolute inset-0 z-10 pointer-events-none bg-black transition-opacity duration-300"
            style={{ opacity: overlayOpacity / 100 }}
          />

          {/* STRICT TOP-EDGE POSITIONED VIEWPORT (Locked h-[40vh], overflow-hidden, z-20) */}
          <div className="fixed top-0 left-0 right-0 h-[40vh] overflow-hidden z-20 pointer-events-none">
            
            {/* GRADIENT TEXT MASKING FADE WRAPPER (Pointer events allowed inside, aligned top-start) */}
            <div
              ref={textWrapperRef}
              className="absolute inset-0 overflow-hidden flex justify-center items-start pointer-events-auto"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)'
              }}
            >
              {/* Scrolling text container (padding-top aligned to Guide line, padding-bottom 36vh) */}
              <div
                ref={textContainerRef}
                className="w-full px-6 flex flex-col will-change-transform"
                style={{
                  maxWidth: `${textWidth}%`,
                  paddingTop: '4vh', // matches 10% height of 40vh (which is 4vh)
                  paddingBottom: '36vh', // allows the script to scroll completely past the 4vh line
                  transform: isMirrored ? 'scaleX(-1)' : 'none'
                }}
              >
                <div
                  ref={textContentRef}
                  className="font-bold whitespace-pre-wrap text-center select-none"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: lineHeight,
                    color: textColor,
                    textShadow: `2px 2px 4px rgba(0,0,0,0.95), -2px -2px 4px rgba(0,0,0,0.95), 2px -2px 4px rgba(0,0,0,0.95), -2px 2px 4px rgba(0,0,0,0.95), 0px 4px 12px rgba(0,0,0,0.9)`
                  }}
                >
                  {script}
                </div>
              </div>
            </div>

            {/* EYE-LINE READING GUIDE BAR (Locked absolutely at 10% height of 40vh = 4vh) */}
            {showReadingGuide && (
              <div className="absolute top-[10%] -translate-y-1/2 left-0 w-full h-[60px] z-25 border-y border-stone-400/20 bg-stone-500/5 flex items-center justify-between">
                <div className="text-indicator-stone absolute left-[15px] lg:left-[5%] pointer-events-none hidden md:block"></div>
                <div className="text-indicator-stone absolute right-[15px] lg:right-[5%] pointer-events-none hidden md:block"></div>
              </div>
            )}

          </div>

          {/* COUNTDOWN START OVERLAY */}
          {countdown !== null && (
            <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-4">
                <span className="text-9xl font-black text-[#fffdd0] tracking-tight">
                  {countdown}
                </span>
                <span className="text-sm tracking-widest text-stone-400 font-bold uppercase font-sans">
                  Ready to record
                </span>
              </div>
            </div>
          )}

          {/* FLOATING ACTION CONTROL BAR (Hover / Motion Activated) */}
          <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 w-[95%] max-w-3xl px-6 py-4 rounded-2xl border border-stone-800 bg-[#121214]/95 backdrop-blur-md shadow-[0_12px_45px_rgba(0,0,0,0.85)] flex flex-wrap items-center justify-between gap-4 ${
              showControlOverlay ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}
          >
            {/* Controls panel: Play, Reset, and Start/Stop Recording */}
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={() => setIsPlaying(prev => !prev)}
                className={`p-3 rounded-xl transition-all duration-200 border ${
                  isPlaying
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-stone-500/10 text-stone-200 border-stone-700 hover:bg-stone-500/20'
                }`}
                title="Play / Pause (Spacebar)"
                id="btn-play-pause"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-amber-500" /> : <Play className="w-5 h-5 fill-stone-200" />}
              </button>

              {/* Reset scroll */}
              <button
                onClick={handleResetScroll}
                className="p-3 rounded-xl bg-stone-500/10 border border-stone-700 text-stone-200 hover:bg-stone-500/20 transition-all duration-200"
                title="Reset Script (R)"
                id="btn-reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* VIDEO RECORDING SWITCH */}
              {isCameraActive && !cameraError && (
                <div className="flex items-center gap-2 ml-1">
                  {isRecording ? (
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 bg-rose-500/20 text-rose-400 border border-rose-500/40 px-4 py-2.5 rounded-xl hover:bg-rose-500/30 active:scale-[0.98] transition-all duration-150"
                      id="btn-stop-recording"
                    >
                      <Circle className="w-4.5 h-4.5 fill-rose-400 animate-pulse text-rose-400" />
                      <span className="text-xs font-extrabold font-sans">STOP REC ({formatTimer(recordingTime)})</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartRecording}
                      className="flex items-center gap-2 bg-stone-500/10 hover:bg-rose-500/10 text-stone-300 hover:text-rose-400 border border-stone-700 hover:border-rose-500/35 px-4 py-2.5 rounded-xl active:scale-[0.98] transition-all duration-150"
                      id="btn-start-recording"
                    >
                      <Circle className="w-4.5 h-4.5 fill-stone-400 text-stone-400 hover:fill-rose-500 hover:text-rose-500" />
                      <span className="text-xs font-bold font-sans">RECORD VIDEO</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reading Timer and Stats Info */}
            <div className="flex items-center gap-4 text-xs font-bold bg-black/60 px-4 py-2.5 rounded-xl border border-stone-800/80 text-stone-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#fffdd0] animate-pulse"></span>
                <span>{formatTimer(timeElapsed)}</span>
              </div>
              <div className="w-px h-4 bg-stone-800"></div>
              <div>Speed: {scrollSpeed}</div>
              <div className="w-px h-4 bg-stone-800"></div>
              <div>Font: {fontSize}px</div>
            </div>

            {/* In-prompt quick speed adjustments */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScrollSpeed(prev => Math.max(prev - 1, 1))}
                className="px-3 py-2 text-[10px] font-extrabold bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 rounded-lg"
                title="Slower (Arrow Down)"
              >
                Speed -
              </button>
              <button
                onClick={() => setScrollSpeed(prev => Math.min(prev + 1, 20))}
                className="px-3 py-2 text-[10px] font-extrabold bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 rounded-lg"
                title="Faster (Arrow Up)"
              >
                Speed +
              </button>
              
              <div className="w-px h-5 bg-stone-800 mx-1"></div>

              {/* Close/Exit */}
              <button
                onClick={handleExitPrompter}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 rounded-xl transition-all duration-200"
                title="Exit to Setup (Escape)"
                id="btn-close-prompter"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Distraction-free Help Text overlay */}
          {!isPlaying && countdown === null && (
            <div className="absolute top-6 left-6 z-10 pointer-events-none text-[10px] text-stone-400 bg-black/65 px-4 py-2.5 rounded-xl border border-stone-800 backdrop-blur-md">
              <span className="font-bold text-stone-200 block mb-1">Controls:</span>
              Space: Play/Pause | Esc: Exit | Arrows: Speed/Size | R: Reset
            </div>
          )}
        </div>
      )}

      {/* -------------------- HOTKEYS HELP MODAL (SETUP VIEW) -------------------- */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-stone-800 flex items-center gap-2 mb-3">
              <Keyboard className="w-6 h-6 text-[#8c7853]" />
              Hotkeys Help
            </h3>
            <p className="text-sm text-stone-500 mb-6 font-medium font-sans">
              Control scroll and styling in prompter mode using standard keyboard triggers.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-700 font-medium font-sans">Play / Pause scrolling</span>
                <kbd className="px-2.5 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">Spacebar</kbd>
              </div>
              
              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-700 font-medium font-sans">Exit and return to Setup</span>
                <kbd className="px-2.5 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">Escape</kbd>
              </div>

              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-700 font-medium font-sans">Increase / Decrease speed</span>
                <div className="flex gap-1.5">
                  <kbd className="px-2 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">↑</kbd>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">↓</kbd>
                </div>
              </div>

              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-700 font-medium font-sans">Increase / Decrease font size</span>
                <div className="flex gap-1.5">
                  <kbd className="px-2 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">→</kbd>
                  <kbd className="px-2 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">←</kbd>
                </div>
              </div>

              <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-700 font-medium font-sans">Reset scroll position</span>
                <kbd className="px-2.5 py-1 text-xs font-mono bg-white rounded-md text-stone-800 border border-stone-200 shadow-sm">R</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full mt-6 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-white font-bold py-2.5 rounded-xl transition-all duration-200 shadow-sm"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {mode === 'setup' && (
        <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs text-stone-400 border-t border-stone-200 font-medium mt-auto font-sans">
          <span>ProPrompter &bull; Cool Cream Theme &bull; Built-in Video Recorder &bull; 100% Client-Side.</span>
        </footer>
      )}
    </div>
  )
}
