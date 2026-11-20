import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Button from '../../components/common/Button'

// =============================================================================
// Settings.jsx - Admin System Configuration Page
// Loads and updates active academic year, semester, renewal window, deadline,
// and default scholar password in the PostgreSQL 'system_settings' table
// via C# endpoints (GET /api/settings and PUT /api/settings).
// =============================================================================
export default function Settings() {
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [semester, setSemester] = useState('1st Semester')
  const [renewalOpen, setRenewalOpen] = useState(true)
  const [deadline, setDeadline] = useState('2026-11-30')
  const [defaultPassword, setDefaultPassword] = useState('123456')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load current settings from PostgreSQL when the page opens
  useEffect(() => {
    api
      .get('/settings')
      .then((res) => {
        if (res.data) {
          setAcademicYear(res.data.academicYear || '2026-2027')
          setSemester(res.data.semester || '1st Semester')
          setRenewalOpen(res.data.renewalOpen ?? true)
          setDeadline(res.data.deadline || '2026-11-30')
          setDefaultPassword(res.data.defaultPassword || '123456')
        }
      })
      .catch((err) => console.error('Failed to load settings:', err))
  }, [])

  // Save updated settings back to PostgreSQL via C# API
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      await api.put('/settings', {
        academicYear,
        semester,
        renewalOpen,
        deadline,
        defaultPassword,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>System Settings</h2>
          <p className="muted small">
            Configure the active academic year, semester renewal periods, and account defaults.
          </p>
        </div>
      </div>

      {saved && (
        <div className="note-ok" style={{ marginBottom: '20px' }}>
          ✓ Program settings saved successfully.
        </div>
      )}

      <div style={{ maxWidth: '680px' }}>
        <form onSubmit={handleSave}>
          {/* Active Period Card */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '14px' }}>Active Period Configuration</h3>
            <p className="muted small" style={{ marginBottom: '16px' }}>
              Determines the active renewal cycle applied to all scholar accounts and reports.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-field">
                <label>Academic Year</label>
                <input
                  type="text"
                  className="form-input"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Semester</label>
                <select
                  className="form-select"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer Term">Summer Term</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-field">
                <label>Renewal Submissions Window</label>
                <select
                  className="form-select"
                  value={renewalOpen ? 'open' : 'closed'}
                  onChange={(e) => setRenewalOpen(e.target.value === 'open')}
                >
                  <option value="open">🟢 Open (Scholars can submit)</option>
                  <option value="closed">🔴 Closed (Submissions locked)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Submission Deadline</label>
                <input
                  type="date"
                  className="form-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Account Defaults */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '14px' }}>Scholar Account Defaults</h3>
            <p className="muted small" style={{ marginBottom: '16px' }}>
              Since accounts are issued by the admin, new scholars use this initial password on their first login.
            </p>

            <div className="form-field">
              <label>Default Initial Password</label>
              <input
                type="text"
                className="form-input"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                style={{ maxWidth: '300px' }}
                required
              />
            </div>
          </div>

          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </div>
    </div>
  )
}
