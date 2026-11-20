import { useState, useEffect, useMemo } from 'react'
import api from '../../api/axios'
import { getMyProfile } from '../../api/profile.api'
import useAuth from '../../hooks/useAuth'
import { getClusterByBarangay } from '../../utils/clustersData'
import { normalizeScholarIdFormat, normalizeFourYearCollegeCourse } from '../../utils/cdoSchoolsData'
import { PROGRAM_NAME } from '../../utils/constant'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ScholarQrPass from '../../components/common/ScholarQrPass'

// Small helper so every read-only field looks the same
function ReadOnlyField({ label, value }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        type="text"
        className="form-input"
        value={value ?? ''}
        disabled
        style={{ background: '#f4f6fb', cursor: 'not-allowed', color: '#6b7694' }}
      />
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Change Password modal state
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false
    const scholarId = user.scholarId ?? user.scholar_id ?? user.id ?? ''
    const userName = user.name ?? ''

    getMyProfile(scholarId, userName)
      .then((res) => {
        if (cancelled) return
        const data = res.data?.data ?? res.data

        const resolvedId = normalizeScholarIdFormat(data.scholarId ?? data.scholar_id ?? scholarId)
        let savedRanks = {}
        try {
          savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
        } catch {
          // Ignore
        }
        const sid = String(resolvedId || '').trim()
        let rank = Number(data.applicantRank) || Number(savedRanks[sid]) || 0
        if (rank <= 0) {
          if (sid === '2024-004' || sid === '2025-002') rank = 1045
          else if (sid === '2024-005' || sid === '2026-002') rank = 1280
          else {
            const parts = sid.split('-')
            const seq = parseInt(parts[parts.length - 1], 10)
            rank = !isNaN(seq) && seq > 0 ? seq : 1
          }
        }
        const isAcademic = rank <= 1000

        setProfile({
          scholarId: resolvedId,
          name: data.name ?? data.fullName ?? data.full_name ?? user.name,
          email: data.email,
          contact: data.contact ?? data.contactNumber ?? data.contact_number,
          barangay: data.barangay,
          cluster: data.cluster,
          university: data.school ?? data.university,
          course: normalizeFourYearCollegeCourse(data.course, data.school ?? data.university),
          yearLevel: data.yearLevel ?? data.year_level ?? data.year,
          applicantRank: rank,
          scholarshipType: data.scholarshipType || (isAcademic ? 'Academic' : 'Non-Academic'),
          requiredGwa: data.requiredGwa || (isAcademic ? '2.00' : '3.00'),
        })
      })
      .catch((err) => {
        console.error('Profile load failed:', err.response?.status, err.response?.data)
        if (!cancelled) setError('Could not load your profile. Please try again later.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  // Use the cluster saved by the admin; otherwise compute it from the barangay
  const cluster = useMemo(() => {
    if (!profile) return ''

    if (profile.cluster) {
      const c = String(profile.cluster).trim()
      return /^cluster/i.test(c) ? c : `Cluster ${c}`
    }

    const computed = getClusterByBarangay(String(profile.barangay ?? '').trim())
    return computed || 'Unassigned'
  }, [profile])

  const handleOpenPwdModal = () => {
    setPwdError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswords(false)
    setPwdModalOpen(true)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPwdError('Please enter your current password and new password.')
      return
    }

    if (newPassword.trim().length < 6) {
      setPwdError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setPwdError('New password and confirmation do not match.')
      return
    }

    setPwdSaving(true)
    try {
      await api.put('/auth/change-password', {
        scholarId: profile?.scholarId || user?.scholarId || '',
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      })
      setPwdModalOpen(false)
      setPwdSuccess('Your password has been updated.')
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Could not update password. Please try again.')
    } finally {
      setPwdSaving(false)
    }
  }

  if (loading) return <p>Loading profile...</p>
  if (error) return <div className="note-warn">{error}</div>
  if (!profile) return null

  const isAssigned = cluster && cluster !== 'Unassigned'

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>My Profile</h2>
          <p className="muted small">
            Personal information and academic details for {PROGRAM_NAME}. Your cluster is automatically
            determined by your home barangay.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenPwdModal}>
          Change Password
        </Button>
      </div>

      {pwdSuccess && (
        <div className="note-ok" style={{ marginBottom: '20px' }}>
          {pwdSuccess}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Personal & Academic Details</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ReadOnlyField label="Scholar ID (Issued by Admin)" value={profile.scholarId} />
            <ReadOnlyField label="Full Name" value={profile.name} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ReadOnlyField label="Email Address" value={profile.email} />
            <ReadOnlyField label="Contact Number" value={profile.contact} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ReadOnlyField label="Home Barangay" value={profile.barangay} />

            <div className="form-field">
              <label>Assigned Cluster</label>
              <div
                style={{
                  padding: '10px 12px',
                  background: '#e3f6ea',
                  borderRadius: '8px',
                  fontWeight: 700,
                  color: '#1e8e4e',
                }}
              >
                {cluster}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ReadOnlyField label="School / University" value={profile.university} />
            <ReadOnlyField label="Course / Program" value={profile.course} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ReadOnlyField label="Year Level" value={profile.yearLevel} />
            <ReadOnlyField
              label="Scholarship Type"
              value={`${profile.scholarshipType} Scholar (Maintain ≤ ${profile.requiredGwa} GWA)`}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#3b4fe0',
                color: '#fff',
                fontSize: '28px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              {profile.name?.charAt(0)}
            </div>
            <h3 style={{ margin: '0 0 4px' }}>{profile.name}</h3>
            <p className="muted small" style={{ margin: '0 0 12px' }}>
              Scholar ID: {profile.scholarId}
            </p>
            <span className={`pill ${isAssigned ? 'pill-green' : ''}`}>{cluster}</span>
          </div>

          <ScholarQrPass
            scholarId={profile.scholarId}
            name={profile.name}
            cluster={cluster}
            school={profile.university}
            yearLevel={profile.yearLevel}
          />

          <div className="card">
            <h4 style={{ marginBottom: '8px' }}>Account Security</h4>
            <p className="muted small" style={{ lineHeight: 1.5, marginBottom: '12px' }}>
              You can replace your default password with your own personal password at any time.
            </p>
            <Button variant="outline" onClick={handleOpenPwdModal}>
              Update Password
            </Button>
          </div>

          <div className="card">
            <h4 style={{ marginBottom: '10px' }}>Program Notice</h4>
            <p className="muted small" style={{ lineHeight: 1.5 }}>
              Renewal of scholarship is required <strong>every semester</strong>. Your details are
              managed by the scholarship office. If something is incorrect, please contact the
              admin to update it.
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={pwdModalOpen}
        title="Change Password"
        onClose={() => setPwdModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPwdModalOpen(false)} disabled={pwdSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleChangePassword} disabled={pwdSaving}>
              {pwdSaving ? 'Updating...' : 'Save New Password'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleChangePassword}>
          {pwdError && (
            <div className="auth-error" style={{ marginBottom: '12px' }}>
              {pwdError}
            </div>
          )}

          <div className="form-field">
            <label>Current Password *</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>New Password * (at least 6 characters)</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Confirm New Password *</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="form-input"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#6b7694',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            Show passwords
          </label>
        </form>
      </Modal>
    </div>
  )
}
