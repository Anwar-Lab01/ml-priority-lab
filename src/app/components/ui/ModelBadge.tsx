import { cn } from '../../../lib/utils';
import { MODEL_CONFIG } from '../../../config/scenarios';

interface ModelBadgeProps {
  model: string;
  className?: string;
}

export function ModelBadge({ model, className }: ModelBadgeProps) {
  const config = MODEL_CONFIG[model] ?? { label: model, color: '#64748b', bgColor: '#f1f5f9' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {config.label}
    </span>
  );
}
