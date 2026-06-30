import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, X } from "lucide-react";

// ── Pixel-grid SVG overlay (subtle) ──────────────────────────────────────────
const PixelGridOverlay = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="pg" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="white" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#pg)" />
  </svg>
);

const TIER_COLORS = {
  Gold:   { ring: "#d4af37", glow: "rgba(212,175,55,0.35)", label: "GOLD SPONSOR" },
  Silver: { ring: "#a8a9ad", glow: "rgba(168,169,173,0.25)", label: "SILVER SPONSOR" },
  Bronze: { ring: "#cd7f32", glow: "rgba(205,127,50,0.25)", label: "BRONZE SPONSOR" },
};

export default function SponsorTicker() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [animClass, setAnimClass] = useState("jb-visible");
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem("ticker_dismissed") !== "1"
  );
  const intervalRef = useRef(null);

  const dismiss = () => {
    sessionStorage.setItem("ticker_dismissed", "1");
    setVisible(false);
  };

  const { data: sponsors = [] } = useQuery({
    queryKey: ["layout-sponsors"],
    queryFn: () => base44.entities.Sponsor.filter({ approval_status: "approved", is_active: true }),
    staleTime: 60_000,
  });

  // Cycle with "fade-down-flash" animation
  useEffect(() => {
    if (sponsors.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setAnimClass("jb-exit");
      setTimeout(() => {
        setActiveIdx(i => (i + 1) % sponsors.length);
        setAnimClass("jb-flash");
        setTimeout(() => setAnimClass("jb-visible"), 180);
      }, 300);
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, [sponsors.length]);

  if (!visible) return null;
  if (!sponsors.length) return null;

  const sponsor = sponsors[activeIdx];
  const tier = TIER_COLORS[sponsor.tier] || TIER_COLORS.Bronze;
  const iconIsUrl = sponsor.logo_url && (sponsor.logo_url.startsWith("http://") || sponsor.logo_url.startsWith("https://"));

  const Jumbotron = (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: "linear-gradient(160deg, #0a0a0a 0%, #141414 60%, #0d0d0d 100%)",
        border: `1.5px solid ${tier.ring}`,
        borderRadius: "14px",
        boxShadow: `0 0 18px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5)`,
      }}
    >
      {/* Beveled inner frame edge */}
      <div
        className="absolute inset-[3px] rounded-[10px] pointer-events-none"
        style={{ border: "1px solid rgba(255,255,255,0.04)" }}
      />

      {/* Pixel grid */}
      <PixelGridOverlay />

      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[14px] overflow-hidden"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
        }}
      />

      {/* Content */}
      <div
        className={`relative z-10 flex items-center gap-3 px-3 py-2 jumbotron-content ${animClass}`}
      >
        {/* LEFT: label (stacked) */}
        <div className="flex flex-col items-center justify-center shrink-0 gap-1">
          {tier.label.split(" ").map((word, i) => (
            <span
              key={i}
              className="text-[7px] font-black tracking-[0.15em] uppercase leading-none"
              style={{ color: tier.ring, textShadow: `0 0 8px ${tier.glow}` }}
            >
              {word}
            </span>
          ))}
        </div>

        <div className="w-px h-8 shrink-0" style={{ background: `linear-gradient(to bottom, transparent, ${tier.ring}60, transparent)` }} />

        {/* Logo or icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${tier.ring}40` }}
        >
          {iconIsUrl ? (
            <img src={sponsor.logo_url} alt={sponsor.business_name} className="w-full h-full object-contain p-0.5" />
          ) : (
            <Building2 className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold truncate"
            style={{ color: "#f0e8d0", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
          >
            {sponsor.business_name}
          </p>
          {sponsor.website_url && (
            <p className="text-[10px] truncate" style={{ color: tier.ring, opacity: 0.8 }}>
              {sponsor.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </p>
          )}
        </div>

        {/* Dot indicators */}
        {sponsors.length > 1 && (
          <div className="flex gap-1 shrink-0">
            {sponsors.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIdx ? 6 : 3,
                  height: 3,
                  borderRadius: 1.5,
                  background: i === activeIdx ? tier.ring : "rgba(255,255,255,0.18)",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom LED strip */}
      <div
        className="h-[2px] w-full"
        style={{ background: `linear-gradient(to right, transparent, ${tier.ring}, transparent)`, opacity: 0.6 }}
      />

      <style>{`
        .jb-visible { opacity: 1; transform: translateY(0); transition: opacity 0.25s, transform 0.25s; }
        .jb-exit    { opacity: 0; transform: translateY(6px); transition: opacity 0.25s, transform 0.25s; }
        .jb-flash   { opacity: 0; transform: translateY(-4px); }
      `}</style>
    </div>
  );

  if (sponsor.website_url) {
    return (
      <div className="relative px-3 pt-3 pb-1">
        <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="block no-underline">
          {Jumbotron}
        </a>
        <button
          onClick={dismiss}
          aria-label="Dismiss sponsors"
          className="absolute top-1 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative px-3 pt-3 pb-1">
      {Jumbotron}
      <button
        onClick={dismiss}
        aria-label="Dismiss sponsors"
        className="absolute top-1 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}