import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";

const PAGE_TYPES = [
  { id: "privacy_policy",   label: "Privacy Policy" },
  { id: "terms_of_service", label: "Terms of Service" },
  { id: "payment_terms",    label: "Payment Terms" },
  { id: "data_retention",   label: "Data Retention Policy" },
];

const DEFAULT_CONTENT = {
  privacy_policy: `# Privacy Policy\n\nLast updated: ${new Date().toLocaleDateString()}\n\n**Cornerstone United** ("we", "us", or "our") is committed to protecting your personal information.\n\n## Information We Collect\n- Name, email address, and contact information\n- Player registration details\n- Payment information (processed securely via Stripe)\n- Usage data within the platform\n\n## How We Use Your Information\n- To manage team rosters, schedules, and events\n- To process payments securely\n- To send notifications about your child's team\n- To provide parent portal access\n\n## Data Sharing\nWe do not sell your personal information. Data is shared only with coaches and administrators within your organization.\n\n## Contact\nFor privacy concerns, contact your organization administrator.`,
  terms_of_service: `# Terms of Service\n\nLast updated: ${new Date().toLocaleDateString()}\n\nBy using the Cornerstone United platform, you agree to these Terms of Service.\n\n## Acceptable Use\n- You must provide accurate registration information\n- You are responsible for keeping your account credentials secure\n- The platform is for authorized members of Cornerstone United only\n\n## Payments\n- All payments are final unless otherwise stated by your administrator\n- Payment processing is handled securely by Stripe\n\n## Termination\nAdministrators may suspend access for violations of these terms.\n\n## Limitation of Liability\nCORNERSTONE UNITED IS NOT LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES ARISING FROM USE OF THIS PLATFORM.`,
  payment_terms: `# Payment Terms\n\nLast updated: ${new Date().toLocaleDateString()}\n\n## Invoices\n- Invoices are created by administrators and sent to parent accounts\n- Payment is due by the date specified on each invoice\n\n## Payment Processing\n- All payments are processed securely through Stripe\n- Accepted payment methods: major credit and debit cards\n\n## Refund Policy\n- Refunds are issued at the discretion of your organization administrator\n- Contact your admin within 30 days of payment for refund requests\n\n## Late Payments\n- Access to registration and certain features may be restricted for unpaid balances\n- Contact your administrator for payment arrangements`,
  data_retention: `# Data Retention Policy\n\nLast updated: ${new Date().toLocaleDateString()}\n\n## How Long We Keep Your Data\n- Active player records are retained for the duration of their participation\n- Payment records are retained for 7 years per financial regulations\n- Archived season data is retained for 3 years\n- Inactive accounts are reviewed annually\n\n## Your Rights\n- You may request a copy of your data by contacting your administrator\n- You may request deletion of your data after your child's participation ends\n\n## Data Security\n- All data is encrypted in transit and at rest\n- Access is restricted to authorized administrators and coaches only`,
};

export default function LegalPages({ embedded = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeType, setActiveType] = useState("privacy_policy");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const queryClient = useQueryClient();

  const { data: pages = [] } = useQuery({
    queryKey: ["legal-pages"],
    queryFn: () => base44.entities.LegalPage.list(),
  });

  const currentPage = pages.find(p => p.page_type === activeType);
  const displayContent = currentPage?.content || DEFAULT_CONTENT[activeType] || "";

  const saveMutation = useMutation({
    mutationFn: (content) => {
      const pageType = PAGE_TYPES.find(p => p.id === activeType);
      if (currentPage) {
        return base44.entities.LegalPage.update(currentPage.id, {
          content,
          last_updated_by: user?.email,
        });
      } else {
        return base44.entities.LegalPage.create({
          page_type: activeType,
          title: pageType?.label || activeType,
          content,
          last_updated_by: user?.email,
          is_published: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-pages"] });
      setEditing(false);
    },
  });

  const startEdit = () => {
    setEditContent(displayContent);
    setEditing(true);
  };

  return (
    <div className={embedded ? "space-y-6" : "p-4 md:p-6 max-w-4xl mx-auto space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Legal & Policy Pages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage your organization's legal documents</p>
        </div>
        {isAdmin && !editing && (
          <Button variant="outline" onClick={startEdit} className="border-border gap-2">
            <Edit2 className="w-4 h-4" /> Edit Page
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} className="border-border gap-2">
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate(editContent)} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {PAGE_TYPES.map(pt => (
          <button
            key={pt.id}
            onClick={() => { setActiveType(pt.id); setEditing(false); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeType === pt.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground border border-border"}`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {currentPage?.updated_date && (
          <div className="px-6 py-3 bg-surface border-b border-border">
            <p className="text-xs text-muted-foreground">
              Last updated {format(new Date(currentPage.updated_date), "MMMM d, yyyy")}
              {currentPage.last_updated_by && ` by ${currentPage.last_updated_by}`}
            </p>
          </div>
        )}
        <div className="p-6">
          {editing ? (
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full min-h-[500px] bg-surface border border-border rounded-xl p-4 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              {displayContent.split("\n").map((line, i) => {
                if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold text-foreground mt-5 mb-2">{line.slice(3)}</h2>;
                if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-foreground mb-4">{line.slice(2)}</h1>;
                if (line.startsWith("- ")) return <li key={i} className="text-sm text-muted-foreground ml-4 list-disc">{line.slice(2)}</li>;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-semibold text-foreground">{line.slice(2, -2)}</p>;
                if (line === "") return <br key={i} />;
                return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}