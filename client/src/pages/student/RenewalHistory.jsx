import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Badge from '../../components/common/Badge'

export default function RenewalHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])

  // Fetch the logged-in scholar's real renewal records from PostgreSQL via C# API
  useEffect(() => {
    const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
    api
      .get('/renewals', { params: { scholarId } })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setHistory(res.data)
        }
      })
      .catch((err) => console.error('Failed to fetch renewal history:', err))
  }, [user])

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Renewal History</h2>
          <p className="muted small">
            Archive of your previous semester renewal submissions and coordinator remarks.
          </p>
        </div>
        <Link to="/student/renewal" className="ui-btn ui-btn-primary link-btn">
          + New Semester Submission
        </Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Academic Period</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Admin Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    No renewal records found yet.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.period}</strong>
                    </td>
                    <td className="muted small">{item.submittedOn}</td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td style={{ fontSize: '13px', maxWidth: '320px' }}>
                      {item.remarks}
                    </td>
                    <td>
                      <Link
                        to={`/student/renewal-history/${item.id}`}
                        className="link-small"
                      >
                        View Details →
                      </Link>
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
