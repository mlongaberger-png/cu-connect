import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Undo2, Redo2, Trash2, Download, Save, MousePointer, Pencil, Circle, Square, Eraser, ArrowRight, Minus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────
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

function snapVal(v) { return Math.round(v / 20) * 20; }

function drawField(ctx, W, H, mode) {
  ctx.fillStyle = FIELD_COLOR;
  ctx.fillRect(0, 0, W, H);
  const stripeH = H / 10;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) { ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, i * stripeH, W, stripeH); }
  }
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  for (let i = 1; i < 10; i++) {
    const y = i * (H / 10);
    ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(W - 4, y); ctx.stroke();
  }
  if (mode !== "Youth") {
    ctx.strokeStyle = HASH_COLOR;
    ctx.lineWidth = 1.5;
    const leftHash = W * 0.28, rightHash = W * 0.72;
    for (let i = 0; i <= 50; i++) {
      const y = 4 + i * ((H - 8) / 50);
      [leftHash, rightHash].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.stroke();
      });
    }
  }
  ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
  const los = H * 0.6;
  ctx.beginPath(); ctx.moveTo(4, los); ctx.lineTo(W - 4, los); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(96,165,250,0.7)"; ctx.font = "10px sans-serif"; ctx.fillText("LOS", 8, los - 3);
}

function drawArrowHead(ctx, from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const aLen = 11;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - aLen * Math.cos(angle - 0.4), to.y - aLen * Math.sin(angle - 0.4));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - aLen * Math.cos(angle + 0.4), to.y - aLen * Math.sin(angle + 0.4));
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
    ctx.strokeStyle = isSelected ? "#fff" : (path.color || ROUTE_COLOR);
    ctx.lineWidth = isSelected ? (path.width || 2.5) + 1.5 : (path.width || 2.5);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.setLineDash(path.dashed ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (path.arrow) {
      const last = path.points[path.points.length - 1];
      const prev = path.points[path.points.length - 2];
      drawArrowHead(ctx, prev, last, isSelected ? "#fff" : (path.color || ROUTE_COLOR));
    }
  });
}

function drawPlayers(ctx, players, selectedId) {
  players.forEach(p => {
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
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    const fontSize = p.label && p.label.length > 2 ? r - 5 : r - 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.label || (p.type === "defense" ? "X" : "O"), p.x, p.y);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  });
}

// ── Toolbar config ────────────────────────────────────────────────────────────
const MODES = ["Varsity", "JV", "Youth"];
const TOOLS = [
  { id: "select",   icon: MousePointer, label: "Select/Move",       color: "#94a3b8" },
  { id: "offense",  icon: Circle,       label: "Add Offense (O)",   color: OFF_FILL },
  { id: "defense",  icon: Square,       label: "Add Defense (X)",   color: DEF_FILL },
  { id: "route",    icon: ArrowRight,   label: "Route (freehand arrow)", color: ROUTE_COLOR },
  { id: "line",     icon: Minus,        label: "Straight Line",     color: BLOCK_COLOR },
  { id: "arrow",    icon: ArrowRight,   label: "Straight Arrow",    color: MOTION_COLOR },
  { id: "block",    icon: Pencil,       label: "Block (freehand)",  color: BLOCK_COLOR },
  { id: "motion",   icon: Pencil,       label: "Motion (dashed)",   color: MOTION_COLOR },
  { id: "erase",    icon: Eraser,       label: "Erase Line",        color: "#f87171" },
];

const LINE_COLORS = [
  { color: ROUTE_COLOR,  label: "Route" },
  { color: BLOCK_COLOR,  label: "Block" },
  { color: MOTION_COLOR, label: "Motion" },
  { color: "#f472b6",    label: "Pink" },
  { color: "#ffffff",    label: "White" },
  { color: "#fb923c",    label: "Orange" },
];

