import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  X, Undo2, Redo2, Trash2, Download, Save,
  MousePointer, Pencil, Circle, Square, Eraser,
  ArrowRight, Minus, Type, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Field & color constants ───────────────────────────────────────────────────
const FIELD_COLOR   = "#2d5a27";
const LINE_COLOR    = "rgba(255,255,255,0.6)";
const HASH_COLOR    = "rgba(255,255,255,0.35)";
const OFF_FILL      = "#f59e0b";
const OFF_STROKE    = "#fbbf24";
const DEF_FILL      = "#ef4444";
const DEF_STROKE    = "#f87171";
const BALL_FILL     = "#b45309";
const ROUTE_COLOR   = "#facc15";
const BLOCK_COLOR   = "#60a5fa";
const MOTION_COLOR  = "#34d399";
const PLAYER_R      = 9;

// Field is LANDSCAPE: W > H
const FW = 520;   // canvas width
const FH = 320;   // canvas height

function snapV(v) { return Math.round(v / 18) * 18; }

function drawField(ctx, mode) {
  // Green background
  ctx.fillStyle = FIELD_COLOR;
  ctx.fillRect(0, 0, FW, FH);

  // Alternating 10-yard stripes (horizontal bands across the width)
  const stripeW = FW / 10;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(i * stripeW, 0, stripeW, FH);
    }
  }

  // Sidelines
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, FW - 8, FH - 8);

  // Yard lines (vertical, every 10% of width)
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 10; i++) {
    const x = i * (FW / 10);
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, FH - 4);
    ctx.stroke();
  }

  // Hash marks
  if (mode !== "Youth") {
    ctx.strokeStyle = HASH_COLOR;
    ctx.lineWidth = 1.5;
    const topHash = FH * 0.33;
    const botHash = FH * 0.67;
    for (let i = 0; i <= 50; i++) {
      const x = 4 + i * ((FW - 8) / 50);
      [topHash, botHash].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
      });
    }
  }

  // Line of scrimmage (vertical dashed line at 40% from left)
  const los = FW * 0.4;
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(los, 4);
  ctx.lineTo(los, FH - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(96,165,250,0.8)";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText("LOS", los + 4, 16);
}

function drawArrowHead(ctx, from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 11;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(angle - 0.4), to.y - len * Math.sin(angle - 0.4));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(angle + 0.4), to.y - len * Math.sin(angle + 0.4));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
}

