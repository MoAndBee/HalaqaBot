/**
 * Centralized session/participation type definitions
 * All components should import from here to maintain consistency
 */

// Union type of all valid session types
export type SessionType =
  | 'تلاوة'
  | 'تسميع'
  | 'تطبيق'
  | 'اختبار'
  | 'دعم'
  | 'مراجعة'
  | 'تعويض'

// All session types
export const SESSION_TYPES: SessionType[] = [
  'تلاوة',
  'تسميع',
  'تطبيق',
  'اختبار',
  'دعم',
  'مراجعة',
  'تعويض',
]

// Color mapping for session types (used in StudentStats calendar)
export const SESSION_TYPE_COLORS: Record<string, string> = {
  'تلاوة': 'bg-green-500',
  'تسميع': 'bg-blue-500',
  'تطبيق': 'bg-purple-500',
  'اختبار': 'bg-orange-500',
  'دعم': 'bg-pink-500',
  'مراجعة': 'bg-teal-500',
  'تعويض': 'bg-yellow-500',
}

// Sort order for participation types (for visual consistency in calendars/lists)
export const SESSION_TYPE_ORDER: Record<string, number> = {
  'تسميع': 1,
  'تطبيق': 2,
  'دعم': 3,
  'تلاوة': 4,
  'اختبار': 5,
  'مراجعة': 6,
  'تعويض': 7,
}

// Session types with keys for summary pages
export const SESSION_TYPES_WITH_KEYS = [
  { key: 'tilawa', label: 'تلاوة' },
  { key: 'tasmee', label: 'تسميع' },
  { key: 'tatbeeq', label: 'تطبيق' },
  { key: 'ikhtebar', label: 'اختبار' },
  { key: 'daam', label: 'دعم' },
  { key: 'muraja', label: 'مراجعة' },
] as const
