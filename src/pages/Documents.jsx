import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FolderOpen, Trash2, Download, FileText, Filter, PenLine } from "lucide-react";
import { format } from "date-fns";

import { useAdminOrADGuard } from "@/hooks/useRoleGuard";
import { useAuth } from "@/lib/AuthContext";
import SendSignatureRequestDialog from "@/components/documents/SendSignatureRequestDialog";
import SignatureRequestsPanel from "@/components/documents/SignatureRequestsPanel";

const categories = ["roster", "schedule", "policy", "medical", "financial", "other"];

const TABS = [
  { id: "files", label: "Files" },
  { id: "signatures", label: "E-Signatures" },
];

export default function Documents() {
  useAdminOrADGuard();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("files");
  const [showUpload, setShowUpload] = useState(false);
  const [showSendSig, setShowSendSig] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other", target: "org", target_id: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list("-created_date"),
  });
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); setShowUpload(false); setSelectedFile(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
    let targetName = "Organization";
    if (form.target === "sport") targetName = sports.find(s => s.id === form.target_id)?.name || "";
    if (form.target === "team") targetName = teams.find(t => t.id === form.target_id)?.name || "";
    
    createMutation.mutate({
      name: form.name || selectedFile.name,
      file_url,
      category: form.category,
      target: form.target,
      target_id: form.target === "org" ? "org" : form.target_id,
      target_name: targetName,
      file_type: selectedFile.type,
      file_size: `${(selectedFile.size / 1024).toFixed(1)} KB`,
      uploaded_by: "Admin",
    });
    setUploading(false);
  };

  const filtered = filterCat === "all" ? documents : documents.filter(d => d.category === filterCat);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">{documents.length} files uploaded</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSendSig(true)} className="border-border gap-2">
            <PenLine className="w-4 h-4" /> Send for Signature
          </Button>
          <Button onClick={() => setShowUpload(true)} className="bg-primary text-primary-foreground">
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "signatures" && (
        <SignatureRequestsPanel user={user} />
      )}

      {activeTab === "files" && <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40 bg-surface border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No documents</h3>
          <p className="text-muted-foreground">Upload your first document</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-primary/20 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="capitalize">{doc.category}</span>
                  {doc.file_size && <span>• {doc.file_size}</span>}
                  {doc.target_name && <span>• {doc.target_name}</span>}
                  {doc.created_date && <span>• {format(new Date(doc.created_date), "MMM d")}</span>}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Download className="w-4 h-4" />
                  </Button>
                </a>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(doc.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>}

      <SendSignatureRequestDialog open={showSendSig} onOpenChange={setShowSendSig} user={user} />

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {selectedFile ? selectedFile.name : "Click to select a file"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setSelectedFile(file); setForm({...form, name: file.name}); }
                }}
              />
            </div>
            <div><Label>Document Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-surface border-border" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={form.target} onValueChange={v => setForm({...form, target: v, target_id: ""})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="org">Organization</SelectItem>
                    <SelectItem value="sport">Sport</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.target === "sport" && (
              <div>
                <Label>Sport</Label>
                <Select value={form.target_id} onValueChange={v => setForm({...form, target_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.target === "team" && (
              <div>
                <Label>Team</Label>
                <Select value={form.target_id} onValueChange={v => setForm({...form, target_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowUpload(false)} className="border-border">Cancel</Button>
              <Button type="submit" disabled={!selectedFile || uploading} className="bg-primary text-primary-foreground">
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}