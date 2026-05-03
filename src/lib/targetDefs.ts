import { isTargetPositive } from './utils';

export type TargetField =
  | 'planned_any_2026'
  | 'planned_tender_2026'
  | 'planned_pl_2026'
  | 'planned_teknokratis_2026'
  | 'planned_teknokratis_2027';

export type TargetType = TargetField | 'both';

export const TARGET_FIELDS: TargetField[] = [
  'planned_any_2026',
  'planned_tender_2026',
  'planned_pl_2026',
  'planned_teknokratis_2026',
  'planned_teknokratis_2027'
];

export const TARGET_LABELS: Record<TargetType, string> = {
  planned_any_2026: 'Any 2026',
  planned_tender_2026: 'Tender 2026',
  planned_pl_2026: 'PL 2026',
  planned_teknokratis_2026: 'Tekno 2026',
  planned_teknokratis_2027: 'Tekno 2027',
  both: 'Both (Any/Tender)'
};

export function getTargetHitValue(
  row: Partial<Record<TargetField, number | null | undefined>>,
  targetType: TargetType
): number | null {
  if (targetType === 'both') {
    const anyVal = row.planned_any_2026;
    const tenderVal = row.planned_tender_2026;
    if (anyVal == null && tenderVal == null) return null;
    return isTargetPositive(anyVal) || isTargetPositive(tenderVal) ? 1 : 0;
  }

  const value = row[targetType];
  if (value == null) return null;
  return isTargetPositive(value) ? 1 : 0;
}
