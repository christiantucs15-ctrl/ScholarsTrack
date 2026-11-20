import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { CLUSTERS } from '../../utils/clustersData'
import { ensure4000ScholarsDataset } from '../../utils/cdoSchoolsData'

// =============================================================================
// Clusters.jsx - Admin Geographic Clusters & Barangays Page
// Fetches the 7 Clusters (A to G), their 5 assigned barangays each, and the
// live scholar count per cluster from PostgreSQL via C# (GET /api/clusters).
// =============================================================================
export default function Clusters() {
  const [clusters, setClusters] = useState(() => {
    const full = ensure4000ScholarsDataset([])
    return CLUSTERS.map((c) => ({
      ...c,
      scholarCount: full.filter((s) => s.cluster === c.name).length,
    }))
  })

  useEffect(() => {
    api
      .get('/clusters')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const totalDb = res.data.reduce((sum, x) => sum + (x.scholarCount || 0), 0)
          if (totalDb >= 4000) {
            setClusters(res.data)
          }
        }
      })
      .catch((err) => console.error('Failed to fetch clusters:', err))
  }, [])

  const totalScholars = clusters.reduce((sum, c) => sum + (c.scholarCount || 0), 0)

  return (
    <div>
      <h2>Clusters & Barangays</h2>
      <p>
        The city is divided into 7 Clusters (A to G), with 5 barangays assigned to each cluster.
        When a scholar selects their barangay, their cluster is automatically determined.
      </p>

      {/* Overview Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Total Clusters</div>
          <div className="stat-value">{clusters.length}</div>
          <div className="muted small">Cluster A to Cluster G</div>
        </div>

        <div className="card">
          <div className="stat-label">Covered Barangays</div>
          <div className="stat-value">35</div>
          <div className="muted small">5 barangays per cluster</div>
        </div>

        <div className="card">
          <div className="stat-label">Assigned Scholars</div>
          <div className="stat-value" style={{ color: '#3b4fe0' }}>
            {totalScholars}
          </div>
          <div className="muted small">Automatically mapped by barangay</div>
        </div>
      </div>

      {/* 7 Clusters Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {clusters.map((cluster) => (
          <div className="card" key={cluster.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                borderBottom: '1px solid #f0f2f8',
                paddingBottom: '10px',
              }}
            >
              <h3 style={{ fontSize: '18px', color: '#0f1b3d', margin: 0 }}>
                {cluster.name}
              </h3>
              <span className="pill pill-green">
                {cluster.scholarCount ?? 0} Scholars • {cluster.barangays.length} Brgys
              </span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cluster.barangays.map((b, index) => (
                <li
                  key={b}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 0',
                    borderBottom:
                      index < cluster.barangays.length - 1 ? '1px solid #f8f9fc' : 'none',
                    fontSize: '14px',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#f4f6fb',
                      color: '#6b7694',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