export default function DiagramDrawer({ play, onSave, onClose }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("Varsity");
  const [tool, setTool] = useState("offense");
  const [players, setPlayers] = useState([]);
  const [paths, setPaths] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState(null);       // player id
  const [selectedPathId, setSelectedPathId] = useState(null); // path id
  const [dragging, setDragging] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [lineStart, setLineStart] = useState(null);          // for straight line/arrow
  const [customColor, setCustomColor] = useState(ROUTE_COLOR);
  const [saving, setSaving] = useState(false);
  // Rename inline
  const [renaming, setRenaming] = useState(null); // { id, value }
  const playerCounter = useRef(1);

  const W = 320, H = 480;

  // Load existing diagram data if play has diagram_data saved
  useEffect(() => {
    if (play?.diagram_data) {
      try {
        const saved = JSON.parse(play.diagram_data);
        if (saved.players) setPlayers(saved.players);
        if (saved.paths) setPaths(saved.paths);
        if (saved.counter) playerCounter.current = saved.counter;
      } catch {}
    }
  }, [play?.id]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawField(ctx, W, H, mode);
    drawPaths(ctx, paths, selectedPathId);
    if (currentPath) drawPaths(ctx, [currentPath], null);
    // Preview straight line while dragging
    if (lineStart && (tool === "line" || tool === "arrow")) {
      // Will be drawn on mousemove via currentPath
    }
    drawPlayers(ctx, players, selectedId);
  }, [players, paths, currentPath, selectedId, selectedPathId, mode, lineStart, tool]);

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
  const clearAll = () => { pushHistory(snapshot()); setPlayers([]); setPaths([]); setSelectedId(null); setSelectedPathId(null); };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  const hitPlayer = (x, y) => players.find(p => Math.hypot(p.x - x, p.y - y) <= PLAYER_RADIUS + 4);

  // Find clicked path (within ~8px of any segment)
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
        if (dist < 8) return path;
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
      const sx = snapVal(x), sy = snapVal(y);
      const label = tool === "offense" ? `O${playerCounter.current++}` : `X${playerCounter.current++}`;
      pushHistory(snapshot());
      setPlayers(ps => [...ps, { id: Date.now().toString(), type: tool, x: sx, y: sy, label }]);
      return;
    }

    // Straight line / arrow — record start point
    if (tool === "line" || tool === "arrow") {
      setLineStart({ x, y });
      setCurrentPath({ points: [{ x, y }, { x, y }], color: customColor, dashed: false, arrow: tool === "arrow", width: 2.5 });
      return;
    }

    // Freehand paths
    const color = tool === "route" ? customColor : tool === "block" ? BLOCK_COLOR : MOTION_COLOR;
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
      if (tool === "line" || tool === "arrow") {
        // Update end point for straight line preview
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
      pushHistory(snapshot());
      setPaths(ps => [...ps, { ...currentPath, id: Date.now().toString() }]);
    }
    setCurrentPath(null);
    setLineStart(null);
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
    if (!selectedId) return;
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
    // Save both the image and the raw data so it can be re-edited
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const file = new File([blob], `diagram-${play?.id || Date.now()}.png`, { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const diagramData = JSON.stringify({ players, paths, counter: playerCounter.current });
    await base44.entities.Play.update(play.id, { diagram_url: file_url, diagram_data: diagramData });
    setSaving(false);
    onSave(file_url);
  };

  const hasSelection = selectedId || selectedPathId;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-start overflow-y-auto py-2">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">Diagram Editor</p>
            <h3 className="text-sm font-bold text-foreground truncate max-w-[180px]">{play?.title || "New Diagram"}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 px-3 pt-3 pb-1">
          {MODES.map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
              {m}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="px-3 pb-1 relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-xl border border-border touch-none"
            style={{ cursor: tool === "select" ? "grab" : tool === "erase" ? "cell" : "crosshair" }}
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
          <div className="grid grid-cols-9 gap-1">
            {TOOLS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  title={t.label}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all border ${tool === t.id ? "border-primary bg-primary/20" : "border-border bg-surface hover:bg-surface/80"}`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                  <span className="text-[8px] text-muted-foreground mt-0.5 leading-tight text-center hidden sm:block">
                    {t.id === "offense" ? "Off" : t.id === "defense" ? "Def" : t.id === "select" ? "Move" : t.id === "erase" ? "Erase" : t.id === "line" ? "Line" : t.id === "arrow" ? "→" : t.id.charAt(0).toUpperCase() + t.id.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color picker for line tools */}
        {(tool === "route" || tool === "line" || tool === "arrow") && (
          <div className="px-3 pb-2">
            <p className="text-[10px] text-muted-foreground mb-1.5">Line Color</p>
            <div className="flex gap-1.5 flex-wrap">
              {LINE_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => setCustomColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${customColor === color ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected player actions */}
        {selectedId && (
          <div className="px-3 pb-2">
            <div className="bg-surface rounded-xl border border-border p-2.5 flex items-center gap-2">
              {renaming ? (
                <>
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                    maxLength={4}
                    className="flex-1 bg-card border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="Label…"
                  />
                  <button onClick={commitRename} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">OK</button>
                  <button onClick={() => setRenaming(null)} className="px-2 py-1 rounded-lg bg-surface text-muted-foreground text-xs">✕</button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground flex-1">Player selected</span>
                  <button onClick={startRename} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                    <Type className="w-3 h-3" /> Rename
                  </button>
                  <button onClick={deleteSelected} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Selected path actions */}
        {selectedPathId && !selectedId && (
          <div className="px-3 pb-2">
            <div className="bg-surface rounded-xl border border-border p-2.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Line selected</span>
              <button onClick={deleteSelected} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                <Trash2 className="w-3 h-3" /> Delete Line
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 px-3 pb-2 flex-wrap">
          {[["Route/Arrow", ROUTE_COLOR], ["Block", BLOCK_COLOR], ["Motion", MOTION_COLOR]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex gap-1 px-3 pb-3 flex-wrap">
          <button onClick={undo} disabled={!history.length} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} disabled={!redoStack.length} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={clearAll} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-red-400 text-xs">
            Clear All
          </button>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground text-xs">
            <Download className="w-3.5 h-3.5" />
          </button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground gap-1 text-xs h-8">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}