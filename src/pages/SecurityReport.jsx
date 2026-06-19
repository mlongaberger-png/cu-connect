import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Navigate } from "react-router-dom";
import { FileText, Download, Shield, Loader2 } from "lucide-react";

export default function SecurityReport() {
  const { user, isLoadingAuth } = useAuth();
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getSecurityReportUrl", {});
      if (res.data?.signed_url) {
        setSignedUrl(res.data.signed_url);
        window.open(res.data.signed_url, "_blank");
      } else {
        setError("No signed URL returned from server.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 mb-6">
          <Shield className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          CU Connect Security Audit
        </h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Phase 1 Fixes + Phase 2 QA Verification Sweep
        </p>
        <p className="text-muted-foreground mb-6 text-sm">
          Full report covering all 10 security findings, patches applied,
          and QA verification results with PASS/FAIL table.
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
          {loading ? "Generating..." : "Generate & Download PDF"}
        </button>

        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm text-primary hover:underline"
          >
            <FileText className="w-4 h-4" />
            Open downloaded report
          </a>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            {error}
          </p>
        )}

        <div className="mt-8 p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-yellow-500">⚠ Internal Use Only</span>
            <br />
            This report is confidential and intended for internal security
            audit purposes. Do not distribute outside the organization.
          </p>
        </div>
      </div>
    </div>
  );
}