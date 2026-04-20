import { Link, Outlet } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <span className="text-label">Vibey</span>
            <div className="ml-auto">
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs uppercase tracking-wider">Vibey Control</span>
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
