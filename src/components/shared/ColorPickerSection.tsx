import { Pipette } from 'lucide-react';
import { normalizeHexColor } from '../../store/color-history-store';
import { colorsMatch } from './color-utils';

const SHARED_COLORS = [
  { id: 'black', label: 'Black', value: '#1A1A1A' },
  { id: 'white', label: 'White', value: '#FFFFFF' },
  { id: 'gray', label: 'Gray', value: '#9CA3AF' },
  { id: 'red', label: 'Red', value: '#EF4444' },
  { id: 'orange', label: 'Orange', value: '#F97316' },
  { id: 'green', label: 'Green', value: '#22C55E' },
  { id: 'blue', label: 'Blue', value: '#3B82F6' },
  { id: 'purple', label: 'Purple', value: '#8B5CF6' },
];

function getColorInputValue(color: string | undefined, fallback: string): string {
  return normalizeHexColor(color) ?? fallback;
}

interface Props {
  label: string;
  /** aria-label for the custom color picker input (e.g. "Custom background color") */
  pickerAriaLabel: string;
  currentColor: string | undefined;
  fallbackInputColor: string;
  onColorChange: (color: string | undefined) => void;
  onPickerFocus: () => void;
  onPickerBlur: () => void;
}

export default function ColorPickerSection({
  label,
  pickerAriaLabel,
  currentColor,
  fallbackInputColor,
  onColorChange,
  onPickerFocus,
  onPickerBlur,
}: Props) {
  return (
    <>
      <div className="context-menu-label">{label}</div>
      <div className="context-menu-colors">
        <button
          className="color-swatch color-swatch-none"
          data-active={!currentColor}
          title="Default"
          onClick={() => onColorChange(undefined)}
        />
        {SHARED_COLORS.map((c) => (
          <button
            key={c.id}
            className="color-swatch"
            data-active={colorsMatch(currentColor, c.value)}
            style={{ backgroundColor: c.value }}
            title={c.label}
            onClick={() => onColorChange(c.value)}
          />
        ))}
        <label
          className="color-swatch color-picker-trigger"
          title={`Pick custom ${label.toLowerCase()}`}
          style={undefined}
          onPointerDown={onPickerFocus}
        >
          <Pipette size={12} aria-hidden="true" />
          <input
            type="color"
            className="color-picker-input"
            aria-label={pickerAriaLabel}
            value={getColorInputValue(currentColor, fallbackInputColor)}
            onFocus={onPickerFocus}
            onBlur={onPickerBlur}
            onChange={(e) => {
              onColorChange(normalizeHexColor(e.target.value));
            }}
          />
        </label>
      </div>
    </>
  );
}
