import React, { useState } from "react";
import { CheckCircle2, Users, Car } from "lucide-react";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import ParentVolunteerView from "@/components/volunteers/ParentVolunteerView";
import CarpoolBoard from "@/components/parentportal/CarpoolBoard";

const SUBTABS = [
  { id: "rsvp", label: "RSVPs", icon: CheckCircle2 },
  { id: "volunteers", label: "Volunteers", icon: Users },
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
}) {
  const [sub, setSub] = useState("rsvp");
  const openRsvps = myAttendanceRequests.filter(r => !r.is_locked);

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
              {openRsvps.map(req => (
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
          )}
          {/* Also show locked/past for reference */}
          {myAttendanceRequests.filter(r => r.is_locked).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Past / Locked RSVPs</p>
              <div className="space-y-2">
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
            </div>
          )}
        </div>
      )}

      {sub === "volunteers" && (
        <ParentVolunteerView myKids={myKids} userEmail={userEmail} userName={userName} />
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