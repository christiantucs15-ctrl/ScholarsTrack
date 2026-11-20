import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/axios'
import Badge from '../../components/common/Badge'

export default function StudentRenewalDetails() {
  const { id } = useParams()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/renewals/${id}`)
      .then((res) => {
        if (res.data) setDetails(res.data)
      })
      .catch((err) => console.error('Failed to load renewal details:', err))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading renewal details...</p>
  if (!details) return <div className="note-warn">Renewal details not found.</div>

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/student/renewal-history" className="link-small">
          ← Back to Renewal History
        </Link>
      </div>

      <div className="toolbar">
        <div>
          <h2>Renewal Submission Details</h2>
          <p className="muted small">
            Academic Period: {details.period} • Submitted: {details.submittedOn}
          </p>
        </div>
        <Badge status={details.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Submitted Requirements</h3>

          {(!details.documents || details.documents.length === 0) ? (
            <p className="muted small">No documents uploaded for this renewal yet.</p>
          ) : (
            <ul className="req-list">
              {details.documents.map((doc) => (
                <li key={doc.id || doc.name} className="req-item">
                  <div className="req-info">
                    <strong>{doc.name}</strong>
                    <span className="muted small">{doc.file}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge status={doc.status} />
                    <a
                      href={`http://localhost:5000/uploads/${doc.file}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-small"
                    >
                      View File
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div
            style={{
              marginTop: '20px',
              padding: '14px',
              background: '#f4f6fb',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <strong>Coordinator Remarks:</strong> {details.remarks}
          </div>
        </div>

        <div className="card">
          <h4>Renewal Notice</h4>
          <p className="muted small" style={{ marginTop: '10px', lineHeight: 1.5 }}>
            Once all 4 documents are verified and approved, your renewal status will automatically
            switch to <strong>Approved</strong> and your semester allowance will be scheduled for
            disbursement.
          </p>
        </div>
      </div>
    </div>
  )
}
