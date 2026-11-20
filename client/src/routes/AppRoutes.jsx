import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/guards/ProtectedRoute'
import RoleRoute from '../components/guards/RoleRoute'
import StudentLayout from '../components/layout/StudentLayout'
import AdminLayout from '../components/layout/AdminLayout'
import { ROLES } from '../utils/constant'

// Public pages (Scholar Login & Staff/Admin Portal Login)
import Login from '../pages/public/Login'
import StaffLogin from '../pages/public/StaffLogin'

// Student pages
import StudentDashboard from '../pages/student/Dashboard'
import Profile from '../pages/student/Profile'
import Renewal from '../pages/student/Renewal'
import RenewalHistory from '../pages/student/RenewalHistory'
import StudentRenewalDetails from '../pages/student/RenewalDetails'
import StudentDocuments from '../pages/student/Documents'
import SdpTracker from '../pages/student/SdpTracker'
import Grades from '../pages/student/Grades'
import ScholarshipStatus from '../pages/student/ScholarshipStatus'
import AboutProgram from '../pages/student/AboutProgram'
import StudentNotifications from '../pages/student/Notifications'

// Evaluator / Staff pages
import EvaluatorDashboard from '../pages/evaluator/Dashboard'
import Renewals from '../pages/admin/Renewals'
import AdminRenewalDetails from '../pages/admin/RenewalDetails'
import DocumentVerification from '../pages/admin/DocumentVerification'

// Admin pages
import AdminDashboard from '../pages/admin/Dashboard'
import Scholars from '../pages/admin/Scholars'
import SdpManagement from '../pages/admin/SdpManagement'
import Clusters from '../pages/admin/Clusters'
import Reports from '../pages/admin/Reports'
import Settings from '../pages/admin/Settings'
import AdminNotifications from '../pages/admin/Notifications'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root URL goes directly to the Scholar Login screen */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/staff-login" element={<StaffLogin />} />
      <Route path="/admin/login" element={<StaffLogin />} />
      <Route path="/evaluator/login" element={<StaffLogin />} />

      <Route element={<ProtectedRoute />}>
        {/* 1. Student Portal */}
        <Route element={<RoleRoute allow={[ROLES.STUDENT]} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="renewal" element={<Renewal />} />
            <Route path="renewal-history" element={<RenewalHistory />} />
            <Route path="renewal-history/:id" element={<StudentRenewalDetails />} />
            <Route path="documents" element={<StudentDocuments />} />
            <Route path="sdp" element={<SdpTracker />} />
            <Route path="grades" element={<Grades />} />
            <Route path="status" element={<ScholarshipStatus />} />
            <Route path="about" element={<AboutProgram />} />
            <Route path="notifications" element={<StudentNotifications />} />
          </Route>
        </Route>

        {/* 2. Evaluator / Staff Portal (Reviews Applications, Verifies Documents, Assesses Eligibility, Approves/Rejects) */}
        <Route element={<RoleRoute allow={[ROLES.EVALUATOR]} />}>
          <Route path="/evaluator" element={<AdminLayout />}>
            <Route index element={<EvaluatorDashboard />} />
            <Route path="renewals" element={<Renewals />} />
            <Route path="renewals/:id" element={<AdminRenewalDetails />} />
            <Route path="documents" element={<DocumentVerification />} />
            <Route path="sdp" element={<SdpManagement />} />
            <Route path="notifications" element={<AdminNotifications />} />
          </Route>
        </Route>

        {/* 3. Admin Portal (Manages Scholars & Staff, SDP, Clusters, Reports & Settings) */}
        <Route element={<RoleRoute allow={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="scholars" element={<Scholars />} />
            <Route path="sdp" element={<SdpManagement />} />
            <Route path="clusters" element={<Clusters />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<AdminNotifications />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
