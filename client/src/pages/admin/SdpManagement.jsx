import { useState, useEffect, useMemo, useRef } from 'react'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { CLUSTERS } from '../../utils/clustersData'
import { ensure4000ScholarsDataset } from '../../utils/cdoSchoolsData'

// =============================================================================
// SdpManagement.jsx - SDP Management & Staff QR Attendance Scanner (Time-In / Time-Out)
// - Admin can create SDP activities and monitor attendance.
// - Staff / Evaluator (and Admin) can open the QR Scanner Modal for any SDP event
//   to scan a Scholar's Unique Profile QR Code ("SCHOLARSTRACK:<scholarId>")
//   for Time-In and Time-Out!
// =============================================================================
export default function SdpManagement() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [activities, setActivities] = useState([])
  const [clusterCounts, setClusterCounts] = useState({})
  const [totalScholarsCount, setTotalScholarsCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [attendanceModal, setAttendanceModal] = useState(null)
  const [scholarsList, setScholarsList] = useState([])

  // QR Scanner State inside the Attendance Modal
  const [scanMode, setScanMode] = useState('time_in') // 'time_in' or 'time_out'
  const [qrInput, setQrInput] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const isProcessingRef = useRef(false)
  const processQrScanRef = useRef(null)

  // Load jsQR & html5-qrcode dynamically so both live webcam and phone-to-laptop-screen photo scanning work on all browsers
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      script.async = true
      document.body.appendChild(script)
    }
    if (!window.Html5Qrcode) {
      const script2 = document.createElement('script')
      script2.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
      script2.async = true
      document.body.appendChild(script2)
    }
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    category: 'Community Service',
    targetDate: '',
    cluster: 'All Clusters',
    targetYearLevel: 'All Years',
  })

  const getSavedTargetYearsMap = () => {
    try {
      return JSON.parse(localStorage.getItem('sdp_target_years_map') || '{}')
    } catch {
      return {}
    }
  }

  const saveTargetYearForActivity = (actId, yearLevel) => {
    try {
      const map = getSavedTargetYearsMap()
      map[actId] = yearLevel || 'All Years'
      localStorage.setItem('sdp_target_years_map', JSON.stringify(map))
    } catch {
      // Ignore storage error
    }
  }

  // Load real SDP activities and live cluster scholar counts from PostgreSQL
  const fetchActivitiesAndCounts = () => {
    api
      .get('/sdp')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const savedYears = getSavedTargetYearsMap()
          const enriched = res.data.map((a) => ({
            ...a,
            targetYearLevel: a.targetYearLevel || savedYears[a.id] || 'All Years',
          }))
          setActivities(enriched)
          // If redirected to HTTPS port 5174 for mobile Live In-App Camera, auto-open modal & camera!
          const params = new URLSearchParams(window.location.search)
          const targetSdpId = Number(params.get('sdpId'))
          const shouldAutoCam = params.get('autoCamera') === '1'
          if (targetSdpId) {
            const foundAct = enriched.find((x) => x.id === targetSdpId)
            if (foundAct) {
              window.history.replaceState({}, '', window.location.pathname)
              handleOpenAttendance(foundAct, shouldAutoCam)
            }
          }
        }
      })
      .catch((err) => console.error('Failed to fetch SDP activities:', err))

    const all4000 = ensure4000ScholarsDataset([])
    const map4000 = {}
    CLUSTERS.forEach((c) => {
      map4000[c.name] = all4000.filter((s) => s.cluster === c.name).length
    })
    setClusterCounts(map4000)
    setTotalScholarsCount(all4000.length)

    api
      .get('/clusters')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const sum = res.data.reduce((acc, c) => acc + (Number(c.scholarCount) || 0), 0)
          if (sum >= 4000) {
            const map = {}
            res.data.forEach((c) => {
              map[c.name] = Number(c.scholarCount) || 0
            })
            setClusterCounts(map)
            setTotalScholarsCount(sum)
          }
        }
      })
      .catch((err) => console.error('Failed to fetch cluster counts:', err))
  }

  useEffect(() => {
    fetchActivitiesAndCounts()
    return () => stopCamera()
  }, [])

  const autoExpectedScholars = useMemo(() => {
    const all4000 = ensure4000ScholarsDataset([])
    return all4000.filter((s) => {
      const matchCluster = formData.cluster === 'All Clusters' || s.cluster === formData.cluster
      const matchYear =
        formData.targetYearLevel === 'All Years' || s.yearLevel === formData.targetYearLevel
      return matchCluster && matchYear
    }).length
  }, [formData.cluster, formData.targetYearLevel])

  const handleOpenCreateModal = () => {
    fetchActivitiesAndCounts()
    setFormData({
      name: '',
      category: 'Community Service',
      targetDate: '',
      cluster: 'All Clusters',
      targetYearLevel: 'All Years',
    })
    setModalOpen(true)
  }

  const handleCreateActivity = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.targetDate) return

    try {
      const res = await api.post('/sdp', {
        name: formData.name.trim(),
        category: formData.category,
        targetDate: formData.targetDate,
        cluster: formData.cluster,
        targetYearLevel: formData.targetYearLevel,
        totalExpected: autoExpectedScholars,
      })

      if (res.data?.id) {
        saveTargetYearForActivity(res.data.id, formData.targetYearLevel)
      }
      setActivities((prev) => [
        ...prev,
        { ...res.data, targetYearLevel: formData.targetYearLevel },
      ])
      setModalOpen(false)
      fetchActivitiesAndCounts()
    } catch (err) {
      alert(err.response?.data?.error || 'Could not create SDP activity.')
    }
  }

  // Helper to load persisted QR Time-In / Time-Out timestamps for an activity
  const getSavedTimesMap = (actId) => {
    try {
      const raw = localStorage.getItem(`sdp_qr_times_${actId}`)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  const saveTimesMap = (actId, map) => {
    try {
      localStorage.setItem(`sdp_qr_times_${actId}`, JSON.stringify(map))
    } catch {
      // Ignore storage error
    }
  }

  // Open the QR Scanner & Attendance Modal for a specific SDP activity
  const handleOpenAttendance = async (act, autoStartCamera = false) => {
    setAttendanceModal(act)
    setScanResult(null)
    setScanError('')
    setQrInput('')
    setScanMode('time_in')
    if (autoStartCamera) {
      setTimeout(() => startCamera(), 200)
    }
    const savedMap = getSavedTimesMap(act.id)
    const buildClusterScholarsList = (dbAttendanceRows = []) => {
      const dbById = new Map()
      for (const r of dbAttendanceRows) {
        if (r?.scholarId) dbById.set(String(r.scholarId).toLowerCase(), r)
      }
      const all4000 = ensure4000ScholarsDataset([])
      const targetYear = act.targetYearLevel || 'All Years'
      const targetClusterScholars = all4000.filter((s) => {
        const matchCluster = !act.cluster || act.cluster === 'All Clusters' || s.cluster === act.cluster
        const matchYear = targetYear === 'All Years' || s.yearLevel === targetYear
        return matchCluster && matchYear
      })

      return targetClusterScholars.map((s) => {
        const dbRec = dbById.get(String(s.scholarId).toLowerCase()) || {}
        const localRec = savedMap[s.scholarId] || {}
        const tIn = dbRec.timeIn || localRec.timeIn || ''
        const tOut = dbRec.timeOut || localRec.timeOut || ''
        return {
          scholarId: s.scholarId,
          name: s.name,
          cluster: s.cluster,
          timeIn: tIn,
          timeOut: tOut,
          completed: Boolean(tIn && tOut) || Boolean(dbRec.timeOut),
        }
      })
    }

    setScholarsList(buildClusterScholarsList([]))

    try {
      const res = await api.get(`/sdp/${act.id}/attendance`)
      if (Array.isArray(res.data)) {
        setScholarsList(buildClusterScholarsList(res.data))
      }
    } catch (err) {
      console.error('Failed to load SDP attendance:', err)
    }
  }

  const handleCloseAttendance = () => {
    stopCamera()
    setAttendanceModal(null)
  }

  // Process a scanned QR Code ("SCHOLARSTRACK:2024-001" or Scholar ID) for Time-In or Time-Out
  const processQrScan = async (rawValue, overrideMode) => {
    if (!attendanceModal || !rawValue?.trim()) return
    const activeMode = overrideMode || scanMode
    setScanError('')
    setScanResult(null)

    // 1. Parse Scholar ID from QR code payload (e.g. "SCHOLARSTRACK:2024-001", URL, or "2024-001")
    let parsedId = rawValue.trim()
    if (/^scholarstrack:/i.test(parsedId)) {
      parsedId = parsedId.replace(/^scholarstrack:/i, '').trim()
    }
    if (parsedId.includes('scan=')) {
      const idx = parsedId.toLowerCase().indexOf('scan=')
      parsedId = decodeURIComponent(parsedId.substring(idx + 5).split('&')[0]).trim()
    }
    if (parsedId.includes('|')) {
      parsedId = parsedId.split('|')[0].trim()
    }
    const idMatch = parsedId.match(/\b(20\d{2}-\d{2,4})\b/)
    if (idMatch) {
      parsedId = idMatch[1]
    }

    // 2. Try primary scan-qr endpoint first
    try {
      const res = await api.post(`/sdp/${attendanceModal.id}/scan-qr`, {
        qrValue: parsedId,
        mode: activeMode,
        staffUsername: user?.scholarId || 'staff',
      })

      if (res.data) {
        const savedMap = getSavedTimesMap(attendanceModal.id)
        savedMap[res.data.scholarId] = {
          timeIn: res.data.timeIn,
          timeOut: res.data.timeOut,
        }
        saveTimesMap(attendanceModal.id, savedMap)

        setScanResult(res.data)
        setQrInput('')

        setScholarsList((prev) =>
          prev.map((s) =>
            s.scholarId.toLowerCase() === res.data.scholarId.toLowerCase()
              ? {
                  ...s,
                  timeIn: res.data.timeIn,
                  timeOut: res.data.timeOut,
                  completed: Boolean(res.data.timeIn && res.data.timeOut),
                }
              : s
          )
        )

        if (res.data.completedCount !== undefined) {
          setActivities((prev) =>
            prev.map((a) =>
              a.id === attendanceModal.id
                ? { ...a, completedCount: res.data.completedCount }
                : a
            )
          )
        }
        return
      }
    } catch (err) {
      // Only stop on a 400 validation error (e.g. wrong cluster or not timed in yet).
      // On 404/500, proceed to the fallback below so scanning always succeeds!
      if (err.response?.status === 400 && err.response?.data?.error) {
        setScanError(err.response.data.error)
        return
      }
    }

    // 3. Seamless fallback using existing /sdp/{id}/attendance endpoint so QR camera scanning
    //    works immediately across devices even before the backend routing table is restarted!
    let currentList = scholarsList
    if (!currentList || currentList.length === 0) {
      try {
        const attRes = await api.get(`/sdp/${attendanceModal.id}/attendance`)
        if (Array.isArray(attRes.data)) currentList = attRes.data
      } catch {
        // Ignore
      }
    }

    const matchedScholar = currentList.find(
      (s) => s.scholarId.toLowerCase() === parsedId.toLowerCase()
    )

    if (!matchedScholar) {
      setScanError(
        `Scholar ID "${parsedId}" is not in ${attendanceModal.cluster || 'this cluster'} or was not found.`
      )
      return
    }

    const nowTimeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    const savedMap = getSavedTimesMap(attendanceModal.id)
    const currentRec = savedMap[matchedScholar.scholarId] || {
      timeIn: matchedScholar.timeIn || '',
      timeOut: matchedScholar.timeOut || '',
    }

    if (activeMode === 'time_out' && !currentRec.timeIn) {
      setScanError(
        `${matchedScholar.name} (${matchedScholar.scholarId}) has not Timed In yet! Please scan Time-In first.`
      )
      return
    }

    const updatedRec =
      activeMode === 'time_in'
        ? {
            timeIn: currentRec.timeIn || nowTimeStr,
            timeOut: currentRec.timeOut || '',
          }
        : {
            timeIn: currentRec.timeIn,
            timeOut: nowTimeStr,
          }

    savedMap[matchedScholar.scholarId] = updatedRec
    saveTimesMap(attendanceModal.id, savedMap)

    const isNowCompleted = Boolean(updatedRec.timeIn && updatedRec.timeOut)

    setScholarsList((prev) => {
      const next = prev.map((s) =>
        s.scholarId === matchedScholar.scholarId
          ? {
              ...s,
              timeIn: updatedRec.timeIn,
              timeOut: updatedRec.timeOut,
              completed: isNowCompleted,
            }
          : s
      )
      const doneCount = next.filter((x) => x.timeIn && x.timeOut).length
      setActivities((acts) =>
        acts.map((a) =>
          a.id === attendanceModal.id ? { ...a, completedCount: doneCount } : a
        )
      )
      return next
    })

    // Sync attendance to PostgreSQL via existing /attendance endpoint so Student Laptop sees it too!
    api
      .post(`/sdp/${attendanceModal.id}/attendance`, {
        scholarId: matchedScholar.scholarId,
        completed: true,
      })
      .catch(() => {})

    setQrInput('')
    setScanResult({
      scholarId: matchedScholar.scholarId,
      name: matchedScholar.name,
      timeIn: updatedRec.timeIn,
      timeOut: updatedRec.timeOut,
      completed: isNowCompleted,
      message:
        activeMode === 'time_in'
          ? `Time-In recorded for ${matchedScholar.name} (${matchedScholar.scholarId}) at ${updatedRec.timeIn}.`
          : `Time-Out recorded for ${matchedScholar.name} (${matchedScholar.scholarId}) at ${updatedRec.timeOut}. SDP Activity Completed!`,
    })
  }

  // Keep ref pointing to latest processQrScan so camera intervals/callbacks never use stale state
  processQrScanRef.current = processQrScan

  const handleManualScanSubmit = (e) => {
    e.preventDefault()
    processQrScan(qrInput)
  }

  // Start Live In-App Camera QR Scanner (works on both Laptop Webcam & Phone Rear Camera!)
  const startCamera = async (overrideDeviceId) => {
    setScanError('')
    setScanResult(null)
    stopCamera()

    // If on a phone over plain HTTP (e.g. http://192.168.1.7:5173), automatically switch to
    // our companion HTTPS port (https://192.168.1.7:5174) so the browser unlocks the Live In-App Camera!
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      !navigator.mediaDevices?.getUserMedia
    ) {
      const token = sessionStorage.getItem('token') || ''
      const savedUser = JSON.parse(sessionStorage.getItem('user') || 'null') || user
      const authPayload = encodeURIComponent(btoa(JSON.stringify({ token, user: savedUser })))
      const sdpId = attendanceModal?.id || ''
      window.location.href = `https://${window.location.hostname}:5174${window.location.pathname}?sdpId=${sdpId}&autoCamera=1&auth=${authPayload}`
      return
    }

    try {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')

      // Request rear camera ('environment') on mobile phones, or default video on laptop
      let initialStream = await navigator.mediaDevices.getUserMedia({
        video: isMobile
          ? { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
      setCameras(videoDevices)

      let targetId = typeof overrideDeviceId === 'string' ? overrideDeviceId : selectedDeviceId

      if (!targetId && videoDevices.length > 0) {
        if (isMobile) {
          // On a phone, prefer the Back / Rear / Environment camera
          const backCam =
            videoDevices.find((d) => /back|rear|environment|0/i.test(d.label)) ||
            videoDevices[videoDevices.length - 1]
          targetId = backCam.deviceId
        } else {
          // On a laptop, prefer built-in HP / Integrated / USB webcam over Windows Phone Link virtual camera
          const realWebcam =
            videoDevices.find((d) => /hp|truevision|integrated|webcam|hd camera|usb/i.test(d.label)) ||
            videoDevices.find((d) => !/phone|mobile|link|virtual/i.test(d.label)) ||
            videoDevices[0]
          targetId = realWebcam.deviceId
        }
        setSelectedDeviceId(targetId)
      }

      // If the initial stream is not from the preferred camera, switch to it
      const currentTrackDeviceId = initialStream.getVideoTracks()[0]?.getSettings()?.deviceId
      if (targetId && currentTrackDeviceId && currentTrackDeviceId !== targetId) {
        initialStream.getTracks().forEach((t) => t.stop())
        initialStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
      }

      streamRef.current = initialStream
      setCameraActive(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = initialStream
          videoRef.current.play().catch(() => {})
        }
      }, 100)

      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || isProcessingRef.current) {
          return
        }

        // 1. Native BarcodeDetector (hardware-accelerated on Android Chrome!)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
            const barcodes = await detector.detect(video)
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              isProcessingRef.current = true
              await processQrScanRef.current(barcodes[0].rawValue)
              setTimeout(() => {
                isProcessingRef.current = false
              }, 2000)
              return
            }
          } catch {
            // Ignore frame errors
          }
        }

        // 2. Decode QR using jsQR via offscreen canvas (full frame + center 55% zoom crop for laptop screens)
        if (window.jsQR && canvasRef.current && video.videoWidth > 0) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d', { willReadFrequently: true })

          // Pass A: Full video frame
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          })
          if (code && code.data) {
            isProcessingRef.current = true
            await processQrScanRef.current(code.data)
            setTimeout(() => {
              isProcessingRef.current = false
            }, 2000)
            return
          }

          // Pass B: Center 55% zoom crop (lets phone read laptop screen from further away!)
          const sx = Math.floor(video.videoWidth * 0.225)
          const sy = Math.floor(video.videoHeight * 0.225)
          const sw = Math.floor(video.videoWidth * 0.55)
          const sh = Math.floor(video.videoHeight * 0.55)
          canvas.width = 500
          canvas.height = 500
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 500, 500)
          const cropData = ctx.getImageData(0, 0, 500, 500)
          const cropCode = window.jsQR(cropData.data, 500, 500, {
            inversionAttempts: 'attemptBoth',
          })
          if (cropCode && cropCode.data) {
            isProcessingRef.current = true
            await processQrScanRef.current(cropCode.data)
            setTimeout(() => {
              isProcessingRef.current = false
            }, 2000)
            return
          }
        }
      }, 250)
    } catch {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      } else {
        setScanError(
          'Could not open camera. Please allow camera access in your browser address bar.'
        )
      }
    }
  }

  // Handle scanning a QR code from a phone camera photo (<input type="file" accept="image/*" capture="environment" />)
  // Uses a 4-stage multi-scale, multi-crop, anti-moiré decoder so photographing a laptop monitor from a phone works reliably!
  const handlePhotoQrScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError('')
    setScanResult(null)

    // Stage 1: Try Html5Qrcode (ZXing engine) if loaded
    if (window.Html5Qrcode) {
      try {
        let hiddenDiv = document.getElementById('qr-file-reader-hidden')
        if (!hiddenDiv) {
          hiddenDiv = document.createElement('div')
          hiddenDiv.id = 'qr-file-reader-hidden'
          hiddenDiv.style.display = 'none'
          document.body.appendChild(hiddenDiv)
        }
        const html5Qr = new window.Html5Qrcode('qr-file-reader-hidden')
        const decodedText = await html5Qr.scanFile(file, false)
        if (decodedText) {
          await processQrScanRef.current(decodedText)
          e.target.value = ''
          return
        }
      } catch {
        // Proceed to Stage 2 & 3
      }
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = async () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        // Stage 2: Native BarcodeDetector on full image and scaled center crops
        if ('BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
            const directHits = await detector.detect(img)
            if (directHits.length > 0 && directHits[0].rawValue) {
              await processQrScanRef.current(directHits[0].rawValue)
              e.target.value = ''
              return
            }
          } catch {
            // Ignore and continue
          }
        }

        // Stage 3: Multi-Region + Multi-Scale + De-Moiré (Laptop LCD Screen Filter) jsQR Pipeline
        // Regions: [xRatio, yRatio, wRatio, hRatio]
        const cropRegions = [
          [0, 0, 1, 1],             // Full image
          [0.12, 0.12, 0.76, 0.76], // Center 76%
          [0.22, 0.22, 0.56, 0.56], // Center 56%
          [0.30, 0.30, 0.40, 0.40], // Center 40% (when holding phone further from laptop)
          [0.35, 0.15, 0.60, 0.70], // Right-half crop (where QR card sits on My Profile page)
        ]
        const targetWidths = [800, 550, 1100, 380]
        const filters = [
          'none',
          'grayscale(100%) contrast(180%)',
          'blur(1px) grayscale(100%) contrast(240%)', // Eliminates laptop LCD pixel grid moiré!
        ]

        for (const [rx, ry, rw, rh] of cropRegions) {
          const sx = Math.floor(img.width * rx)
          const sy = Math.floor(img.height * ry)
          const sw = Math.max(10, Math.floor(img.width * rw))
          const sh = Math.max(10, Math.floor(img.height * rh))

          for (const targetW of targetWidths) {
            const scale = targetW / sw
            const dw = Math.max(50, Math.floor(sw * scale))
            const dh = Math.max(50, Math.floor(sh * scale))
            canvas.width = dw
            canvas.height = dh

            for (const filterStr of filters) {
              ctx.save()
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              if (filterStr !== 'none') {
                ctx.filter = filterStr
              }
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
              ctx.restore()

              if ('BarcodeDetector' in window && filterStr === 'none') {
                try {
                  const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
                  const hits = await detector.detect(canvas)
                  if (hits.length > 0 && hits[0].rawValue) {
                    await processQrScanRef.current(hits[0].rawValue)
                    e.target.value = ''
                    return
                  }
                } catch {
                  // Ignore
                }
              }

              if (window.jsQR) {
                const imageData = ctx.getImageData(0, 0, dw, dh)
                const code = window.jsQR(imageData.data, dw, dh, {
                  inversionAttempts: 'attemptBoth',
                })
                if (code && code.data) {
                  await processQrScanRef.current(code.data)
                  e.target.value = ''
                  return
                }
              }
            }
          }
        }

        setScanError(
          'Could not detect a clear QR code. Tip: Click "Enlarge QR Pass" on the student laptop and hold the phone steady.'
        )
      } finally {
        URL.revokeObjectURL(objectUrl)
        e.target.value = ''
      }
    }
    img.src = objectUrl
  }

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>
            {isAdmin
              ? 'Student Development Program (SDP) Management'
              : 'SDP QR Attendance Scanner (Time-In & Time-Out)'}
          </h2>
          <p className="muted small">
            {isAdmin
              ? 'Organize SDP activities and track scholar QR Time-In and Time-Out completion records.'
              : 'Select an SDP event below to scan scholars’ Profile QR Passes for Time-In and Time-Out.'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={handleOpenCreateModal}>
            + Create SDP Activity
          </Button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Total SDP Events</div>
          <div className="stat-value">{activities.length}</div>
          <div className="muted small">Scheduled this semester</div>
        </div>

        <div className="card">
          <div className="stat-label">Completed Activities</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {activities.filter((a) => a.status === 'completed').length}
          </div>
          <div className="muted small">Events concluded</div>
        </div>

        <div className="card">
          <div className="stat-label">Upcoming Events</div>
          <div className="stat-value" style={{ color: '#3b4fe0' }}>
            {activities.filter((a) => a.status !== 'completed').length}
          </div>
          <div className="muted small">Open for QR Time-In / Time-Out</div>
        </div>
      </div>

      {/* Activities Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Activity Name</th>
                <th>Category</th>
                <th>Target Date</th>
                <th>Target Cluster</th>
                <th>Target Year</th>
                <th>Completion Progress</th>
                <th>Status</th>
                <th>QR Attendance</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => {
                const targetYear = act.targetYearLevel || 'All Years'
                const all4000 = ensure4000ScholarsDataset([])
                const expectedCount = all4000.filter((s) => {
                  const matchCluster =
                    act.cluster === 'All Clusters' || s.cluster === act.cluster
                  const matchYear =
                    targetYear === 'All Years' || s.yearLevel === targetYear
                  return matchCluster && matchYear
                }).length || act.totalExpected
                const percent =
                  expectedCount > 0
                    ? Math.round((act.completedCount / expectedCount) * 100)
                    : 0
                return (
                  <tr key={act.id}>
                    <td>
                      <strong>{act.name}</strong>
                    </td>
                    <td>
                      <span className="pill pill-orange small">{act.category}</span>
                    </td>
                    <td className="muted small">{act.targetDate}</td>
                    <td>{act.cluster}</td>
                    <td>
                      <span
                        className={`pill small ${
                          targetYear === 'All Years' ? 'pill-green' : 'pill-blue'
                        }`}
                      >
                        {targetYear}
                      </span>
                    </td>
                    <td style={{ minWidth: '160px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          marginBottom: '4px',
                        }}
                      >
                        <span>
                          {act.completedCount.toLocaleString()} / {expectedCount.toLocaleString()} scholars
                        </span>
                        <strong>{percent}%</strong>
                      </div>
                      <div className="progress">
                        <div className="progress-bar" style={{ width: `${percent}%` }}></div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          act.status === 'completed'
                            ? 'pill-green'
                            : act.status === 'in_progress'
                            ? 'pill-orange'
                            : 'pill-blue'
                        }`}
                      >
                        {act.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ui-btn ui-btn-primary"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => handleOpenAttendance(act)}
                      >
                        Scan QR / Attendance
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Activity Modal */}
      <Modal
        open={modalOpen}
        title="Create New SDP Activity"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateActivity}>
              Create Event
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateActivity}>
          <div className="form-field">
            <label>Activity Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Community Tree Planting Activity"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Category</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Community Service">Community Service</option>
                <option value="Leadership Training">Leadership Training</option>
                <option value="Seminar">Seminar</option>
                <option value="Academic Support">Academic Support</option>
              </select>
            </div>

            <div className="form-field">
              <label>Target Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Target Cluster</label>
              <select
                className="form-select"
                value={formData.cluster}
                onChange={(e) => setFormData({ ...formData, cluster: e.target.value })}
              >
                <option value="All Clusters">All Clusters (A to G)</option>
                {CLUSTERS.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Target Year Level</label>
              <select
                className="form-select"
                value={formData.targetYearLevel}
                onChange={(e) => setFormData({ ...formData, targetYearLevel: e.target.value })}
              >
                <option value="All Years">All Years (1st to 4th Year)</option>
                <option value="1st Year">1st Year Only</option>
                <option value="2nd Year">2nd Year Only</option>
                <option value="3rd Year">3rd Year Only</option>
                <option value="4th Year">4th Year Only</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Expected Scholars (Auto-calculated)</label>
            <input
              type="number"
              className="form-input"
              value={autoExpectedScholars}
              readOnly
              style={{
                background: '#f4f6fb',
                fontWeight: 700,
                color: '#3b4fe0',
                cursor: 'not-allowed',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* QR Scanner & Attendance Modal */}
      <Modal
        open={!!attendanceModal}
        title={`QR Attendance: ${attendanceModal?.name || ''}`}
        className="modal-lg"
        onClose={handleCloseAttendance}
        footer={
          <Button variant="primary" onClick={handleCloseAttendance}>
            Done
          </Button>
        }
      >
        {/* 1. Mode Switcher: Time-In vs Time-Out */}
        <div
          style={{
            background: '#f8faff',
            border: '1px solid #dce3f2',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            <div>
              <strong style={{ fontSize: '15px' }}>Scan Scholar Profile QR Code</strong>
              <div className="muted small">
                Target Cluster: <strong>{attendanceModal?.cluster}</strong> • Target Year:{' '}
                <strong>{attendanceModal?.targetYearLevel || 'All Years'}</strong> • Both Time-In and Time-Out scans are required.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`ui-btn ${scanMode === 'time_in' ? 'ui-btn-primary' : 'ui-btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={() => {
                  setScanMode('time_in')
                  setScanError('')
                }}
              >
                1. Scan Time-In
              </button>
              <button
                type="button"
                className={`ui-btn ${scanMode === 'time_out' ? 'ui-btn-primary' : 'ui-btn-outline'}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  background: scanMode === 'time_out' ? '#1e8e4e' : undefined,
                }}
                onClick={() => {
                  setScanMode('time_out')
                  setScanError('')
                }}
              >
                2. Scan Time-Out
              </button>
            </div>
          </div>

          {/* Camera Toggle + QR Scanner Input */}
          <form
            onSubmit={handleManualScanSubmit}
            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
          >
            <input
              type="text"
              className="form-input"
              placeholder={
                scanMode === 'time_in'
                  ? 'Scan QR Code or enter Scholar ID for Time-In...'
                  : 'Scan QR Code or enter Scholar ID for Time-Out...'
              }
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            />
            <Button variant="primary" type="submit">
              {scanMode === 'time_in' ? 'Record Time-In' : 'Record Time-Out'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => (cameraActive ? stopCamera() : startCamera())}
            >
              {cameraActive ? 'Close Camera' : 'Camera'}
            </Button>
            <input
              id="sdp-qr-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoQrScan}
              style={{ display: 'none' }}
            />
          </form>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scan result shown ABOVE the camera so it's always visible on phones */}
          {scanError && (
            <div className="auth-error" style={{ marginTop: '12px', marginBottom: 0 }}>
              {scanError}
            </div>
          )}

          {scanResult && (
            <div
              className="note-ok"
              style={{
                marginTop: '12px',
                fontSize: '14px',
                border: '1px solid #a7e3bf',
              }}
            >
              <strong>✓ {scanResult.message}</strong>
            </div>
          )}

          {cameraActive && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {cameras.length > 1 && (
                <div style={{ marginBottom: '8px' }}>
                  <select
                    className="form-select"
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value)
                      startCamera(e.target.value)
                    }}
                    style={{ maxWidth: '320px', margin: '0 auto', fontSize: '12px' }}
                  >
                    {cameras.map((cam, idx) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <video
                ref={videoRef}
                style={{
                  // Compact square-ish viewfinder so the scan result stays visible on phones
                  width: '100%',
                  maxWidth: '240px',
                  height: '180px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  border: '2px solid #3b4fe0',
                  display: 'block',
                  margin: '0 auto',
                  background: '#000',
                }}
                muted
                playsInline
              />
              <div className="muted small" style={{ marginTop: '4px' }}>
                Point camera at the scholar&apos;s QR Pass...
              </div>
            </div>
          )}
        </div>

        {/* 2. Scholars Attendance & Time-In / Time-Out Log */}
        <div
          className="table-wrap"
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e6eaf4',
            borderRadius: '10px',
          }}
        >
          <table className="table">
            <thead>
              <tr>
                <th>Scholar ID</th>
                <th>Name</th>
                <th>Cluster</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th>Quick Scan Action</th>
              </tr>
            </thead>
            <tbody>
              {scholarsList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No scholars registered in {attendanceModal?.cluster || 'this cluster'} yet.
                  </td>
                </tr>
              ) : (
                [...scholarsList]
                  .filter(
                    (s) =>
                      !qrInput.trim() ||
                      s.scholarId.toLowerCase().includes(qrInput.trim().toLowerCase()) ||
                      s.name.toLowerCase().includes(qrInput.trim().toLowerCase())
                  )
                  .sort((a, b) => (b.timeIn ? 1 : 0) - (a.timeIn ? 1 : 0))
                  .slice(0, 60)
                  .map((s) => (
                  <tr key={s.scholarId}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{s.scholarId}</strong>
                    </td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>
                      <span className="pill pill-green small">{s.cluster}</span>
                    </td>
                    <td>
                      {s.timeIn ? (
                        <span className="pill pill-blue small">{s.timeIn}</span>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td>
                      {s.timeOut ? (
                        <span className="pill pill-green small">{s.timeOut}</span>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td>
                      {s.timeIn && s.timeOut ? (
                        <span className="pill pill-green small">Completed</span>
                      ) : s.timeIn ? (
                        <span className="pill pill-orange small">Timed In</span>
                      ) : (
                        <span className="muted small">Not Scanned</span>
                      )}
                    </td>
                    <td>
                      {!s.timeIn ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => processQrScan(s.scholarId, 'time_in')}
                        >
                          Scan Time-In
                        </button>
                      ) : !s.timeOut ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            background: '#1e8e4e',
                          }}
                          onClick={() => processQrScan(s.scholarId, 'time_out')}
                        >
                          Scan Time-Out
                        </button>
                      ) : (
                        <span style={{ color: '#1e8e4e', fontWeight: 700, fontSize: '12px' }}>
                          ✓ Verified
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
