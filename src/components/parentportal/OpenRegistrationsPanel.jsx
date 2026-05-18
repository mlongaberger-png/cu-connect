import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SPORT_EMOJIS = {
  baseball: "⚾",
  football: "🏈",
  cheer: "📣",
  cheerleading: "📣",
  soccer: "⚽",
  basketball: "🏀",
  softball: "🥎",
  volleyball: "🏐",
  wrestling: "🤼",
  tennis: "🎾",
  swimming: "🏊",
  track: "🏃",
  golf: "⛳",
  default: "🏅",
};

function getSportEmoji(sportName) {
  if (!sportName) return SPORT_EMOJIS.default;
  const lower = sportName.toLowerCase();
  for (const [key, emoji] of Object.entries(SPORT_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return SPORT_EMOJIS.default;
}

export default function OpenRegistrationsPanel({ myKids, userEmail }) {
  // Fetch all open registrations — re-fetches when admin toggles is_open
  const { data: openRegs = [] } = useQuery({
    queryKey: ["open-team-registrations"],
    queryFn: async () => {
      const all = await base44.entities.TeamRegistration.list("-created_date");
      return all.filter(r => r.is_open === true);
    },
    refetchInterval: 60000, // auto-refresh every 60s for near-real-time updates
  });

  // Fetch this parent's existing submissions
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my-reg-submissions", userEmail],
    queryFn: () => base44.entities.RegistrationSubmission.filter({ parent_email: userEmail }),
    enabled: !!userEmail,
  });

  if (openRegs.length === 0) return null;

  // Group by sport name
  const bySport = openRegs.reduce((acc, reg) => {
    const sport = reg.sport_name || "Other";
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(reg);
    return acc;
  }, {});

  const getSubmissionStatus = (regId) => {
    const sub = mySubmissions.find(s => s.registration_id === regId);
    if (!sub) return null;
    return sub.status; // "pending" | "approved" | "rejected"
  };

  const formatFee = (amount) => {
    if (!amount || amount === 0) return "Free";
    return `$${Number(amount).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-foreground">Open Registrations</h3>
      </div>

      {Object.entries(bySport).map(([sportName, regs]) => (
        <div key={sportName}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getSportEmoji(sportName)}</span>
            <h4 className="text-sm font-semibold text-foreground">{sportName}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {regs.map(reg => {
              const status = getSubmissionStatus(reg.id);
              return (
                <RegistrationCard
                  key={reg.id}
                  reg={reg}
                  status={status}
                  formatFee={formatFee}
                  myKids={myKids}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegistrationCard({ reg, status, formatFee, myKids }) {
  const navigate = useNavigate();

  const handleRegister = () => {
    navigate(`/Register?reg_id=${reg.id}`);
  };

  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-4 space-y-3">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{reg.title}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {reg.season && (
              <span className="text-xs text-muted-foreground capitalize">{reg.season}</span>
            )}
            {reg.year && (
              <span className="text-xs text-muted-foreground">· {reg.year}</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-primary">{formatFee(reg.fee_amount)}</p>
          {reg.fee_description && (
            <p className="text-[10px] text-muted-foreground">{reg.fee_description}</p>
          )}
        </div>
      </div>

      {reg.team_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trophy className="w-3 h-3 text-primary" />
          {reg.team_name}
        </div>
      )}

      {reg.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{reg.description}</p>
      )}

      {/* CTA */}
      <div>
        {status === "pending" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
            ⏳ Pending Approval
          </span>
        ) : status === "approved" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400">
            ✅ Registered
          </span>
        ) : status === "rejected" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
            ✗ Not Accepted
          </span>
        ) : (
          <button
            onClick={handleRegister}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            📝 Register Athlete
          </button>
        )}
      </div>
    </div>
  );
}