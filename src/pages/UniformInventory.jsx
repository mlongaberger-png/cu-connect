import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Shirt, Plus, Pencil, Trash2, Filter, AlertTriangle,
  Loader2, PackageSearch, MinusCircle, PlusCircle,
} from "lucide-react";
import { useScheduleGuard } from "@/hooks/useRoleGuard";

const ITEM_TYPES = ["jersey", "pads", "skirt"];
const SIZE_SUGGESTIONS = ["YS", "YM", "YL", "AS", "AM", "AL", "AXL"];
const LOW_STOCK_THRESHOLD = 2;

const emptyForm = { sport_id: "", item_type: "jersey", size: "", quantity_total: 0, quantity_assigned: 0 };

function StatusPill({ available }) {
  if (available <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-500/20 border-red-500/50 text-red-400 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> None available
      </span>
    );
  }
  if (available <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-yellow-500/20 border-yellow-500/50 text-yellow-400 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> Low stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-green-500/20 border-green-500/50 text-green-400 whitespace-nowrap">
      In stock
    </span>
  );
}

export default function UniformInventory() {
  const { isAdmin, isAD } = useScheduleGuard();
  const canDelete = isAdmin || isAD; // matches UniformInventory RLS delete rule

  const queryClient = useQueryClient();

  const [filterTeam, setFilterTeam] = useState("all");
  const [filterSport, setFilterSport] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["uniform-inventory-all"],
    queryFn: () => base44.entities.UniformInventory.list("-created_date", 500),
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const sortedSports = useMemo(() => [...sports].sort((a, b) => a.name.localeCompare(b.name)), [sports]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);

  // Inventory is pooled per sport, not per individual team. When a team is
  // selected, resolve it to its sport so the table shows that team's pool.
  const selectedTeam = teams.find(t => t.id === filterTeam);
  const effectiveSportId = filterTeam !== "all" ? selectedTeam?.sport_id : (filterSport !== "all" ? filterSport : null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (effectiveSportId && item.sport_id !== effectiveSportId) return false;
      if (filterType !== "all" && item.item_type !== filterType) return false;
      if (search.trim() && !(item.size || "").toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [items, effectiveSportId, filterType, search]);

  const lowStockCount = items.filter(
    i => (i.quantity_total || 0) - (i.quantity_assigned || 0) <= LOW_STOCK_THRESHOLD
  ).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["uniform-inventory-all"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.UniformInventory.create(data),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UniformInventory.update(id, data),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UniformInventory.delete(id),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });
  const adjustAssignedMutation = useMutation({
    mutationFn: ({ id, quantity_assigned }) => base44.entities.UniformInventory.update(id, { quantity_assigned }),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm, sport_id: effectiveSportId || sortedSports[0]?.id || "" });
    setShowForm(true);
  };
  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      sport_id: item.sport_id || "",
      item_type: item.item_type || "jersey",
      size: item.size || "",
      quantity_total: item.quantity_total ?? 0,
      quantity_assigned: item.quantity_assigned ?? 0,
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingItem(null); setForm(emptyForm); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.sport_id) return;
    const sport = sports.find(s => s.id === form.sport_id);
    const totalNum = Math.max(0, Number(form.quantity_total) || 0);
    const data = {
      sport_id: form.sport_id,
      sport_name: sport?.name || "",
      item_type: form.item_type,
      size: form.size.trim(),
      quantity_total: totalNum,
      quantity_assigned: Math.min(Math.max(0, Number(form.quantity_assigned) || 0), totalNum),
    };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  const bump = (item, delta) => {
    const next = Math.max(0, Math.min((item.quantity_assigned || 0) + delta, item.quantity_total || 0));
    if (next === item.quantity_assigned) return;
    adjustAssignedMutation.mutate({ id: item.id, quantity_assigned: next });
  };

  const teamsForSport = (sportId) => teams.filter(t => t.sport_id === sportId).map(t => t.name);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shirt className="w-6 h-6 text-primary" /> Uniform Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} item{items.length === 1 ? "" : "s"} tracked
            {lowStockCount > 0 && (
              <span className="ml-2 text-yellow-400 font-medium">· {lowStockCount} low on stock</span>
            )}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filterTeam} onValueChange={(v) => { setFilterTeam(v); setFilterSport("all"); }}>
            <SelectTrigger className="w-44 bg-surface border-border">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {sortedTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterSport} onValueChange={(v) => { setFilterSport(v); setFilterTeam("all"); }}>
          <SelectTrigger className="w-40 bg-surface border-border">
            <SelectValue placeholder="Filter by sport" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Sports</SelectItem>
            {sortedSports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 bg-surface border-border">
            <SelectValue placeholder="Item type" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Types</SelectItem>
            {ITEM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search size…"
          className="w-36 bg-surface border-border"
        />
        {selectedTeam && (
          <span className="text-xs text-muted-foreground">
            Shared {selectedTeam.sport_name || "sport"} pool — used by {teamsForSport(selectedTeam.sport_id).join(", ") || selectedTeam.name}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <PackageSearch className="w-10 h-10 opacity-30" />
            <p className="text-sm">No uniform inventory items match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-semibold px-4 py-3">Sport</th>
                  <th className="text-left font-semibold px-4 py-3">Item Type</th>
                  <th className="text-left font-semibold px-4 py-3">Size</th>
                  <th className="text-left font-semibold px-4 py-3">Total</th>
                  <th className="text-left font-semibold px-4 py-3">Assigned</th>
                  <th className="text-left font-semibold px-4 py-3">Available</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const available = (item.quantity_total || 0) - (item.quantity_assigned || 0);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{item.sport_name || "—"}</td>
                      <td className="px-4 py-3 text-foreground capitalize whitespace-nowrap">{item.item_type}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{item.size || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.quantity_total || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => bump(item, -1)}
                            disabled={(item.quantity_assigned || 0) <= 0 || adjustAssignedMutation.isPending}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Return one (decrease assigned count)"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center text-foreground">{item.quantity_assigned || 0}</span>
                          <button
                            type="button"
                            onClick={() => bump(item, 1)}
                            disabled={available <= 0 || adjustAssignedMutation.isPending}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Check out one (increase assigned count)"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{available}</td>
                      <td className="px-4 py-3"><StatusPill available={available} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="border-border h-8 px-3">
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteTarget(item)}
                              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400 h-8 px-3"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Sport</Label>
              <Select value={form.sport_id} onValueChange={(v) => setForm({ ...form, sport_id: v })}>
                <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select a sport" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {sortedSports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item Type</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {ITEM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Input
                list="uniform-size-suggestions"
                value={form.size}
                onChange={e => setForm({ ...form, size: e.target.value })}
                placeholder="e.g. YM, AL"
                className="bg-surface border-border"
              />
              <datalist id="uniform-size-suggestions">
                {SIZE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity_total}
                  onChange={e => setForm({ ...form, quantity_total: e.target.value })}
                  className="bg-surface border-border"
                />
              </div>
              <div>
                <Label>Assigned / Checked Out</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity_assigned}
                  onChange={e => setForm({ ...form, quantity_assigned: e.target.value })}
                  className="bg-surface border-border"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Inventory is shared across all teams within a sport. Use the +/- controls on the table for quick check-out / return without opening this form.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancel</Button>
              <Button
                type="submit"
                disabled={!form.sport_id || createMutation.isPending || updateMutation.isPending}
                className="bg-primary text-primary-foreground"
              >
                {editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Inventory Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget && `${deleteTarget.sport_name || "This"} ${deleteTarget.item_type} (${deleteTarget.size || "no size"})`} will be permanently removed. This can't be undone.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} className="border-border">Cancel</Button>
            <Button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
