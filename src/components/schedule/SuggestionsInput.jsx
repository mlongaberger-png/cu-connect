import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function SuggestionsInput({ value, onChange, suggestions = [], placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const containerRef = useRef(null);

  // Build filtered list when input changes or suggestions change
  useEffect(() => {
    if (!value) {
      setFiltered(suggestions.slice(0, 5));
    } else {
      setFiltered(
        suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
      );
    }
  }, [value, suggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (s) => {
    onChange(s);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors border-b border-border/50 last:border-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}