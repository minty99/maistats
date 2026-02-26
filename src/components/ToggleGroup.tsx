interface ToggleGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  formatLabel?: (value: T) => string;
}

export function ToggleGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  formatLabel,
}: ToggleGroupProps<T>) {
  return (
    <div className="filter-block">
      <div className="filter-label">{label}</div>
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip ${selected.includes(option) ? 'active' : ''}`}
            onClick={() => onToggle(option)}
          >
            {formatLabel ? formatLabel(option) : option}
          </button>
        ))}
      </div>
    </div>
  );
}
