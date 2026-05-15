import { Outlet, useLocation, useNavigate, NavLink } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Calendar, Columns2, LayoutDashboard, LogOut, Maximize2, MessagesSquare, X, Zap } from "lucide-react";
import { signOut } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsStandalone } from "@/hooks/use-pwa";
import Chat from "@/pages/Chat";
import { cn } from "@/lib/utils";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();

  // Routes that render inside the Vibey Control panel (vs. their own full page).
  const controlRoutes = ["/dashboard", "/sections", "/soul", "/identity", "/memory", "/media", "/interfaces", "/relationships", "/conversations", "/groups", "/automations"];
  const isControlRoute = controlRoutes.some((r) => location.pathname.startsWith(r));
  const isChatRoute = location.pathname === "/";

  // Optional side-by-side mode: control routes are full-width by default.
  const [splitChatOpen, setSplitChatOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vibey-split-chat") === "true";
  });

  // Resizable Vibey Control panel width (desktop/tablet only).
  const MIN_W = 320;
  const MAX_W = 1200;
  const DEFAULT_W = 520;
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_W;
    const saved = Number(window.localStorage.getItem("vibey-control-width"));
    return Number.isFinite(saved) && saved >= MIN_W && saved <= MAX_W ? saved : DEFAULT_W;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      // Panel is anchored to the right edge — width = distance from cursor to right edge.
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
      setPanelWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      try {
        window.localStorage.setItem("vibey-control-width", String(panelWidth));
      } catch {
        // Ignore private browsing / storage quota failures.
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, panelWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("vibey-split-chat", String(splitChatOpen));
    } catch {
      // Non-critical preference persistence.
    }
  }, [splitChatOpen]);

  // PWA: when launched as an installed app on mobile, land on Vibey Control instead of chat.
  const didAutoLand = useRef(false);
  useEffect(() => {
    if (didAutoLand.current) return;
    if (isStandalone && isMobile && location.pathname === "/") {
      didAutoLand.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isStandalone, isMobile, location.pathname, navigate]);

  const handleControlButton = () => {
    if (isControlRoute) {
      setSplitChatOpen((open) => !open);
      return;
    }
    navigate("/dashboard");
  };

  const closeSplitChat = () => {
    setSplitChatOpen(false);
  };

  // On tablet/desktop, split mode keeps chat open beside the selected control route.
  const showInlineControl = !isMobile && isControlRoute && splitChatOpen;
  const mainShowsChat = isChatRoute || showInlineControl;
  // Tailwind `lg` = 1024px, but useIsMobile flips at 768px — use md+ classes so the panel shows on tablets too.
  // Control routes render full-width unless split mode is enabled, in which case chat stays on the left.

  return (
    <SidebarProvider>
      <div className="h-safe-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="pt-safe shrink-0 border-b border-border">
            <div className="h-12 flex items-center px-4 gap-3">
              <SidebarTrigger />
              <span className="text-label">Vibey</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  onClick={handleControlButton}
                  size="sm"
                  variant={showInlineControl ? "default" : "outline"}
                  className="h-8 gap-1.5"
                >
                  {isControlRoute ? (
                    showInlineControl ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Columns2 className="h-3.5 w-3.5" />
                    )
                  ) : (
                    <LayoutDashboard className="h-3.5 w-3.5" />
                  )}
                  <span className="font-mono text-xs uppercase tracking-wider">
                    {isControlRoute
                      ? showInlineControl
                        ? "Full Page"
                        : "Split Chat"
                      : "Vibey Control"}
                  </span>
                </Button>
                <Button
                  onClick={() => signOut()}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Chat is always mounted as the main view */}
            <main
              className={cn(
                "flex-1 min-w-0 min-h-0 flex flex-col",
                // Chat owns its own internal scroll; other routes can scroll the main area.
                mainShowsChat ? "overflow-hidden" : "overflow-auto",
                showInlineControl && "md:border-r md:border-border"
              )}
            >
              {mainShowsChat ? <Chat /> : <Outlet />}
            </main>

            {/* Tablet/desktop inline control panel */}
            {showInlineControl && (
              <aside
                className="hidden md:flex flex-col shrink-0 overflow-hidden bg-background animate-slide-in-right border-l border-border relative"
                style={{ width: `${panelWidth}px` }}
              >
                {/* Drag handle */}
                <div
                  onMouseDown={startResize}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize Vibey Control"
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-col-resize z-10 group",
                    "hover:bg-primary/40 transition-colors",
                    isResizing && "bg-primary/60"
                  )}
                />
                <div className="pt-safe border-b border-border shrink-0">
                  <div className="h-10 flex items-center justify-between px-4">
                    <span className="text-label">Vibey Control</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={closeSplitChat}
                      aria-label="Close split chat"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <Outlet />
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
