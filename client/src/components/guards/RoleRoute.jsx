import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

// Only lets the listed roles through, e.g. <RoleRoute allow={['admin']} />
export default function RoleRoute({ allow }) {
  const { user } = useAuth()
  if (!allow.includes(user?.role)) return <Navigate to="/login" replace />
  return <Outlet />
}