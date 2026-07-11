interface ChipProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function Chip({ label, selected, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      className={selected ? "chip is-selected" : "chip"}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
