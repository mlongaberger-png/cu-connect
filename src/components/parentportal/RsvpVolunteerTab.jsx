import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Cookie, Car } from "lucide-react";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import SnacksTab from "@/components/snacks/SnacksTab";
import CarpoolBoard from "@/components/parentportal/CarpoolBoard";

const SUBTABS = [
  { id: "rsvp",    label: "RSVPs",   icon: CheckCircle2 },
  { id: "snacks",  label: "Snacks",  icon: Cookie },
  { id: "carpool", label: "Carpool", icon: Car },
];

export default function RsvpVolunteerTab({
  myAttendanceRequests,
  user,
  myKids,
  userEmail,
  userName,
  myTeamIds,
  myTeams,
  events,
  highlightAttendanceId,
}) {
  const [sub, setSub] = useState("rsvp");
  const highlightRef = useRef(null);
  const openRsvps = myAttendanceRequests.filter(r => !r.is_locked);

  // Scroll to highlighted card when data is ready
  useEffect(() => {
    if (highlightAttendanceId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [highlightAttendanceId, myAttendanceRequests.length]);

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="bg-surface rounded-xl p-1 flex gap-1">
        {SUBTABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSub(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${sub === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {sub === "rsvp" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">RSVP Requests</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Let your coaches know if your athlete is attending</p>
          </div>
          {openRsvps.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-2xl">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No open RSVP requests right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openRsvps.map(req => {
                const isHighlighted = req.id === highlightAttendanceId;
                return (
                  <div
                    key={req.id}
                    ref={isHighlighted ? highlightRef : null}
                    className={isHighlighted ? "ring-2 ring-primary rounded-2xl animate-pulse" : ""}
                  >
                    <AttendanceCard
                      request={req}
                      isStaff={false}
                      currentUser={user}
                      myPlayers={myKids}
                      allPlayers={[]}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {myAttendanceRequests.filter(r => r.is_locked).length > 0 && (
            <details>
              <summary className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 cursor-pointer">
                Past / Locked RSVPs
              </summary>
              <div className="space-y-2 mt-2">
                {myAttendanceRequests.filter(r => r.is_locked).slice(0, 5).map(req => (
                  <AttendanceCard
                    key={req.id}
                    request={req}
                    isStaff={false}
                    currentUser={user}
                    myPlayers={myKids}
                    allPlayers={[]}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {sub === "snacks" && (
        <SnacksTab
          myTeamIds={myTeamIds}
          userEmail={userEmail}
          userName={userName}
          myKids={myKids}
          events={events}
        />
      )}

      {sub === "carpool" && (
        <CarpoolBoard
          myKids={myKids}
          userEmail={userEmail}
          userName={userName}
          myTeamIds={myTeamIds}
          myTeams={myTeams}
          events={events}
        />
      )}
    </div>
  );
}