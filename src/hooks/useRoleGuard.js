import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/** Admin only */
export function useAdminGuard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user || user.role !== "admin") {
      navigate("/Portal", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);
  return { isAdmin: user?.role === "admin", user };
}

/** Admin or Athletic Director */
export function useAdminOrADGuard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user || (user.role !== "admin" && user.role !== "athletic_director")) {
      navigate("/Portal", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);
  return { isAdmin: user?.role === "admin", isAD: user?.role === "athletic_director", user };
}

/** Admin, Athletic Director, or Coach (schedule access) */
export function useScheduleGuard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user || !["admin", "athletic_director", "coach"].includes(user.role)) {
      navigate("/Portal", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);
  const isAdmin = user?.role === "admin";
  const isAD = user?.role === "athletic_director";
  const isCoach = user?.role === "coach";
  return { isAdmin, isAD, isCoach, user };
}

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === "admin";
}

export function useIsStaff() {
  const { user } = useAuth();
  return ["admin", "athletic_director", "coach"].includes(user?.role);
}

export function useIsParent() {
  const { user } = useAuth();
  return user?.role === "parent";
}

export function useRole() {
  const { user } = useAuth();
  return user?.role || null;
}