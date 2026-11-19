// Small labeled inputs used by the settings panel.

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label className="control">
      <span className="control-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="control-value">{format(value)}</span>
    </label>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="control">
      <span className="control-label">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="control-value">{value}</span>
    </label>
  );
}
