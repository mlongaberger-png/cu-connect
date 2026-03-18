import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/**
 * Redirects non-admin users away from admin-only pages.
 * Call at the top of any admin-only page/component.
 */
export function useAdminGuard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && user && user.role !== "admin") {
      navigate("/Portal", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  const isAdmin = user?.role === "admin";
  return { isAdmin, user };
}

/**
 * Returns true if the current user is an admin.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === "admin";
}