import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { ROLES } from '../../utils/constant'

const studentLinks = [
  { to: '/student', label: 'Dashboard', end: true },
  { to: '/student/profile', label: 'My Profile' },
  { to: '/student/renewal', label: 'Renewal' },
  { to: '/student/renewal-history', label: 'Renewal History' },
  { to: '/student/documents', label: 'Documents' },
  { to: '/student/sdp', label: 'SDP Tracker' },
  { to: '/student/grades', label: 'Grades' },
  { to: '/student/status', label: 'Scholarship Status' },
  { to: '/student/about', label: 'About the Program' },
  { to: '/student/notifications', label: 'Notifications' },
]

// Evaluator / Staff role: reviews applications, verifies documents, scans SDP QR attendance, and approves/rejects renewals
const evaluatorLinks = [
  { to: '/evaluator', label: 'Dashboard', end: true },
  { to: '/evaluator/renewals', label: 'Renewal Applications' },
  { to: '/evaluator/documents', label: 'Document Verification' },
  { to: '/evaluator/sdp', label: 'SDP QR Attendance' },
  { to: '/evaluator/notifications', label: 'Notifications' },
]

// Admin role: manages scholars & staff accounts, SDP, clusters, reports, and program settings
const adminLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/scholars', label: 'Scholars & Staff' },
  { to: '/admin/sdp', label: 'SDP Management' },
  { to: '/admin/clusters', label: 'Clusters' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/notifications', label: 'Notifications' },
]

export default function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const links =
    user?.role === ROLES.ADMIN
      ? adminLinks
      : user?.role === ROLES.EVALUATOR
      ? evaluatorLinks
      : studentLinks

  const handleLogout = () => {
    const isStaffOrAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.EVALUATOR
    logout()
    navigate(isStaffOrAdmin ? '/staff-login' : '/login', { replace: true })
  }

  return (
    <>
      {/* Backdrop overlay when mobile menu drawer is open */}
      {open && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <div className="sidebar-logo">ScholarsTrack</div>
            <div style={{ fontSize: '11px', color: '#8fa2d9', marginTop: '2px' }}>
              {user?.role === ROLES.ADMIN
                ? 'Admin Portal'
                : user?.role === ROLES.EVALUATOR
                ? 'Evaluator / Staff Portal'
                : 'Scholar Portal'}
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close Menu"
          >
            ✕
          </button>
        </div>

        {/* Compact User Summary Card inside Sidebar */}
        {user && (
          <div className="sidebar-user-card">
            <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '15px' }}>
              {user.name?.charAt(0) || 'U'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.name}
              </div>
              <div style={{ fontSize: '11px', color: '#9fb0e0' }}>
                {user.scholarId || user.role}
              </div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => {
                if (onClose) onClose()
              }}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-logout" onClick={() => setConfirmOpen(true)}>
          Log Out
        </button>

        <Modal
          open={confirmOpen}
          title="Log Out"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleLogout}>
                Log Out
              </Button>
            </>
          }
        >
          Are you sure you want to log out?
        </Modal>
      </aside>
    </>
  )
}
