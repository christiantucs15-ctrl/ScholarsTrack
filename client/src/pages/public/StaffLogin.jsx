import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import useAuth from '../../hooks/useAuth'

// =============================================================================
// StaffLogin.jsx - Dedicated Login Page for Staff / Evaluator & Admin
// Accessible at /staff-login, /admin/login, and /evaluator/login
// =============================================================================
export default function StaffLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/auth/login', {
        scholarId: staffId.trim(),
        password: password.trim(),
      })

      if (res.data?.user) {
        const role = res.data.user.role
        if (role === 'student') {
          setError('Scholar accounts must sign in through the Scholar Login page.')
          setLoading(false)
          return
        }

        if (res.data.token) localStorage.setItem('token', res.data.token)
        login(res.data.user)
        const destination = role === 'admin' ? '/admin' : '/evaluator'
        navigate(destination)
        return
      }
    } catch (apiErr) {
      setError(
        apiErr.response?.data?.error || 'Invalid Staff / Admin ID or password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div
        className="auth-hero"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #1e3a8a 100%)',
        }}
      >
        <div className="auth-brand">ScholarsTrack</div>
        <p className="auth-brand-sub">Management &amp; Evaluation Portal</p>

        <div className="auth-welcome">
          <h1>Welcome, Staff &amp; Admin!</h1>
          <p className="auth-tagline">Evaluation. Verification. Governance.</p>
          <p>
            Log in to review scholarship renewals, verify submitted documents, scan SDP QR attendance, and manage scholar records.
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div
            style={{
              display: 'inline-block',
              background: '#eef2ff',
              color: '#3b4fe0',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '999px',
              marginBottom: '10px',
              letterSpacing: '0.4px',
            }}
          >
            STAFF / EVALUATOR &amp; ADMIN
          </div>
          <h2>Portal Log In</h2>
          <p className="auth-sub">Authorized personnel access</p>

          <label htmlFor="staffId">Staff / Admin ID</label>
          <input
            id="staffId"
            type="text"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            placeholder="Enter Staff, Evaluator, or Admin ID"
            required
          />

          <label htmlFor="staffPassword">Password</label>
          <div className="password-field">
            <input
              id="staffPassword"
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
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <div
            style={{
              marginTop: '18px',
              paddingTop: '14px',
              borderTop: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '13px',
            }}
          >
            <Link
              to="/login"
              style={{
                color: '#3b4fe0',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              ← Back to Scholar Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
