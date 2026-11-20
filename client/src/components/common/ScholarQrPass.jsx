import { useState } from 'react'
import Button from './Button'
import Modal from './Modal'

// =============================================================================
// ScholarQrPass.jsx
// Displays the Scholar's unique Digital ID QR Code ("SCHOLARSTRACK:<scholarId>")
// used by Staff / Evaluators to scan Time-In and Time-Out at SDP Activities.
// =============================================================================
export default function ScholarQrPass({ scholarId, name, cluster, school, yearLevel }) {
  const [modalOpen, setModalOpen] = useState(false)
  // Short, high-contrast payload with quiet-zone margin & error correction so phone cameras
  // can easily scan the QR code directly off a laptop monitor even with screen glare.
  const qrPayload = `${scholarId}`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&ecc=M&margin=16&data=${encodeURIComponent(
    qrPayload
  )}`

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrPayload)
    }
  }

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '999px',
            background: '#eef2ff',
            color: '#3b4fe0',
            fontSize: '11px',
            fontWeight: 700,
            marginBottom: '10px',
            letterSpacing: '0.3px',
          }}
        >
          SDP ATTENDANCE QR PASS
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px',
            width: '204px',
            height: '204px',
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={qrImageUrl}
            alt={`QR Code for ${scholarId}`}
            style={{ width: '180px', height: '180px', display: 'block', imageRendering: 'pixelated' }}
          />
        </div>

        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e2a44' }}>
          {scholarId}
        </div>
        <p className="muted small" style={{ margin: '4px 0 12px', lineHeight: 1.4 }}>
          Present this QR code to the Staff / Evaluator at SDP events for <strong>Time-In</strong> and <strong>Time-Out</strong>.
        </p>

        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Enlarge QR Pass
        </Button>
      </div>

      <Modal
        open={modalOpen}
        title="Digital Scholar QR Pass"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={handleCopyCode}>
              Copy QR Code ID
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <div
          style={{
            textAlign: 'center',
            background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)',
            border: '1px solid #dce3f2',
            borderRadius: '16px',
            padding: '24px 20px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#3b4fe0',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginBottom: '4px',
            }}
          >
            ScholarsTrack Official Pass
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '20px' }}>{name}</h3>
          <div className="muted small" style={{ marginBottom: '16px' }}>
            {school || 'City University'} • {yearLevel || 'Scholar'}
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '2px solid #3b4fe0',
              borderRadius: '16px',
              padding: '16px',
              width: '240px',
              height: '240px',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(59, 79, 224, 0.1)',
            }}
          >
            <img
              src={qrImageUrl}
              alt={`QR Code for ${scholarId}`}
              style={{ width: '208px', height: '208px', display: 'block' }}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                background: '#eef2ff',
                color: '#3b4fe0',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '15px',
                letterSpacing: '0.5px',
              }}
            >
              ID: {scholarId}
            </span>
          </div>

          <div>
            <span className="pill pill-green">{cluster}</span>
          </div>

          <p className="muted small" style={{ marginTop: '14px', marginBottom: 0 }}>
            Show this screen to the Staff or Evaluator during event registration (Time-In) and dismissal (Time-Out).
          </p>
        </div>
      </Modal>
    </>
  )
}
