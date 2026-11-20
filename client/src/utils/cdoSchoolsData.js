import { ALL_BARANGAYS } from './clustersData'

// =============================================================================
// cdoSchoolsData.js
// Official list of the 11 Partner Universities & Colleges in Cagayan de Oro City
// and their aligned degree/vocational programs for the 4,000 City Scholars:
//   - 1,500 First Year   (Batch 2026)
//   - 1,200 Second Year  (Batch 2025)
//   -   800 Third Year   (Batch 2024)
//   -   500 Fourth Year  (Batch 2023)
//   Total = 4,000 Scholars (2,000 Academic + 2,000 Non-Academic)
// =============================================================================

export const CDO_SCHOOLS = [
  {
    name: 'Xavier University – Ateneo de Cagayan',
    programs: [
      'BS in Nursing',
      'BS Accountancy',
      'BS Business Administration',
      'BS Civil Engineering',
      'BS Agriculture',
      'BS Computer Science',
      'BS Information Systems',
      'Bachelor of Secondary Education',
      'AB Psychology',
      'AB Economics',
    ],
  },
  {
    name: 'University of Science and Technology of Southern Philippines (USTP)',
    programs: [
      'BS Information Technology',
      'BS Computer Engineering',
      'BS Civil Engineering',
      'BS Electrical Engineering',
      'BS Mechanical Engineering',
      'BS Applied Mathematics',
      'BS Chemistry',
      'BS Technology and Livelihood Education',
    ],
  },
  {
    name: 'Liceo de Cagayan University',
    programs: [
      'BS in Nursing',
      'BS Medical Technology',
      'BS Pharmacy',
      'BS Radiologic Technology',
      'BS Business Administration',
      'BS Hospitality Management',
      'BS Criminology',
      'AB Political Science',
      'BS Information Technology',
      'BS Civil Engineering',
    ],
  },
  {
    name: 'Capitol University',
    programs: [
      'BS Marine Transportation',
      'BS Marine Engineering',
      'BS Civil Engineering',
      'BS in Nursing',
      'BS Midwifery',
      'BS Business Administration',
      'BS Criminology',
      'BS Accountancy',
      'BS Information Technology',
      'Bachelor of Elementary Education',
    ],
  },
  {
    name: 'PHINMA Cagayan de Oro College (COC)',
    programs: [
      'BS Criminology',
      'BS Accountancy',
      'BS Management Accounting',
      'BS Business Administration',
      'BS Hospitality Management',
      'BS Tourism Management',
      'BS in Nursing',
      'BS Medical Technology',
      'BS Pharmacy',
      'BS Psychology',
      'BS Civil Engineering',
      'BS Electrical Engineering',
      'BS Mechanical Engineering',
      'BS Computer Engineering',
      'BS Information Technology',
      'AB Communication',
      'Bachelor of Secondary Education',
    ],
  },
  {
    name: 'Lourdes College',
    programs: [
      'BS in Nursing',
      'BS Nutrition and Dietetics',
      'BS Pharmacy',
      'BS Accountancy',
      'BS Accounting Information Systems',
      'BS Business Administration',
      'BS Hospitality Management',
      'BS Tourism Management',
      'BS Information Technology',
      'BS Information Systems',
      'BS Social Work',
      'BS Psychology',
      'AB Communication',
      'AB English Language',
      'Bachelor of Library and Information Science',
      'Bachelor of Music',
      'Bachelor of Elementary Education',
    ],
  },
  {
    name: 'City College of Cagayan de Oro',
    programs: [
      'Bachelor of Technical-Vocational Teacher Education (BTVTEd)',
      'Bachelor of Technology and Livelihood Education (BTLEd)',
      'AB Communication',
      'AB Social Science',
      'BS Office Administration',
      'BS Entrepreneurship',
    ],
  },
  {
    name: 'STI College Cagayan de Oro',
    programs: [
      'BS Information Technology',
      'BS Business Administration',
      'BS Hospitality Management',
      'BS Tourism Management',
    ],
  },
  {
    name: 'Pilgrim Christian College',
    programs: [
      'Bachelor of Elementary Education',
      'Bachelor of Secondary Education',
      'BS Business Administration',
      'AB Liberal Arts',
    ],
  },
  {
    name: 'Southern de Oro Philippines College (SPC)',
    programs: [
      'BS Criminology',
      'BS Business Administration',
      'Bachelor of Secondary Education',
      'Bachelor of Elementary Education',
    ],
  },
  {
    name: 'AMA Computer College & ACLC College',
    programs: [
      'BS Information Technology',
      'BS Computer Science',
      'BS Information Systems',
      'BS Business Administration',
    ],
  },
]

