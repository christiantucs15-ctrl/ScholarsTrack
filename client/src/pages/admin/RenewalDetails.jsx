import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import {
  ensure4000RenewalsDataset,
  getScholarDocumentsForEvaluation,
  getRenewalOverridesMap,
  saveRenewalOverride,
} from '../../utils/cdoSchoolsData'
import { ROLES } from '../../utils/constant'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'

function buildDefaultProgramSubjects(courseProgram) {
  const prog = String(courseProgram || '').toLowerCase()
  if (prog.includes('nurs') || prog.includes('midwif')) {
    return [
      { id: 1, code: 'NCM 112', name: 'Care of Clients with Problems in Oxygenation, Fluid & Electrolytes', units: 5, grade: '1.50', remarks: 'Passed' },
      { id: 2, code: 'NCM 113', name: 'Community Health Nursing II (Population Groups & Community)', units: 4, grade: '1.25', remarks: 'Passed' },
      { id: 3, code: 'NCM 114', name: 'Care of the Older Adult (Geriatric Nursing)', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 4, code: 'NURS 301', name: 'Nursing Research 1', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 5, code: 'BIOSTAT', name: 'Biostatistics for Nursing', units: 3, grade: '1.25', remarks: 'Passed' },
    ]
  }
  if (prog.includes('office')) {
    return [
      { id: 1, code: 'OAD 201', name: 'Administrative Office Procedures and Management', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 2, code: 'OAD 202', name: 'Business Report Writing & Executive Correspondence', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 3, code: 'OAD 203', name: 'Machine Shorthand and Transcription', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 4, code: 'OAD 204', name: 'Records and Information Management', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 5, code: 'OAD 205', name: 'Customer Relations and Front Office Operations', units: 3, grade: '1.25', remarks: 'Passed' },
    ]
  }
  if (prog.includes('crim')) {
    return [
      { id: 1, code: 'CRIM 201', name: 'Theories of Crime Causation', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 2, code: 'CDI 201', name: 'Fundamentals of Criminal Investigation and Intelligence', units: 4, grade: '1.25', remarks: 'Passed' },
      { id: 3, code: 'CLJ 201', name: 'Philippine Criminal Justice System', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 4, code: 'FOREN 201', name: 'Personal Identification Techniques', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 5, code: 'LEA 201', name: 'Law Enforcement Operations and Planning', units: 3, grade: '1.50', remarks: 'Passed' },
    ]
  }
  if (prog.includes('account') || prog.includes('bsa') || prog.includes('finance')) {
    return [
      { id: 1, code: 'ACTG 201', name: 'Intermediate Accounting 1', units: 6, grade: '1.50', remarks: 'Passed' },
      { id: 2, code: 'ACTG 202', name: 'Cost Accounting and Control', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 3, code: 'BLAW 201', name: 'Law on Obligations and Contracts', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 4, code: 'TAX 201', name: 'Income Taxation', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 5, code: 'ECON 201', name: 'Microeconomic Theory and Practice', units: 3, grade: '1.25', remarks: 'Passed' },
    ]
  }
  if (prog.includes('educ') || prog.includes('btvted') || prog.includes('btled')) {
    return [
      { id: 1, code: 'EDUC 201', name: 'Facilitating Learner-Centered Teaching', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 2, code: 'EDUC 202', name: 'Assessment in Learning 1', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 3, code: 'EDUC 203', name: 'The Teacher and the School Curriculum', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 4, code: 'EDUC 204', name: 'Technology for Teaching and Learning 1', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 5, code: 'EDUC 205', name: 'Foundation of Special and Inclusive Education', units: 3, grade: '1.50', remarks: 'Passed' },
    ]
  }
  if (prog.includes('engin') || prog.includes('arch')) {
    return [
      { id: 1, code: 'ENGR 201', name: 'Differential Equations for Engineers', units: 3, grade: '1.50', remarks: 'Passed' },
      { id: 2, code: 'ENGR 202', name: 'Mechanics of Deformable Bodies & Structural Design', units: 4, grade: '1.75', remarks: 'Passed' },
      { id: 3, code: 'ENGR 203', name: 'Engineering Economics & Project Management', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 4, code: 'ENGR 204', name: 'Computer-Aided Drafting and Design (CAD)', units: 3, grade: '1.25', remarks: 'Passed' },
      { id: 5, code: 'ENGR 205', name: 'Thermodynamics and Fluid Mechanics', units: 4, grade: '1.50', remarks: 'Passed' },
    ]
  }
  return [
    { id: 1, code: 'IT 201', name: 'Data Structures and Algorithms', units: 3, grade: '1.25', remarks: 'Passed' },
    { id: 2, code: 'IT 202', name: 'Object-Oriented Programming', units: 3, grade: '1.50', remarks: 'Passed' },
    { id: 3, code: 'IT 203', name: 'Information Management & Database Systems', units: 3, grade: '1.25', remarks: 'Passed' },
    { id: 4, code: 'IT 204', name: 'Networking 1 (Fundamentals)', units: 3, grade: '1.50', remarks: 'Passed' },
    { id: 5, code: 'IT 205', name: 'Human-Computer Interaction', units: 3, grade: '1.25', remarks: 'Passed' },
  ]
}

