import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Trash2, Trophy, Clock, TrendingDown, KeyRound, Ban, AlertTriangle, ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_COLUMNS = "id, type, title, message, link, is_read, created_at";

/** Typen aus kw-market-worker und kw-order-worker; unbekannte zeigen die Glocke. */
const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  project_new: Bell,
  project_underbid: TrendingDown,
  contact_unlocked: KeyRound,
  project_awarded: Trophy,
  project_not_awarded: Ban,
  project_ended: Clock,
  project_cancelled: Ban,
  complaint_filed: AlertTriangle,
  complaint_decided: AlertTriangle,
  order_reminder: ClipboardList,
  order_update: ClipboardList,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  project_new: "text-primary bg-primary/10",
  project_underbid: "text-destructive bg-destructive/10",
  contact_unlocked: "text-success bg-success/10",
  project_awarded: "text-success bg-success/10",
  project_not_awarded: "text-muted-foreground bg-muted",
  project_ended: "text-warning bg-warning/10",
  project_cancelled: "text-muted-foreground bg-muted",
  complaint_filed: "text-warning bg-warning/10",
  complaint_decided: "text-warning bg-warning/10",
  order_reminder: "text-warning bg-warning/10",
  order_update: "text-primary bg-primary/10",
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} ${diffDays === 1 ? "Tag" : "Tagen"}`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["dealer_notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      const { data, error } = await supabase
        .from("dealer_notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("Error fetching notifications:", error);
        return [];
      }
      return (data || []) as Notification[];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dealer-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dealer_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dealer_notifications", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dealer_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dealer_notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;
      const { error } = await supabase
        .from("dealer_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["dealer_notifications", user?.id] });
      }
    },
    [user, queryClient]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;
    const { error } = await supabase
      .from("dealer_notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["dealer_notifications", user.id] });
    }
  }, [user, queryClient]);

  // Delete a notification
  const deleteNotification = useCallback(
    async (notificationId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;
      const { error } = await supabase
        .from("dealer_notifications")
        .delete()
        .eq("id", notificationId);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["dealer_notifications", user?.id] });
      }
    },
    [user, queryClient]
  );

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
      if (notification.link) {
        navigate(notification.link);
        setIsOpen(false);
      }
    },
    [markAsRead, navigate]
  );

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border bg-background shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Benachrichtigungen</h3>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs gap-1"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Alle gelesen
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Laden...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const IconComponent = NOTIFICATION_ICONS[notification.type] || Bell;
                const colorClass = NOTIFICATION_COLORS[notification.type] || "text-muted-foreground bg-muted";

                return (
                  <div
                    key={notification.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notification.is_read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${colorClass}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(notification.created_at)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={(e) => deleteNotification(notification.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  navigate("/dashboard");
                  setIsOpen(false);
                }}
              >
                Zum Dashboard
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
