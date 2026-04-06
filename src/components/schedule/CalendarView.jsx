import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, subDays } from "date-fns";
import { parseLocalDate } from "@/utils/dateTime";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_DOT_COLORS = {
  practice: "bg-blue-400",
  game: "bg-green-400",
  tournament: "bg-purple-400",
  meeting: "bg-orange-400",
  fundraiser: "bg-yellow-400",
  other: "bg-cyan-400",
  volunteer: "bg-teal-400",
};

const TYPE_BG = {
  practice: "bg-blue-500/20 text-blue-300",
  game: "bg-green-500/20 text-green-300",
  tournament: "bg-purple-500/20 text-purple-300",
  meeting: "bg-orange-500/20 text-orange-300",
  fundraiser: "bg-yellow-500/20 text-yellow-300",
  other: "bg-cyan-500/20 text-cyan-300",
  volunteer: "bg-teal-500/20 text-teal-300",
};

export default function CalendarView({ events, calendarView, setCalendarView, onEventClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const eventsOnDay = (day) =>
    events.filter(e => e.date && isSameDay(parseLocalDate(e.date), day));

  // ---- Month View ----
  const renderMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const rows = [];
    let day = gridStart;
    while (day <= gridEnd) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = day;
        const dayEvents = eventsOnDay(d);
        const isToday = isSameDay(d, new Date());
        const inMonth = isSameMonth(d, monthStart);
        week.push(
          <div
            key={d.toISOString()}
            className={`min-h-[80px] p-1.5 border-b border-r border-border cursor-pointer hover:bg-surface/60 transition-colors ${!inMonth ? "opacity-30" : ""}`}
            onClick={() => dayEvents.length === 1 && onEventClick(dayEvents[0])}
          >
            <span className={`text-xs font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full mb-1 ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {format(d, "d")}
            </span>
            <div className="space-y-0.5">
              {dayEvents.slice(0, 3).map(e => (
                <button
                  key={e.id}
                  onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                  className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded font-medium truncate capitalize ${TYPE_BG[e.type] || "bg-muted text-muted-foreground"}`}
                >
                  {e.start_time ? `${e.start_time} ` : ""}{e.title}
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</span>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day.toISOString()} className="grid grid-cols-7">{week}</div>);
    }

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground py-2 font-medium">{d}</div>
          ))}
        </div>
        {rows}
      </div>
    );
  };

  // ---- Week View ----
  const renderWeek = () => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return (
      <div>
        <div className="grid grid-cols-7 border-b border-border">
          {days.map(d => {
            const isToday = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className="text-center py-2">
                <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
                <div className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {format(d, "d")}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[300px]">
          {days.map(d => {
            const dayEvents = eventsOnDay(d);
            return (
              <div key={d.toISOString()} className="border-r border-border p-1.5 space-y-1">
                {dayEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-lg font-medium capitalize ${TYPE_BG[e.type] || "bg-muted text-muted-foreground"}`}
                  >
                    <div className="truncate">{e.title}</div>
                    {e.start_time && <div className="text-[10px] opacity-70">{e.start_time}</div>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Day View ----
  const renderDay = () => {
    const dayEvents = eventsOnDay(currentDate);
    const isToday = isSameDay(currentDate, new Date());
    return (
      <div className="p-4">
        <div className={`text-center mb-4 p-3 rounded-xl ${isToday ? "bg-primary/10 border border-primary/30" : "bg-surface"}`}>
          <p className="text-xs text-muted-foreground">{format(currentDate, "EEEE")}</p>
          <p className={`text-3xl font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{format(currentDate, "d")}</p>
          <p className="text-xs text-muted-foreground">{format(currentDate, "MMMM yyyy")}</p>
        </div>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No events today</p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className={`w-full text-left p-3 rounded-xl ${TYPE_BG[e.type] || "bg-muted text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT_COLORS[e.type] || "bg-gray-400"}`} />
                  <span className="font-semibold capitalize text-sm">{e.title}</span>
                </div>
                {e.start_time && <p className="text-xs mt-1 ml-4 opacity-80">{e.start_time}{e.end_time ? ` – ${e.end_time}` : ""}</p>}
                {e.location && <p className="text-xs mt-0.5 ml-4 opacity-70">{e.location}</p>}
                {e.team_name && <p className="text-xs mt-0.5 ml-4 opacity-70">{e.team_name}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const navigate = (dir) => {
    if (calendarView === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (calendarView === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const titleLabel = () => {
    if (calendarView === "month") return format(currentDate, "MMMM yyyy");
    if (calendarView === "week") {
      const ws = startOfWeek(currentDate);
      const we = endOfWeek(currentDate);
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
          {["month", "week", "day"].map(v => (
            <button
              key={v}
              onClick={() => setCalendarView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${calendarView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground hidden sm:block">{titleLabel()}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
      </div>
      <span className="text-xs font-semibold text-foreground block sm:hidden px-4 py-2 border-b border-border">{titleLabel()}</span>

      {/* Calendar Body */}
      {calendarView === "month" && renderMonth()}
      {calendarView === "week" && renderWeek()}
      {calendarView === "day" && renderDay()}

      {/* Legend */}
      <div className="flex gap-3 flex-wrap p-3 border-t border-border">
        {Object.entries(TYPE_DOT_COLORS).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}