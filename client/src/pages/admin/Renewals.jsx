import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import { CLUSTERS } from '../../utils/clustersData'
import { ensure4000RenewalsDataset, saveRenewalOverride } from '../../utils/cdoSchoolsData'
import { CURRENT_PERIOD, ROLES } from '../../utils/constant'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'

const PAGE_SIZE = 50

export default function Renewals() {
  const { user } = useAuth()
  const base = user?.role === ROLES.EVALUATOR ? '/evaluator' : '/admin'
  const [renewals, setRenewals] = useState(() => ensure4000RenewalsDataset([]))
  const [selectedCluster, setSelectedCluster] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Action Modal State
  const [modalItem, setModalItem] = useState(null)
  const [actionType, setActionType] = useState('approve')
  const [remarks, setRemarks] = useState('')

  // Fetch renewals from C# + PostgreSQL and merge with all 4,000 scholars (ready to renew, not approved yet)
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
    return () => {
      ignore = true
    }
  }, [])

  const filtered = useMemo(() => {
    return renewals.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.scholarId.toLowerCase().includes(search.toLowerCase()) ||
        (r.school && r.school.toLowerCase().includes(search.toLowerCase())) ||
        (r.course && r.course.toLowerCase().includes(search.toLowerCase()))
      const matchCluster = selectedCluster === 'all' || r.cluster === selectedCluster
      const matchStatus = selectedStatus === 'all' || r.status === selectedStatus
      const matchYear = selectedYear === 'all' || r.yearLevel === selectedYear
      const matchType = selectedType === 'all' || r.scholarshipType === selectedType
      return matchSearch && matchCluster && matchStatus && matchYear && matchType
    })
  }, [renewals, search, selectedCluster, selectedStatus, selectedYear, selectedType])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const openActionModal = (item, type) => {
    setModalItem(item)
    setActionType(type)
    setRemarks(type === 'approve' ? 'All semester requirements verified and approved.' : '')
  }

  const handleConfirmAction = async () => {
    if (!modalItem) return
    const newStatus = actionType === 'approve' ? 'approved' : 'rejected'

    saveRenewalOverride(modalItem.scholarId, {
      status: newStatus,
      remarks,
    })

    try {
      await api.put(`/renewals/${modalItem.id}/status`, {
        status: newStatus,
        remarks,
      })
    } catch {
      // Saved in local override if renewal row wasn't in DB yet
    }

    setRenewals((prev) =>
      prev.map((r) =>
        r.scholarId === modalItem.scholarId ? { ...r, status: newStatus, remarks } : r
      )
    )
    setModalItem(null)
  }

  const pendingCount = renewals.filter((r) =>
    ['pending', 'under_review'].includes(r.status)
  ).length
  const approvedCount = renewals.filter((r) => r.status === 'approved').length

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Semester Renewals</h2>
          <p className="muted small">
            Review and evaluate scholarship renewal applications for {CURRENT_PERIOD}. All 4,000 scholars are ready for evaluation.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Ready for Renewal (Pending Review)</div>
          <div className="stat-value" style={{ color: '#c77700' }}>
            {pendingCount.toLocaleString()}
          </div>
          <div className="muted small">Awaiting Staff / Evaluator approval</div>
        </div>

        <div className="card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {approvedCount.toLocaleString()}
          </div>
          <div className="muted small">Approved by Evaluator this semester</div>
        </div>

        <div className="card">
          <div className="stat-label">Total Scholars Connected</div>
          <div className="stat-value">{renewals.length.toLocaleString()}</div>
          <div className="muted small">1,500 1st Yr • 1,200 2nd Yr • 800 3rd Yr • 500 4th Yr</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-row" style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by Scholar ID, Name, School..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ maxWidth: '250px' }}
            />

            <select
              className="form-select"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Year Levels (4,000)</option>
              <option value="1st Year">1st Year (1,500)</option>
              <option value="2nd Year">2nd Year (1,200)</option>
              <option value="3rd Year">3rd Year (800)</option>
              <option value="4th Year">4th Year (500)</option>
            </select>

            <select
              className="form-select"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Types</option>
              <option value="Academic">Academic (2.00 GWA)</option>
              <option value="Non-Academic">Non-Academic (3.00 Grade)</option>
            </select>

            <select
              className="form-select"
              value={selectedCluster}
              onChange={(e) => {
                setSelectedCluster(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Clusters (A–G)</option>
              {CLUSTERS.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Statuses</option>
              <option value="under_review">Under Review (Ready)</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {(search ||
            selectedCluster !== 'all' ||
            selectedStatus !== 'all' ||
            selectedYear !== 'all' ||
            selectedType !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setSelectedCluster('all')
                setSelectedStatus('all')
                setSelectedYear('all')
                setSelectedType('all')
                setPage(1)
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Renewals Table */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span className="muted small">
            Showing{' '}
            <strong>
              {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)}
            </strong>{' '}
            of <strong>{filtered.length.toLocaleString()}</strong> renewal applications
          </span>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="ui-btn ui-btn-outline"
                style={{ padding: '5px 12px', fontSize: '12px' }}
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span className="small" style={{ fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="ui-btn ui-btn-outline"
                style={{ padding: '5px 12px', fontSize: '12px' }}
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scholar ID</th>
                <th>Scholar Name & School</th>
                <th>Scholar Type</th>
                <th>Barangay & Cluster</th>
                <th>Year & Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No renewal applications found.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr key={r.scholarId}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{r.scholarId}</strong>
                    </td>
                    <td>
                      <div>
                        <strong>{r.name}</strong>
                      </div>
                      <div className="muted small">{r.school}</div>
                    </td>
                    <td>
                      <span
                        className={`pill small ${
                          r.scholarshipType === 'Academic' ? 'pill-blue' : 'pill-orange'
                        }`}
                        style={
                          r.scholarshipType === 'Academic'
                            ? { background: '#eef2ff', color: '#3b4fe0' }
                            : undefined
                        }
                      >
                        {r.scholarshipType} (≤ {r.requiredGwa} GWA)
                      </span>
                    </td>
                    <td>
                      <div>{r.barangay}</div>
                      <span className="pill pill-green small">{r.cluster}</span>
                    </td>
                    <td>
                      <div>{r.yearLevel}</div>
                      <div className="muted small">{r.period}</div>
                    </td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link
                          to={`${base}/renewals/${r.scholarId}`}
                          className="ui-btn ui-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                        >
                          Evaluate
                        </Link>
                        {r.status !== 'approved' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '12px', background: '#1e8e4e' }}
                            onClick={() => openActionModal(r, 'approve')}
                          >
                            Approve
                          </button>
                        )}
                        {r.status !== 'rejected' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-danger"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openActionModal(r, 'reject')}
                          >
                            Reject
                          </button>
                        )}
                        {(r.status === 'approved' || r.status === 'rejected') && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-outline"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={async () => {
                              saveRenewalOverride(r.scholarId, {
                                status: 'under_review',
                                remarks: 'All 4 renewal requirements submitted. Ready for Evaluator review.',
                              })
                              api
                                .put(`/renewals/${r.id}/status`, {
                                  status: 'under_review',
                                  remarks: 'Reverted to Under Review.',
                                })
                                .catch(() => {})
                              setRenewals((prev) =>
                                prev.map((item) =>
                                  item.scholarId === r.scholarId
                                    ? {
                                        ...item,
                                        status: 'under_review',
                                        remarks: 'All 4 renewal requirements submitted. Ready for Evaluator review.',
                                      }
                                    : item
                                )
                              )
                            }}
                            title="Revert back to Under Review"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      <Modal
        open={!!modalItem}
        title={actionType === 'approve' ? 'Approve Renewal' : 'Reject Renewal'}
        onClose={() => setModalItem(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'primary' : 'danger'}
              style={actionType === 'approve' ? { background: '#1e8e4e' } : {}}
              onClick={handleConfirmAction}
            >
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: '12px' }}>
          Are you sure you want to <strong>{actionType}</strong> the renewal for{' '}
          <strong>{modalItem?.name}</strong> ({modalItem?.scholarId})?
        </p>

        <div className="form-field">
          <label>Remarks / Notes for Scholar</label>
          <textarea
            className="form-input"
            rows="3"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter reason or instructions..."
          />
        </div>
      </Modal>
    </div>
  )
}