const FIRST_NAMES = [
  'Juan', 'Maria', 'Angelo', 'Bea', 'Carlo', 'Diana', 'Elijah', 'Faith', 'Gabriel', 'Hannah',
  'Ivan', 'Jasmine', 'Kevin', 'Lara', 'Marco', 'Nadine', 'Oscar', 'Patricia', 'Quentin', 'Rachel',
  'Samuel', 'Trisha', 'Ulysses', 'Valerie', 'William', 'Xenia', 'Yvette', 'Zachary', 'Adrian', 'Bianca',
  'Christian', 'Denise', 'Edward', 'Frances', 'Gerald', 'Hazel', 'Ian', 'Jillian', 'Kenneth', 'Lovely',
]

const LAST_NAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada',
  'Castillo', 'Villanueva', 'Ramos', 'Castro', 'Rivera', 'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Soriano',
  'Lumactod', 'Cabrera', 'Tolentino', 'Aguilar', 'Pascual', 'Santiago', 'Gomez', 'Fernandez', 'Lopez', 'Morales',
]

let _cached4000 = null

/**
 * Normalizes any Scholar ID like "2024-05" or "2024-001" into strict "YYYY-0000" format (e.g. "2024-0005", "2024-0001")
 */
export function normalizeScholarIdFormat(rawId) {
  const clean = String(rawId || '').trim()
  const match = clean.match(/^(\d{4})-(\d{1,4})$/)
  if (match) {
    return `${match[1]}-${match[2].padStart(4, '0')}`
  }
  return clean
}

export function normalizeFourYearCollegeCourse(course, school) {
  const c = String(course || '').trim()
  if (/tesda|vocational|certification/i.test(c) && !/teacher education|btvted/i.test(c)) {
    if (/ama|aclc|sti|ustp/i.test(String(school || ''))) return 'BS Information Technology'
    if (/city college/i.test(String(school || ''))) return 'BS Office Administration'
    return 'BS Business Administration'
  }
  return c || 'BS Information Technology'
}

function normalizeCdoSchoolName(school, sid) {
  const s = String(school || '').trim()
  if (/^xu$/i.test(s) || /xavier/i.test(s)) return 'Xavier University – Ateneo de Cagayan'
  if (/^sti/i.test(s)) return 'STI College Cagayan de Oro'
  if (/^ustp$/i.test(s)) return 'University of Science and Technology of Southern Philippines (USTP)'
  if (/city university|city state/i.test(s) || !s) {
    if (String(sid).includes('2024-0001')) return 'Xavier University – Ateneo de Cagayan'
    if (String(sid).includes('2025-0001')) return 'University of Science and Technology of Southern Philippines (USTP)'
    if (String(sid).includes('2025-0002')) return 'PHINMA Cagayan de Oro College (COC)'
    return 'City College of Cagayan de Oro'
  }
  return s
}

/**
 * Ensures the scholar list contains the full 4,000 CDO scholars:
 * - 1,500 First Year  (2026-0001 .. 2026-1500)
 * - 1,200 Second Year (2025-0001 .. 2025-1200)
 * -   800 Third Year  (2024-0001 .. 2024-0800)
 * -   500 Fourth Year (2023-0001 .. 2023-0500)
 * Preserves all real DB rows from PostgreSQL (normalizing IDs to YYYY-0000) and fills up to 4,000.
 */
