import { StaffMember } from '../types';

export const MINISTRY_NAME = 'ក្រសួងអប់រំ យុវជន និងកីឡា';
export const SCHOOL_NAME = 'សាលាបឋមសិក្សា រោគ';
export const SCHOOL_DISTRICT = 'រដ្ឋបាលស្រុកភ្នំស្រុក';
export const SCHOOL_OFFICE = 'ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុក';
export const SCHOOL_LOCATION_NAME = 'រោគ';

export const SUB_DECREE_ANNEX1 = 'ឧបសម្ព័ន្ធទី១ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក ចុះថ្ងៃទី ០១ ខែ មេសា ឆ្នាំ២០១៦';
export const SUB_DECREE_ANNEX2 = 'ឧបសម្ព័ន្ធទី២ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក ចុះថ្ងៃទី ០១ ខែ មេសា ឆ្នាំ២០១៦';
export const SUB_DECREE_ANNEX3 = 'ឧបសម្ព័ន្ធទី៣ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក ចុះថ្ងៃទី ០១ ខែ មេសា ឆ្នាំ២០១៦';
export const SUB_DECREE_ANNEX4 = 'ឧបសម្ព័ន្ធទី៤ នៃអនុក្រឹត្យលេខ ៥៦ អនក្រ.បក ចុះថ្ងៃទី ០១ ខែ មេសា ឆ្នាំ២០១៦';

export const LEAVE_REGULATIONS = [
  { id: 1, name: 'ច្បាប់ឈប់ប្រចាំឆ្នាំ', duration: 'មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ' },
  { id: 2, name: 'ច្បាប់ឈប់រយៈពេលខ្លី', duration: 'មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ' },
  { id: 3, name: 'ច្បាប់ឈប់សម្រាកលំហែមាតុភាព', duration: 'មានរយៈពេល៣ខែ' },
  { id: 4, name: 'ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ', duration: 'មានរយៈពេល១២ខែក្នុងអំឡុងពេលបម្រើការងារជាមន្ត្រី' },
  { id: 5, name: 'ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន', duration: 'មានរយៈពេល៣ខែក្នុងអំឡុងពេលបម្រើការងារជាមន្ត្រី' },
];

export const DISCIPLINE_SANCTIONS = {
  civilServant: [
    'ការស្តីបន្ទោស',
    'ការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន',
    'ការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងដំឡើងឋានន្តរស័ក្តិឬថ្នាក់',
    'ការលុបឈ្មោះចេញពីក្របខណ្ឌ។',
  ],
  contractStaff: [
    'ណែនាំលើកទី១',
    'ណែនាំចុងក្រោយ',
    'លុបឈ្មោះពីអង្គភាពសាមី។',
  ],
};

export const SCHOOL_LAT = 13.7000257;
export const SCHOOL_LNG = 103.4108298;
export const SCHOOL_RADIUS = 10000; // 10,000 meters (10 km)

export const STAFF_LIST: StaffMember[] = [
  {
    id: '2730200248',
    name: 'សុខ សារើន',
    gender: 'ស្រី',
    position: 'នាយិកា',
    cls: '-',
    phone: '+85589663966',
    role: 'director',
  },
  {
    id: '1720200457',
    name: 'យ៉េន សារី',
    gender: 'ប្រុស',
    position: 'នាយករង',
    cls: '-',
    phone: '+85585246698',
    role: 'vice_director',
  },
  {
    id: '1920100007',
    name: 'អ៊ុន ប៊ុនទុង',
    gender: 'ប្រុស',
    position: 'លេខាធិការ',
    cls: '-',
    phone: '+85592272005',
    role: 'admin',
  },
  {
    id: '2900100038',
    name: 'រ៉ែម សុភក្ដិ',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '1A',
    phone: '+855883435566',
    role: 'teacher',
  },
  {
    id: '2000100008',
    name: 'ស្វាង មនោរម្យ',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '5A',
    phone: '+855976858898',
    role: 'teacher',
  },
  {
    id: '2860100030',
    name: 'ប៉ោង ស្រីពេជ្រ',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '2A',
    phone: '+855889304103',
    role: 'teacher',
  },
  {
    id: '2860100029',
    name: 'លេង ចាន់លាវ',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '2B',
    phone: '+855884661856',
    role: 'teacher',
  },
  {
    id: '2910100012',
    name: 'អែង ផល្លែន',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '3B',
    phone: '+85592620771',
    role: 'teacher',
  },
  {
    id: '2900100091',
    name: 'ប៊ី ពិសី',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '3A',
    phone: '+855889339499',
    role: 'teacher',
  },
  {
    id: '2910100014',
    name: 'អឿន សុខៀប',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '4B',
    phone: '+8550977075979',
    role: 'teacher',
  },
  {
    id: '2900100021',
    name: 'ឆេន សាវដា',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '4A',
    phone: '+855974611580',
    role: 'teacher',
  },
  {
    id: '1880100066',
    name: 'រ៉ោម សម្ផស្ស',
    gender: 'ប្រុស',
    position: 'ថ្នាក់',
    cls: '5B',
    phone: '+855314234466',
    role: 'teacher',
  },
  {
    id: '2930100004',
    name: 'ឈួត សេរ៉ូម',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: '6A',
    phone: '+855976700999',
    role: 'teacher',
  },
  {
    id: '1720200503',
    name: 'កែវ ខន',
    gender: 'ប្រុស',
    position: 'កសិកម្ម',
    cls: '-',
    phone: '+85590887118',
    role: 'teacher',
  },
  {
    id: '2880100092',
    name: 'លន់ ចាន់នឹក',
    gender: 'ស្រី',
    position: 'បណ្ណារក្ស',
    cls: '-',
    phone: '+855972424423',
    role: 'teacher',
  },
  {
    id: '2970100060',
    name: 'ពាន ណូរ៉ា',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: 'ម.ត',
    phone: '+855978680864',
    role: 'teacher',
  },
  {
    id: '2880100101',
    name: 'ឡុក ម៉ាក់តី',
    gender: 'ស្រី',
    position: 'ថ្នាក់',
    cls: 'ម.ត',
    phone: '+855886534343',
    role: 'teacher',
  },
];

