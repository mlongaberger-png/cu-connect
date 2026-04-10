import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

function pad(n) { return String(n).padStart(2, "0"); }

function parseTime(val) {
  if (!val) return { hour: 12, minute: 0, ampm: "AM" };
  const [h, m] = val.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: m || 0, ampm };
}

function toHHMM({ hour, minute, ampm }) {
  let h = hour % 12;
  if (ampm === "PM") h += 12;
  return `${pad(h)}:${pad(minute)}`;
}

function format12h({ hour, minute, ampm }) {
  return `${hour}:${pad(minute)} ${ampm}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function TimePickerPopup({ value, onChange, placeholder = "--:-- --" }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(parseTime(value));

  useEffect(() => {
    setLocal(parseTime(value));
  }, [value, open]);

  const handleConfirm = () => {
    onChange(toHHMM(local));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const display = value ? format12h(parseTime(value)) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-surface text-sm text-left"
        >
          <span className={display ? "text-foreground" : "text-muted-foreground"}>
            {display || placeholder}
          </span>
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-card border-border p-4 z-50" align="start">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Time</p>

        {/* Preview */}
        <div className="text-center text-2xl font-bold text-primary mb-4">
          {local.hour}:{pad(local.minute)} {local.ampm}
        </div>

        {/* Hour */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Hour</p>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setLocal(l => ({ ...l, hour: h }))}
                className={`py-1.5 rounded-lg text-sm font-medium transition-all ${
                  local.hour === h ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Minute */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Minute</p>
          <div className="grid grid-cols-6 gap-1">
            {MINUTES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setLocal(l => ({ ...l, minute: m }))}
                className={`py-1.5 rounded-lg text-sm font-medium transition-all ${
                  local.minute === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {pad(m)}
              </button>
            ))}
          </div>
        </div>

        {/* AM/PM */}
        <div className="flex gap-2 mb-4">
          {["AM", "PM"].map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setLocal(l => ({ ...l, ampm: a }))}
              className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                local.ampm === a ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClear} className="border-border text-xs flex-1">Clear</Button>
          <Button type="button" size="sm" onClick={handleConfirm} className="bg-primary text-primary-foreground text-xs flex-1">OK</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}