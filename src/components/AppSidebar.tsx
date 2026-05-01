import {
  MessageCircle,
  Sparkles,
  User,
  Brain,
  Image,
  Settings2,
  Users,
  MessagesSquare,
  UsersRound,
  ExternalLink,
  LayoutDashboard,
  Zap,
  Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import vibeyAvatar from "@/assets/vibey-avatar.png";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const chatItem = { title: "Talk to Vibey", url: "/", icon: MessageCircle };
const dashboardItem = { title: "Vibey Control", url: "/dashboard", icon: LayoutDashboard };

const agentItems = [
  { title: "Soul", url: "/soul", icon: Sparkles },
  { title: "Identity", url: "/identity", icon: User },
  { title: "Memory", url: "/memory", icon: Brain },
  { title: "Tools", url: "/tools", icon: Wrench },
  { title: "Media Library", url: "/media", icon: Image },
  { title: "Interfaces", url: "/interfaces", icon: Settings2 },
];

const socialItems = [
  { title: "Relationships", url: "/relationships", icon: Users },
  { title: "Conversations", url: "/conversations", icon: MessagesSquare },
  { title: "Group Chats", url: "/groups", icon: UsersRound },
  { title: "Automations", url: "/automations", icon: Zap },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isMobile = useIsMobile();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 w-full",
      active && "bg-sidebar-accent text-primary font-medium"
    );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary/10 shrink-0 ring-1 ring-primary/20">
            <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
              Vibey
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Chat + Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")}>
                  <NavLink to="/" end onClick={handleNav} className={({ isActive }) => linkClass(isActive)}>
                    <chatItem.icon className="h-4 w-4" />
                    {!collapsed && <span>{chatItem.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <NavLink to="/dashboard" onClick={handleNav} className={({ isActive }) => linkClass(isActive)}>
                    <dashboardItem.icon className="h-4 w-4" />
                    {!collapsed && <span>{dashboardItem.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Agent */}
        <SidebarGroup>
          <SidebarGroupLabel>Agent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agentItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} onClick={handleNav} className={({ isActive }) => linkClass(isActive)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Social */}
        <SidebarGroup>
          <SidebarGroupLabel>Social</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {socialItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} onClick={handleNav} className={({ isActive }) => linkClass(isActive)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="flex flex-col gap-3">
            <ThemeToggle />
            <a
              href="#"
              className="text-label flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View Site
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
