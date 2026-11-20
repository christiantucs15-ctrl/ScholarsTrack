import { useState, useMemo, useEffect } from 'react'
import api from '../../api/axios'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import {
  ensure4000ScholarsDataset,
  getScholarDocumentsForEvaluation,
  getRenewalOverridesMap,
  saveRenewalOverride,
} from '../../utils/cdoSchoolsData'
import { REQUIRED_DOCUMENTS, YEAR_LEVELS } from '../../utils/constant'

const PAGE_SIZE = 50

export default function DocumentVerification() {
  const [dbDocs, setDbDocs] = useState([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    api
      .get('/documents')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setDbDocs(res.data)
        }
      })
      .catch(() => {})
  }, [])

  // Build connected document list across all 4,000 scholars (4 requirements each = 16,000 documents)
  const docs = useMemo(() => {
    void refreshTick
    const allScholars = ensure4000ScholarsDataset([])
    const dbMap = new Map()
    for (const d of dbDocs) {
      if (d?.scholarId && d?.docType) {
        dbMap.set(`${String(d.scholarId).toLowerCase()}::${d.docType}`, d)
      }
    }

    const result = []
    for (const s of allScholars) {
      const evalDocs = getScholarDocumentsForEvaluation(
        s.scholarId,
        s.name,
        s.yearLevel,
        s.cluster
      )
      for (const ed of evalDocs) {
        const dbMatch = dbMap.get(`${String(s.scholarId).toLowerCase()}::${ed.docType}`)
        result.push({
          ...ed,
          id: dbMatch?.id || ed.id,
          file: dbMatch?.file || ed.file,
          size: dbMatch?.size || ed.size,
          date: dbMatch?.date || ed.date,
          status: ed.status !== 'pending' ? ed.status : dbMatch?.status || 'pending',
        })
      }
    }
    return result
  }, [dbDocs, refreshTick])

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const matchSearch =
        !search ||
        d.scholarName.toLowerCase().includes(search.toLowerCase()) ||
        d.scholarId.toLowerCase().includes(search.toLowerCase())
      const matchType = selectedType === 'all' || d.docType === selectedType
      const matchStatus = selectedStatus === 'all' || d.status === selectedStatus
      const matchYear = selectedYear === 'all' || d.yearLevel === selectedYear
      return matchSearch && matchType && matchStatus && matchYear
    })
  }, [docs, search, selectedType, selectedStatus, selectedYear])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const setStatus = async (docItem, newStatus) => {
    const overrides = getRenewalOverridesMap()
    const key = String(docItem.scholarId).toLowerCase()
    const prevStatuses = overrides[key]?.docStatuses || {}
    saveRenewalOverride(docItem.scholarId, {
      docStatuses: { ...prevStatuses, [docItem.docType]: newStatus },
    })

    if (typeof docItem.id === 'number' || /^\d+$/.test(String(docItem.id))) {
      api.put(`/documents/${docItem.id}/status`, { status: newStatus }).catch(() => {})
    }

    setRefreshTick((t) => t + 1)
  }

  const pendingCount = docs.filter((d) => d.status === 'pending').length
  const verifiedCount = docs.filter((d) => d.status === 'verified').length

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Document Verification Queue</h2>
          <p className="muted small">
            Review and authenticate requirement documents uploaded by all 4,000 scholars.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Pending Verification</div>
          <div className="stat-value" style={{ color: '#c77700' }}>
            {pendingCount.toLocaleString()}
          </div>
          <div className="muted small">Requires Staff / Evaluator inspection</div>
        </div>

        <div className="card">
          <div className="stat-label">Verified Documents</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {verifiedCount.toLocaleString()}
          </div>
          <div className="muted small">Approved files</div>
        </div>

        <div className="card">
          <div className="stat-label">Total Documents</div>
          <div className="stat-value">{docs.length.toLocaleString()}</div>
          <div className="muted small">4 requirements across 4,000 scholars</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-row" style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by Scholar ID or Name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ maxWidth: '250px' }}
            />

            <select
              className="form-select"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Document Types</option>
              {REQUIRED_DOCUMENTS.map((doc) => (
                <option key={doc} value={doc}>
                  {doc}
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
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              className="form-select"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Year Levels</option>
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {(search || selectedType !== 'all' || selectedStatus !== 'all' || selectedYear !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setSelectedType('all')
                setSelectedStatus('all')
                setSelectedYear('all')
                setPage(1)
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Documents Table */}
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
            of <strong>{filtered.length.toLocaleString()}</strong> documents
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
                <th>Scholar</th>
                <th>Year Level</th>
                <th>Cluster</th>
                <th>Requirement Type</th>
                <th>Uploaded File</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty">
                    No documents matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginated.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div>
                        <strong>{d.scholarName}</strong>
                      </div>
                      <span className="muted small">{d.scholarId}</span>
                    </td>
                    <td>
                      <span className="muted small">{d.yearLevel}</span>
                    </td>
                    <td>
                      <span className="pill pill-green small">{d.cluster}</span>
                    </td>
                    <td>
                      <strong>{d.docType}</strong>
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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a
                          href={`/uploads/${d.file}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ui-btn ui-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px', textDecoration: 'none' }}
                        >
                          View File
                        </a>
                        {d.status !== 'verified' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '12px', background: '#1e8e4e' }}
                            onClick={() => setStatus(d, 'verified')}
                          >
                            Verify
                          </button>
                        )}
                        {d.status !== 'rejected' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-danger"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setStatus(d, 'rejected')}
                          >
                            Reject
                          </button>
                        )}
                        {d.status !== 'pending' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn-outline"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setStatus(d, 'pending')}
                            title="Revert back to Pending"
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
    </div>
  )
}
