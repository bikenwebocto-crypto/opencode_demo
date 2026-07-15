"use client";

import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useNotificationStore } from "@/store/notification-store";
import { supabase } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

interface NavbarProps {
  title: string;
  onMenuClick?: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: string | null;
  avatarUrl?: string | null;
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

export function Navbar({
  title,
  onMenuClick,
  userName,
  userEmail,
  userRole,
  avatarUrl,
}: NavbarProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = userName || "NA";
  const displayEmail = userEmail || "NA";
  const initials = getInitials(displayName);
  const router = useRouter();
  const logout = async () => {
    try {
      const res = await supabase.auth.signOut();
      //  console.log('Logout response:', res)
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Realtime indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <span className="realtime-dot h-1.5 w-1.5 rounded-full bg-green-500" />
          Live
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>

        {/* User avatar with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-accent"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border shadow-lg bg-background z-50">
              <div className="border-b px-2 pb-2">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
                {userRole && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {userRole.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <div className="border-t px-2 py-2">
                <Button variant="ghost" onClick={logout}>
                  <Link
                    href="/login"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
