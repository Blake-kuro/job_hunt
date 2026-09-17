import { cn } from "../lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  name: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  fullWidth?: boolean;
}

/** 分段单选（radio 组），选中项填钢蓝。 */
export function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
  className,
  fullWidth = false,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-[4px] border border-divider",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((opt, i) => (
        <label
          key={opt.value}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center px-3 py-1.5 text-[13px] transition-colors",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent",
            i > 0 && "border-l border-divider",
            fullWidth && "flex-1",
            value === opt.value ? "bg-accent text-bg" : "hover:bg-text/7",
          )}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