export function ensure4000ScholarsDataset(dbScholars = []) {
  const normalizedDb = []
  const existingById = new Map()
  let standingMap = {}
  try {
    standingMap = JSON.parse(localStorage.getItem('scholar_standing_map') || '{}')
  } catch {
    // Ignore
  }

  for (const raw of dbScholars) {
    if (!raw?.scholarId) continue
    const normId = normalizeScholarIdFormat(raw.scholarId)
    const key = normId.toLowerCase()
    if (existingById.has(key)) continue
    const standingOverride = standingMap[key]?.status || standingMap[String(raw.scholarId).toLowerCase()]?.status
    const normSchool = normalizeCdoSchoolName(raw.school, normId)
    const cleaned = {
      ...raw,
      scholarId: normId,
      school: normSchool,
      course: normalizeFourYearCollegeCourse(raw.course, normSchool),
      status: standingOverride || raw.status || 'active',
    }
    existingById.set(key, cleaned)
    normalizedDb.push(cleaned)
  }

  if (normalizedDb.length >= 4000) {
    return normalizedDb
  }

  if (_cached4000 && normalizedDb.length === 0) {
    return _cached4000.map((s) => {
      const override = standingMap[s.scholarId.toLowerCase()]?.status
      return override ? { ...s, status: override } : s
    })
  }

  const cohorts = [
    { prefix: '2026', yearLevel: '1st Year', target: 1500, academicCount: 750 },
    { prefix: '2025', yearLevel: '2nd Year', target: 1200, academicCount: 600 },
    { prefix: '2024', yearLevel: '3rd Year', target: 800, academicCount: 400 },
    { prefix: '2023', yearLevel: '4th Year', target: 500, academicCount: 250 },
  ]

  const result = [...normalizedDb]
  const currentCounts = {
    '1st Year': normalizedDb.filter((s) => s.yearLevel === '1st Year').length,
    '2nd Year': normalizedDb.filter((s) => s.yearLevel === '2nd Year').length,
    '3rd Year': normalizedDb.filter((s) => s.yearLevel === '3rd Year').length,
    '4th Year': normalizedDb.filter((s) => s.yearLevel === '4th Year').length,
  }

  const currentAcademicCounts = {
    '1st Year': normalizedDb.filter((s) => s.yearLevel === '1st Year' && (Number(s.applicantRank) || 1) <= 1000).length,
    '2nd Year': normalizedDb.filter((s) => s.yearLevel === '2nd Year' && (Number(s.applicantRank) || 1) <= 1000).length,
    '3rd Year': normalizedDb.filter((s) => s.yearLevel === '3rd Year' && (Number(s.applicantRank) || 1) <= 1000).length,
    '4th Year': normalizedDb.filter((s) => s.yearLevel === '4th Year' && (Number(s.applicantRank) || 1) <= 1000).length,
  }

  let globalIndex = normalizedDb.length

  for (const cohort of cohorts) {
    let addedForCohort = currentCounts[cohort.yearLevel] || 0
    let acadForCohort = currentAcademicCounts[cohort.yearLevel] || 0
    for (let i = 1; i <= cohort.target + 50 && addedForCohort < cohort.target; i++) {
      const padded = String(i).padStart(4, '0')
      const sid = `${cohort.prefix}-${padded}`
      if (existingById.has(sid.toLowerCase())) continue

      addedForCohort++
      globalIndex++
      const schoolObj = CDO_SCHOOLS[(globalIndex + i) % CDO_SCHOOLS.length]
      const course = schoolObj.programs[(globalIndex * 3 + i) % schoolObj.programs.length]
      const brgyObj = ALL_BARANGAYS[(globalIndex + i * 2) % ALL_BARANGAYS.length]
      const firstName = FIRST_NAMES[(globalIndex + i) % FIRST_NAMES.length]
      const lastName = LAST_NAMES[(Math.floor(globalIndex / 7) + i) % LAST_NAMES.length]
      const isAcademic = acadForCohort < cohort.academicCount
      if (isAcademic) acadForCohort++
      const applicantRank = isAcademic ? ((i - 1) % 1000) + 1 : 1001 + ((i - 1) % 1000)

      result.push({
        scholarId: sid,
        name: `${firstName} ${lastName}`,
        email: `${sid.toLowerCase()}@cdo-scholar.edu.ph`,
        contactNumber: `0917-${String(100 + (globalIndex % 899)).padStart(3, '0')}-${String(1000 + (i % 8999)).padStart(4, '0')}`,
        school: schoolObj.name,
        course,
        barangay: brgyObj.name,
        cluster: brgyObj.clusterName,
        yearLevel: cohort.yearLevel,
        applicantRank,
        scholarshipType: isAcademic ? 'Academic' : 'Non-Academic',
        requiredGwa: isAcademic ? '2.00' : '3.00',
        status: standingMap[sid.toLowerCase()]?.status || 'active',
      })
    }
  }

  if (normalizedDb.length === 0) {
    _cached4000 = result
  }
  return result
}

