import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/**
 * Redirects non-admin users away from admin-only pages.
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
 * Redirects users who are not admin or coach away from staff pages.
 */
export function useStaffGuard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && user && user.role !== "admin" && user.role !== "coach") {
      navigate("/Portal", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  const isStaff = user?.role === "admin" || user?.role === "coach";
  return { isStaff, isAdmin: user?.role === "admin", user };
}

/**
 * Returns true if the current user is an admin.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === "admin";
}

/**
 * Returns true if the current user is admin or coach.
 */
export function useIsStaff() {
  const { user } = useAuth();
  return user?.role === "admin" || user?.role === "coach";
}