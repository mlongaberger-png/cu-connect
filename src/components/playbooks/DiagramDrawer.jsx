import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Undo2, Redo2, Trash2, Download, Save, MousePointer, Pencil, Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Constants ────────────────────────────────────────────────────────────────
const FIELD_COLOR = "#2d5a27";
const LINE_COLOR = "rgba(255,255,255,0.6)";
const HASH_COLOR = "rgba(255,255,255,0.4)";
const OFF_FILL = "#f59e0b";
const OFF_STROKE = "#fbbf24";
const DEF_FILL = "#ef4444";
const DEF_STROKE = "#f87171";
const BALL_FILL = "#b45309";
const ROUTE_COLOR = "#facc15";
const BLOCK_COLOR = "#60a5fa";
const MOTION_COLOR = "#34d399";

const PLAYER_RADIUS = 14;
const SNAP = 20; // grid snap px

function snapVal(v) { return Math.round(v / SNAP) * SNAP; }

function drawField(ctx, W, H, mode) {
  // Background
  ctx.fillStyle = FIELD_COLOR;
  ctx.fillRect(0, 0, W, H);

  // Alternating darker stripes (10-yard bands)
  const stripeH = H / 10;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, i * stripeH, W, stripeH);
    }
  }

  // Sidelines
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Yard lines (every 10% of height)
  for (let i = 1; i < 10; i++) {
    const y = i * (H / 10);
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(W - 4, y);
    ctx.stroke();
  }

  // Hash marks (skip in Youth mode)
  if (mode !== "Youth") {
    ctx.strokeStyle = HASH_COLOR;
    ctx.lineWidth = 1.5;
    const leftHash = W * 0.28;
    const rightHash = W * 0.72;
    for (let i = 0; i <= 50; i++) {
      const y = 4 + i * ((H - 8) / 50);
      [leftHash, rightHash].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.stroke();
      });
    }
  }

  // Line of scrimmage
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  const los = H * 0.6;
  ctx.beginPath();
  ctx.moveTo(4, los);
  ctx.lineTo(W - 4, los);
  ctx.stroke();
  ctx.setLineDash([]);

  // LOS label
  ctx.fillStyle = "rgba(96,165,250,0.7)";
  ctx.font = "10px sans-serif";
  ctx.fillText("LOS", 8, los - 3);
}

function drawPlayers(ctx, players, selectedId, mode) {
  players.forEach(p => {
    if (mode === "Youth" && p.varsityOnly) return;
    const r = PLAYER_RADIUS;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (p.type === "offense") {
      ctx.fillStyle = p.id === selectedId ? "#fde68a" : OFF_FILL;
      ctx.strokeStyle = OFF_STROKE;
    } else if (p.type === "defense") {
      ctx.fillStyle = p.id === selectedId ? "#fca5a5" : DEF_FILL;
      ctx.strokeStyle = DEF_STROKE;
    } else {
      ctx.fillStyle = p.id === selectedId ? "#d97706" : BALL_FILL;
      ctx.strokeStyle = "#f59e0b";
    }
    ctx.lineWidth = p.id === selectedId ? 3 : 2;
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r - 2}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.label || (p.type === "defense" ? "X" : "O"), p.x, p.y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  });
}

