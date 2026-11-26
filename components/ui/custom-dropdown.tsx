"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
  meta?: string;
};

type CustomDropdownProps = {
  name?: string;
  label?: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  searchable?: boolean;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

export function CustomDropdown({
  name,
  label,
  options,
  value: controlledValue,
  defaultValue = "",
  placeholder = "Select an option",
  searchable = options.length > 6,
  required = false,
  disabled = false,
  onChange,
}: CustomDropdownProps) {
  const triggerId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((opt) => opt.value === currentValue);
  const filteredOptions = query.trim()
    ? options.filter((opt) => {
        const q = query.trim().toLowerCase();
        return opt.label.toLowerCase().includes(q) || (opt.meta?.toLowerCase().includes(q) ?? false);
      })
    : options;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      const id = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open, searchable]);

  const selectValue = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 0, width: "100%" }}>
      {name ? <input id={name} type="hidden" name={name} value={currentValue} required={required} /> : null}
      {label ? (
        <label
          htmlFor={triggerId}
          style={{
            display: "block",
            fontSize: "12.5px",
            fontWeight: 700,
            color: "#111318",
            marginBottom: "6px",
          }}
        >
          {label}
        </label>
      ) : null}

      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setActiveIndex(Math.max(0, filteredOptions.findIndex((o) => o.value === currentValue)));
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            if (!open) {
              event.preventDefault();
              setOpen(true);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((i) => Math.min(filteredOptions.length - 1, i + 1));
            }
          } else if (event.key === "ArrowUp" && open) {
            event.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          } else if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
            event.preventDefault();
            selectValue(filteredOptions[activeIndex].value);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          width: "100%",
          minHeight: "48px",
          padding: "10px 16px",
          borderRadius: "13px",
          border: open ? "1.5px solid #ff6b2b" : "1.5px solid #dfe5ee",
          background: disabled ? "#f6f8fb" : "#ffffff",
          boxShadow: open ? "0 0 0 4px rgba(255, 107, 43, 0.12)" : "0 1px 2px rgba(17, 24, 39, 0.03)",
          color: selectedOption ? "#111318" : "#647087",
          fontSize: "14px",
          fontWeight: selectedOption ? 600 : 400,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "border-color 150ms ease-out, box-shadow 150ms ease-out, transform 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
          {selectedOption ? (
            <>
              <span>{selectedOption.label}</span>
              {selectedOption.meta ? (
                <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 500, color: "#647087" }}>
                  {selectedOption.meta}
                </span>
              ) : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "#647087",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 40,
            borderRadius: "14px",
            border: "1px solid #dfe5ee",
            background: "#ffffff",
            boxShadow: "var(--tm-shadow-md, 0 8px 24px rgba(17, 24, 39, 0.12))",
            overflow: "hidden",
            transformOrigin: "top center",
            animation: "tm-popover-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            overscrollBehavior: "contain",
          }}
        >
          {searchable ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderBottom: "1px solid #eef2f7",
                background: "#f8fafc",
              }}
            >
              <Search size={15} aria-hidden="true" style={{ color: "#647087", flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Filter options…"
                aria-label="Filter dropdown options"
                style={{
                  width: "100%",
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  fontSize: "14px",
                  color: "#111318",
                }}
              />
            </div>
          ) : null}

          <ul
            id={listboxId}
            role="listbox"
            style={{
              margin: 0,
              padding: "6px",
              listStyle: "none",
              maxHeight: "260px",
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {filteredOptions.length === 0 ? (
              <li style={{ padding: "12px 14px", fontSize: "13px", color: "#647087", textAlign: "left" }}>
                No matching options.
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === currentValue;
                const isHighlighted = index === activeIndex;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => selectValue(option.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        width: "100%",
                        minHeight: "42px",
                        padding: "8px 12px",
                        border: 0,
                        borderRadius: "10px",
                        background: isSelected ? "#fff0e8" : isHighlighted ? "#f6f8fb" : "transparent",
                        color: isSelected ? "#d94b14" : "#111318",
                        fontSize: "13.5px",
                        fontWeight: isSelected ? 700 : 500,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {option.label}
                        {option.meta ? (
                          <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 400, color: "#647087" }}>
                            {option.meta}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? <Check size={15} aria-hidden="true" style={{ flexShrink: 0, color: "#ff6b2b" }} /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
