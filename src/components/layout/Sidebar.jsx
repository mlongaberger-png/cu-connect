import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Trophy, Users, Calendar, MessageSquare, Megaphone,
  FolderOpen, UserCircle, X, LogOut, ShieldCheck, Bell,
  HelpCircle, Settings, Image, ClipboardList, Music2, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const staffNavGroups = [
  {
    label: "Main",
    items: [
      { path: "/Portal", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "athletic_director", "coach"] },
      { path: "/Schedule", label: "Schedule", icon: Calendar, roles: ["admin", "athletic_director", "coach"] },
      { path: "/Messages", label: "Messages", icon: MessageSquare, roles: ["admin", "athletic_director", "coach"] },
    ]
  },
  {
    label: "Team",
    items: [
      { path: "/Teams", label: "Teams & Roster", icon: Users, roles: ["admin", "athletic_director"] },
      { path: "/Sports", label: "Sports", icon: Trophy, roles: ["admin"] },
      { path: "/PracticePlans", label: "Practice Plans", icon: ClipboardList, roles: ["admin", "athletic_director", "coach"] },
      { path: "/GameDayPlaylists", label: "Game Day Music", icon: Music2, roles: ["admin", "athletic_director", "coach"] },
      { path: "/Playbooks", label: "Playbooks", icon: BookOpen, roles: ["admin", "athletic_director", "coach"] },
      { path: "/Gallery", label: "Gallery", icon: Image, roles: ["admin", "athletic_director", "coach"] },
    ]
  },
  {
    label: "Manage",
    items: [
      { path: "/Volunteers", label: "Volunteers", icon: Users, roles: ["admin", "athletic_director", "coach"] },
      { path: "/Announcements", label: "Announcements", icon: Megaphone, roles: ["admin", "athletic_director"] },
      { path: "/Documents", label: "Documents", icon: FolderOpen, roles: ["admin", "athletic_director"] },
      { path: "/ParentPortal", label: "Parent View", icon: UserCircle, roles: ["admin", "athletic_director", "coach"] },
      { path: "/AthleticDirectors", label: "Admin Console", icon: ShieldCheck, roles: ["admin"] },
    ]
  }
];

const parentNavItems = [
  { path: "/Portal", label: "Dashboard", icon: LayoutDashboard, roles: ["parent", "user"] },
  { path: "/ParentPortal", label: "My Portal", icon: UserCircle, roles: ["parent", "user"] },
  { path: "/sports-directory", label: "Sports & Register", icon: Trophy, roles: ["parent", "user"] },
  { path: "/Messages", label: "Messages", icon: MessageSquare, roles: ["parent", "user"] },
  { path: "/Gallery", label: "Gallery", icon: Image, roles: ["parent", "user"] },
];

const grandparentNavItems = [
  { path: "/Portal", label: "Portal", icon: LayoutDashboard, roles: ["grandparent"] },
  { path: "/Schedule", label: "Schedule", icon: Calendar, roles: ["grandparent"] },
];

// flat list for backward compat
const allNavItems = [
  ...staffNavGroups.flatMap(g => g.items),
  ...parentNavItems,
  ...grandparentNavItems,
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role || "";
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const navItems = allNavItems.filter(item => item.roles.includes(role));
  const currentPath = location.pathname + location.search;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose} />

      }
      
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border z-50
        flex flex-col transition-transform duration-300
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/fa10ad88f_IMG_20260126_085559_639.webp"
                alt="Cornerstone United Lions"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-primary text-sm font-bold tracking-tight leading-tight">Cornerstone United</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Lions Athletics</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {isStaff ? (
            // Grouped nav for staff
            staffNavGroups.map(group => {
              const groupItems = group.items.filter(item => item.roles.includes(role));
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label} className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 mb-1">{group.label}</p>
                  {groupItems.map(item => {
                    const isActive = location.pathname === item.path && !location.search;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path + item.label}
                        to={item.path}
                        onClick={onClose}
                        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 active:scale-[0.98]
                          ${isActive ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'}`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full" />
                        )}
                        <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                        {item.label}
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </Link>
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Flat nav for parents/grandparents
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = item.path.includes("?")
                  ? currentPath === item.path || currentPath.startsWith(item.path)
                  : location.pathname === item.path && !location.search;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'}`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {user && (
            <div className="px-4 py-3 rounded-xl bg-surface flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.full_name || user.email}</p>
                <p className="text-[10px] text-primary uppercase tracking-wide capitalize">{user.role?.replace("_", " ") || "user"}</p>
              </div>
            </div>
          )}
          <Link to="/AccountSettings" onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all">
            <Settings className="w-4 h-4" /> Account Settings
          </Link>
          <Link to="/NotificationSettings" onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all">
            <Bell className="w-4 h-4" /> Notifications
          </Link>
          <Link to="/HelpCenter" onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all">
            <HelpCircle className="w-4 h-4" /> Help & FAQ
          </Link>
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