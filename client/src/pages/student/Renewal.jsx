import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import Stepper from '../../components/common/Stepper'

// =============================================================================
// Renewal.jsx - Student Semester Renewal Page
// 1. Automatically identifies the student's Batch Year, Year Level (e.g.,
//    2024-01 -> Batch 2024, 3rd Year), and which Semester they are renewing.
// 2. Uploads the 4 required documents and, upon submission, automatically
//    sends/links all 4 documents to My Documents (/student/documents).
// =============================================================================
const REQUIREMENTS = [
  { id: 1, name: 'Latest Grades' },
  { id: 2, name: 'Certificate of Enrollment' },
  { id: 3, name: 'Accomplishment Report' },
  { id: 4, name: 'Parent Consent' },
]

const STEPS = ['Requirements', 'Review', 'Submit']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Client-side helper to derive Batch Year and Year Level from Scholar ID (e.g. 2024-01 -> Batch 2024, 3rd Year)
function deriveBatchAndYear(scholarId, fallbackYearLevel) {
  const sid = String(scholarId || '').trim()
  if (sid.length >= 4) {
    const prefix = parseInt(sid.substring(0, 4), 10)
    if (!isNaN(prefix) && prefix >= 2018 && prefix <= 2030) {
      const yearNum = Math.min(4, Math.max(1, 2026 - prefix + 1))
      const label =
        yearNum === 1
          ? '1st Year'
          : yearNum === 2
          ? '2nd Year'
          : yearNum === 3
          ? '3rd Year'
          : '4th Year'
      return { batchYear: String(prefix), yearLevel: label }
    }
  }
  return { batchYear: '2024', yearLevel: fallbackYearLevel || '3rd Year' }
}

