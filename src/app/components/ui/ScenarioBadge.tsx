import { cn } from '../../../lib/utils';
import { FAMILY_CONFIG } from '../../../config/scenarios';
import type { ScenarioFamily } from '../../../types/contracts';

interface ScenarioBadgeProps {
  family: ScenarioFamily;
  label?: string;
  className?: string;
}

export function ScenarioBadge({ family, label, className }: ScenarioBadgeProps) {
  const config = FAMILY_CONFIG[family];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {label ?? config.label}
    </span>
  );
}