function drawPaths(ctx, paths, selectedPathId) {
  paths.forEach(path => {
    if (path.points.length < 2) return;
    const isSelected = path.id === selectedPathId;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
    ctx.strokeStyle = isSelected ? "#ffffff" : (path.color || ROUTE_COLOR);
    ctx.lineWidth = isSelected ? (path.width || 2.5) + 2 : (path.width || 2.5);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.setLineDash(path.dashed ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (path.arrow && path.points.length >= 2) {
      const last = path.points[path.points.length - 1];
      const prev = path.points[path.points.length - 2];
      drawArrowHead(ctx, prev, last, isSelected ? "#ffffff" : (path.color || ROUTE_COLOR));
    }
  });
}

function drawPlayers(ctx, players, selectedId) {
  players.forEach(p => {
    const r = PLAYER_R;
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
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    const fs = p.label && p.label.length > 2 ? r - 2 : r + 1;
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.label || (p.type === "defense" ? "X" : "O"), p.x, p.y);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  });
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOL_GROUPS = [
  {
    label: "Players",
    tools: [
      { id: "select",  label: "Select / Move", icon: MousePointer, color: "#94a3b8", hint: "Click to select, drag to move" },
      { id: "offense", label: "Offense (O)",   icon: Circle,       color: OFF_FILL,  hint: "Place offensive player" },
      { id: "defense", label: "Defense (X)",   icon: Square,       color: DEF_FILL,  hint: "Place defensive player" },
    ],
  },
  {
    label: "Lines",
    tools: [
      { id: "route",   label: "Route",         icon: Pencil,       color: ROUTE_COLOR,  hint: "Freehand route with arrow" },
      { id: "arrow",   label: "Straight Arrow",icon: ArrowRight,   color: ROUTE_COLOR,  hint: "Click-drag straight arrow" },
      { id: "line",    label: "Straight Line", icon: Minus,        color: BLOCK_COLOR,  hint: "Click-drag straight line" },
      { id: "block",   label: "Block",         icon: Pencil,       color: BLOCK_COLOR,  hint: "Freehand block path" },
      { id: "motion",  label: "Motion",        icon: Pencil,       color: MOTION_COLOR, hint: "Dashed motion path" },
    ],
  },
  {
    label: "Edit",
    tools: [
      { id: "erase",   label: "Erase Line",    icon: Eraser,       color: "#f87171",    hint: "Click a line to erase it" },
    ],
  },
];

const LINE_COLORS = [
  { color: ROUTE_COLOR,  label: "Yellow" },
  { color: BLOCK_COLOR,  label: "Blue" },
  { color: MOTION_COLOR, label: "Green" },
  { color: "#f472b6",    label: "Pink" },
  { color: "#ffffff",    label: "White" },
  { color: "#fb923c",    label: "Orange" },
];

const MODES = ["Varsity", "JV", "Youth"];

export default function DiagramDrawer({ play, onSave, onClose }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("Varsity");
  const [tool, setTool] = useState("offense");
  const [players, setPlayers] = useState([]);
  const [paths, setPaths] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [customColor, setCustomColor] = useState(ROUTE_COLOR);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const playerCounter = useRef(1);

  // Load saved diagram data
  useEffect(() => {
    if (play?.diagram_data) {
      try {
        const saved = JSON.parse(play.diagram_data);
        if (saved.players) setPlayers(saved.players);
        if (saved.paths)   setPaths(saved.paths);
        if (saved.counter) playerCounter.current = saved.counter;
      } catch {}
    }
  }, [play?.id]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawField(ctx, mode);
    drawPaths(ctx, paths, selectedPathId);
    if (currentPath) drawPaths(ctx, [currentPath], null);
    drawPlayers(ctx, players, selectedId);
  }, [players, paths, currentPath, selectedId, selectedPathId, mode]);

  useEffect(() => { redraw(); }, [redraw]);

  const snapshot = () => ({ players: JSON.parse(JSON.stringify(players)), paths: JSON.parse(JSON.stringify(paths)) });
  const pushHistory = (snap) => { setHistory(h => [...h.slice(-30), snap]); setRedoStack([]); };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [...r, snapshot()]);
    setHistory(h => h.slice(0, -1));
    setPlayers(prev.players); setPaths(prev.paths);
    setSelectedId(null); setSelectedPathId(null);
  };
  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(h => [...h, snapshot()]);
    setRedoStack(r => r.slice(0, -1));
    setPlayers(next.players); setPaths(next.paths);
  };
  const clearAll = () => {
    pushHistory(snapshot());
    setPlayers([]); setPaths([]);
    setSelectedId(null); setSelectedPathId(null);
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = FW / rect.width, scaleY = FH / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  const hitPlayer = (x, y) => players.find(p => Math.hypot(p.x - x, p.y - y) <= PLAYER_R + 5);
  const hitPath = (x, y) => {
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      for (let j = 1; j < path.points.length; j++) {
        const a = path.points[j - 1], b = path.points[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len)));
        const dist = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
        if (dist < 9) return path;
      }
    }
    return null;
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    if (renaming) { commitRename(); return; }

    if (tool === "select") {
      const hitP = hitPlayer(x, y);
      if (hitP) {
        setSelectedId(hitP.id); setSelectedPathId(null);
        setDragging({ id: hitP.id, offX: x - hitP.x, offY: y - hitP.y });
        // Open rename immediately on click
        setRenaming({ id: hitP.id, value: hitP.label || "" });
      } else {
        const hitL = hitPath(x, y);
        if (hitL) { setSelectedPathId(hitL.id); setSelectedId(null); }
        else { setSelectedId(null); setSelectedPathId(null); }
      }
      return;
    }
    if (tool === "erase") {
      const hitL = hitPath(x, y);
      if (hitL) {
        pushHistory(snapshot());
        setPaths(ps => ps.filter(p => p.id !== hitL.id));
        setSelectedPathId(null);
      }
      return;
    }
    if (tool === "offense" || tool === "defense") {
      pushHistory(snapshot());
      const label = tool === "offense" ? `O${playerCounter.current++}` : `X${playerCounter.current++}`;
      setPlayers(ps => [...ps, { id: Date.now().toString(), type: tool, x: snapV(x), y: snapV(y), label }]);
      return;
    }
    // Line tools
    const color = (tool === "block") ? BLOCK_COLOR : (tool === "motion") ? MOTION_COLOR : customColor;
    const dashed = tool === "motion";
    const arrow  = tool === "route" || tool === "arrow";
    setCurrentPath({ points: [{ x, y }, { x, y }], color, dashed, arrow, width: 2.5 });
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    if (dragging) {
      setPlayers(ps => ps.map(p => p.id === dragging.id ? { ...p, x: snapV(x - dragging.offX), y: snapV(y - dragging.offY) } : p));
      return;
    }
    if (currentPath) {
      if (tool === "line" || tool === "arrow") {
        setCurrentPath(cp => ({ ...cp, points: [cp.points[0], { x, y }] }));
      } else {
        setCurrentPath(cp => ({ ...cp, points: [...cp.points, { x, y }] }));
      }
    }
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    if (dragging) { pushHistory(snapshot()); setDragging(null); return; }
    if (currentPath && currentPath.points.length > 1) {
      const p0 = currentPath.points[0], p1 = currentPath.points[currentPath.points.length - 1];
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 5) {
        pushHistory(snapshot());
        setPaths(ps => [...ps, { ...currentPath, id: Date.now().toString() }]);
      }
    }
    setCurrentPath(null);
  };

  const deleteSelected = () => {
    if (selectedId) {
      pushHistory(snapshot());
      setPlayers(ps => ps.filter(p => p.id !== selectedId));
      setSelectedId(null);
    } else if (selectedPathId) {
      pushHistory(snapshot());
      setPaths(ps => ps.filter(p => p.id !== selectedPathId));
      setSelectedPathId(null);
    }
  };

  const startRename = () => {
    const p = players.find(pl => pl.id === selectedId);
    if (p) setRenaming({ id: p.id, value: p.label || "" });
  };
  const commitRename = () => {
    if (!renaming) return;
    pushHistory(snapshot());
    setPlayers(ps => ps.map(p => p.id === renaming.id ? { ...p, label: renaming.value } : p));
    setRenaming(null);
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${play?.title || "diagram"}.png`;
    a.click();
  };

  const handleSave = async () => {
    setSaving(true);
    const canvas = canvasRef.current;
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const file = new File([blob], `diagram-${play?.id || Date.now()}.png`, { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const diagramData = JSON.stringify({ players, paths, counter: playerCounter.current });
    await base44.entities.Play.update(play.id, { diagram_url: file_url, diagram_data: diagramData });
    setSaving(false);
    onSave(file_url);
  };

  const activeTool = TOOL_GROUPS.flatMap(g => g.tools).find(t => t.id === tool);
  const isLineTool = ["route", "arrow", "line", "block", "motion"].includes(tool);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-2 overflow-auto">
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col"
        style={{ width: "min(98vw, 860px)", maxHeight: "98dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Diagram Editor</p>
              <h3 className="text-sm font-bold text-foreground">{play?.title || "New Diagram"}</h3>
            </div>
            {/* Mode pills */}
            <div className="flex gap-1 ml-2">
              {MODES.map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${mode === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={undo} disabled={!history.length} title="Undo"
              className="p-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={!redoStack.length} title="Redo"
              className="p-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
              <Redo2 className="w-4 h-4" />
            </button>
            <button onClick={clearAll} className="px-2.5 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-red-400 text-xs transition-colors">
              Clear
            </button>
            <button onClick={handleExport} className="px-2.5 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground gap-1 h-8 text-xs">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
            <button onClick={onClose} className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Main body: toolbox + canvas ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left toolbox ── */}
          <div className="w-44 shrink-0 bg-[hsl(0_0%_8%)] border-r border-border overflow-y-auto flex flex-col">
            {TOOL_GROUPS.map(group => (
              <div key={group.label} className="p-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">{group.label}</p>
                <div className="space-y-1">
                  {group.tools.map(t => {
                    const Icon = t.icon;
                    const isActive = tool === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${
                          isActive
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-transparent bg-transparent hover:bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? t.color : undefined }} />
                        <span className="text-xs font-medium leading-tight">{t.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Color picker — shown for line tools */}
            {isLineTool && (
              <div className="p-2 border-t border-border mt-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">Color</p>
                <div className="grid grid-cols-3 gap-1.5 px-1">
                  {LINE_COLORS.map(({ color, label }) => (
                    <button
                      key={color}
                      title={label}
                      onClick={() => setCustomColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all mx-auto ${customColor === color ? "border-white scale-110 shadow-lg" : "border-transparent hover:border-white/40"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Selected player actions */}
            {selectedId && (
              <div className="p-2 border-t border-border mt-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">Selected</p>
                {renaming ? (
                  <div className="space-y-1.5 px-1">
                    <input
                      autoFocus
                      value={renaming.value}
                      onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                      maxLength={4}
                      className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="e.g. QB"
                    />
                    <div className="flex gap-1">
                      <button onClick={commitRename} className="flex-1 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">OK</button>
                      <button onClick={() => setRenaming(null)} className="px-2 py-1 rounded-lg bg-surface text-muted-foreground text-xs">✕</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 px-1">
                    <button onClick={startRename}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                      <Type className="w-3.5 h-3.5" /> Rename Label
                    </button>
                    <button onClick={deleteSelected}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Player
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Selected path actions */}
            {selectedPathId && !selectedId && (
              <div className="p-2 border-t border-border mt-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5">Selected</p>
                <div className="px-1">
                  <button onClick={deleteSelected}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Line
                  </button>
                </div>
              </div>
            )}

            {/* Active tool hint */}
            {activeTool && (
              <div className="mt-auto p-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground leading-relaxed">{activeTool.hint}</p>
              </div>
            )}
          </div>

          {/* ── Canvas area ── */}
          <div className="flex-1 flex items-center justify-center bg-[hsl(0_0%_5%)] p-3 overflow-auto">
            <canvas
              ref={canvasRef}
              width={FW}
              height={FH}
              className="rounded-xl border border-border touch-none block"
              style={{
                cursor: tool === "select" ? "grab" : tool === "erase" ? "cell" : "crosshair",
                maxWidth: "100%",
                maxHeight: "100%",
              }}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
            />
          </div>
        </div>

        {/* ── Bottom legend ── */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-card/50 shrink-0 flex-wrap">
          {[["Route/Arrow", ROUTE_COLOR], ["Block", BLOCK_COLOR], ["Motion (dashed)", MOTION_COLOR]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-5 h-1 rounded" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1 rounded border-t-2 border-dashed border-blue-400" />
            <span className="text-[10px] text-muted-foreground">Line of Scrimmage</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">Click a line in Select mode to highlight it, then delete</span>
        </div>
      </div>
    </div>
  );
}