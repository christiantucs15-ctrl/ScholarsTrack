import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'
import { ensure4000ScholarsDataset, normalizeScholarIdFormat } from '../../utils/cdoSchoolsData'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [scholarId, setScholarId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Forgot Password Request Modal State
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetId, setResetId] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanId = scholarId.trim()
    const cleanPwd = password.trim()

    try {
      // Authenticate directly against C# ASP.NET Core + PostgreSQL database
      const res = await api.post('/auth/login', {
        scholarId: cleanId,
        password: cleanPwd,
      })

      if (res.data?.user) {
        const role = res.data.user.role
        if (role === 'admin' || role === 'evaluator' || role === 'staff') {
          setError('Staff, Evaluator, and Admin accounts must sign in on the Staff & Admin Login page.')
          setLoading(false)
          return
        }

        if (res.data.token) localStorage.setItem('token', res.data.token)
        const normalizedUser = {
          ...res.data.user,
          scholarId: normalizeScholarIdFormat(res.data.user.scholarId),
        }
        login(normalizedUser)
        navigate('/student')
        return
      }
    } catch (apiErr) {
      // If this is one of the 4,000 CDO scholars not yet synced to PostgreSQL and password is 123456,
      // automatically register them in PostgreSQL via POST /api/scholars and log them in!
      if (cleanPwd === '123456') {
        const normInputId = normalizeScholarIdFormat(cleanId)
        const all4000 = ensure4000ScholarsDataset([])
        const matched = all4000.find(
          (s) => s.scholarId.toLowerCase() === normInputId.toLowerCase()
        )
        if (matched) {
          try {
            await api.post('/scholars', {
              scholarId: matched.scholarId,
              name: matched.name,
              email: matched.email,
              contactNumber: matched.contactNumber,
              school: matched.school,
              barangay: matched.barangay,
              course: matched.course,
              yearLevel: matched.yearLevel,
              applicantRank: matched.applicantRank,
            })
          } catch {
            // Ignore if already exists
          }

          try {
            const savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
            savedRanks[matched.scholarId] = matched.applicantRank
            localStorage.setItem('scholar_ranks_map', JSON.stringify(savedRanks))
          } catch {
            // Ignore
          }

          const scholarUser = {
            id: matched.scholarId,
            scholarId: matched.scholarId,
            name: matched.name,
            email: matched.email,
            contact: matched.contactNumber,
            school: matched.school,
            course: matched.course,
            barangay: matched.barangay,
            cluster: matched.cluster,
            yearLevel: matched.yearLevel,
            applicantRank: matched.applicantRank,
            scholarshipType: matched.scholarshipType,
            requiredGwa: matched.requiredGwa,
            role: 'student',
          }
          localStorage.setItem('token', `jwt-${matched.scholarId}`)
          login(scholarUser)
          navigate('/student')
          return
        }
      }

      setError(
        apiErr.response?.data?.error || 'Invalid Scholar ID or password.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleOpenForgotModal = () => {
    setResetError('')
    setResetSuccess('')
    setResetId(scholarId.trim())
    setForgotOpen(true)
  }

  const handleRequestReset = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetSuccess('')

    if (!resetId.trim()) {
      setResetError('Please enter your Scholar ID.')
      return
    }

    setResetSubmitting(true)
    try {
      const targetId = resetId.trim()
      const all4000 = ensure4000ScholarsDataset([])
      const matched = all4000.find(
        (s) => s.scholarId.toLowerCase() === targetId.toLowerCase()
      )
      if (matched) {
        await api
          .post('/scholars', {
            scholarId: matched.scholarId,
            name: matched.name,
            email: matched.email,
            contactNumber: matched.contactNumber,
            school: matched.school,
            barangay: matched.barangay,
            course: matched.course,
            yearLevel: matched.yearLevel,
            applicantRank: matched.applicantRank,
          })
          .catch(() => {})
      }

      const res = await api.post('/auth/forgot-password', {
        scholarId: targetId,
      })
      setResetSuccess(
        res.data?.message ||
          'Request sent! Once the Admin approves it, your password will be reset to 123456.'
      )
    } catch (err) {
      setResetError(
        err.response?.data?.error ||
          'Could not reach server. Make sure your C# backend is restarted (Ctrl + C then dotnet run).'
      )
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-brand">ScholarsTrack</div>
        <p className="auth-brand-sub">Scholarship Management System</p>

        <div className="auth-welcome">
          <h1>Welcome, Scholar!</h1>
          <p className="auth-tagline">Your goals. Our support.</p>
          <p>Log in to access your scholarship information and requirements.</p>
        </div>
      </div>

      <div className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Log In</h2>
          <p className="auth-sub">Access your account</p>

          <label htmlFor="scholarId">Scholar ID</label>
          <input
            id="scholarId"
            type="text"
            value={scholarId}
            onChange={(e) => setScholarId(e.target.value)}
            placeholder="Enter your Scholar ID"
            required
          />

          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="auth-row">
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={handleOpenForgotModal}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b4fe0',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Forgot Password?
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <p className="auth-note">
            Forgot your password? Click <strong>Forgot Password?</strong> above to request a password reset from the administrator.
          </p>

          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '13px',
            }}
          >
            <span className="muted">Staff / Evaluator or Admin? </span>
            <Link
              to="/staff-login"
              style={{
                color: '#3b4fe0',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Portal Login →
            </Link>
          </div>
        </form>
      </div>

      {/* Forgot Password Request Modal */}
      <Modal
        open={forgotOpen}
        title="Request Password Reset"
        onClose={() => setForgotOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>
              Close
            </Button>
            {!resetSuccess && (
              <Button variant="primary" onClick={handleRequestReset} disabled={resetSubmitting}>
                {resetSubmitting ? 'Sending...' : 'Send Request to Admin'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={handleRequestReset}>
          <p className="muted small" style={{ marginBottom: '14px', lineHeight: 1.5 }}>
            Enter your <strong>Scholar ID</strong> below. The Admin will receive your request and reset your password back to the default (<strong>123456</strong>) so you can log in and set a new password.
          </p>

          {resetError && (
            <div className="auth-error" style={{ marginBottom: '12px' }}>
              {resetError}
            </div>
          )}

          {resetSuccess ? (
            <div className="note-ok" style={{ marginBottom: '12px' }}>
              {resetSuccess}
            </div>
          ) : (
            <div className="form-field">
              <label>Scholar ID *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2024-001"
                value={resetId}
                onChange={(e) => setResetId(e.target.value)}
                required
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
