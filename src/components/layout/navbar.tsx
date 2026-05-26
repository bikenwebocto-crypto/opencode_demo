'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useNotificationStore } from '@/store/notification-store'

interface NavbarProps {
  title: string
  onMenuClick?: () => void
}

export function Navbar({ title, onMenuClick }: NavbarProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
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
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">AD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
