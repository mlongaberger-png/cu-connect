import React from "react";
import { Menu, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import TopBarWeather from "@/components/dashboard/TopBarWeather";

export default function TopBar({ onMenuToggle, title }) {
  const { user } = useAuth();

  return (
    <header
      className="shrink-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60 safe-area-top"
      style={{ transform: "translateZ(0)", willChange: "transform", boxShadow: "0 1px 0 0 hsl(var(--border) / 0.4)" }}
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Link to="/" className="lg:hidden">
            <img
              src="https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/61ac4d66c_file_0000000089d071f8be26c9f306ac7ce1.png"
              alt="CU"
              className="w-8 h-8 object-contain shrink-0"
            />
          </Link>
          <h2 className="text-lg font-semibold text-foreground hidden lg:block">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <TopBarWeather />
          {user && (
            <Link to="/AccountSettings" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-primary/40 transition-colors">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                : <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{(user.full_name || user.email || "A")[0].toUpperCase()}</span>
                  </div>
              }
              <span className="text-sm text-foreground">{user.full_name || user.email}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{user.role || "admin"}</span>
            </Link>
          )}
          <Button variant="ghost" size="icon" asChild className="relative text-muted-foreground hover:text-foreground">
            <Link to="/HelpCenter"><HelpCircle className="w-5 h-5" /></Link>
          </Button>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}