export function getRenewalOverridesMap() {
  try {
    return JSON.parse(localStorage.getItem('evaluator_renewal_overrides') || '{}')
  } catch {
    return {}
  }
}

export function saveRenewalOverride(scholarId, patch) {
  try {
    const map = getRenewalOverridesMap()
    const key = String(scholarId || '').toLowerCase()
    map[key] = { ...(map[key] || {}), ...patch }
    localStorage.setItem('evaluator_renewal_overrides', JSON.stringify(map))
  } catch {
    // Ignore storage error
  }
}

/**
 * Connects all 4,000 scholars to the Staff / Evaluator Renewal Applications queue.
 * All scholars default to 'under_review' (Ready to Renew, NOT approved yet) unless
 * explicitly approved or rejected by the Staff / Evaluator!
 */
export function ensure4000RenewalsDataset(dbRenewals = [], dbScholars = []) {
  const allScholars = ensure4000ScholarsDataset(dbScholars)
  const overrides = getRenewalOverridesMap()

  const dbByScholarId = new Map()
  for (const r of dbRenewals) {
    if (r?.scholarId) {
      dbByScholarId.set(String(r.scholarId).toLowerCase(), r)
    }
  }

  return allScholars.map((s, idx) => {
    const key = String(s.scholarId).toLowerCase()
    const existing = dbByScholarId.get(key)
    const localOverride = overrides[key] || {}

    // Keep all scholars 'under_review' (ready to renew, not approved yet) unless explicitly updated by Evaluator
    const status = localOverride.status || (existing?.status === 'rejected' ? 'rejected' : 'under_review')

    return {
      id: existing?.id || idx + 1,
      scholarId: s.scholarId,
      name: s.name,
      email: s.email,
      barangay: s.barangay,
      cluster: s.cluster,
      school: s.school,
      course: s.course,
      yearLevel: s.yearLevel,
      applicantRank: s.applicantRank,
      scholarshipType: s.scholarshipType,
      requiredGwa: s.requiredGwa,
      period: existing?.period || '1st Semester, 2026-2027',
      submittedOn: existing?.submittedOn || '2026-11-14',
      status,
      remarks:
        localOverride.remarks ||
        existing?.remarks ||
        'All 4 renewal requirements submitted. Ready for Evaluator review.',
    }
  })
}

export function getScholarDocumentsForEvaluation(scholarId, scholarName, yearLevel, cluster) {
  const overrides = getRenewalOverridesMap()
  const key = String(scholarId || '').toLowerCase()
  const docStatuses = overrides[key]?.docStatuses || {}
  const safeId = String(scholarId || '2026-0001').replace(/[^a-zA-Z0-9_-]/g, '')

  const reqTypes = [
    'Latest Grades',
    'Certificate of Enrollment',
    'Accomplishment Report',
    'Parent Consent',
  ]

  return reqTypes.map((docType, i) => {
    const docId = `${safeId}-doc-${i + 1}`
    return {
      id: docId,
      scholarId,
      scholarName,
      yearLevel,
      cluster,
      docType,
      name: docType,
      file: `${safeId}_${docType.replace(/\s+/g, '_')}.pdf`,
      size: '420 KB',
      date: '2026-11-14',
      status: docStatuses[docType] || 'pending',
    }
  })
}

