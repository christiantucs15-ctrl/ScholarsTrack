import { useState, useEffect } from 'react'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Badge from '../../components/common/Badge'

export default function SdpTracker() {
  const { user } = useAuth()
  const [activities, setActivities] = useState([])

  // Fetch real SDP activities and this scholar's QR Time-In / Time-Out records from PostgreSQL
  // Polls every 4 seconds so when Staff/Evaluator scans on a cellphone, the Student's laptop updates live!
  useEffect(() => {
    const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
    const deriveYear = (sid, fallback) => {
      const clean = String(sid || '').trim()
      if (clean.length >= 4) {
        const batch = parseInt(clean.substring(0, 4), 10)
        if (!isNaN(batch) && batch >= 2018 && batch <= 2030) {
          const yr = Math.min(4, Math.max(1, 2026 - batch + 1))
          return yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : '4th Year'
        }
      }
      return fallback || '1st Year'
    }
    const myYearLevel = deriveYear(scholarId, user?.yearLevel)

    const loadSdp = () => {
      let savedYears = {}
      try {
        savedYears = JSON.parse(localStorage.getItem('sdp_target_years_map') || '{}')
      } catch {
        // Ignore
      }

      api
        .get('/sdp', { params: { scholarId } })
        .then((res) => {
          if (Array.isArray(res.data)) {
            const visible = res.data.filter((a) => {
              const targetYr = a.targetYearLevel || savedYears[a.id] || 'All Years'
              return targetYr === 'All Years' || targetYr.toLowerCase() === myYearLevel.toLowerCase()
            })
            setActivities(
              visible.map((a) => {
                let localRec = {}
                try {
                  const raw = localStorage.getItem(`sdp_qr_times_${a.id}`)
                  const map = raw ? JSON.parse(raw) : {}
                  localRec = map[scholarId] || {}
                } catch {
                  // Ignore
                }
                const tIn = a.timeIn || localRec.timeIn || ''
                const tOut = a.timeOut || localRec.timeOut || ''
                const isDone = Boolean(a.scholarCompleted) || Boolean(tIn && tOut)
                return {
                  id: a.id,
                  name: a.name,
                  category: a.category,
                  date: a.targetDate,
                  targetYearLevel: a.targetYearLevel || savedYears[a.id] || 'All Years',
                  timeIn: tIn,
                  timeOut: tOut,
                  status: isDone
                    ? 'completed'
                    : tIn
                    ? 'in_progress'
                    : a.status === 'upcoming'
                    ? 'pending'
                    : a.status,
                  hours: a.expectedHours || 4,
                  facilitator: a.cluster || 'All Clusters',
                }
              })
            )
          }
        })
        .catch((err) => console.error('Failed to load SDP activities:', err))
    }

    loadSdp()
    const timer = setInterval(loadSdp, 4000)
    return () => clearInterval(timer)
  }, [user])

  const completed = activities.filter((a) => a.status === 'completed')
  const completedHours = completed.reduce((sum, a) => sum + a.hours, 0)
  const totalHours = activities.reduce((sum, a) => sum + a.hours, 0)
  const percent = activities.length > 0 ? Math.round((completed.length / activities.length) * 100) : 0

  return (
    <div>
      <h2>Student Development Program (SDP) Tracker</h2>
      <p>
        Track your required community service, leadership sessions, and QR Time-In / Time-Out records.
      </p>

      {/* Progress Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Activities Completed</div>
          <div className="stat-value">
            {completed.length} / {activities.length}
          </div>
          <div className="muted small">{percent}% semester progress</div>
        </div>

        <div className="card">
          <div className="stat-label">Recorded Hours</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {completedHours} / {totalHours} hrs
          </div>
          <div className="muted small">Verified via QR Time-In & Time-Out</div>
        </div>

        <div className="card">
          <div className="stat-label">QR Attendance Pass</div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#3b4fe0', marginTop: '6px' }}>
            Available in My Profile
          </div>
          <div className="muted small">Present your QR code to Staff at events</div>
        </div>
      </div>

      {/* Overall Progress Bar Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <strong>Semester Completion Status</strong>
          <strong>{percent}%</strong>
        </div>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${percent}%` }}></div>
        </div>
        <p className="muted small" style={{ marginTop: '8px' }}>
          Both <strong>Time-In</strong> and <strong>Time-Out</strong> QR scans are required at each event to mark an SDP activity as Completed.
        </p>
      </div>

      {/* Activities List */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Scheduled Activities & Attendance Log</h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Category</th>
                <th>Credit Hours</th>
                <th>Date</th>
                <th>Target Cluster</th>
                <th>Target Year</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                  </td>
                  <td>
                    <span className="pill pill-orange small">{a.category}</span>
                  </td>
                  <td>{a.hours} hrs</td>
                  <td className="muted small">{a.date}</td>
                  <td className="muted small">{a.facilitator}</td>
                  <td>
                    <span
                      className={`pill small ${
                        a.targetYearLevel === 'All Years' ? 'pill-green' : 'pill-blue'
                      }`}
                    >
                      {a.targetYearLevel}
                    </span>
                  </td>
                  <td>
                    {a.timeIn ? (
                      <span className="pill pill-blue small">{a.timeIn}</span>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td>
                    {a.timeOut ? (
                      <span className="pill pill-green small">{a.timeOut}</span>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td>
                    <Badge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
