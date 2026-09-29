import { Checkbox } from "@/ui";

export type TypeOption = { typeId: number; label: string };

/**
 * The one genuinely new primitive this component needs — no existing `TypeChip`/`TypeToken` covers
 * a species/type multi-select (fe-essentials spec-actor-menu-scope-picker.md). Plain checkbox list
 * over the real `Checkbox` primitive, not a new entity ladder.
 */
export function TypeMultiSelect({
  options,
  value,
  onChange
}: {
  options: TypeOption[];
  value: number[];
  onChange: (typeIds: number[]) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm italic text-muted" data-testid="scope-type-empty">
        No types available.
      </p>
    );
  }

  function toggle(typeId: number, checked: boolean) {
    const next = checked ? [...value, typeId] : value.filter((id) => id !== typeId);
    console.debug("[fe-essentials] actor-menu-scope-picker: type selection changed", { typeIds: next });
    onChange(next);
  }

  return (
    <div data-testid="scope-type-list">
      {options.map((opt) => (
        <Checkbox
          key={opt.typeId}
          label={opt.label}
          data-testid={`scope-type-option-${opt.typeId}`}
          checked={value.includes(opt.typeId)}
          onChange={(e) => toggle(opt.typeId, e.target.checked)}
        />
      ))}
    </div>
  );
}
