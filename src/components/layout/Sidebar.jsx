import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Trophy, Users, Calendar, MessageSquare, Megaphone,
  FolderOpen, UserCircle, X, LogOut, ShieldCheck, HandHelping } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const allNavItems = [
  { path: "/Dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "athletic_director"] },
  { path: "/Sports", label: "Sports", icon: Trophy, roles: ["admin"] },
  { path: "/Teams", label: "Teams", icon: Users, roles: ["admin", "athletic_director"] },
  { path: "/Schedule", label: "Schedule", icon: Calendar, roles: ["admin", "athletic_director", "coach"] },
  { path: "/Messages", label: "Messages", icon: MessageSquare, roles: ["admin", "athletic_director", "coach"] },
  { path: "/Volunteers", label: "Volunteers", icon: Users, roles: ["admin", "athletic_director", "coach"] },
  { path: "/Announcements", label: "Announcements", icon: Megaphone, roles: ["admin", "athletic_director"] },
  { path: "/Documents", label: "Documents", icon: FolderOpen, roles: ["admin", "athletic_director"] },
  { path: "/ParentPortal", label: "Parent Portal", icon: UserCircle, roles: ["admin", "athletic_director", "coach"] },
  { path: "/AthleticDirectors", label: "Admin", icon: ShieldCheck, roles: ["admin"] },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role || "";
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose} />

      }
      
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50
        flex flex-col transition-transform duration-300
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img
                  src="https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png"
                  alt="Cornerstone United Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-primary text-base font-bold tracking-tight">Cornerstone United</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Athletics</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive ?
                'bg-primary/15 text-primary shadow-sm' :
                'text-muted-foreground hover:text-foreground hover:bg-surface-hover'}
                `}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {user && (
            <div className="px-4 py-3 rounded-xl bg-surface flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.full_name || user.email}</p>
                <p className="text-[10px] text-primary uppercase tracking-wide capitalize">{user.role || "admin"}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>);

}