import { getStatus } from '../../utils/statusColors'

export default function Badge({ status }) {
  const { label, className } = getStatus(status)
  return <span className={`badge ${className}`}>{label}</span>
}