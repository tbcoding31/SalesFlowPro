import React from 'react';
import { MasterDataItem } from '../../types';

export const isColorValue = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Match HEX (#RGB, #RRGGBB, #RRGGBBAA)
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return true;
  }
  // Match rgb(), rgba(), hsl(), hsla()
  if (/^(rgb|rgba|hsl|hsla)\s*\(/i.test(trimmed)) {
    return true;
  }
  return false;
};

export const isValidIconName = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (isColorValue(trimmed)) return false;
  // Must be valid alphanumeric identifier with underscore (typical Google Material Symbols identifier)
  return /^[a-z0-9_]{2,50}$/i.test(trimmed);
};

export interface MasterDataIndicatorProps {
  item?: Partial<MasterDataItem> | null;
  indicator?: string | null;
  icon?: string | null;
  color?: string | null;
  className?: string;
}

export const MasterDataIndicator: React.FC<MasterDataIndicatorProps> = ({
  item,
  indicator: propIndicator,
  icon: propIcon,
  color: propColor,
  className = ''
}) => {
  // Resolve raw values from item or direct props
  const rawColor = propColor || item?.color;
  const rawIcon = propIcon || item?.icon;
  const rawIndicator = propIndicator !== undefined ? propIndicator : item?.indicator;

  // Derive authoritative color and icon
  const resolvedColor = (rawColor && isColorValue(rawColor))
    ? rawColor.trim()
    : (rawIndicator && isColorValue(rawIndicator) ? rawIndicator.trim() : null);

  const resolvedIcon = (rawIcon && isValidIconName(rawIcon))
    ? rawIcon.trim()
    : (rawIndicator && !isColorValue(rawIndicator) && isValidIconName(rawIndicator) ? rawIndicator.trim() : null);

  // 1. Both Icon and Color Present (e.g., activity_types with icon and brand color)
  if (resolvedIcon && resolvedColor) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="indicator-icon-and-color">
        <span
          className="material-symbols-outlined text-[18px] select-none"
          style={{ color: resolvedColor }}
          title={`${resolvedIcon} (${resolvedColor})`}
          data-testid="material-symbol-icon"
        >
          {resolvedIcon}
        </span>
        <span
          className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0 inline-block"
          style={{ backgroundColor: resolvedColor }}
          title={resolvedColor}
          data-testid="color-swatch-dot"
        />
      </div>
    );
  }

  // 2. Color Only (e.g., task_priorities, task_statuses, visit_statuses)
  if (resolvedColor) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`} data-testid="indicator-color-swatch">
        <span
          className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs shrink-0 inline-block"
          style={{ backgroundColor: resolvedColor }}
          title={resolvedColor}
          data-testid="color-swatch"
        />
        <span className="text-[11px] font-mono text-[#464555]" data-testid="color-code-label">
          {resolvedColor}
        </span>
      </div>
    );
  }

  // 3. Icon Only (e.g., activity_types without custom color)
  if (resolvedIcon) {
    return (
      <div className={`flex items-center ${className}`} data-testid="indicator-icon-only">
        <span
          className="material-symbols-outlined text-[18px] text-[#4744e5] select-none"
          title={resolvedIcon}
          data-testid="material-symbol-icon"
        >
          {resolvedIcon}
        </span>
      </div>
    );
  }

  // 4. Empty / Null / Neutral Placeholder (e.g., customer_types, visit_purposes, positions)
  return (
    <div className={`flex items-center ${className}`} data-testid="indicator-placeholder-container">
      <span
        className="text-[#94A3B8] font-bold text-xs select-none"
        data-testid="indicator-placeholder"
      >
        -
      </span>
    </div>
  );
};
