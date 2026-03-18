import React from "react";
import { Menu, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TopBar({ onMenuToggle, title }) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuToggle}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center relative">
            <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9 w-64 bg-surface border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  );
}