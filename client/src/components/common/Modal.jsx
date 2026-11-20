import { createPortal } from 'react-dom'

export default function Modal({ open, title, onClose, children, footer, className = '' }) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 10000 }}
    >
      <div
        className={`modal ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 10001 }}
      >
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}