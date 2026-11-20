import { useState, useEffect, useMemo } from 'react'
import api from '../../api/axios'
import { getMyProfile } from '../../api/profile.api'
import useAuth from '../../hooks/useAuth'
import { normalizeFourYearCollegeCourse } from '../../utils/cdoSchoolsData'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'

// =============================================================================
// Grades.jsx - Student Academic Records & Manual Subject / Unit Input Page
// Automatically aligns every scholar's courses/subjects with their actual
// Degree Program (e.g. BS in Nursing, BS Tourism Management, BS Accountancy,
// BS Information Technology, BS Civil Engineering, BS Education, etc.)
// =============================================================================
const SEMESTER_OPTIONS = [
  '1st Semester, 2026-2027',
  '2nd Semester, 2026-2027',
  '1st Semester, 2025-2026',
  '2nd Semester, 2025-2026',
]

// Program-specific curriculum subjects so every scholar's courses match their degree program
function getProgramCurriculum(courseProgram) {
  const prog = String(courseProgram || '').toLowerCase()

  if (prog.includes('nurs')) {
    return [
      { code: 'NCM 112', name: 'Care of Clients with Problems in Oxygenation, Fluid & Electrolytes', units: 5, grade: '1.50' },
      { code: 'NCM 113', name: 'Community Health Nursing II (Population Groups & Community)', units: 4, grade: '1.25' },
      { code: 'NCM 114', name: 'Care of the Older Adult (Geriatric Nursing)', units: 3, grade: '1.50' },
      { code: 'NURS 301', name: 'Nursing Research 1', units: 3, grade: '1.50' },
      { code: 'BIOSTAT', name: 'Biostatistics for Nursing', units: 3, grade: '1.25' },
      { code: 'NCM 115', name: 'Care of Clients with Maladaptive Patterns of Behavior', units: 4, grade: '1.50' },
    ]
  }

  if (prog.includes('tourism') || prog.includes('hospitality') || prog.includes('hm')) {
    return [
      { code: 'TM 301', name: 'Philippine Culture and Tourism Geography', units: 3, grade: '1.25' },
      { code: 'TM 302', name: 'Tour and Travel Management', units: 3, grade: '1.50' },
      { code: 'TM 303', name: 'Sustainable Tourism Development', units: 3, grade: '1.25' },
      { code: 'TM 304', name: 'Foreign Language 1 (Hospitality & Tourism)', units: 3, grade: '1.50' },
      { code: 'TM 305', name: 'Transportation and Cruise Line Operations', units: 3, grade: '1.50' },
      { code: 'TM 306', name: 'MICE (Meetings, Incentives, Conferences & Events) Management', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('office')) {
    return [
      { code: 'OAD 201', name: 'Administrative Office Procedures and Management', units: 3, grade: '1.25' },
      { code: 'OAD 202', name: 'Business Report Writing & Executive Correspondence', units: 3, grade: '1.50' },
      { code: 'OAD 203', name: 'Machine Shorthand and Transcription', units: 3, grade: '1.25' },
      { code: 'OAD 204', name: 'Records and Information Management', units: 3, grade: '1.50' },
      { code: 'OAD 205', name: 'Customer Relations and Front Office Operations', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('entrep') || prog.includes('business') || prog.includes('bsba') || prog.includes('econ')) {
    return [
      { code: 'BUS 201', name: 'Principles of Management and Organization', units: 3, grade: '1.25' },
      { code: 'BUS 202', name: 'Entrepreneurial Behavior and Opportunity Seeking', units: 3, grade: '1.50' },
      { code: 'BUS 203', name: 'Marketing Management and Strategy', units: 3, grade: '1.25' },
      { code: 'BUS 204', name: 'Managerial Economics and Financial Analysis', units: 3, grade: '1.50' },
      { code: 'BUS 205', name: 'Business Law and Obligations & Contracts', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('account') || prog.includes('bsa') || prog.includes('finance')) {
    return [
      { code: 'ACTG 201', name: 'Intermediate Accounting 1', units: 6, grade: '1.50' },
      { code: 'ACTG 202', name: 'Cost Accounting and Control', units: 3, grade: '1.25' },
      { code: 'BLAW 201', name: 'Law on Obligations and Contracts', units: 3, grade: '1.50' },
      { code: 'TAX 201', name: 'Income Taxation', units: 3, grade: '1.50' },
      { code: 'ECON 201', name: 'Microeconomic Theory and Practice', units: 3, grade: '1.25' },
      { code: 'FIN 201', name: 'Financial Management', units: 3, grade: '1.50' },
    ]
  }

  if (prog.includes('educ') || prog.includes('teaching') || prog.includes('beed') || prog.includes('bsed') || prog.includes('btvted') || prog.includes('btled') || prog.includes('livelihood')) {
    return [
      { code: 'EDUC 201', name: 'Facilitating Learner-Centered Teaching', units: 3, grade: '1.25' },
      { code: 'EDUC 202', name: 'Assessment in Learning 1', units: 3, grade: '1.50' },
      { code: 'EDUC 203', name: 'The Teacher and the School Curriculum', units: 3, grade: '1.25' },
      { code: 'EDUC 204', name: 'Technology for Teaching and Learning 1', units: 3, grade: '1.25' },
      { code: 'EDUC 205', name: 'Foundation of Special and Inclusive Education', units: 3, grade: '1.50' },
    ]
  }

  if ((prog.includes('engin') && !prog.includes('computer') && !prog.includes('marine')) || prog.includes('civil') || prog.includes('mech') || prog.includes('electr') || prog.includes('arch')) {
    return [
      { code: 'ENGR 201', name: 'Differential Equations for Engineers', units: 3, grade: '1.50' },
      { code: 'ENGR 202', name: 'Mechanics of Deformable Bodies & Structural Design', units: 4, grade: '1.75' },
      { code: 'ENGR 203', name: 'Engineering Economics & Project Management', units: 3, grade: '1.25' },
      { code: 'ENGR 204', name: 'Computer-Aided Drafting and Design (CAD)', units: 3, grade: '1.25' },
      { code: 'ENGR 205', name: 'Thermodynamics and Fluid Mechanics', units: 4, grade: '1.50' },
    ]
  }

  if (prog.includes('agri') || prog.includes('bio') || prog.includes('chem') || prog.includes('math')) {
    return [
      { code: 'SCI 201', name: 'General Ecology and Environmental Science', units: 4, grade: '1.25' },
      { code: 'SCI 202', name: 'Analytical Methods and Quantitative Research', units: 4, grade: '1.50' },
      { code: 'SCI 203', name: 'Organic and Applied Biochemistry', units: 4, grade: '1.25' },
      { code: 'SCI 204', name: 'Statistical Analysis for Natural Sciences', units: 3, grade: '1.50' },
      { code: 'SCI 205', name: 'Scientific Instrumentation and Laboratory Techniques', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('crim')) {
    return [
      { code: 'CRIM 201', name: 'Theories of Crime Causation', units: 3, grade: '1.50' },
      { code: 'CDI 201', name: 'Fundamentals of Criminal Investigation and Intelligence', units: 4, grade: '1.25' },
      { code: 'CLJ 201', name: 'Philippine Criminal Justice System', units: 3, grade: '1.50' },
      { code: 'FOREN 201', name: 'Personal Identification Techniques', units: 3, grade: '1.25' },
      { code: 'LEA 201', name: 'Law Enforcement Operations and Planning', units: 3, grade: '1.50' },
    ]
  }

  if (prog.includes('marine') || prog.includes('maritime')) {
    return [
      { code: 'MAR 201', name: 'Terrestrial and Coastal Navigation 1', units: 4, grade: '1.50' },
      { code: 'MAR 202', name: 'Ship, Ship Routines and Ship Construction', units: 3, grade: '1.25' },
      { code: 'MAR 203', name: 'Maritime Law and International Conventions', units: 3, grade: '1.50' },
      { code: 'MAR 204', name: 'Meteorology and Oceanography 1', units: 3, grade: '1.50' },
      { code: 'MAR 205', name: 'Basic Marine Engineering & Safety', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('med') || prog.includes('pharm') || prog.includes('radio') || prog.includes('nutri') || prog.includes('midwif')) {
    return [
      { code: 'HLT 201', name: 'Human Anatomy and Physiology with Pathophysiology', units: 5, grade: '1.50' },
      { code: 'HLT 202', name: 'Clinical Chemistry and Laboratory Diagnostics', units: 4, grade: '1.25' },
      { code: 'HLT 203', name: 'Pharmacology and Therapeutics', units: 3, grade: '1.50' },
      { code: 'HLT 204', name: 'Medical Microbiology and Parasitology', units: 4, grade: '1.50' },
      { code: 'HLT 205', name: 'Public Health and Epidemiology', units: 3, grade: '1.25' },
    ]
  }

  if (prog.includes('psych') || prog.includes('social') || prog.includes('comm') || prog.includes('arts') || prog.includes('pol') || prog.includes('english') || prog.includes('music') || prog.includes('lib')) {
    return [
      { code: 'HUM 201', name: 'Theories of Personality & Human Behavior', units: 3, grade: '1.25' },
      { code: 'HUM 202', name: 'Social Science Research Methods & Statistics', units: 3, grade: '1.50' },
      { code: 'HUM 203', name: 'Development Communication and Media Ethics', units: 3, grade: '1.25' },
      { code: 'HUM 204', name: 'Community Organization and Social Welfare', units: 3, grade: '1.50' },
      { code: 'HUM 205', name: 'Philippine Society, Culture, and Governance', units: 3, grade: '1.25' },
    ]
  }

  if ((prog.includes('tesda') || prog.includes('vocational')) && !prog.includes('it')) {
    return [
      { code: 'TVET 101', name: 'Occupational Health and Safety Procedures (OHSP)', units: 3, grade: '1.25' },
      { code: 'TVET 102', name: 'Technical Blueprint Reading and Trade Mensuration', units: 3, grade: '1.50' },
      { code: 'TVET 103', name: 'Core Trade Competency & Applied Workshop Lab 1', units: 5, grade: '1.25' },
      { code: 'TVET 104', name: 'Core Trade Competency & Applied Workshop Lab 2', units: 5, grade: '1.50' },
      { code: 'TVET 105', name: 'Workplace Communication and Entrepreneurship', units: 3, grade: '1.25' },
    ]
  }

  // Default: BS Information Technology / Computer Science
  return [
    { code: 'IT 201', name: 'Data Structures and Algorithms', units: 3, grade: '1.25' },
    { code: 'IT 202', name: 'Object-Oriented Programming', units: 3, grade: '1.50' },
    { code: 'IT 203', name: 'Information Management & Database Systems', units: 3, grade: '1.25' },
    { code: 'IT 204', name: 'Networking 1 (Fundamentals)', units: 3, grade: '1.50' },
    { code: 'IT 205', name: 'Human-Computer Interaction', units: 3, grade: '1.25' },
    { code: 'IT 311', name: 'Systems Integration and Architecture', units: 3, grade: '1.50' },
  ]
}

export default function Grades() {
  const { user } = useAuth()
  const [scholarCourse, setScholarCourse] = useState(user?.course || '')
  const [rankInfo, setRankInfo] = useState({
    applicantRank: 1,
    scholarshipType: 'Academic',
    requiredGwa: '2.00',
  })
  const [semesters, setSemesters] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('1st Semester, 2026-2027')
  const [loading, setLoading] = useState(true)

  // Modal state for manually adding a subject & unit
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    period: '1st Semester, 2026-2027',
    code: '',
    subjectName: '',
    units: 3,
    grade: '1.50',
  })

  const scholarId = user?.scholarId ?? user?.scholar_id ?? ''
  const name = user?.name ?? ''

  const programCurriculum = useMemo(
    () => getProgramCurriculum(scholarCourse),
    [scholarCourse]
  )

  const syncAndLoadGrades = async (preferPeriod) => {
    setLoading(true)
    try {
      // 1. Fetch scholar's exact Course / Program & Applicant Rank from their profile first
      let detectedProgram = normalizeFourYearCollegeCourse(user?.course || '', user?.school)
      try {
        const profRes = await getMyProfile(scholarId, name)
        const profData = profRes.data?.data ?? profRes.data
        if (profData?.course) {
          detectedProgram = normalizeFourYearCollegeCourse(profData.course, profData.school)
          setScholarCourse(detectedProgram)
        }
        let savedRanks = {}
        try {
          savedRanks = JSON.parse(localStorage.getItem('scholar_ranks_map') || '{}')
        } catch {
          // Ignore
        }
        const sid = String(profData?.scholarId || scholarId || '').trim()
        let rank = Number(profData?.applicantRank) || Number(savedRanks[sid]) || 0
        if (rank <= 0) {
          if (sid === '2024-004' || sid === '2025-002') rank = 1045
          else if (sid === '2024-005' || sid === '2026-002') rank = 1280
          else {
            const parts = sid.split('-')
            const seq = parseInt(parts[parts.length - 1], 10)
            rank = !isNaN(seq) && seq > 0 ? seq : 1
          }
        }
        const isAcademic = rank <= 1000
        setRankInfo({
          applicantRank: rank,
          scholarshipType: isAcademic ? 'Academic' : 'Non-Academic',
          requiredGwa: isAcademic ? '2.00' : '3.00',
        })
      } catch {
        // Fallback to user.course
      }

      // 2. Fetch grades from backend
      const res = await api.get('/grades', { params: { scholarId, name } })
      let semData = Array.isArray(res.data) ? res.data : []

      const targetCurriculum = getProgramCurriculum(detectedProgram).slice(0, 5)
      const expectedUsesIt = targetCurriculum[0]?.code?.startsWith('IT ')
      const allSubjects = semData.flatMap((s) => s.subjects || [])
      const hasMismatchedItSubjects =
        !expectedUsesIt &&
        detectedProgram &&
        allSubjects.some((sub) => /^(IT|CS)\s/i.test(String(sub.code || '')))

      // 3. If this scholar is NOT in an IT/Computer program (e.g. BS Office Administration, BS in Nursing, etc.)
      //    but has default IT subjects (or 0 subjects), automatically replace them with their exact program curriculum!
      if (hasMismatchedItSubjects || (allSubjects.length === 0 && detectedProgram)) {
        for (const sub of allSubjects) {
          if (sub.id && /^(IT|CS|GE)\s/i.test(String(sub.code || ''))) {
            await api.delete(`/grades/${sub.id}`).catch(() => {})
          }
        }

        for (const item of targetCurriculum) {
          await api
            .post('/grades', {
              scholarId,
              name,
              period: '1st Semester, 2026-2027',
              code: item.code,
              subjectName: item.name,
              units: item.units,
              grade: item.grade,
            })
            .catch(() => {})
        }

        const refreshed = await api.get('/grades', { params: { scholarId, name } })
        if (Array.isArray(refreshed.data)) {
          semData = refreshed.data
        }
      }

      // 4. Clean up any duplicate course codes within the same semester period
      let removedDuplicates = false
      for (const sem of semData) {
        const seenCodes = new Set()
        for (const sub of sem.subjects || []) {
          const codeKey = String(sub.code || '').trim().toLowerCase()
          if (seenCodes.has(codeKey) && sub.id) {
            await api.delete(`/grades/${sub.id}`).catch(() => {})
            removedDuplicates = true
          } else {
            seenCodes.add(codeKey)
          }
        }
      }
      if (removedDuplicates) {
        const deduped = await api.get('/grades', { params: { scholarId, name } })
        if (Array.isArray(deduped.data)) {
          semData = deduped.data
        }
      }

      setSemesters(semData)
      if (preferPeriod) {
        setSelectedPeriod(preferPeriod)
      } else if (semData.length > 0 && !semData.some((s) => s.period === selectedPeriod)) {
        setSelectedPeriod(semData[0].period)
      }
    } catch (err) {
      console.error('Failed to load grades:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      syncAndLoadGrades()
    }
  }, [user])

  // Open modal defaulting to the currently selected semester
  const handleOpenAddModal = () => {
    setError('')
    setFormData({
      period: selectedPeriod || '1st Semester, 2026-2027',
      code: '',
      subjectName: '',
      units: 3,
      grade: '1.50',
    })
    setModalOpen(true)
  }

  // Save the student's manually entered subject and units to the C# backend
  const handleAddSubject = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.code.trim() || !formData.subjectName.trim()) {
      setError('Please enter both the Course Code and Subject Description.')
      return
    }

    setSaving(true)
    try {
      await api.post('/grades', {
        scholarId,
        name,
        period: formData.period,
        code: formData.code.trim(),
        subjectName: formData.subjectName.trim(),
        units: Number(formData.units) || 3,
        grade: String(formData.grade).trim(),
      })
      setModalOpen(false)
      syncAndLoadGrades(formData.period)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save subject. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Remove a subject row
  const handleDeleteSubject = async (id) => {
    try {
      await api.delete(`/grades/${id}`)
      syncAndLoadGrades(selectedPeriod)
    } catch (err) {
      console.error('Failed to remove subject:', err)
    }
  }

  // Build list of available semester periods for the dropdown
  const periodList = Array.from(
    new Set([...SEMESTER_OPTIONS, ...semesters.map((s) => s.period)])
  )

  const current = semesters.find((s) => s.period === selectedPeriod) || {
    period: selectedPeriod,
    gwa: '0.00',
    units: 0,
    subjects: [],
  }

  // Compute Failed Courses vs. Passed Retakes across all semesters:
  // - 1 or 2 unpassed failed courses (> 3.00 / 5.00) -> Automatic "On Probation (OP)" (must retake & pass)
  // - 3 or more unpassed failed courses             -> Automatic "Scholarship Forfeited"
  const { unpassedFails, failedCodesSet, passedCodesSet, standingStatus, standingLabel, standingClass } =
    useMemo(() => {
      const passedSet = new Set()
      const failedList = []

      for (const sem of semesters) {
        for (const sub of sem.subjects || []) {
          const codeKey = String(sub.code || '').trim().toUpperCase()
          const numGrade = parseFloat(sub.grade)
          if (!isNaN(numGrade) && numGrade > 0 && numGrade <= 3.0) {
            passedSet.add(codeKey)
          }
        }
      }

      const failedSet = new Set()
      for (const sem of semesters) {
        for (const sub of sem.subjects || []) {
          const codeKey = String(sub.code || '').trim().toUpperCase()
          const numGrade = parseFloat(sub.grade)
          if (!isNaN(numGrade) && numGrade > 3.0) {
            failedSet.add(codeKey)
            // Only count as an active unpassed failure if the student hasn't retaken & passed this course code
            if (!passedSet.has(codeKey)) {
              failedList.push({ ...sub, period: sem.period })
            }
          }
        }
      }

      const failCount = failedList.length
      let status = 'active'
      let label = `Meets ${rankInfo.scholarshipType} GWA (≤ ${rankInfo.requiredGwa})`
      let pillClass = 'pill-green'

      if (failCount >= 3) {
        status = 'forfeited'
        label = `Scholarship Forfeited (${failCount} Failed Courses)`
        pillClass = 'pill-red'
      } else if (failCount > 0) {
        status = 'on_probation'
        label = `On Probation (OP) — ${failCount} Failed Course${failCount > 1 ? 's' : ''}`
        pillClass = 'pill-orange'
      } else if (
        current.subjects.length > 0 &&
        Number(current.gwa) > Number(rankInfo.requiredGwa)
      ) {
        status = 'on_probation'
        label = `On Probation (OP) — Below ${rankInfo.scholarshipType} GWA (> ${rankInfo.requiredGwa})`
        pillClass = 'pill-orange'
      } else if (current.subjects.length === 0) {
        label = 'Awaiting Grades'
        pillClass = 'pill-orange'
      }

      return {
        unpassedFails: failedList,
        failedCodesSet: failedSet,
        passedCodesSet: passedSet,
        standingStatus: status,
        standingLabel: label,
        standingClass: pillClass,
      }
    }, [semesters, current, rankInfo])

  // Persist scholar's Probation / Forfeited status so Scholarship Status, Renewal, Evaluator & Admin see it live
  useEffect(() => {
    if (!scholarId || semesters.length === 0) return
    try {
      const map = JSON.parse(localStorage.getItem('scholar_standing_map') || '{}')
      map[String(scholarId).toLowerCase()] = {
        status: standingStatus,
        failedCount: unpassedFails.length,
        failedCourses: unpassedFails.map((f) => f.code),
      }
      localStorage.setItem('scholar_standing_map', JSON.stringify(map))
    } catch {
      // Ignore storage error
    }
  }, [scholarId, semesters, standingStatus, unpassedFails])

  const handleRetakeCourse = (failedSub) => {
    setError('')
    setFormData({
      period: selectedPeriod || '2nd Semester, 2026-2027',
      code: failedSub.code,
      subjectName: failedSub.name,
      units: failedSub.units || 3,
      grade: '2.00',
    })
    setModalOpen(true)
  }

  const exampleSubj = programCurriculum[0] || {
    code: 'SUBJ 101',
    name: 'Major Course Subject',
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Academic Records & Grades</h2>
            {scholarCourse && (
              <span className="pill pill-blue" style={{ fontSize: '12px' }}>
                {scholarCourse}
              </span>
            )}
            <span
              className={`pill ${
                rankInfo.scholarshipType === 'Academic' ? 'pill-green' : 'pill-orange'
              }`}
              style={{ fontSize: '12px' }}
            >
              {rankInfo.scholarshipType} Scholar (Maintain ≤ {rankInfo.requiredGwa} GWA)
            </span>
          </div>
          <p className="muted small" style={{ marginTop: '4px' }}>
            Encode your semester courses, units, and final grades aligned with your{' '}
            <strong>{scholarCourse || 'degree program'}</strong> curriculum.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAddModal}>
          + Add Subject & Units
        </Button>
      </div>

      {/* On Probation (OP) / Scholarship Forfeited Alert Banner */}
      {unpassedFails.length >= 3 && (
        <div
          style={{
            background: '#fdecec',
            border: '1px solid #f5c2c7',
            borderLeft: '5px solid #c0392b',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            color: '#842029',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>
            ✕ Scholarship Forfeited — {unpassedFails.length} Unpassed Failed Courses ({unpassedFails.map((f) => f.code).join(', ')})
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            Under program rules, accumulating <strong>3 or more failed courses (5.00)</strong> without passing them automatically forfeits your scholarship eligibility.
          </div>
        </div>
      )}

      {unpassedFails.length > 0 && unpassedFails.length < 3 && (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderLeft: '5px solid #e08a00',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            color: '#9a3412',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>
            ⚠ Automatic On Probation (OP) — {unpassedFails.length} Failed Course{unpassedFails.length > 1 ? 's' : ''} ({unpassedFails.map((f) => f.code).join(', ')})
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            Because you failed <strong>{unpassedFails.map((f) => `${f.code} (${f.name})`).join(', ')}</strong>, your scholarship status is automatically placed <strong>On Probation (OP)</strong>. You are given another chance to stay in the scholarship, but you <strong>must retake and pass {unpassedFails.length > 1 ? 'these courses' : 'this course'}</strong>. Accumulating <strong>3 failed courses</strong> will automatically forfeit your scholarship.
          </div>
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="stat-label">Semester GWA</div>
          <div
            className="stat-value"
            style={{
              color:
                current.subjects.length > 0 &&
                (Number(current.gwa) > Number(rankInfo.requiredGwa) || unpassedFails.length > 0)
                  ? '#c0392b'
                  : '#1e8e4e',
            }}
          >
            {current.subjects.length > 0 ? current.gwa : '—'}
          </div>
          <div className="muted small">
            {rankInfo.scholarshipType} requirement: <strong>{rankInfo.requiredGwa}</strong> or better
          </div>
        </div>

        <div className="card">
          <div className="stat-label">Total Enrolled Units</div>
          <div className="stat-value">{current.units} Units</div>
          <div className="muted small">{current.subjects.length} course(s) encoded</div>
        </div>

        <div className="card">
          <div className="stat-label">Scholarship Standing ({rankInfo.scholarshipType})</div>
          <div style={{ marginTop: '8px' }}>
            <span className={`pill ${standingClass}`}>{standingLabel}</span>
          </div>
          <div className="muted small" style={{ marginTop: '4px' }}>
            {unpassedFails.length >= 3
              ? '3+ failed courses → Scholarship Forfeited'
              : unpassedFails.length > 0
              ? 'Must retake & pass failed course(s) to lift OP'
              : scholarCourse
              ? `${scholarCourse} • ${current.period}`
              : current.period}
          </div>
        </div>
      </div>

      {/* Semester Selector and Subject Breakdown Table */}
      <div className="card">
        <div className="toolbar" style={{ borderBottom: '1px solid #f0f2f8', paddingBottom: '14px' }}>
          <div>
            <h3>Course & Grade Breakdown</h3>
            <span className="muted small">
              Enrolled courses under <strong>{scholarCourse || 'your program'}</strong> for {current.period}
            </span>
          </div>

          <select
            className="form-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ width: 'auto' }}
          >
            {periodList.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course / Subject Description</th>
                <th>Units</th>
                <th>Final Grade</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    Loading academic records...
                  </td>
                </tr>
              ) : current.subjects.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No courses encoded for <strong>{current.period}</strong> yet. Click{' '}
                    <strong>"+ Add Subject & Units"</strong> above to input your courses and units.
                  </td>
                </tr>
              ) : (
                current.subjects.map((sub) => {
                  const codeKey = String(sub.code || '').trim().toUpperCase()
                  const isFailed = parseFloat(sub.grade) > 3.0
                  const wasPreviouslyFailedAndNowPassed =
                    !isFailed && failedCodesSet.has(codeKey) && passedCodesSet.has(codeKey)
                  const computedRemarks = isFailed
                    ? 'Failed (Must Retake)'
                    : wasPreviouslyFailedAndNowPassed
                    ? 'Passed (Retaken)'
                    : sub.remarks || 'Passed'

                  return (
                    <tr key={sub.id || sub.code}>
                      <td>
                        <strong>{sub.code}</strong>
                      </td>
                      <td>{sub.name}</td>
                      <td>{sub.units}</td>
                      <td>
                        <strong style={{ color: isFailed ? '#c0392b' : '#0f1b3d' }}>
                          {sub.grade}
                        </strong>
                      </td>
                      <td>
                        <Badge status={computedRemarks} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isFailed && !passedCodesSet.has(codeKey) && (
                            <button
                              type="button"
                              className="ui-btn ui-btn-primary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => handleRetakeCourse(sub)}
                              title="Encode passing retake grade in another semester"
                            >
                              Retake Course
                            </button>
                          )}
                          <button
                            type="button"
                            className="ui-btn ui-btn-outline"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleDeleteSubject(sub.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Manual Subject & Unit Input */}
      <Modal
        open={modalOpen}
        title={`Add Course (${scholarCourse || 'Program'})`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddSubject} disabled={saving}>
              {saving ? 'Saving...' : 'Save Subject'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddSubject}>
          {error && (
            <div className="auth-error" style={{ marginBottom: '12px' }}>
              {error}
            </div>
          )}

          <div className="form-field">
            <label>Semester Period</label>
            <select
              className="form-select"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            >
              {periodList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Quick-Fill from {scholarCourse || 'Program'} Curriculum (Optional)</label>
            <select
              className="form-select"
              value=""
              onChange={(e) => {
                const chosen = programCurriculum.find((c) => c.code === e.target.value)
                if (chosen) {
                  setFormData({
                    ...formData,
                    code: chosen.code,
                    subjectName: chosen.name,
                    units: chosen.units,
                  })
                }
              }}
            >
              <option value="">-- Select a suggested course or type below --</option>
              {programCurriculum.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.units} units)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-field">
              <label>Course Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder={`e.g. ${exampleSubj.code}`}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>

            <div className="form-field">
              <label>Units *</label>
              <input
                type="number"
                min="1"
                max="12"
                className="form-input"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>Course / Subject Description *</label>
            <input
              type="text"
              className="form-input"
              placeholder={`e.g. ${exampleSubj.name}`}
              value={formData.subjectName}
              onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label>Final Grade *</label>
            <select
              className="form-select"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            >
              <option value="1.00">1.00</option>
              <option value="1.25">1.25</option>
              <option value="1.50">1.50</option>
              <option value="1.75">1.75</option>
              <option value="2.00">2.00</option>
              <option value="2.25">2.25</option>
              <option value="2.50">2.50</option>
              <option value="2.75">2.75</option>
              <option value="3.00">3.00</option>
              <option value="5.00">5.00 (Failed)</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}
