import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { FileText, Download, Loader2, Shield, LayoutDashboard, Bug } from "lucide-react";
import buildAppDocumentation from "@/components/reports/buildAppDocumentation";

export default function AppDocumentation() {
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/Portal" replace />;
  }

  const handleGenerate = () => {
    setLoading(true);
    try {
      const doc = buildAppDocumentation();
      doc.save("CU_Connect_Comprehensive_Documentation.pdf");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
          <FileText className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          CU Connect — Full Documentation
        </h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Comprehensive Application Documentation — v1.0
        </p>
        <p className="text-muted-foreground mb-6 text-sm">
          Complete technical deep-dive: project goal, architecture, all 50+ entities, 60+ backend
          functions, 12 automations, 30+ pages, security model, all issues & remediation, successes,
          and recommended next steps. Designed for AI review and development planning.
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {loading ? "Generating PDF..." : "Generate & Download PDF"}
        </button>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/SecurityReport"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Security Report →
          </Link>
          <Link
            to="/UIUXAuditReport"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            UI/UX Audit Report →
          </Link>
          <Link
            to="/IssuesFixedReport"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
          >
            <Bug className="w-4 h-4" />
            Issues Fixed Report →
          </Link>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-yellow-500">For AI Review</span>
            <br />
            This document is a comprehensive handoff for an AI agent to review the entire
            application and recommend changes. It covers everything from the founding goal
            through current implementation state.
          </p>
        </div>
      </div>
    </div>
  );
}