import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

/**
 * Returns a `logAction` function that writes to the AuditLog entity.
 * Usage: const { logAction } = useAuditLog();
 * logAction({ action: "invoice_created", category: "payment", description: "...", target_entity: "Payment", target_id: id, target_name: "..." })
 */
export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async ({ action, category, description, target_entity, target_id, target_name, metadata }) => {
    if (!user) return;
    try {
      await base44.entities.AuditLog.create({
        action,
        category,
        actor_email: user.email,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        description,
        target_entity,
        target_id,
        target_name,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });
    } catch (e) {
      // Audit logging should never break the app
      console.warn("Audit log failed:", e.message);
    }
  };

  return { logAction };
}