import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Badge from '../../components/common/Badge'

function getUserScholarId(user) {
  if (!user) return ''
  return String(
    user.scholarId ??
      user.scholar_id ??
      user.studentId ??
      user.student_id ??
      user.scholarCode ??
      user.code ??
      ''
  ).trim()
}

function getRowScholarId(row) {
  return String(
    row.scholarId ??
      row.scholar_id ??
      row.studentId ??
      row.student_id ??
      row.scholarCode ??
      row.userId ??
      row.user_id ??
      ''
  ).trim()
}

export default function RenewalHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const scholarId = getUserScholarId(user)
    if (!scholarId) {
      setHistory([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    api
      .get('/renewals', { params: { scholarId } })
      .then((res) => {
        if (!active) return
        const rawList = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : []

        // Filter to this student's records AND approved status
        const approvedForStudent = rawList.filter((item) => {
          const itemScholarId = getRowScholarId(item)
          const matchesStudent = !itemScholarId || itemScholarId === scholarId
          const status = String(item.status ?? '').trim().toLowerCase()
          const isApproved = status === 'approved' || status.includes('approved')
          return matchesStudent && isApproved
        })

        setHistory(approvedForStudent)
      })
      .catch((err) => {
        console.error('Failed to fetch renewal history:', err)
        if (active) setHistory([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
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
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    Loading renewal history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    No renewal records found yet.
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => {
                  const id = item.id ?? item.renewalId ?? item.renewal_id ?? idx
                  const period =
                    item.period ??
                    item.academicPeriod ??
                    item.academic_period ??
                    '1st Semester, 2026-2027'
                  const submittedOn =
                    item.submittedOn ??
                    item.submissionDate ??
                    item.submission_date ??
                    item.createdAt ??
                    ''
                  const remarks =
                    item.remarks ??
                    item.adminRemarks ??
                    item.admin_remarks ??
                    'Documents already approved.'

                  return (
                    <tr key={id}>
                      <td>
                        <strong>{period}</strong>
                      </td>
                      <td className="muted small">{submittedOn}</td>
                      <td>
                        <Badge status="Approved" />
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '320px' }}>
                        {remarks}
                      </td>
                      <td>
                        <span className="muted small" style={{ marginRight: '8px' }}>
                          Documents Approved
                        </span>
                        <Link
                          to={`/student/renewal-history/${id}`}
                          className="link-small"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 