function drawPaths(ctx, paths) {
  paths.forEach(path => {
    if (path.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.strokeStyle = path.color || ROUTE_COLOR;
    ctx.lineWidth = path.width || 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (path.dashed) ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow at end
    if (path.arrow && path.points.length >= 2) {
      const last = path.points[path.points.length - 1];
      const prev = path.points[path.points.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const aLen = 10;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x - aLen * Math.cos(angle - 0.4), last.y - aLen * Math.sin(angle - 0.4));
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x - aLen * Math.cos(angle + 0.4), last.y - aLen * Math.sin(angle + 0.4));
      ctx.strokeStyle = path.color || ROUTE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
const MODES = ["Varsity", "JV", "Youth"];
const TOOLS = [
  { id: "select", icon: MousePointer, label: "Select/Move" },
  { id: "offense", icon: Circle, label: "Add Offense (O)" },
  { id: "defense", icon: Square, label: "Add Defense (X)" },
  { id: "route", icon: Pencil, label: "Route (yellow arrow)" },
  { id: "block", icon: Pencil, label: "Block (blue line)" },
  { id: "motion", icon: Pencil, label: "Motion (green dash)" },
];

export default function DiagramDrawer({ play, onSave, onClose }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("Varsity");
  const [tool, setTool] = useState("offense");
  const [players, setPlayers] = useState([]);
  const [paths, setPaths] = useState([]);
  const [history, setHistory] = useState([]); // undo stack: [{players, paths}]
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null); // { id, offX, offY }
  const [currentPath, setCurrentPath] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const playerCounter = useRef(1);

  const W = 320;
  const H = 480;

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawField(ctx, W, H, mode);
    drawPaths(ctx, paths);
    if (currentPath) drawPaths(ctx, [currentPath]);
    drawPlayers(ctx, players, selectedId, mode);
  }, [players, paths, currentPath, selectedId, mode]);

  useEffect(() => { redraw(); }, [redraw]);

  const snapshot = () => ({ players: JSON.parse(JSON.stringify(players)), paths: JSON.parse(JSON.stringify(paths)) });

  const pushHistory = (snap) => {
    setHistory(h => [...h.slice(-30), snap]);
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [...r, snapshot()]);
    setHistory(h => h.slice(0, -1));
    setPlayers(prev.players);
    setPaths(prev.paths);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(h => [...h, snapshot()]);
    setRedoStack(r => r.slice(0, -1));
    setPlayers(next.players);
    setPaths(next.paths);
  };

  const clearAll = () => {
    pushHistory(snapshot());
    setPlayers([]);
    setPaths([]);
    setSelectedId(null);
  };

  // ── Pointer helpers ─────────────────────────────────────────────────────────
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const hitPlayer = (x, y) => players.find(p => Math.hypot(p.x - x, p.y - y) <= PLAYER_RADIUS + 4);

  const onPointerDown = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);

    if (tool === "select") {
      const hit = hitPlayer(x, y);
      if (hit) {
        setSelectedId(hit.id);
        setDragging({ id: hit.id, offX: x - hit.x, offY: y - hit.y });
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "offense" || tool === "defense") {
      const snap = { x: snapVal(x), y: snapVal(y) };
      const label = tool === "offense" ? `O${playerCounter.current++}` : `X${playerCounter.current++}`;
      const newP = { id: Date.now().toString(), type: tool, x: snap.x, y: snap.y, label };
      pushHistory(snapshot());
      setPlayers(ps => [...ps, newP]);
      return;
    }

    // Drawing paths
    const color = tool === "route" ? ROUTE_COLOR : tool === "block" ? BLOCK_COLOR : MOTION_COLOR;
    const dashed = tool === "motion";
    setCurrentPath({ points: [{ x, y }], color, dashed, arrow: tool === "route", width: 2.5 });
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);

    if (dragging) {
      setPlayers(ps => ps.map(p => p.id === dragging.id ? { ...p, x: snapVal(x - dragging.offX), y: snapVal(y - dragging.offY) } : p));
      return;
    }

    if (currentPath) {
      setCurrentPath(cp => ({ ...cp, points: [...cp.points, { x, y }] }));
    }
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    if (dragging) {
      pushHistory(snapshot());
      setDragging(null);
      return;
    }
    if (currentPath && currentPath.points.length > 1) {
      pushHistory(snapshot());
      setPaths(ps => [...ps, { ...currentPath, id: Date.now().toString() }]);
    }
    setCurrentPath(null);
  };

  // Delete selected player
  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    setPlayers(ps => ps.filter(p => p.id !== selectedId));
    setSelectedId(null);
  };

  // Export as PNG
  const handleExport = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${play?.title || "diagram"}.png`;
    a.click();
  };

  // Save to play record
  const handleSave = async () => {
    setSaving(true);
    const canvas = canvasRef.current;
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const file = new File([blob], `diagram-${play?.id || Date.now()}.png`, { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Play.update(play.id, { diagram_url: file_url });
    setSaving(false);
    onSave(file_url);
  };

  const TOOL_COLORS = {
    route: ROUTE_COLOR,
    block: BLOCK_COLOR,
    motion: MOTION_COLOR,
    offense: OFF_FILL,
    defense: DEF_FILL,
    select: "#94a3b8",
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-start overflow-y-auto py-2">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">Diagram</p>
            <h3 className="text-sm font-bold text-foreground truncate max-w-[180px]">{play?.title || "New Diagram"}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 px-3 pt-3 pb-1">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="px-3 pb-1">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-xl border border-border touch-none"
            style={{ cursor: tool === "select" ? "grab" : "crosshair" }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
        </div>

        {/* Tool palette */}
        <div className="px-3 py-2">
          <div className="grid grid-cols-6 gap-1">
            {TOOLS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  title={t.label}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all border ${tool === t.id ? "border-primary bg-primary/20" : "border-border bg-surface hover:bg-surface/80"}`}
                >
                  <Icon className="w-4 h-4" style={{ color: TOOL_COLORS[t.id] }} />
                  <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight text-center">
                    {t.id === "offense" ? "Off" : t.id === "defense" ? "Def" : t.id === "select" ? "Move" : t.id.charAt(0).toUpperCase() + t.id.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 px-3 pb-2 flex-wrap">
          {[["Route", ROUTE_COLOR], ["Block", BLOCK_COLOR], ["Motion", MOTION_COLOR]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex gap-1 px-3 pb-3 flex-wrap">
          <button onClick={undo} disabled={history.length === 0} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs transition-colors">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs transition-colors">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          {selectedId && (
            <button onClick={deleteSelected} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={clearAll} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-red-400 text-xs transition-colors">
            Clear All
          </button>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground text-xs transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground gap-1 text-xs h-8"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}