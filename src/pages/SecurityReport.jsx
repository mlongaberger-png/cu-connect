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
      const token = (await base44.auth.me()).__token || "";
      const res = await fetch("/api/functions/securityReport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CU_Connect_Final_Security_Remediation_Report_v1.0.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // keep the blob URL alive so the persistent link works; revoke after 5 min
      setSignedUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (err) {
      setError(err.message || "Failed to generate report.");
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
          Final Security Remediation Report — v1.0
        </p>
        <p className="text-muted-foreground mb-6 text-sm">
          All 10 findings resolved. Executive summary, findings table, before/after evidence, and scope statement.
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

        {/* Manual direct download link — always visible */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <a
            href="https://appbuilder-prod.base44.com/api/apps/69bae2515552e76ca1fbd6a0/functions/securityReport"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <FileText className="w-4 h-4" />
            CU_Connect_Final_Security_Remediation_Report_v1.0.pdf
          </a>
          <p className="text-[11px] text-muted-foreground break-all select-all px-2">
            https://appbuilder-prod.base44.com/api/apps/69bae2515552e76ca1fbd6a0/functions/securityReport
          </p>
        </div>

        {signedUrl && (
          <a
            href={signedUrl}
            download="CU_Connect_Final_Security_Remediation_Report_v1.0.pdf"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-colors"
          >
            <FileText className="w-4 h-4" />
            CU_Connect_Final_Security_Remediation_Report_v1.0.pdf
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