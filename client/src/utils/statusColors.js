const GREEN = 'badge-approved'
const ORANGE = 'badge-pending'
const RED = 'badge-rejected'

const STATUS_STYLES = {
  approved: { label: 'Approved', className: GREEN },
  verified: { label: 'Verified', className: GREEN },
  completed: { label: 'Completed', className: GREEN },
  active: { label: 'Active', className: GREEN },
  passed: { label: 'Passed', className: GREEN },
  'passed (retaken)': { label: 'Passed (Retaken)', className: GREEN },
  ready: { label: 'Ready', className: GREEN },
  uploaded: { label: 'Uploaded', className: GREEN },
  submitted: { label: 'Submitted', className: GREEN },
  pending: { label: 'Pending', className: ORANGE },
  under_review: { label: 'Under Review', className: ORANGE },
  for_verification: { label: 'For Verification', className: ORANGE },
  in_progress: { label: 'In Progress', className: ORANGE },
  probation: { label: 'On Probation (OP)', className: ORANGE },
  on_probation: { label: 'On Probation (OP)', className: ORANGE },
  'on probation (op)': { label: 'On Probation (OP)', className: ORANGE },
  rejected: { label: 'Rejected', className: RED },
  not_uploaded: { label: 'Not Uploaded', className: RED },
  failed: { label: 'Failed', className: RED },
  'failed (must retake)': { label: 'Failed (Must Retake)', className: RED },
  forfeited: { label: 'Forfeited', className: RED },
  'scholarship forfeited': { label: 'Scholarship Forfeited', className: RED },
  inactive: { label: 'Inactive', className: RED },
}

export function getStatus(status) {
  const key = String(status || '').trim().toLowerCase()
  return (
    STATUS_STYLES[key] || {
      label: String(status || '').replace(/_/g, ' '),
      className: 'badge-gray',
    }
  )
}
