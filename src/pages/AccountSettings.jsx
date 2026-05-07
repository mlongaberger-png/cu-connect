import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Camera, Save, Mail, Phone, User, Shield, KeyRound, CheckCircle, Loader2, Trash2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MyChildrenPanel from "@/components/parentportal/MyChildrenPanel";
import FamilyAccessManager from "@/components/parentportal/FamilyAccessManager";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export default function AccountSettings() {
  const { user, checkAppState } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    avatar_url: user?.avatar_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isParent = ["parent", "grandparent"].includes(user?.role);

  const { data: myGuardianLinks = [] } = useQuery({
    queryKey: ["my-guardian-links-settings", user?.email],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user?.email }),
    enabled: isParent && !!user?.email,
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players-all-settings"],
    queryFn: () => base44.entities.Player.list(),
    enabled: isParent,
  });

  const linkedPlayerIds = new Set(myGuardianLinks.map(g => g.player_id));
  const linkedPlayers = allPlayers.filter(p => linkedPlayerIds.has(p.id) || p.parent_email === user?.email);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, avatar_url: file_url }));
      toast({ title: "Photo uploaded", description: "Click Save to apply changes." });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        avatar_url: form.avatar_url,
      });
      toast({ title: "Profile updated", description: "Your changes have been saved.", duration: 5000 });
      await checkAppState();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendMagicLink = async () => {
    setSendingLink(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: "Sign in to Cornerstone United Athletics",
        body: `Hi ${user.full_name || "there"},\n\nYou requested a new sign-in link. Please log in at the portal to access your account.\n\nIf you didn't request this, you can ignore this email.`,
      });
      setMagicLinkSent(true);
      toast({ title: "Link sent!", description: "Check your email for a new sign-in link." });
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSendingLink(false);
    }
  };

  const initials = (user?.full_name || user?.email || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    await base44.functions.invoke("deleteAccount", {});
    base44.auth.logout();
  };

  const roleLabel = {
    admin: "Administrator",
    coach: "Coach",
    athletic_director: "Athletic Director",
    parent: "Parent / Guardian",
    grandparent: "Grandparent",
    user: "User",
  }[user?.role] || user?.role || "User";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal profile and security settings.</p>
      </div>

      {/* Profile Photo + Name */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Profile</CardTitle>
          <CardDescription>Update your name and profile photo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-border">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md"
              >
                {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.full_name || "—"}</p>
              <Badge variant="outline" className="mt-1 text-xs capitalize">{roleLabel}</Badge>
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 000-0000"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
          </Button>
        </CardContent>
      </Card>

      {/* Email — read only */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email Address</CardTitle>
          <CardDescription>Your login email address. Contact an administrator to change it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted border border-border">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground flex-1">{user?.email}</span>
            <Badge variant="secondary" className="text-xs">Verified</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">To change your email, please contact your organization administrator.</p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Security</CardTitle>
          <CardDescription>Manage your sign-in access. We use secure magic links — no passwords needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
            <KeyRound className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Magic Link Sign-In</p>
              <p className="text-xs text-muted-foreground mt-0.5">We send a secure sign-in link to your email — no password required. Request a new link anytime.</p>
            </div>
          </div>
          {magicLinkSent ? (
            <div className="flex items-center gap-2 text-sm text-green-400 px-1">
              <CheckCircle className="w-4 h-4" />
              Sign-in link sent to {user?.email}
            </div>
          ) : (
            <Button variant="outline" onClick={handleSendMagicLink} disabled={sendingLink} className="w-full">
              {sendingLink ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</> : <><KeyRound className="w-4 h-4 mr-2" />Send New Sign-In Link</>}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Account ID</span>
            <span className="font-mono text-xs text-foreground">{user?.id?.slice(0, 12)}…</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Role</span>
            <span className="text-foreground capitalize">{roleLabel}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Member since</span>
            <span className="text-foreground">{user?.created_date ? new Date(user.created_date).toLocaleDateString() : "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Legal Links */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Legal & Privacy</CardTitle>
          <CardDescription>Access your rights and our data policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { label: "Privacy Policy", href: "/privacy-policy" },
            { label: "Terms of Service", href: "/LegalPages" },
            { label: "Payment Terms", href: "/LegalPages" },
            { label: "Data Retention Policy", href: "/LegalPages" },
          ].map(({ label, href }) => (
            <Link key={label} to={href} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface transition-colors text-muted-foreground hover:text-foreground">
              <span>{label}</span>
              <span className="text-muted-foreground">›</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* My Children — parents/grandparents only */}
      {isParent && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> My Children</CardTitle>
            <CardDescription>Manage your children's profiles and check their status.</CardDescription>
          </CardHeader>
          <CardContent>
            <MyChildrenPanel userEmail={user?.email} userName={user?.full_name} linkedPlayers={linkedPlayers} />
          </CardContent>
        </Card>
      )}

      {/* Family Access — parents only (not grandparents themselves) */}
      {user?.role === "parent" && linkedPlayers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> My Family</CardTitle>
            <CardDescription>Invite grandparents or other family members and control exactly what they can access.</CardDescription>
          </CardHeader>
          <CardContent>
            <FamilyAccessManager players={linkedPlayers} currentUserEmail={user?.email} />
          </CardContent>
        </Card>
      )}

      {/* Delete Account */}
      {["parent", "user", "grandparent"].includes(user?.role) && (
        <Card className="bg-card border-red-900/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-400"><Trash2 className="w-4 h-4" /> Delete My Account</CardTitle>
            <CardDescription>Permanently remove your account and guardian links. Financial and compliance records are retained as required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!showDeleteConfirm ? (
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} className="border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300 w-full">
                <Trash2 className="w-4 h-4 mr-2" /> Request Account Deletion
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/30 text-sm text-red-300">
                  ⚠️ This action is <strong>permanent</strong>. Your account, guardian links, and personal data will be deleted. Type <strong>DELETE</strong> below to confirm.
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full rounded-md border border-red-900/50 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} className="flex-1">Cancel</Button>
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "DELETE" || deleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete My Account"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}