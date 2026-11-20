import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { ensure4000RenewalsDataset } from '../../utils/cdoSchoolsData'
import { CURRENT_PERIOD } from '../../utils/constant'

// =============================================================================
// Evaluator Dashboard.jsx - Simple, Clean Overview for Evaluator / Staff Role
// Shows only the essential summary metrics and quick links to core tasks.
// =============================================================================
export default function EvaluatorDashboard() {
  const [renewals, setRenewals] = useState(() => ensure4000RenewalsDataset([]))
  const [sdpEventsCount, setSdpEventsCount] = useState(0)

  useEffect(() => {
    let ignore = false

    api
      .get('/renewals')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          setRenewals(ensure4000RenewalsDataset(res.data))
        }
      })
      .catch(() => {
        if (!ignore) setRenewals(ensure4000RenewalsDataset([]))
      })

    api
      .get('/sdp')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          setSdpEventsCount(res.data.filter((a) => a.status !== 'completed').length)
        }
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [])

  const pendingApps = renewals.filter((r) =>
    ['pending', 'under_review'].includes(r.status)
  ).length
  const approvedApps = renewals.filter((r) => r.status === 'approved').length
  const rejectedApps = renewals.filter((r) => r.status === 'rejected').length

  const yearBreakdown = [
    { label: '1st Year Scholars', count: renewals.filter((r) => r.yearLevel === '1st Year').length },
    { label: '2nd Year Scholars', count: renewals.filter((r) => r.yearLevel === '2nd Year').length },
    { label: '3rd Year Scholars', count: renewals.filter((r) => r.yearLevel === '3rd Year').length },
    { label: '4th Year Scholars', count: renewals.filter((r) => r.yearLevel === '4th Year').length },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Staff &amp; Evaluator Dashboard</h2>
        <p className="muted small">
          Summary of scholarship renewals and evaluation tasks for {CURRENT_PERIOD}
        </p>
      </div>

      {/* Essential KPI Summary Cards */}
      <div
        className="stat-grid"
        style={{
          marginBottom: '24px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <div className="card">
          <div className="stat-label">Pending Evaluation</div>
          <div className="stat-value" style={{ color: '#c77700' }}>
            {pendingApps.toLocaleString()}
          </div>
          <div className="muted small">Ready for renewal review</div>
        </div>

        <div className="card">
          <div className="stat-label">Approved Renewals</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {approvedApps.toLocaleString()}
          </div>
          <div className="muted small">Approved this semester</div>
        </div>

        <div className="card">
          <div className="stat-label">Rejected Renewals</div>
          <div className="stat-value" style={{ color: '#c0392b' }}>
            {rejectedApps.toLocaleString()}
          </div>
          <div className="muted small">Returned / disapproved</div>
        </div>

        <div className="card">
          <div className="stat-label">Active SDP Events</div>
          <div className="stat-value" style={{ color: '#3b4fe0' }}>
            {sdpEventsCount}
          </div>
          <div className="muted small">Open for QR attendance</div>
        </div>
      </div>

      {/* Simple Two-Column Summary: Year-Level Breakdown + Quick Tasks */}
      <div className="grid-2">
        <div className="card">
          <div className="dash-section-head" style={{ marginBottom: '14px' }}>
            <h3>Scholars by Year Level</h3>
            <Link to="/evaluator/renewals" className="link-small">
              Open Renewals →
            </Link>
          </div>

          <ul className="updates">
            {yearBreakdown.map((item) => (
              <li key={item.label} style={{ justifyContent: 'space-between' }}>
                <span>{item.label}</span>
                <strong>{item.count.toLocaleString()} scholars</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '14px' }}>Quick Staff Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              to="/evaluator/renewals"
              className="ui-btn ui-btn-primary"
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              Review Renewal Applications ({pendingApps.toLocaleString()} Pending)
            </Link>
            <Link
              to="/evaluator/documents"
              className="ui-btn ui-btn-outline"
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              Verify Submitted Documents
            </Link>
            <Link
              to="/evaluator/sdp"
              className="ui-btn ui-btn-outline"
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              Open SDP QR Attendance Scanner
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
