import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// "ad" is accepted as an alias for "athletic_director"
const STAFF_ROLES = new Set(["admin", "coach", "athletic_director", "ad"]);

export default function StaffRoute() {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.has(user?.role);
  return isStaff ? <Outlet /> : <Navigate to="/Portal" replace />;
}