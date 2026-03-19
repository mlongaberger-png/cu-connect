import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Shield, Trash2, Lock } from "lucide-react";

export default function VolunteerRolesPanel({ user }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: roles = [] } = useQuery({
    queryKey: ["volunteer-roles"],
    queryFn: () => base44.entities.VolunteerRole.filter({ is_active: true }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VolunteerRole.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteer-roles"] });
      setOpen(false);
      setForm({ name: "", description: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VolunteerRole.update(id, { is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-roles"] }),
  });

  const systemRoles = roles.filter(r => r.is_system_role);
  const customRoles = roles.filter(r => !r.is_system_role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Volunteer Roles</h2>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Custom Role
        </Button>
      </div>

      {/* System Roles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> System Roles
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {systemRoles.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">{r.name}</span>
                <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">System</span>
              </div>
              {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Custom Roles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custom Roles</p>
        {customRoles.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-xl">
            <p className="text-sm text-muted-foreground">No custom roles yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customRoles.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{r.name}</span>
                  <button
                    onClick={() => deleteMutation.mutate(r.id)}
                    className="ml-auto p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, is_system_role: false, is_active: true, created_by: user?.email }); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Parking Attendant" required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Create Role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}