// Khmer Numerals
export const KH_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

export function toKhmer(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => KH_DIGITS[Number(d)] ?? d);
}

export const KH_WEEKDAYS_LONG = [
  'ថ្ងៃអាទិត្យ',
  'ថ្ងៃច័ន្ទ',
  'ថ្ងៃអង្គារ',
  'ថ្ងៃពុធ',
  'ថ្ងៃព្រហស្បតិ៍',
  'ថ្ងៃសុក្រ',
  'ថ្ងៃសៅរ៍',
];

export const KH_WEEKDAYS_SHORT = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'];

export const KH_MONTHS_SOLAR = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

export const KH_MONTHS_LUNAR: Record<number, string> = {
  0: 'មាឃ',
  1: 'ផល្គុន',
  2: 'ចេត្រ',
  3: 'ពិសាខ',
  4: 'ជេស្ឋ',
  5: 'អាសាឍ',
  6: 'ស្រាពណ៍',
  7: 'ភទ្របទ',
  8: 'អស្សុជ',
  9: 'កត្តិក',
  10: 'មិគសិរ',
  11: 'បុស្ស',
};

export const KH_ANIMALS = [
  'ជូត',
  'ឆ្លូវ',
  'ខាល',
  'ថោះ',
  'រោង',
  'ម្សាញ់',
  'មមី',
  'មមែ',
  'វក',
  'រកា',
  'ច',
  'កុរ',
];

export const KH_SAK = [
  'សំរឹទ្ធិស័ក',
  'ឯកស័ក',
  'ទោស័ក',
  'ត្រីស័ក',
  'ចត្វាស័ក',
  'បញ្ចស័ក',
  'ឆស័ក',
  'សប្តស័ក',
  'អដ្ឋស័ក',
  'នព្វស័ក',
];

export function formatKhmerSolarDate(d: Date): string {
  return `ថ្ងៃទី${toKhmer(d.getDate())} ខែ${KH_MONTHS_SOLAR[d.getMonth()]} ឆ្នាំ${toKhmer(d.getFullYear())}`;
}

export function formatKhmerLunarDate(d: Date): string {
  const base = new Date('2026-05-13');
  const diff = Math.round((d.getTime() - base.getTime()) / 86400000);
  let ld = (9 + diff) % 30 || 30;
  if (ld <= 0) ld += 30;
  const phase = ld <= 15 ? 'កើត' : 'រោច';
  const pn = ld <= 15 ? ld : (ld - 15 || 15);
  const lm = KH_MONTHS_LUNAR[d.getMonth()] || 'មាឃ';

  const afterKhmerNewYear = d.getMonth() > 3 || (d.getMonth() === 3 && d.getDate() >= 14);
  const cs = afterKhmerNewYear ? d.getFullYear() - 638 : d.getFullYear() - 639;
  const be = cs + 1182;
  const animalName = KH_ANIMALS[(((cs % 12) + 12) % 12 + 10) % 12];
  const sakName = KH_SAK[((cs % 10) + 10) % 10];

  return `${KH_WEEKDAYS_LONG[d.getDay()]} ${toKhmer(pn)}${phase} ខែ${lm} ឆ្នាំ${animalName} ${sakName} ព.ស ${toKhmer(be)}`;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
