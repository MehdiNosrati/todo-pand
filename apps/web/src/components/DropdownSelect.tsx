import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";

export interface DropdownOption {
  label: string;
  value: string;
  dotColor?: string;
}

export interface DropdownSelectProps {
  id?: string;
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function DropdownSelect({
  id,
  label,
  value,
  options,
  onChange,
  size = "md",
  className = "",
  ariaLabel,
}: DropdownSelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        const currentIdx = options.findIndex((o) => o.value === value);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      }
      return next;
    });
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        const currentIdx = options.findIndex((o) => o.value === value);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % Math.max(options.length, 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        const currentIdx = options.findIndex((o) => o.value === value);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      } else {
        setHighlightedIndex(
          (prev) => (prev - 1 + Math.max(options.length, 1)) % Math.max(options.length, 1),
        );
      }
    } else if (e.key === "Enter" || e.key === " ") {
      if (open && highlightedIndex >= 0 && options[highlightedIndex]) {
        e.preventDefault();
        onChange(options[highlightedIndex].value);
        setOpen(false);
      }
    }
  };

  const sizeClasses =
    size === "sm" ? "px-2.5 py-1.5 text-xs rounded-md" : "px-3 py-2 text-sm rounded-lg";

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 ${className}`}>
      {label ? (
        <label htmlFor={controlId} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <button
        id={controlId}
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex w-full cursor-pointer items-center justify-between gap-2 border border-slate-200 bg-white text-left font-medium text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50/70 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none ${sizeClasses}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption?.dotColor ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          ) : null}
          <span className="truncate">{selectedOption?.label ?? "Select..."}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180 text-indigo-600" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          aria-labelledby={controlId}
          className="absolute top-full left-0 z-50 mt-1.5 max-h-64 w-full min-w-[168px] overflow-auto rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition sm:text-sm ${
                  isSelected
                    ? "bg-indigo-50/90 text-indigo-700"
                    : isHighlighted
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2 truncate">
                  {opt.dotColor ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: opt.dotColor }}
                    />
                  ) : null}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
