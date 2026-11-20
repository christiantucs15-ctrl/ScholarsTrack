import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import useNotifications from '../../hooks/useNotifications'
import { ROLES } from '../../utils/constant'

export default function Topbar({ onMenuToggle }) {
  const { user } = useAuth()
  const { unreadCount = 0 } = useNotifications() || {}
  const base =
    user?.role === ROLES.ADMIN
      ? '/admin'
      : user?.role === ROLES.EVALUATOR
      ? '/evaluator'
      : '/student'

  return (
    <header className="topbar">
      {/* Mobile Menu Button & App Brand (visible on phones) */}
      <div className="topbar-mobile-brand">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle Menu"
        >
          ☰
        </button>
        <span className="mobile-brand-title">ScholarsTrack</span>
      </div>

      <div className="topbar-right">
        <Link to={`${base}/notifications`} className="topbar-bell" title="Notifications">
          🔔
          {unreadCount > 0 && <span className="bell-count">{unreadCount}</span>}
        </Link>
        <div className="topbar-user">
          <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
          <span>{user?.name || 'User'}</span>
        </div>
      </div>
    </header>
  )
}