// =============================================================================
// RenewalDetails.jsx - Evaluator Application Review, Document Verification &
// Eligibility Assessment Page
// Lets the Evaluator / Staff inspect all 4 uploaded documents, view the
// scholar's encoded courses & GWA per semester, and Approve or Reject the renewal.
// =============================================================================
export default function RenewalDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const base = user?.role === ROLES.EVALUATOR ? '/evaluator' : '/admin'

  const [renewal, setRenewal] = useState(null)
  const [semesterGrades, setSemesterGrades] = useState([])
  const [selectedGradePeriod, setSelectedGradePeriod] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionType, setActionType] = useState('approve')
  const [remarks, setRemarks] = useState('')

  // Load real renewal + scholar profile + uploaded documents + encoded semester grades from PostgreSQL (or 4,000 dataset)
  useEffect(() => {
    setLoading(true)
    const all4000Renewals = ensure4000RenewalsDataset([])
    const matchedFrom4000 = all4000Renewals.find(
      (r) =>
        String(r.scholarId).toLowerCase() === String(id).toLowerCase() ||
        String(r.id) === String(id)
    )

    const loadFallbackFrom4000 = () => {
      if (!matchedFrom4000) return
      const docs = getScholarDocumentsForEvaluation(
        matchedFrom4000.scholarId,
        matchedFrom4000.name,
        matchedFrom4000.yearLevel,
        matchedFrom4000.cluster
      )
      const defaultSubjs = buildDefaultProgramSubjects(matchedFrom4000.course)
      const totalU = defaultSubjs.reduce((acc, x) => acc + x.units, 0)
      const wSum = defaultSubjs.reduce((acc, x) => acc + parseFloat(x.grade) * x.units, 0)
      const gwaStr = (wSum / totalU).toFixed(2)
      const targetPeriod = matchedFrom4000.period || '1st Semester, 2026-2027'

      setRenewal({
        ...matchedFrom4000,
        gwa: gwaStr,
        totalUnits: totalU,
        sdpCompleted: 2,
        sdpTotal: 6,
        documents: docs,
      })
      setSelectedGradePeriod(targetPeriod)
      setSemesterGrades([
        {
          period: targetPeriod,
          gwa: gwaStr,
          units: totalU,
          subjects: defaultSubjs,
        },
      ])
    }

    if (/^\d+$/.test(String(id))) {
      api
        .get(`/renewals/${id}`)
        .then(async (res) => {
          if (res.data) {
            setRenewal(res.data)
            const targetPeriod = res.data.period || '1st Semester, 2026-2027'
            setSelectedGradePeriod(targetPeriod)

            try {
              const gRes = await api.get('/grades', {
                params: {
                  scholarId: res.data.scholarId,
                  name: res.data.name,
                },
              })
              if (Array.isArray(gRes.data)) {
                setSemesterGrades(gRes.data)
                if (
                  gRes.data.length > 0 &&
                  !gRes.data.some((s) => s.period === targetPeriod)
                ) {
                  setSelectedGradePeriod(gRes.data[0].period)
                }
              }
            } catch {
              // Ignore
            }
          } else {
            loadFallbackFrom4000()
          }
        })
        .catch(() => loadFallbackFrom4000())
        .finally(() => setLoading(false))
    } else {
      loadFallbackFrom4000()
      setLoading(false)
    }
  }, [id])

  const handleUpdateDocStatus = async (docId, nextStatus) => {
    const targetDoc = renewal?.documents?.find((d) => d.id === docId)
    if (renewal?.scholarId && targetDoc?.name) {
      const overrides = getRenewalOverridesMap()
      const key = String(renewal.scholarId).toLowerCase()
      const prevStatuses = overrides[key]?.docStatuses || {}
      saveRenewalOverride(renewal.scholarId, {
        docStatuses: { ...prevStatuses, [targetDoc.name]: nextStatus },
      })
    }

    if (typeof docId === 'number' || /^\d+$/.test(String(docId))) {
      api.put(`/documents/${docId}/status`, { status: nextStatus }).catch(() => {})
    }

    setRenewal((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId ? { ...d, status: nextStatus } : d
      ),
    }))
  }

  const handleAction = async () => {
    if (!renewal) return
    const newStatus = actionType === 'approve' ? 'approved' : 'rejected'

    saveRenewalOverride(renewal.scholarId, {
      status: newStatus,
      remarks,
    })

    if (typeof renewal.id === 'number') {
      api
        .put(`/renewals/${renewal.id}/status`, {
          status: newStatus,
          remarks,
        })
        .catch(() => {})
    }

    setRenewal((prev) => ({
      ...prev,
      status: newStatus,
      remarks,
    }))
    setModalOpen(false)
  }

  if (loading) return <p>Loading renewal details...</p>
  if (!renewal) return <div className="note-warn">Renewal record not found.</div>

  // Match the active semester's grades (defaults to the renewal's semester period, or evaluator's selected period)
  const activeSemesterRecord =
    semesterGrades.find((s) => s.period === selectedGradePeriod) ||
    semesterGrades.find((s) => s.period === renewal.period) ||
    null

  const displayedGwa = activeSemesterRecord
    ? activeSemesterRecord.gwa
    : renewal.gwa || 'N/A'
  const displayedUnits = activeSemesterRecord
    ? activeSemesterRecord.units
    : renewal.totalUnits || 0
  const displayedSubjects = activeSemesterRecord?.subjects || []

  const docsList = renewal.documents || []
  const verifiedDocsCount = docsList.filter((d) => d.status === 'verified').length

  // Determine Scholar's Applicant Rank (1..1,000 = Academic -> 2.00 GWA | 1,001..2,000 = Non-Academic -> 3.00 Grade)
  let savedRanks = {}
  try {
    savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
  } catch {
    // Ignore
  }
  const sid = String(renewal.scholarId || '').trim()
  let scholarRank = Number(renewal.applicantRank) || Number(savedRanks[sid]) || 0
  if (scholarRank <= 0) {
    if (sid === '2024-004' || sid === '2025-002') scholarRank = 1045
    else if (sid === '2024-005' || sid === '2026-002') scholarRank = 1280
    else {
      const parts = sid.split('-')
      const seq = parseInt(parts[parts.length - 1], 10)
      scholarRank = !isNaN(seq) && seq > 0 ? seq : 1
    }
  }
  const isAcademicScholar = scholarRank <= 1000
  const scholarType = renewal.scholarshipType || (isAcademicScholar ? 'Academic' : 'Non-Academic')
  const requiredGwa = renewal.requiredGwa || (scholarType === 'Academic' ? '2.00' : '3.00')

  const numericGwa = parseFloat(displayedGwa)
  const gwaPassing =
    !isNaN(numericGwa) && numericGwa > 0 && numericGwa <= parseFloat(requiredGwa)

  // Compute unpassed failed courses (> 3.00 / 5.00) across the scholar's semesters:
  // 1-2 fails -> On Probation (OP) | 3+ fails -> Scholarship Forfeited
  const passedCodes = new Set()
  for (const sem of semesterGrades) {
    for (const sub of sem.subjects || []) {
      const g = parseFloat(sub.grade)
      if (!isNaN(g) && g > 0 && g <= 3.0) {
        passedCodes.add(String(sub.code || '').trim().toUpperCase())
      }
    }
  }
  const unpassedFailedCourses = []
  for (const sem of semesterGrades) {
    for (const sub of sem.subjects || []) {
      const codeKey = String(sub.code || '').trim().toUpperCase()
      const g = parseFloat(sub.grade)
      if (!isNaN(g) && g > 3.0 && !passedCodes.has(codeKey)) {
        unpassedFailedCourses.push(sub)
      }
    }
  }
  const failCount = unpassedFailedCourses.length
  const isForfeited = failCount >= 3
  const isOnProbation = failCount > 0 && failCount < 3

  const isFullyEligible =
    !isForfeited &&
    docsList.length >= 4 &&
    verifiedDocsCount === 4 &&
    (gwaPassing || displayedGwa === 'N/A')

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link to={`${base}/renewals`} className="link-small">
          ← Back to Renewal Applications
        </Link>
      </div>

      <div className="toolbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Application Review & Eligibility: {renewal.name}</h2>
            <span
              className={`pill ${scholarType === 'Academic' ? 'pill-green' : 'pill-orange'}`}
              style={{ fontSize: '12px' }}
            >
              {scholarType} Scholar (Maintain ≤ {requiredGwa} GWA)
            </span>
          </div>
          <p className="muted small" style={{ marginTop: '4px' }}>
            Scholar ID: {renewal.scholarId} • Renewal Period: <strong>{renewal.period}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            style={{ color: '#c0392b', borderColor: '#c0392b' }}
            onClick={() => {
              setActionType('reject')
              setRemarks('')
              setModalOpen(true)
            }}
          >
            Reject Application
          </Button>
          <Button
            variant="primary"
            style={{ background: '#1e8e4e' }}
            onClick={() => {
              setActionType('approve')
              setRemarks('All requirements verified and scholar meets retention eligibility.')
              setModalOpen(true)
            }}
          >
            Approve Application
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Eligibility Assessment Card */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <h3>Eligibility Assessment</h3>
              <span
                className={`pill ${
                  isForfeited
                    ? 'pill-red'
                    : isOnProbation
                    ? 'pill-orange'
                    : isFullyEligible
                    ? 'pill-green'
                    : 'pill-orange'
                }`}
              >
                {isForfeited
                  ? `✕ Scholarship Forfeited (${failCount} Failed Courses)`
                  : isOnProbation
                  ? `⚠ On Probation (OP) — ${failCount} Failed Course${failCount > 1 ? 's' : ''} (Must Retake & Pass)`
                  : isFullyEligible
                  ? '✓ Eligible for Approval'
                  : 'Pending Document Verification'}
              </span>
            </div>

            <div className="stat-grid">
              <div style={{ background: '#f4f6fb', padding: '12px', borderRadius: '8px' }}>
                <div className="muted small">Documents Verified</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f1b3d', marginTop: '4px' }}>
                  {verifiedDocsCount} / 4 Verified
                </div>
                <div className="muted small">{docsList.length} uploaded</div>
              </div>

              <div style={{ background: '#f4f6fb', padding: '12px', borderRadius: '8px' }}>
                <div className="muted small">
                  {scholarType} GWA ({selectedGradePeriod || renewal.period})
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: gwaPassing ? '#1e8e4e' : '#c0392b',
                    marginTop: '4px',
                  }}
                >
                  {displayedGwa}
                </div>
                <div className="muted small">
                  {displayedUnits ? `${displayedUnits} units • ` : ''}Required ≤ {requiredGwa} ({scholarType})
                </div>
              </div>

              <div style={{ background: '#f4f6fb', padding: '12px', borderRadius: '8px' }}>
                <div className="muted small">SDP Participation</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b4fe0', marginTop: '4px' }}>
                  {renewal.sdpCompleted ?? 0} / {renewal.sdpTotal ?? 0}
                </div>
                <div className="muted small">Activities completed</div>
              </div>
            </div>
          </div>

          {/* 2. Submitted Documents Checklist */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3>Submitted Requirements ({docsList.length}/4)</h3>
              <Badge status={renewal.status} />
            </div>

            {docsList.length === 0 ? (
              <p className="muted small">
                This scholar has not uploaded their 4 renewal documents yet.
              </p>
            ) : (
              <ul className="req-list">
                {docsList.map((doc) => (
                  <li key={doc.id} className="req-item">
                    <div className="req-info">
                      <strong>{doc.name}</strong>
                      <span className="muted small">
                        File: {doc.file} ({doc.size})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Badge status={doc.status} />
                      <a
                        href={`/uploads/${doc.file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-small"
                      >
                        View File
                      </a>
                      {doc.status !== 'verified' && (
                        <button
                          type="button"
                          className="ui-btn ui-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleUpdateDocStatus(doc.id, 'verified')}
                        >
                          Mark Verified
                        </button>
                      )}
                      {doc.status !== 'pending' && (
                        <button
                          type="button"
                          className="ui-btn ui-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleUpdateDocStatus(doc.id, 'pending')}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {renewal.remarks && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '14px',
                  background: '#f4f6fb',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                <strong>Evaluation Remarks:</strong> {renewal.remarks}
              </div>
            )}
          </div>

          {/* 3. Encoded Courses & Grades Breakdown for Evaluator Inspection */}
          <div className="card">
            <div
              className="toolbar"
              style={{
                borderBottom: '1px solid #f0f2f8',
                paddingBottom: '12px',
                marginBottom: '12px',
              }}
            >
              <div>
                <h3>Encoded Courses & Grades ({renewal.course})</h3>
                <span className="muted small">
                  Showing subjects encoded by {renewal.name} for{' '}
                  <strong>{selectedGradePeriod || renewal.period}</strong>
                </span>
              </div>

              {semesterGrades.length > 0 && (
                <select
                  className="form-select"
                  value={selectedGradePeriod}
                  onChange={(e) => setSelectedGradePeriod(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  {semesterGrades.map((sem) => (
                    <option key={sem.period} value={sem.period}>
                      {sem.period} ({sem.units} units • GWA {sem.gwa})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course / Subject Description</th>
                    <th>Units</th>
                    <th>Final Grade</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSubjects.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="table-empty">
                        No courses encoded for <strong>{selectedGradePeriod || renewal.period}</strong> yet.
                      </td>
                    </tr>
                  ) : (
                    displayedSubjects.map((sub) => (
                      <tr key={sub.id || sub.code}>
                        <td>
                          <strong>{sub.code}</strong>
                        </td>
                        <td>{sub.name}</td>
                        <td>{sub.units}</td>
                        <td>
                          <strong>{sub.grade}</strong>
                        </td>
                        <td>
                          <Badge status={sub.remarks || 'passed'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. Scholar Profile Sidebar */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '16px' }}>Scholar Profile</h3>

          <div style={{ marginBottom: '14px' }}>
            <div className="muted small">Full Name:</div>
            <strong>{renewal.name}</strong>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div className="muted small">Barangay:</div>
            <div>{renewal.barangay}</div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div className="muted small">Assigned Cluster:</div>
            <div style={{ marginTop: '4px' }}>
              <span className="pill pill-green">{renewal.cluster}</span>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div className="muted small">Course:</div>
            <div>{renewal.course}</div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div className="muted small">Year Level:</div>
            <div>{renewal.yearLevel || '3rd Year'}</div>
          </div>

          <div>
            <div className="muted small">Submitted On:</div>
            <div>{renewal.submittedOn}</div>
          </div>
        </div>
      </div>

      {/* Approve / Reject Confirmation Modal */}
      <Modal
        open={modalOpen}
        title={actionType === 'approve' ? 'Approve Renewal' : 'Reject Renewal'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAction}>
              {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        <div className="form-field">
          <label>
            {actionType === 'approve'
              ? 'Approval Note (Optional)'
              : 'Reason for Rejection *'}
          </label>
          <textarea
            className="form-textarea"
            rows="4"
            placeholder={
              actionType === 'approve'
                ? 'e.g. All documents verified. Scholar is in good standing.'
                : 'e.g. Certificate of Enrollment is blurry. Please re-upload.'
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
