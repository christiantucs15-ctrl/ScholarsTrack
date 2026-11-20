import { useEffect, useState } from 'react'
import api from '../../api/axios'
import Badge from '../../components/common/Badge'

function getScholarId(row) {
  return String(
    row.scholarId ??
      row.scholar_id ??
      row.studentId ??
      row.student_id ??
      row.scholarCode ??
      ''
  ).trim()
}

function getScholarName(row) {
  return (
    row.scholarName ??
    row.scholar_name ??
    row.studentName ??
    row.fullName ??
    'Scholar'
  )
}

function getPeriod(row) {
  return (
    row.period ??
    row.academicPeriod ??
    row.academic_period ??
    '1st Semester, 2026-2027'
  )
}

function getSubmittedDate(row) {
  return (
    row.submittedOn ??
    row.submissionDate ??
    row.submission_date ??
    row.createdAt ??
    ''
  )
}

export default function RenewalApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const loadApplications = async () => {
    try {
      setLoading(true)
      setErrorMsg('')
      const res = await api.get('/renewals')
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : []
      setApplications(list)
    } catch (err) {
      console.error('Failed to load renewal applications:', err)
      setErrorMsg('Could not load renewal applications from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [])

  const handleApprove = async (row) => {
    const id = row.id ?? row.renewalId ?? row.renewal_id
    if (!id) return

    const remarks = `Documents approved for ${getScholarName(row)} (${getPeriod(row)}).`

    try {
      setBusyId(id)
      setErrorMsg('')

      let updatedRow = null
      try {
        const res = await api.patch(`/renewals/${id}/approve`, {
          status: 'Approved',
          remarks,
        })
        updatedRow = res.data?.data ?? res.data
      } catch (patchErr) {
        // Fallback if backend uses PUT or PATCH /renewals/:id
        const res = await api.put(`/renewals/${id}`, {
          ...row,
          status: 'Approved',
          remarks,
        })
        updatedRow = res.data?.data ?? res.data
      }

      setApplications((prev) =>
        prev.map((item) => {
          const itemId = item.id ?? item.renewalId ?? item.renewal_id
          if (itemId !== id) return item
          return {
            ...item,
            ...(updatedRow && typeof updatedRow === 'object' ? updatedRow : {}),
            status: 'Approved',
            remarks: updatedRow?.remarks ?? remarks,
          }
        })
      )
    } catch (err) {
      console.error('Approve failed:', err)
      setErrorMsg('Failed to approve application in database.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Renewal Applications</h2>
          <p className="muted small">
            Approve submitted scholar renewal documents so they appear in student Renewal History.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="card" style={{ padding: '12px', marginBottom: '12px', color: '#b91c1c' }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scholar ID</th>
                <th>Scholar Name</th>
                <th>Academic Period</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    Loading renewal applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No renewal applications found.
                  </td>
                </tr>
              ) : (
                applications.map((row, idx) => {
                  const id = row.id ?? row.renewalId ?? row.renewal_id ?? idx
                  const statusText = String(row.status ?? 'Under Review')
                  const isApproved = statusText.toLowerCase().includes('approved')

                  return (
                    <tr key={id}>
                      <td>
                        <strong>{getScholarId(row)}</strong>
                      </td>
                      <td>{getScholarName(row)}</td>
                      <td>{getPeriod(row)}</td>
                      <td className="muted small">{getSubmittedDate(row)}</td>
                      <td>
                        <Badge status={isApproved ? 'Approved' : statusText} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ui-btn ui-btn-primary"
                          disabled={isApproved || busyId === id}
                          onClick={() => handleApprove(row)}
                        >
                          {isApproved
                            ? 'Approved'
                            : busyId === id
                            ? 'Approving...'
                            : 'Approve'}
                        </button>
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