export default function Renewal() {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState({})
  const [uploadingId, setUploadingId] = useState(null)
  const [error, setError] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
  const name = user?.name ?? ''
  const initialDerived = deriveBatchAndYear(scholarId, user?.yearLevel)

  // Auto-identified renewal target state
  const [targetInfo, setTargetInfo] = useState({
    batchYear: initialDerived.batchYear,
    yearLevel: initialDerived.yearLevel,
    academicYear: '2026-2027',
    semester: '1st Semester',
    period: '1st Semester, 2026-2027',
    prerequisitePeriod: '1st Semester, 2026-2027',
    firstSemSubjectCount: 0,
    firstSemUnits: 0,
    firstSemGwa: 'N/A',
    hasFirstSemGrades: true,
  })

  // Fetch auto-identified target semester & any already uploaded files for this semester
  useEffect(() => {
    if (!scholarId && !name) return

    api
      .get('/renewals/target', { params: { scholarId, name } })
      .then(async (res) => {
        if (res.data) {
          let subjCount = res.data.firstSemSubjectCount ?? 0
          let unitsCount = res.data.firstSemUnits ?? 0
          let gwaVal = res.data.firstSemGwa ?? 'N/A'
          let hasGrades = res.data.hasFirstSemGrades ?? true

          // If backend wasn't restarted yet, check /grades for 1st Semester subjects
          if (res.data.firstSemSubjectCount === undefined) {
            try {
              const gRes = await api.get('/grades', { params: { scholarId, name } })
              if (Array.isArray(gRes.data)) {
                const firstSem = gRes.data.find((p) =>
                  String(p.period || '').toLowerCase().startsWith('1st semester')
                )
                if (firstSem && Array.isArray(firstSem.subjects)) {
                  subjCount = firstSem.subjects.length
                  unitsCount = firstSem.units || 0
                  gwaVal = firstSem.gwa || 'N/A'
                  hasGrades = subjCount > 0
                }
              }
            } catch {
              // Ignore
            }
          }

          setTargetInfo({
            batchYear: res.data.batchYear || initialDerived.batchYear,
            yearLevel: res.data.yearLevel || initialDerived.yearLevel,
            academicYear: res.data.academicYear || '2026-2027',
            semester: res.data.semester || '1st Semester',
            period: res.data.period || '1st Semester, 2026-2027',
            prerequisitePeriod: res.data.prerequisitePeriod || `1st Semester, ${res.data.academicYear || '2026-2027'}`,
            firstSemSubjectCount: subjCount,
            firstSemUnits: unitsCount,
            firstSemGwa: gwaVal,
            hasFirstSemGrades: hasGrades,
          })

          if (Array.isArray(res.data.documents) && res.data.documents.length > 0) {
            const loadedFiles = {}
            res.data.documents.forEach((doc) => {
              const match = REQUIREMENTS.find((r) => r.name === doc.docType)
              if (match) {
                loadedFiles[match.id] = doc.file
              }
            })
            setFiles(loadedFiles)
          }
        }
      })
      .catch((err) => console.error('Failed to identify renewal target:', err))
  }, [user])

  const isSecondSemRenewal = String(targetInfo.semester || '')
    .toLowerCase()
    .startsWith('2nd')
  const gradesPrerequisiteMet = !isSecondSemRenewal || targetInfo.hasFirstSemGrades
  const allUploaded = REQUIREMENTS.every((r) => files[r.id]) && gradesPrerequisiteMet
  const submitted = step === 3

  // Upload a requirement file and link it to the identified semester
  const handleFile = async (reqItem, e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setDraftSaved(false)

    if (file.size > MAX_SIZE) {
      setError(`${file.name} is larger than 5MB.`)
      return
    }

    setUploadingId(reqItem.id)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('scholarId', scholarId)
      formData.append('name', name)
      formData.append('docType', reqItem.name)
      formData.append('academicYear', targetInfo.academicYear)
      formData.append('semester', targetInfo.semester)

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const storedFile = res.data?.file || file.name
      setFiles((prev) => ({ ...prev, [reqItem.id]: storedFile }))
      setDraftSaved(true)
    } catch (err) {
      console.error('File upload failed:', err)
      setError(err.response?.data?.error || 'Could not upload file. Please try again.')
    } finally {
      setUploadingId(null)
    }
  }

  // Submit full renewal and ensure all 4 documents are recorded in My Documents
  const handleSubmitRenewal = async () => {
    setError('')
    setSubmitting(true)
    try {
      const submittedDocs = REQUIREMENTS.map((r) => ({
        docType: r.name,
        fileName: files[r.id] || '',
        fileSizeKb: 1024,
      })).filter((d) => d.fileName)

      await api.post('/renewals', {
        scholarId,
        name,
        academicYear: targetInfo.academicYear,
        semester: targetInfo.semester,
        status: 'under_review',
        documents: submittedDocs,
      })
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit renewal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Renewal</h2>
          <p className="muted small">
            {targetInfo.period}. Upload your 4 required documents to keep your scholarship active.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill pill-green">
            Batch {targetInfo.batchYear} • {targetInfo.yearLevel}
          </span>
          <span className="pill" style={{ background: '#e8ecff', color: '#3b4fe0', fontWeight: 600 }}>
            Renewing for: {targetInfo.yearLevel} — {targetInfo.period}
          </span>
        </div>
      </div>

      <div className="card">
        <Stepper steps={STEPS} current={submitted ? 4 : step} />

        {/* STEP 1: Requirements */}
        {step === 1 && (
          <div>
            {/* 1st Semester Grades & Subjects Prerequisite Check */}
            <div
              style={{
                background: targetInfo.hasFirstSemGrades ? '#f0fdf4' : '#fff7ed',
                border: `1px solid ${targetInfo.hasFirstSemGrades ? '#bbf7d0' : '#fed7aa'}`,
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e2a44' }}>
                  {targetInfo.hasFirstSemGrades
                    ? `✓ 1st Semester Academic Record Encoded (${targetInfo.prerequisitePeriod})`
                    : `⚠ Prerequisite Required: Encode 1st Semester Subjects & Grades First`}
                </div>
                <div className="muted small" style={{ marginTop: '2px' }}>
                  {targetInfo.hasFirstSemGrades ? (
                    <>
                      Encoded Subjects: <strong>{targetInfo.firstSemSubjectCount} courses</strong> • Total Units:{' '}
                      <strong>{targetInfo.firstSemUnits} units</strong> • Computed GWA:{' '}
                      <strong>{targetInfo.firstSemGwa}</strong>
                    </>
                  ) : (
                    <>
                      Before renewing for <strong>2nd Semester</strong>, you must first encode your{' '}
                      <strong>1st Semester subjects, units, and final grades</strong> on the Grades page.
                    </>
                  )}
                </div>
              </div>
              <Link
                to="/student/grades"
                className="ui-btn ui-btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}
              >
                {targetInfo.hasFirstSemGrades ? 'Review 1st Sem Grades' : 'Encode 1st Sem Grades →'}
              </Link>
            </div>

            <h3>Upload Required Documents</h3>
            <p className="muted small">
              Automatically detected renewal period: <strong>{targetInfo.yearLevel} ({targetInfo.period})</strong> • Accepted: PDF, JPG, PNG (max 5MB each)
            </p>

            <ul className="req-list">
              {REQUIREMENTS.map((r) => (
                <li key={r.id} className="req-item">
                  <div className="req-info">
                    <strong>{r.name}</strong>
                    {files[r.id] ? (
                      <a
                        href={`/uploads/${files[r.id]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-small"
                      >
                        {files[r.id]}
                      </a>
                    ) : (
                      <span className="muted small">No file uploaded</span>
                    )}
                  </div>
                  <span
                    className={`pill ${
                      files[r.id] ? 'pill-green' : ''
                    }`}
                    style={
                      !files[r.id]
                        ? { background: '#f0f2f8', color: '#6b7694' }
                        : undefined
                    }
                  >
                    {uploadingId === r.id
                      ? 'Uploading...'
                      : files[r.id]
                      ? 'Uploaded'
                      : 'Not Uploaded'}
                  </span>
                  <label className="ui-btn ui-btn-outline file-btn">
                    {uploadingId === r.id ? 'Saving...' : files[r.id] ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFile(r, e)}
                      disabled={uploadingId === r.id}
                      hidden
                    />
                  </label>
                </li>
              ))}
            </ul>

            {error && <div className="auth-error">{error}</div>}
            {draftSaved && (
              <div className="note-ok">Document uploaded successfully.</div>
            )}

            <div className="step-actions">
              <button
                className="ui-btn ui-btn-primary"
                disabled={!allUploaded}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
            {!allUploaded && (
              <p className="muted small hint">
                Upload all four documents to continue.
              </p>
            )}
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div>
            <h3>Review Your Submission</h3>
            <p className="muted small">
              Confirm your 4 requirements for <strong>{targetInfo.yearLevel} — {targetInfo.period}</strong> before submitting.
            </p>

            <ul className="req-list">
              {REQUIREMENTS.map((r) => (
                <li key={r.id} className="req-item">
                  <div className="req-info">
                    <strong>{r.name}</strong>
                    <a
                      href={`/uploads/${files[r.id]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-small"
                    >
                      {files[r.id]}
                    </a>
                  </div>
                  <span className="pill pill-green">Ready</span>
                </li>
              ))}
            </ul>

            {error && <div className="auth-error">{error}</div>}

            <div className="step-actions">
              <button className="ui-btn ui-btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="ui-btn ui-btn-primary"
                disabled={submitting}
                onClick={handleSubmitRenewal}
              >
                {submitting ? 'Submitting...' : 'Submit Renewal'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Submitted */}
        {step === 3 && (
          <div className="success-box">
            <div className="success-icon">✓</div>
            <h3>Renewal Submitted</h3>
            <p className="muted">
              Your renewal for <strong>{targetInfo.yearLevel} ({targetInfo.period})</strong> has been submitted, and your 4 uploaded documents have been sent to <strong>My Documents</strong> for verification.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
              <Link to="/student/documents" className="ui-btn ui-btn-primary link-btn">
                View in My Documents
              </Link>
              <Link to="/student" className="ui-btn ui-btn-outline link-btn">
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
