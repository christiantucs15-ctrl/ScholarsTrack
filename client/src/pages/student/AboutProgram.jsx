import { PROGRAM_NAME } from '../../utils/constant'
import { CLUSTERS } from '../../utils/clustersData'

export default function AboutProgram() {
  return (
    <div>
      <h2>About the {PROGRAM_NAME}</h2>
      <p>
        An exclusive, city-funded merit and developmental scholarship initiative supporting tertiary students across all 35 barangays.
      </p>

      {/* Program Pillars */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '24px' }}>100%</div>
          <div className="stat-label">Full Tuition & Stipend</div>
          <div className="muted small">Disbursed per semester</div>
        </div>

        <div className="card">
          <div className="stat-value" style={{ fontSize: '24px', color: '#1e8e4e' }}>35 Barangays</div>
          <div className="stat-label">City-Wide Coverage</div>
          <div className="muted small">Divided into 7 Clusters (A to G)</div>
        </div>

        <div className="card">
          <div className="stat-value" style={{ fontSize: '24px', color: '#3b4fe0' }}>SDP Training</div>
          <div className="stat-label">Student Development</div>
          <div className="muted small">Leadership & community service</div>
        </div>
      </div>

      {/* Program Details */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '14px' }}>Scholarship Guidelines & Retention Policy</h3>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.8', fontSize: '14px', color: '#1e2a44' }}>
          <li>
            <strong>Admission & Entrance:</strong> Scholars are accepted based on competitive city entrance examination results. Accounts are officially created and issued by the City Scholarship Office.
          </li>
          <li>
            <strong>Semester Renewal:</strong> Scholars must renew every semester by submitting the four (4) mandatory documents: Latest Copy of Grades, Certificate of Enrollment (COE), Accomplishment Report, and Parent Consent.
          </li>
          <li>
            <strong>Grade Requirement:</strong> Maintain a General Weighted Average (GWA) of 2.50 or better, with no failing or incomplete grades.
          </li>
          <li>
            <strong>Student Development Program (SDP):</strong> Participate in and complete the required hours for Community Service, Leadership Training, and city seminars each semester.
          </li>
        </ul>
      </div>

      {/* Cluster Allocation Reference */}
      <div className="card">
        <h3 style={{ marginBottom: '14px' }}>7 Clusters (A to G) Representation</h3>
        <p className="muted small" style={{ marginBottom: '16px' }}>
          Each cluster represents 5 barangays for local activities and community service assignments.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {CLUSTERS.map((c) => (
            <div
              key={c.id}
              style={{
                background: '#f4f6fb',
                padding: '12px 14px',
                borderRadius: '8px',
              }}
            >
              <strong style={{ color: '#0f1b3d' }}>{c.name}</strong>
              <div className="muted small" style={{ marginTop: '4px' }}>
                {c.barangays.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
