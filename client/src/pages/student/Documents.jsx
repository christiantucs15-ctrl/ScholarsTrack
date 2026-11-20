import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Badge from '../../components/common/Badge'

// =============================================================================
// Documents.jsx - Student "My Documents" Page
// Automatically displays all documents uploaded and submitted by the student
// during their semester renewal, including the identified semester period and
// verification status from the scholarship office.
// =============================================================================
export default function Documents() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch the logged-in scholar's renewal documents from PostgreSQL via C# API
  useEffect(() => {
    const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
    const name = user?.name ?? ''
    setLoading(true)
    api
      .get('/documents', { params: { scholarId, name } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setDocs(
            res.data.map((d) => ({
              id: d.id,
              name: d.docType,
              file: d.file,
              date: d.date,
              size: d.size,
              status: d.status,
              category: d.period ? `Renewal (${d.period})` : 'Renewal Requirement',
            }))
          )
        }
      })
      .catch((err) => console.error('Failed to fetch scholar documents:', err))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>My Documents</h2>
          <p className="muted small">
            Manage your uploaded requirements and check the verification status issued by the scholarship office.
          </p>
        </div>
        <Link to="/student/renewal" className="ui-btn ui-btn-outline link-btn">
          Go to Renewal
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Total Documents</div>
          <div className="stat-value">{docs.length}</div>
          <div className="muted small">Submitted files</div>
        </div>

        <div className="card">
          <div className="stat-label">Verified</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {docs.filter((d) => d.status === 'verified').length}
          </div>
          <div className="muted small">Approved by admin</div>
        </div>

        <div className="card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: '#c77700' }}>
            {docs.filter((d) => d.status === 'pending').length}
          </div>
          <div className="muted small">Awaiting verification</div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Category</th>
                <th>File Name & Size</th>
                <th>Date Uploaded</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    Loading your documents...
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No documents uploaded yet. Once you upload and submit your requirements in{' '}
                    <Link to="/student/renewal" className="link-small">
                      <strong>Renewal</strong>
                    </Link>
                    , they will automatically appear here.
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                    </td>
                    <td>
                      <span className="pill pill-green small">{d.category}</span>
                    </td>
                    <td>
                      <div>{d.file}</div>
                      <span className="muted small">{d.size}</span>
                    </td>
                    <td className="muted small">{d.date}</td>
                    <td>
                      <Badge status={d.status} />
                    </td>
                    <td>
                      <a
                        href={`/uploads/${d.file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-small"
                      >
                        View / Download
                      </a>
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
