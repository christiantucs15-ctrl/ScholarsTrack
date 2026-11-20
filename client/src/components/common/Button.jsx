export default function Button({ variant = 'primary', type = 'button', children, ...props }) {
  return (
    <button type={type} className={`ui-btn ui-btn-${variant}`} {...props}>
      {children}
    </button>
  )
}