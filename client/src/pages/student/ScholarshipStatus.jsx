import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { CURRENT_PERIOD, PROGRAM_NAME } from '../../utils/constant'
import useAuth from '../../hooks/useAuth'
import { getClusterByBarangay } from '../../utils/clustersData'

export default function ScholarshipStatus() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [renewal, setRenewal] = useState(null)
  const [standingInfo, setStandingInfo] = useState({
    status: 'active',
    failedCount: 0,
    failedCourses: [],
  })

  useEffect(() => {
    const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
    const name = user?.name ?? ''

    try {
      const map = JSON.parse(localStorage.getItem('scholar_standing_map') || '{}')
      const localRec = map[String(scholarId).toLowerCase()]
      if (localRec) setStandingInfo(localRec)
    } catch {
      // Ignore
    }

    api
      .get('/students/me', { params: { scholarId, name } })
      .then((res) => {
        if (res.data) setProfile(res.data)
      })
      .catch(() => {})

    api
      .get('/renewals', { params: { scholarId } })
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setRenewal(res.data[0])
        }
      })
      .catch(() => {})

    api
      .get('/grades', { params: { scholarId, name } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          const passedSet = new Set()
          for (const sem of res.data) {
            for (const sub of sem.subjects || []) {
              const g = parseFloat(sub.grade)
              if (!isNaN(g) && g > 0 && g <= 3.0) {
                passedSet.add(String(sub.code || '').trim().toUpperCase())
              }
            }
          }
          const unpassed = []
          for (const sem of res.data) {
            for (const sub of sem.subjects || []) {
              const codeKey = String(sub.code || '').trim().toUpperCase()
              const g = parseFloat(sub.grade)
              if (!isNaN(g) && g > 3.0 && !passedSet.has(codeKey)) {
                unpassed.push(sub.code)
              }
            }
          }
          const failCount = unpassed.length
          setStandingInfo({
            status: failCount >= 3 ? 'forfeited' : failCount > 0 ? 'on_probation' : 'active',
            failedCount: failCount,
            failedCourses: unpassed,
          })
        }
      })
      .catch(() => {})
  }, [user])

  const barangay = profile?.barangay ?? user?.barangay ?? 'Bugo'
  const cluster = profile?.cluster ?? user?.cluster ?? getClusterByBarangay(barangay)
  const isApproved = renewal?.status === 'approved'
  const isUnderReview = renewal?.status === 'under_review'

  // Resolve Rank & Academic (1..1,000 -> 2.00 GWA) vs Non-Academic (1,001..2,000 -> 3.00 Grade)
  const sid = String(profile?.scholarId ?? user?.scholarId ?? '').trim()
  let savedRanks = {}
  try {
    savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
  } catch {
    // Ignore
  }
  let rank = Number(profile?.applicantRank) || Number(savedRanks[sid]) || 0
  if (rank <= 0) {
    if (sid === '2024-004' || sid === '2025-002') rank = 1045
    else if (sid === '2024-005' || sid === '2026-002') rank = 1280
    else {
      const parts = sid.split('-')
      const seq = parseInt(parts[parts.length - 1], 10)
      rank = !isNaN(seq) && seq > 0 ? seq : 1
    }
  }
  const scholarshipType = profile?.scholarshipType || (rank <= 1000 ? 'Academic' : 'Non-Academic')
  const requiredGwa = profile?.requiredGwa || (scholarshipType === 'Academic' ? '2.00' : '3.00')

  const timeline = [
    {
      title: 'Requirements Submitted',
      date: renewal?.submittedOn || 'Pending',
      done: isApproved || isUnderReview,
      current: !isApproved && !isUnderReview,
      desc: 'Latest grades, COE, accomplishment report, and consent form uploaded.',
    },
    {
      title: 'Document Verification',
      date: isApproved ? 'Verified' : isUnderReview ? 'In Progress' : 'Upcoming',
      done: isApproved,
      current: isUnderReview,
      desc: 'Uploaded files verified by scholarship coordinators.',
    },
    {
      title: 'Final Renewal Evaluation',
      date: isApproved ? 'Approved' : 'Pending',
      done: isApproved,
      current: false,
      desc: 'Sign-off from the Scholarship Office.',
    },
  ]

  return (
    <div>
      <h2>Scholarship Status</h2>
      <p>
        Check your current status, active standing, and real-time renewal progress for{' '}
        {CURRENT_PERIOD}.
      </p>

      {/* Main Status Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f1b3d 0%, #1b2a6b 100%)',
          color: '#fff',
          padding: '28px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '13px',
                color: '#b8c2de',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {PROGRAM_NAME}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
              <span
                style={{
                  background: scholarshipType === 'Academic' ? '#3b4fe0' : '#e08a00',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {scholarshipType} Scholar
              </span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Maintaining GWA Requirement: ≤ {requiredGwa}
              </span>
            </div>
            <h1 style={{ fontSize: '28px', margin: '10px 0' }}>
              Scholar Standing:{' '}
              {standingInfo.status === 'forfeited'
                ? 'FORFEITED (3+ FAILED COURSES)'
                : standingInfo.status === 'on_probation'
                ? 'ON PROBATION (OP)'
                : (profile?.status || 'Active').toUpperCase()}
            </h1>
            <p style={{ color: '#d3dbf2', maxWidth: '560px', margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
              {standingInfo.status === 'forfeited'
                ? `You have ${standingInfo.failedCount} unpassed failed courses (${standingInfo.failedCourses.join(', ')}). Accumulating 3 failed courses automatically forfeits your scholarship.`
                : standingInfo.status === 'on_probation'
                ? `You have ${standingInfo.failedCount} failed course(s) (${standingInfo.failedCourses.join(', ')}). You are On Probation (OP): you may stay in the scholarship, provided you retake and pass the failed course(s).`
                : renewal?.remarks ||
                  'Your scholarship is in good standing. Submit your 4 semester requirements in the Renewal tab.'}
            </p>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.12)',
              padding: '14px 20px',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#b8c2de' }}>Designated Cluster</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{cluster}</div>
            <div style={{ fontSize: '12px', color: '#d3dbf2' }}>Barangay {barangay}</div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Renewal Progress Timeline ({CURRENT_PERIOD})</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {timeline.map((item, index) => (
            <div key={item.title} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: item.done ? '#1e8e4e' : item.current ? '#3b4fe0' : '#e6eaf4',
                    color: item.done || item.current ? '#fff' : '#6b7694',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {item.done ? '✓' : index + 1}
                </div>
                {index < timeline.length - 1 && (
                  <div
                    style={{
                      width: '2px',
                      flex: 1,
                      background: item.done ? '#1e8e4e' : '#e6eaf4',
                      margin: '4px 0',
                    }}
                  />
                )}
              </div>

              <div style={{ paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>{item.title}</h4>
                  <span
                    className={`pill ${
                      item.done ? 'pill-green' : item.current ? 'pill-orange' : 'small'
                    }`}
                  >
                    {item.date}
                  </span>
                </div>
                <p className="muted small" style={{ margin: '4px 0 0' }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
