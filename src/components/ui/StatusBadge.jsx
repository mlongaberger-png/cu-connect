import React from "react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  // Payment
  paid:      { label: "Paid",      className: "bg-green-500/20 text-green-400 border-green-500/30" },
  unpaid:    { label: "Unpaid",    className: "bg-red-500/20 text-red-400 border-red-500/30" },
  pending:   { label: "Pending",   className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  failed:    { label: "Failed",    className: "bg-red-500/20 text-red-400 border-red-500/30" },
  // Signatures
  signed:    { label: "Signed",    className: "bg-green-500/20 text-green-400 border-green-500/30" },
  unsigned:  { label: "Unsigned",  className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  revoked:   { label: "Revoked",   className: "bg-red-500/20 text-red-400 border-red-500/30" },
  // Volunteers
  signed_up:   { label: "Signed Up",  className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  completed:   { label: "Completed",  className: "bg-green-500/20 text-green-400 border-green-500/30" },
  no_show:     { label: "No Show",    className: "bg-red-500/20 text-red-400 border-red-500/30" },
  excused:     { label: "Excused",    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  // Slots
  open:      { label: "Open",      className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  filled:    { label: "Filled",    className: "bg-green-500/20 text-green-400 border-green-500/30" },
  locked:    { label: "Locked",    className: "bg-muted text-muted-foreground border-border" },
  // Attendance
  attending:     { label: "Attending",     className: "bg-green-500/20 text-green-400 border-green-500/30" },
  not_attending: { label: "Not Attending", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  maybe:         { label: "Maybe",         className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  // Generic
  active:    { label: "Active",    className: "bg-green-500/20 text-green-400 border-green-500/30" },
  inactive:  { label: "Inactive",  className: "bg-muted text-muted-foreground border-border" },
  approved:  { label: "Approved",  className: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected:  { label: "Rejected",  className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function StatusBadge({ status, label, className }) {
  const config = STATUS_CONFIG[status] || {
    label: label || status || "Unknown",
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      config.className,
      className
    )}>
      {label || config.label}
    </span>
  );
}