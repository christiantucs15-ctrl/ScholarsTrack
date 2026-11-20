import { useState, useEffect, useMemo } from 'react'
import api from '../../api/axios'
import { ensure4000ScholarsDataset } from '../../utils/cdoSchoolsData'
import { CURRENT_PERIOD } from '../../utils/constant'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'

const CLUSTER_NAMES = [
  'Cluster A',
  'Cluster B',
  'Cluster C',
  'Cluster D',
  'Cluster E',
  'Cluster F',
  'Cluster G',
]

export default function Reports() {
  const [scholars, setScholars] = useState(() => ensure4000ScholarsDataset([]))
  const [standingFilter, setStandingFilter] = useState('all')

  useEffect(() => {
    let ignore = false
    api
      .get('/scholars')
      .then((res) => {
        if (!ignore && Array.isArray(res.data)) {
          setScholars(ensure4000ScholarsDataset(res.data))
        }
      })
      .catch(() => {
        if (!ignore) setScholars(ensure4000ScholarsDataset([]))
      })

    return () => {
      ignore = true
    }
  }, [])

  const {
    clusterData,
    totalScholars,
    totalActive,
    totalOnProbation,
    totalForfeited,
    flaggedScholars,
  } = useMemo(() => {
    const map = {}
    for (const c of CLUSTER_NAMES) {
      map[c] = {
        cluster: c,
        scholars: 0,
        active: 0,
        onProbation: 0,
        forfeited: 0,
        renewed: 0,
      }
    }

    let activeCount = 0
    let opCount = 0
    let forfeitedCount = 0
    const flagged = []

    for (const s of scholars) {
      const cName = map[s.cluster] ? s.cluster : 'Cluster A'
      const st = String(s.status || 'active').toLowerCase()
      map[cName].scholars++

      if (st === 'on_probation' || st === 'probation') {
        map[cName].onProbation++
        map[cName].renewed++
        opCount++
        flagged.push({ ...s, status: 'on_probation' })
      } else if (st === 'forfeited') {
        map[cName].forfeited++
        forfeitedCount++
        flagged.push({ ...s, status: 'forfeited' })
      } else {
        map[cName].active++
        map[cName].renewed++
        activeCount++
      }
    }

    const rows = CLUSTER_NAMES.map((c) => {
      const item = map[c]
      const rate =
        item.scholars > 0
          ? `${Math.round((item.renewed / item.scholars) * 100)}%`
          : '0%'
      return { ...item, rate }
    })

    return {
      clusterData: rows,
      totalScholars: scholars.length,
      totalActive: activeCount,
      totalOnProbation: opCount,
      totalForfeited: forfeitedCount,
      flaggedScholars: flagged,
    }
  }, [scholars])

  const filteredFlagged = useMemo(() => {
    if (standingFilter === 'all') return flaggedScholars
    return flaggedScholars.filter((s) => s.status === standingFilter)
  }, [flaggedScholars, standingFilter])

  const handleExport = () => {
    const header = [
      'Cluster',
      'Total Scholars',
      'Active Standing',
      'On Probation (OP)',
      'Forfeited (3+ Fails)',
      'Eligible for Renewal',
      'Compliance Rate',
    ]
    const csvRows = [
      header.join(','),
      ...clusterData.map((c) =>
        [
          c.cluster,
          c.scholars,
          c.active,
          c.onProbation,
          c.forfeited,
          c.renewed,
          c.rate,
        ].join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ScholarsTrack_Report_${CURRENT_PERIOD.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Reports &amp; Analytics</h2>
          <p className="muted small">
            Cluster-based renewal compliance, On Probation (OP), and Forfeited scholarship statistics for{' '}
            {CURRENT_PERIOD}.
          </p>
        </div>
        <Button variant="primary" onClick={handleExport}>
          📥 Export CSV Summary
        </Button>
      </div>

      {/* Aggregate KPI Cards (including On Probation & Forfeited counts) */}
      <div
        className="stat-grid"
        style={{
          marginBottom: '24px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <div className="card">
          <div className="stat-label">Total City Scholars</div>
          <div className="stat-value">{totalScholars.toLocaleString()}</div>
          <div className="muted small">Registered across Clusters A–G</div>
        </div>

        <div className="card">
          <div className="stat-label">In Good Standing (Active)</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {totalActive.toLocaleString()}
          </div>
          <div className="muted small">0 failed courses • Eligible for renewal</div>
        </div>

        <div className="card">
          <div className="stat-label">On Probation (OP)</div>
          <div className="stat-value" style={{ color: '#c77700' }}>
            {totalOnProbation.toLocaleString()}
          </div>
          <div className="muted small">1–2 failed courses (must retake &amp; pass)</div>
        </div>

        <div className="card">
          <div className="stat-label">Forfeited Scholarships</div>
          <div className="stat-value" style={{ color: '#c0392b' }}>
            {totalForfeited.toLocaleString()}
          </div>
          <div className="muted small">3+ unpassed failed courses</div>
        </div>
      </div>

      {/* Cluster Compliance & Standing Breakdown Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>
          Compliance &amp; Academic Standing by Cluster (A to G)
        </h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cluster</th>
                <th>Total Scholars</th>
                <th>Active Standing</th>
                <th>On Probation (OP)</th>
                <th>Forfeited</th>
                <th>Eligible for Renewal</th>
                <th>Retention Rate</th>
              </tr>
            </thead>
            <tbody>
              {clusterData.map((c) => (
                <tr key={c.cluster}>
                  <td>
                    <strong>{c.cluster}</strong>
                  </td>
                  <td>
                    <strong>{c.scholars.toLocaleString()}</strong>
                  </td>
                  <td style={{ color: '#1e8e4e', fontWeight: 600 }}>
                    {c.active.toLocaleString()}
                  </td>
                  <td>
                    <span className="pill pill-orange small">
                      {c.onProbation.toLocaleString()} OP
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-red small">
                      {c.forfeited.toLocaleString()} Forfeited
                    </span>
                  </td>
                  <td style={{ color: '#3b4fe0', fontWeight: 600 }}>
                    {c.renewed.toLocaleString()}
                  </td>
                  <td>
                    <span className="pill pill-green small">{c.rate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scholars Currently On Probation (OP) & Forfeited List */}
      <div className="card">
        <div
          className="toolbar"
          style={{ borderBottom: '1px solid #f0f2f8', paddingBottom: '14px' }}
        >
          <div>
            <h3>Scholars Under On Probation (OP) &amp; Forfeited Status</h3>
            <span className="muted small">
              Showing scholars flagged for failed courses (1–2 fails = On Probation (OP) • 3+ fails = Forfeited)
            </span>
          </div>

          <select
            className="form-select"
            value={standingFilter}
            onChange={(e) => setStandingFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">
              All Flagged ({flaggedScholars.length})
            </option>
            <option value="on_probation">
              On Probation (OP) ({totalOnProbation})
            </option>
            <option value="forfeited">
              Forfeited ({totalForfeited})
            </option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scholar ID</th>
                <th>Name</th>
                <th>School &amp; Program</th>
                <th>Cluster</th>
                <th>Year Level</th>
                <th>Scholar Type</th>
                <th>Standing Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlagged.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No scholars are currently On Probation (OP) or Forfeited yet.
                  </td>
                </tr>
              ) : (
                filteredFlagged.slice(0, 50).map((s) => (
                  <tr key={s.scholarId}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{s.scholarId}</strong>
                    </td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>
                      <div>{s.school}</div>
                      <div className="muted small">{s.course}</div>
                    </td>
                    <td>
                      <span className="pill pill-green small">{s.cluster}</span>
                    </td>
                    <td className="muted small">{s.yearLevel}</td>
                    <td>
                      <span
                        className={`pill small ${
                          s.scholarshipType === 'Academic' ? 'pill-blue' : 'pill-orange'
                        }`}
                      >
                        {s.scholarshipType}
                      </span>
                    </td>
                    <td>
                      <Badge status={s.status} />
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
