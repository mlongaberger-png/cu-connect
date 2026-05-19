import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2 } from "lucide-react";

export default function SponsorTicker() {
  const [activeIdx, setActiveIdx] = useState(0);

  const { data: sponsors = [] } = useQuery({
    queryKey: ["layout-sponsors"],
    queryFn: () => base44.entities.Sponsor.filter({ approval_status: "approved", is_active: true }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx(i => (i + 1) % sponsors.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (!sponsors.length) return null;

  const sponsor = sponsors[activeIdx];

  const tierGlow = {
    Gold: "border-yellow-500/40 shadow-yellow-500/10",
    Silver: "border-zinc-400/40 shadow-zinc-400/10",
    Bronze: "border-orange-500/40 shadow-orange-500/10",
  };

  const tierLabel = {
    Gold: "🥇",
    Silver: "🥈",
    Bronze: "🥉",
  };

  const Inner = (
    <div
      className={`flex items-center gap-3 bg-card/80 backdrop-blur-sm border rounded-2xl px-4 py-2.5 shadow-lg transition-all duration-500 ${tierGlow[sponsor.tier] || "border-border"}`}
    >
      <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase shrink-0">Sponsor</span>
      <div className="w-px h-4 bg-border shrink-0" />
      {sponsor.logo_url ? (
        <img src={sponsor.logo_url} alt={sponsor.business_name} className="h-6 max-w-[80px] object-contain shrink-0" />
      ) : (
        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span className="text-sm font-semibold text-foreground truncate">{sponsor.business_name}</span>
      <span className="text-base shrink-0">{tierLabel[sponsor.tier] || ""}</span>
      {sponsors.length > 1 && (
        <div className="flex gap-1 shrink-0 ml-auto">
          {sponsors.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${i === activeIdx ? "w-3 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted"}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (sponsor.website_url) {
    return (
      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="block no-underline">
        {Inner}
      </a>
    );
  }

  return Inner;
}