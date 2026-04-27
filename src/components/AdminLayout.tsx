import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, X } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsStandalone } from "@/hooks/use-pwa";
import Chat from "@/pages/Chat";
import Dashboard from "@/pages/Dashboard";
import { cn } from "@/lib/utils";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();

  // Routes that render inside the Vibey Control panel (vs. their own full page).
  const controlRoutes = ["/dashboard", "/soul", "/identity", "/memory", "/media", "/interfaces", "/relationships", "/conversations", "/groups"];
  const isControlRoute = controlRoutes.some((r) => location.pathname.startsWith(r));
  const isChatRoute = location.pathname === "/";

  // Control panel open state — driven by route so sidebar links still work.
  const [controlOpen, setControlOpen] = useState(isControlRoute);

  useEffect(() => {
    if (isControlRoute) setControlOpen(true);
  }, [location.pathname, isControlRoute]);

  // PWA: when launched as an installed app on mobile, land on Vibey Control instead of chat.
  const didAutoLand = useRef(false);
  useEffect(() => {
    if (didAutoLand.current) return;
    if (isStandalone && isMobile && location.pathname === "/") {
      didAutoLand.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [isStandalone, isMobile, location.pathname, navigate]);

  const toggleControl = () => {
    if (controlOpen) {
      setControlOpen(false);
      // If we're sitting on a control route, return to chat when closing.
      if (isControlRoute) navigate("/");
    } else {
      setControlOpen(true);
      if (!isControlRoute) navigate("/dashboard");
    }
  };

  const closeControl = () => {
    setControlOpen(false);
    if (isControlRoute) navigate("/");
  };

  // On mobile, control panel uses a Sheet. On tablet/desktop, it's an inline side column.
  const showInlineControl = !isMobile && controlOpen;
  // Tailwind `lg` = 1024px, but useIsMobile flips at 768px — use md+ classes so the panel shows on tablets too.
  // The <Outlet /> only renders for non-control routes (i.e. chat / not-found edge cases).
  // For control routes we render Dashboard/Outlet inside the side panel instead.

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <span className="text-label">Vibey</span>
            <div className="ml-auto">
              <Button
                onClick={toggleControl}
                size="sm"
                variant={controlOpen ? "default" : "outline"}
                className="h-8 gap-1.5"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="font-mono text-xs uppercase tracking-wider">
                  Vibey Control
                </span>
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Chat is always mounted as the main view */}
            <main
              className={cn(
                "flex-1 min-w-0 overflow-auto",
                showInlineControl && "md:border-r md:border-border"
              )}
            >
              {isChatRoute || isControlRoute ? <Chat /> : <Outlet />}
            </main>

            {/* Tablet/desktop inline control panel */}
            {showInlineControl && (
              <aside className="hidden md:flex flex-col w-[420px] lg:w-[480px] xl:w-[560px] shrink-0 overflow-hidden bg-background animate-slide-in-right border-l border-border">
                <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
                  <span className="text-label">Vibey Control</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={closeControl}
                    aria-label="Close Vibey Control"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  {isControlRoute ? <Outlet /> : <Dashboard />}
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Mobile control panel as a sheet */}
        <Sheet open={isMobile && controlOpen} onOpenChange={(o) => !o && closeControl()}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
            <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
              <span className="text-label">Vibey Control</span>
            </div>
            <div className="flex-1 overflow-auto">
              {isControlRoute ? <Outlet /> : <Dashboard />}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </SidebarProvider>
  );
}
