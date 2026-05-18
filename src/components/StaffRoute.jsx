import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const STAFF_ROLES = ["admin", "coach", "athletic_director"];

export default function StaffRoute() {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  return isStaff ? <Outlet /> : <Navigate to="/Portal" replace />;
}