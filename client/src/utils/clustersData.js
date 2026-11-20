// Cluster A to G setup with 5 barangays each (35 barangays total)
// Aligned with the City Scholarship Program

export const CLUSTERS = [
  {
    id: 'A',
    name: 'Cluster A',
    barangays: ['Bugo', 'Puerto', 'Agusan', 'Balubal', 'Tablon'],
  },
  {
    id: 'B',
    name: 'Cluster B',
    barangays: ['Lumbia', 'Canitoan', 'Pagatpat', 'San Simon', 'Baikingon'],
  },
  {
    id: 'C',
    name: 'Cluster C',
    barangays: ['Dansolihon', 'Tignapoloan', 'Besigan', 'Mambuaya', 'Bayanga'],
  },
  {
    id: 'D',
    name: 'Cluster D',
    barangays: ['Indahag', 'Balulang', 'Macasandig', 'Nazareth', 'Camaman-an'],
  },
  {
    id: 'E',
    name: 'Cluster E',
    barangays: ['Bonbon', 'Bayabas', 'Kauswagan', 'Bulua', 'Iponan'],
  },
  {
    id: 'F',
    name: 'Cluster F',
    barangays: ['FS Catanico', 'Gusa', 'Lapasan', 'Cugman', 'Macabalan'],
  },
  {
    id: 'G',
    name: 'Cluster G',
    barangays: ['Carmen', 'Patag', 'Puntod', 'Consolacion', 'Unified Barangays'],
  },
]

export const ALL_BARANGAYS = CLUSTERS.flatMap((c) =>
  c.barangays.map((b) => ({
    name: b,
    clusterId: c.id,
    clusterName: c.name,
  }))
)

export function getClusterByBarangay(barangayName) {
  const match = ALL_BARANGAYS.find(
    (b) => b.name.toLowerCase() === (barangayName || '').toLowerCase().trim()
  )
  return match ? match.clusterName : 'Unassigned'
}
