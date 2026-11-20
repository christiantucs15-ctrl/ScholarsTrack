import { useState, useMemo, useEffect } from 'react'
import api from '../../api/axios'
import { CLUSTERS, ALL_BARANGAYS, getClusterByBarangay } from '../../utils/clustersData'
import { CDO_SCHOOLS, ensure4000ScholarsDataset } from '../../utils/cdoSchoolsData'
import { YEAR_LEVELS } from '../../utils/constant'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'

const PAGE_SIZE = 50

export default function Scholars() {
  const [scholars, setScholars] = useState(() => ensure4000ScholarsDataset([]))
  const [loading, setLoading] = useState(false)
  const [dbError, setDbError] = useState(null)

  // Search, Filter & Pagination state
  const [search, setSearch] = useState('')
  const [selectedCluster, setSelectedCluster] = useState('all')
  const [selectedBarangay, setSelectedBarangay] = useState('all')
  const [selectedScholarType, setSelectedScholarType] = useState('all')
  const [selectedYearLevel, setSelectedYearLevel] = useState('all')
  const [selectedSchool, setSelectedSchool] = useState('all')
  const [page, setPage] = useState(1)

  // Create Scholar Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Evaluator / Staff Accounts state
  const [evaluators, setEvaluators] = useState([])
  const [evalModalOpen, setEvalModalOpen] = useState(false)
  const [evalSaving, setEvalSaving] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [evalForm, setEvalForm] = useState({
    username: '',
    name: '',
    email: '',
    department: 'Scholarship Evaluation Office',
  })

  // Password Reset Requests state
  const [resetRequests, setResetRequests] = useState([])
  const [resetNotice, setResetNotice] = useState('')

  const [formData, setFormData] = useState({
    scholarId: '',
    name: '',
    email: '',
    contactNumber: '',
    school: CDO_SCHOOLS[0].name,
    barangay: 'Bugo',
    yearLevel: '1st Year',
    course: CDO_SCHOOLS[0].programs[0],
    applicantRank: 1,
  })

  // Helper: Resolve a scholar's Applicant Rank (1..2000), Scholar Type (Academic vs Non-Academic), and Maintaining GWA
  // Rule: Out of 2,000 applicants -> Rank 1..1,000 = Academic (2.00 GWA) | Rank 1,001..2,000 = Non-Academic (3.00 Grade)
  const resolveScholarRanking = (s, indexFallback = 1) => {
    let savedRanks = {}
    try {
      savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
    } catch {
      // Ignore
    }
    const sid = String(s?.scholarId || '').trim()
    let rank = Number(s?.applicantRank) || Number(savedRanks[sid]) || 0
    if (rank <= 0) {
      if (sid === '2024-004' || sid === '2024-0004' || sid === '2025-002' || sid === '2025-0002') rank = 1045
      else if (sid === '2024-005' || sid === '2026-002' || sid === '2026-0002') rank = 1280
      else {
        const parts = sid.split('-')
        const seq = parseInt(parts[parts.length - 1], 10)
        rank = !isNaN(seq) && seq > 0 ? seq : indexFallback
      }
    }
    const isAcademic = rank <= 1000
    return {
      applicantRank: rank,
      scholarshipType: isAcademic ? 'Academic' : 'Non-Academic',
      requiredGwa: isAcademic ? '2.00' : '3.00',
    }
  }

  // ---------------------------------------------------------------------------
  // Load Scholars from Express API -> SSMS
  // ---------------------------------------------------------------------------
  const fetchScholars = () => {
    setLoading(true)
    setDbError(null)

    api
      .get('/scholars')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setScholars(ensure4000ScholarsDataset(res.data))
        }
      })
      .catch((err) => {
        console.error('Database connection error:', err)
        setScholars((prev) => ensure4000ScholarsDataset(prev))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const fetchResetRequests = () => {
    api
      .get('/auth/reset-requests')
      .then((res) => {
        if (Array.isArray(res.data)) setResetRequests(res.data)
      })
      .catch((err) => console.error('Failed to load reset requests:', err))
  }

  useEffect(() => {
    fetchScholars()
    fetchResetRequests()
    api
      .get('/evaluators')
      .then((res) => {
        if (Array.isArray(res.data)) setEvaluators(res.data)
      })
      .catch((err) => console.error('Failed to load evaluators:', err))
  }, [])

  const handleResetScholarPassword = async (scholarId) => {
    setResetNotice('')
    try {
      const res = await api.post('/auth/reset-password', { scholarId })
      setResetNotice(res.data?.message || `Password for ${scholarId} has been reset to 123456.`)
      setResetRequests((prev) =>
        prev.filter((r) => r.scholarId.toLowerCase() !== scholarId.toLowerCase())
      )
    } catch (err) {
      setDbError(err.response?.data?.error || 'Could not reset password.')
    }
  }

  // Auto-derive cluster from selected barangay
  const derivedCluster = useMemo(
    () => getClusterByBarangay(formData.barangay),
    [formData.barangay]
  )

  const filterBarangayOptions = useMemo(() => {
    if (selectedCluster === 'all') return ALL_BARANGAYS
    return ALL_BARANGAYS.filter((b) => b.clusterName === selectedCluster)
  }, [selectedCluster])

  // Enrich scholars with ranking & Academic/Non-Academic classification
  const enrichedScholars = useMemo(() => {
    return scholars.map((s, idx) => {
      const rankInfo = resolveScholarRanking(s, idx + 1)
      return {
        ...s,
        applicantRank: rankInfo.applicantRank,
        scholarshipType: rankInfo.scholarshipType,
        requiredGwa: rankInfo.requiredGwa,
      }
    })
  }, [scholars])

  // Filter scholars list
  const filteredScholars = useMemo(() => {
    return enrichedScholars.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.scholarId.toLowerCase().includes(search.toLowerCase()) ||
        (s.course && s.course.toLowerCase().includes(search.toLowerCase())) ||
        (s.school && s.school.toLowerCase().includes(search.toLowerCase())) ||
        s.scholarshipType.toLowerCase().includes(search.toLowerCase())

      const matchCluster =
        selectedCluster === 'all' || s.cluster === selectedCluster

      const matchBarangay =
        selectedBarangay === 'all' || s.barangay === selectedBarangay

      const matchType =
        selectedScholarType === 'all' || s.scholarshipType === selectedScholarType

      const matchYear =
        selectedYearLevel === 'all' || s.yearLevel === selectedYearLevel

      const matchSchool =
        selectedSchool === 'all' || s.school === selectedSchool

      return (
        matchSearch &&
        matchCluster &&
        matchBarangay &&
        matchType &&
        matchYear &&
        matchSchool
      )
    })
  }, [
    enrichedScholars,
    search,
    selectedCluster,
    selectedBarangay,
    selectedScholarType,
    selectedYearLevel,
    selectedSchool,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredScholars.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedScholars = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredScholars.slice(start, start + PAGE_SIZE)
  }, [filteredScholars, currentPage])

  const yearCounts = useMemo(() => {
    const counts = { '1st Year': 0, '2nd Year': 0, '3rd Year': 0, '4th Year': 0 }
    for (const s of enrichedScholars) {
      if (counts[s.yearLevel] !== undefined) counts[s.yearLevel]++
    }
    return counts
  }, [enrichedScholars])

  // Automatically derive Year Level from the 4-digit Batch Year prefix of Scholar ID
  // (e.g. 2024-01 -> Batch 2024 -> 3rd Year in Academic Year 2026-2027)
  const deriveYearFromScholarId = (sid) => {
    const clean = String(sid || '').trim()
    if (clean.length >= 4) {
      const batchYear = parseInt(clean.substring(0, 4), 10)
      if (!isNaN(batchYear) && batchYear >= 2018 && batchYear <= 2030) {
        const yearNum = Math.min(4, Math.max(1, 2026 - batchYear + 1))
        return yearNum === 1
          ? '1st Year'
          : yearNum === 2
          ? '2nd Year'
          : yearNum === 3
          ? '3rd Year'
          : '4th Year'
      }
    }
    return '3rd Year'
  }

  // Compute next available strict YYYY-0000 ID for a given year prefix (e.g. 2026 -> 2026-1501)
  const getNextScholarIdForYear = (yearPrefix) => {
    const prefix = `${yearPrefix}-`
    let maxSeq = 0
    for (const s of scholars) {
      const sid = String(s?.scholarId || '')
      if (sid.startsWith(prefix)) {
        const num = parseInt(sid.slice(prefix.length), 10)
        if (!isNaN(num) && num > maxSeq) maxSeq = num
      }
    }
    return `${yearPrefix}-${String(maxSeq + 1).padStart(4, '0')}`
  }

  const handleOpenModal = () => {
    setErrorMessage('')
    const defaultId = getNextScholarIdForYear('2026')
    setFormData({
      scholarId: defaultId,
      name: '',
      email: '',
      contactNumber: '0917-000-0000',
      school: CDO_SCHOOLS[0].name,
      barangay: 'Bugo',
      yearLevel: deriveYearFromScholarId(defaultId),
      course: CDO_SCHOOLS[0].programs[0],
      applicantRank: 1,
    })
    setModalOpen(true)
  }

  // ---------------------------------------------------------------------------
  // SAVE SCHOLAR DIRECTLY INTO SSMS (Strictly enforcing YYYY-0000 ID format)
  // ---------------------------------------------------------------------------
  const handleCreateScholar = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    const cleanId = formData.scholarId.trim()
    if (!formData.name.trim() || !cleanId) {
      setErrorMessage('Scholar ID and Name are required.')
      return
    }

    if (!/^\d{4}-\d{4}$/.test(cleanId)) {
      setErrorMessage(
        'Scholar ID must strictly follow the "year-0000" format (4-digit year + hyphen + 4 digits, e.g. 2026-1501 or 2024-0005).'
      )
      return
    }

    setSaving(true)

    try {
      const rankNum = Math.max(1, Math.min(2000, Number(formData.applicantRank) || 1))
      const payload = {
        ...formData,
        scholarId: formData.scholarId.trim(),
        name: formData.name.trim(),
        applicantRank: rankNum,
      }

      try {
        const savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
        savedRanks[payload.scholarId] = rankNum
        localStorage.setItem('scholar_ranks_map', JSON.stringify(savedRanks))
      } catch {
        // Ignore
      }

      // Send to C# Backend -> PostgreSQL
      const res = await api.post('/scholars', payload)

      if (res.data) {
        setScholars((prev) => [res.data, ...prev])
        setModalOpen(false)
        fetchScholars() // Re-fetch to ensure fresh database state
      }
    } catch (err) {
      console.error('Failed to save scholar to database:', err)
      const msg =
        err.response?.data?.error ||
        'Failed to save to database. Please make sure your C# backend is running (`cd backend` then `dotnet run`).'
      setErrorMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateEvaluator = async (e) => {
    e.preventDefault()
    setEvalError('')
    if (!evalForm.username.trim() || !evalForm.name.trim()) {
      setEvalError('Username/Staff ID and Full Name are required.')
      return
    }
    setEvalSaving(true)
    try {
      const res = await api.post('/evaluators', {
        username: evalForm.username.trim(),
        name: evalForm.name.trim(),
        email: evalForm.email.trim(),
        department: evalForm.department.trim(),
      })
      if (res.data) {
        setEvaluators((prev) => [...prev, res.data])
        setEvalModalOpen(false)
      }
    } catch (err) {
      setEvalError(err.response?.data?.error || 'Could not create Evaluator account.')
    } finally {
      setEvalSaving(false)
    }
  }

  return (
    <div>
      {/* 1. Header Toolbar */}
      <div className="toolbar">
        <div>
          <h2>Scholars & Evaluation Staff</h2>
          <p className="muted small">
            Manage scholar accounts, assigned clusters, and Evaluator / Staff accounts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            onClick={() => {
              setEvalError('')
              setEvalForm({
                username: `staff-${evaluators.length + 1}`,
                name: '',
                email: '',
                department: 'Scholarship Evaluation Office',
              })
              setEvalModalOpen(true)
            }}
          >
            + Create Evaluator / Staff
          </Button>
          <Button variant="primary" onClick={handleOpenModal}>
            + Create Scholar Account
          </Button>
        </div>
      </div>

      {/* Database Warning Alert */}
      {dbError && (
        <div className="auth-error" style={{ marginBottom: '20px' }}>
          {dbError}
        </div>
      )}

      {resetNotice && (
        <div className="note-ok" style={{ marginBottom: '20px' }}>
          {resetNotice}
        </div>
      )}

      {/* Pending Password Reset Requests from Scholars */}
      {resetRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #e08a00' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3>Password Reset Requests ({resetRequests.length})</h3>
            <p className="muted small">
              The following scholars forgot their password and requested a reset. Clicking <strong>Approve & Reset</strong> restores their password to the default (<strong>123456</strong>) so they can log in and set a new password.
            </p>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Scholar ID</th>
                  <th>Name</th>
                  <th>Requested At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {resetRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{req.scholarId}</strong>
                    </td>
                    <td>
                      <strong>{req.scholarName}</strong>
                    </td>
                    <td className="muted small">{req.requestedAt}</td>
                    <td>
                      <button
                        type="button"
                        className="ui-btn ui-btn-primary"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => handleResetScholarPassword(req.scholarId)}
                      >
                        Approve & Reset to 123456
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. KPI Summary Cards (4,000 CDO Scholars: 1,500 1st Yr • 1,200 2nd Yr • 800 3rd Yr • 500 4th Yr) */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Total Registered Scholars</div>
          <div className="stat-value">{enrichedScholars.length.toLocaleString()}</div>
          <div className="muted small">
            1st Yr: <strong>{yearCounts['1st Year'].toLocaleString()}</strong> • 2nd Yr:{' '}
            <strong>{yearCounts['2nd Year'].toLocaleString()}</strong> • 3rd Yr:{' '}
            <strong>{yearCounts['3rd Year'].toLocaleString()}</strong> • 4th Yr:{' '}
            <strong>{yearCounts['4th Year'].toLocaleString()}</strong>
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Academic Scholars</div>
          <div className="stat-value" style={{ color: '#3b4fe0' }}>
            {enrichedScholars.filter((s) => s.scholarshipType === 'Academic').length.toLocaleString()}
          </div>
          <div className="muted small">Must maintain GWA ≤ 2.00</div>
        </div>
        <div className="card">
          <div className="stat-label">Non-Academic Scholars</div>
          <div className="stat-value" style={{ color: '#1e8e4e' }}>
            {enrichedScholars.filter((s) => s.scholarshipType === 'Non-Academic').length.toLocaleString()}
          </div>
          <div className="muted small">Must maintain Grade ≤ 3.00</div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-row" style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by ID, Name, School, Program..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ maxWidth: '240px' }}
            />

            <select
              className="form-select"
              value={selectedYearLevel}
              onChange={(e) => {
                setSelectedYearLevel(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Year Levels (4,000)</option>
              <option value="1st Year">1st Year ({yearCounts['1st Year'].toLocaleString()})</option>
              <option value="2nd Year">2nd Year ({yearCounts['2nd Year'].toLocaleString()})</option>
              <option value="3rd Year">3rd Year ({yearCounts['3rd Year'].toLocaleString()})</option>
              <option value="4th Year">4th Year ({yearCounts['4th Year'].toLocaleString()})</option>
            </select>

            <select
              className="form-select"
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto', maxWidth: '240px' }}
            >
              <option value="all">All 11 CDO Schools</option>
              {CDO_SCHOOLS.map((sc) => (
                <option key={sc.name} value={sc.name}>
                  {sc.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={selectedScholarType}
              onChange={(e) => {
                setSelectedScholarType(e.target.value)
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
                setSelectedBarangay('all')
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Clusters (A-G)</option>
              {CLUSTERS.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={selectedBarangay}
              onChange={(e) => {
                setSelectedBarangay(e.target.value)
                setPage(1)
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All Barangays</option>
              {filterBarangayOptions.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {(search ||
            selectedCluster !== 'all' ||
            selectedBarangay !== 'all' ||
            selectedScholarType !== 'all' ||
            selectedYearLevel !== 'all' ||
            selectedSchool !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setSelectedCluster('all')
                setSelectedBarangay('all')
                setSelectedScholarType('all')
                setSelectedYearLevel('all')
                setSelectedSchool('all')
                setPage(1)
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* 4. Scholars Table */}
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
              {filteredScholars.length === 0
                ? 0
                : (currentPage - 1) * PAGE_SIZE + 1}
              –{Math.min(currentPage * PAGE_SIZE, filteredScholars.length)}
            </strong>{' '}
            of <strong>{filteredScholars.length.toLocaleString()}</strong> scholars
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
                <th>Scholar Type</th>
                <th>Name & Contact</th>
                <th>School & Course</th>
                <th>Barangay & Cluster</th>
                <th>Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    Loading scholars...
                  </td>
                </tr>
              ) : paginatedScholars.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No scholars found. Click <strong>"+ Create Scholar Account"</strong> to add one!
                  </td>
                </tr>
              ) : (
                paginatedScholars.map((s) => (
                  <tr key={s.scholarId}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{s.scholarId}</strong>
                    </td>
                    <td>
                      <span
                        className={`pill small ${
                          s.scholarshipType === 'Academic' ? 'pill-blue' : 'pill-orange'
                        }`}
                        style={
                          s.scholarshipType === 'Academic'
                            ? { background: '#eef2ff', color: '#3b4fe0' }
                            : undefined
                        }
                      >
                        {s.scholarshipType} (≤ {s.requiredGwa} GWA)
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong>{s.name}</strong>
                      </div>
                      <div className="muted small">
                        {s.contactNumber || s.email}
                      </div>
                    </td>
                    <td>
                      <div>{s.school || 'City University'}</div>
                      <div className="muted small">{s.course}</div>
                    </td>
                    <td>
                      <div>{s.barangay}</div>
                      <span className="pill pill-green small">{s.cluster}</span>
                    </td>
                    <td>
                      <span className="muted small">{s.yearLevel}</span>
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

      {/* 5. Create Scholar Account Modal */}
      <Modal
        open={modalOpen}
        title="Create Scholar Account"
        className="modal-lg"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateScholar} disabled={saving}>
              {saving ? 'Saving to Database...' : 'Create Account'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateScholar}>
          <div
            style={{
              background: '#f4f6fb',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#3b4fe0',
              marginBottom: '16px',
            }}
          >
            New scholar accounts are created with the default password: <strong>123456</strong>.
          </div>

          {errorMessage && (
            <div className="auth-error" style={{ marginBottom: '14px' }}>
              {errorMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>Scholar ID (Strictly YYYY-0000) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2026-1501"
                pattern="^\d{4}-\d{4}$"
                title="Must strictly follow YYYY-0000 format (e.g. 2026-1501)"
                value={formData.scholarId}
                onChange={(e) => {
                  const newId = e.target.value
                  setFormData({
                    ...formData,
                    scholarId: newId,
                    yearLevel: deriveYearFromScholarId(newId),
                  })
                }}
                required
              />
            </div>

            <div className="form-field">
              <label>Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sarall Lumactod"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. scholar@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Contact Number 📞</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 0917-123-4567"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>CDO School / University *</label>
              <select
                className="form-select"
                value={formData.school}
                onChange={(e) => {
                  const chosenSchool = e.target.value
                  const schoolObj =
                    CDO_SCHOOLS.find((sc) => sc.name === chosenSchool) || CDO_SCHOOLS[0]
                  setFormData({
                    ...formData,
                    school: chosenSchool,
                    course: schoolObj.programs[0],
                  })
                }}
                required
              >
                {CDO_SCHOOLS.map((sc) => (
                  <option key={sc.name} value={sc.name}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Course / Program *</label>
              <select
                className="form-select"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                required
              >
                {(
                  CDO_SCHOOLS.find((sc) => sc.name === formData.school)?.programs ||
                  CDO_SCHOOLS[0].programs
                ).map((prog) => (
                  <option key={prog} value={prog}>
                    {prog}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>Barangay *</label>
              <select
                className="form-select"
                value={formData.barangay}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
              >
                {ALL_BARANGAYS.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.clusterName})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Assigned Cluster</label>
              <div
                style={{
                  padding: '10px 12px',
                  background: '#f4f6fb',
                  borderRadius: '8px',
                  fontWeight: 600,
                  color: '#1e8e4e',
                }}
              >
                {derivedCluster}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>Year Level</label>
              <select
                className="form-select"
                value={formData.yearLevel}
                onChange={(e) => {
                  const chosenYear = e.target.value
                  const yearPrefix =
                    chosenYear === '1st Year'
                      ? '2026'
                      : chosenYear === '2nd Year'
                      ? '2025'
                      : chosenYear === '3rd Year'
                      ? '2024'
                      : '2023'
                  setFormData({
                    ...formData,
                    yearLevel: chosenYear,
                    scholarId: getNextScholarIdForYear(yearPrefix),
                  })
                }}
              >
                {YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Scholar Type *</label>
              <select
                className="form-select"
                value={Number(formData.applicantRank) <= 1000 ? 'Academic' : 'Non-Academic'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    applicantRank: e.target.value === 'Academic' ? 1 : 1001,
                  })
                }
              >
                <option value="Academic">Academic (Maintain ≤ 2.00 GWA)</option>
                <option value="Non-Academic">Non-Academic (Maintain ≤ 3.00 Grade)</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Evaluator / Staff Accounts Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="toolbar" style={{ marginBottom: '12px' }}>
          <div>
            <h3>Evaluator & Staff Accounts</h3>
            <p className="muted small">
              Staff accounts authorized to review applications, verify documents, assess eligibility, and approve or reject renewals (Default password: <strong>123456</strong>).
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Login Username / ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Department / Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {evaluators.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    Default accounts: <strong>evaluator</strong> and <strong>staff</strong> (password: 123456).
                  </td>
                </tr>
              ) : (
                evaluators.map((ev) => (
                  <tr key={ev.id || ev.username}>
                    <td>
                      <strong style={{ color: '#3b4fe0' }}>{ev.username}</strong>
                    </td>
                    <td>
                      <strong>{ev.name}</strong>
                    </td>
                    <td className="muted small">{ev.email}</td>
                    <td>{ev.department}</td>
                    <td>
                      <span className="pill pill-green small">Evaluator</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Evaluator / Staff Modal */}
      <Modal
        open={evalModalOpen}
        title="Create Evaluator / Staff Account"
        onClose={() => setEvalModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEvalModalOpen(false)} disabled={evalSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateEvaluator} disabled={evalSaving}>
              {evalSaving ? 'Saving...' : 'Create Staff Account'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateEvaluator}>
          <div
            style={{
              background: '#f4f6fb',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#3b4fe0',
              marginBottom: '16px',
            }}
          >
            Evaluator accounts log in with the default password: <strong>123456</strong>.
          </div>

          {evalError && (
            <div className="auth-error" style={{ marginBottom: '12px' }}>
              {evalError}
            </div>
          )}

          <div className="form-field">
            <label>Login Username / Staff ID *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. evaluator or staff-01"
              value={evalForm.username}
              onChange={(e) => setEvalForm({ ...evalForm, username: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label>Full Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Maria Santos"
              value={evalForm.name}
              onChange={(e) => setEvalForm({ ...evalForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. evaluator@cityscholar.edu"
              value={evalForm.email}
              onChange={(e) => setEvalForm({ ...evalForm, email: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>Department / Unit</label>
            <input
              type="text"
              className="form-input"
              value={evalForm.department}
              onChange={(e) => setEvalForm({ ...evalForm, department: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
