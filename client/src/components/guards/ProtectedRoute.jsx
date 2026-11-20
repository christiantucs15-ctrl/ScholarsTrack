import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

// Redirects unauthenticated visitors to /staff-login for Admin/Evaluator routes, or /login for Student routes
export default function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    const isStaffOrAdminRoute =
      location.pathname.startsWith('/admin') || location.pathname.startsWith('/evaluator')
    return <Navigate to={isStaffOrAdminRoute ? '/staff-login' : '/login'} replace />
  }
  return <Outlet />
}
