import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { ensure4000ScholarsDataset } from '../../utils/cdoSchoolsData'
import { CURRENT_PERIOD } from '../../utils/constant'
import Badge from '../../components/common/Badge'

export default function Dashboard() {
  const [scholarCount, setScholarCount] = useState(0)
  const [clusterCounts, setClusterCounts] = useState([
    { cluster: 'Cluster A', count: 0 },
    { cluster: 'Cluster B', count: 0 },
    { cluster: 'Cluster C', count: 0 },
    { cluster: 'Cluster D', count: 0 },
    { cluster: 'Cluster E', count: 0 },
    { cluster: 'Cluster F', count: 0 },
    { cluster: 'Cluster G', count: 0 },
  ])
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [sdpCount, setSdpCount] = useState(0)

  // Fetch live data from C# + PostgreSQL
  useEffect(() => {
    let ignore = false
    api
      .get('/scholars')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          const allScholars = ensure4000ScholarsDataset(res.data)
          setScholarCount(allScholars.length)
          const counts = { 'Cluster A': 0, 'Cluster B': 0, 'Cluster C': 0, 'Cluster D': 0, 'Cluster E': 0, 'Cluster F': 0, 'Cluster G': 0 }
          allScholars.forEach((s) => {
            if (counts[s.cluster] !== undefined) counts[s.cluster]++
          })
          setClusterCounts(
            Object.entries(counts).map(([cluster, count]) => ({ cluster, count }))
          )
        }
      })
      .catch((err) => console.error('Failed to fetch scholars:', err))

    api
      .get('/renewals')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          setRecentSubmissions(
            res.data.map((r) => ({
              id: r.id,
              scholarId: r.scholarId,
              name: r.name,
              cluster: r.cluster,
              date: r.submittedOn,
              status: r.status,
            }))
          )
        }
      })
      .catch((err) => console.error('Failed to fetch renewals:', err))

    api
      .get('/sdp')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          setSdpCount(res.data.length)
        }
      })
      .catch((err) => console.error('Failed to fetch SDP:', err))

    return () => {
      ignore = true
    }
  }, [])

  const pendingRenewals = recentSubmissions.filter((r) =>
    ['pending', 'under_review'].includes(r.status)
  ).length

  const stats = [
    { label: 'Total Scholars', value: scholarCount, sub: 'Registered scholars' },
    { label: 'Pending Renewals', value: pendingRenewals, sub: CURRENT_PERIOD },
    { label: 'Renewal Submissions', value: recentSubmissions.length, sub: 'Submitted this cycle' },
    { label: 'Active SDP Activities', value: sdpCount, sub: 'Scheduled this semester' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>Admin Dashboard</h2>
        <p className="muted small">
          City Scholarship Program Overview • {CURRENT_PERIOD}
        </p>
      </div>

      {/* Primary KPI Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="muted small">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Scholars Per Cluster (A to G) Breakdown */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="dash-section-head" style={{ marginBottom: '16px' }}>
          <div>
            <h3>Scholars per Cluster (A to G)</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Live distribution of scholars across the 7 geographic clusters (35 barangays)
            </p>
          </div>
          <Link to="/admin/clusters" className="link-small">
            Manage Clusters →
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
          }}
        >
          {clusterCounts.map((c) => (
            <div
              key={c.cluster}
              style={{
                background: '#f4f6fb',
                padding: '14px',
                borderRadius: '10px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f1b3d' }}>
                {c.cluster}
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: c.count > 0 ? '#3b4fe0' : '#6b7694',
                  margin: '4px 0',
                }}
              >
                {c.count}
              </div>
              <div className="muted small">Scholars</div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Renewal Status Overview (Read-Only for Admin; Evaluated by Evaluator/Staff) */}
      <div className="card">
        <div className="dash-section-head" style={{ marginBottom: '16px' }}>
          <div>
            <h3>Program Renewal Status Overview</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Live status of applications evaluated by the Scholarship Evaluator / Staff for {CURRENT_PERIOD}
            </p>
          </div>
          <Link to="/admin/reports" className="link-small">
            View Reports →
          </Link>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scholar ID</th>
                <th>Name</th>
                <th>Cluster</th>
                <th>Date Submitted</th>
                <th>Evaluation Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSubmissions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    No renewal submissions recorded for this period yet.
                  </td>
                </tr>
              ) : (
                recentSubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{sub.scholarId}</strong>
                    </td>
                    <td>
                      <strong>{sub.name}</strong>
                    </td>
                    <td>
                      <span className="pill pill-green">{sub.cluster}</span>
                    </td>
                    <td className="muted small">{sub.date}</td>
                    <td>
                      <Badge status={sub.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
