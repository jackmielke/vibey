import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";
import Login from "@/pages/Login";
import Chat from "@/pages/Chat";
import LovableChat from "@/pages/LovableChat";
import Dashboard from "@/pages/Dashboard";
import MissionControl from "@/pages/MissionControl";
import Soul from "@/pages/Soul";
import Identity from "@/pages/Identity";

import Memory from "@/pages/Memory";
import Media from "@/pages/Media";
import Interfaces from "@/pages/Interfaces";
import Tools from "@/pages/Tools";
import Skills from "@/pages/Skills";
import Relationships from "@/pages/Relationships";
import Conversations from "@/pages/Conversations";

import TelegramMini from "@/pages/TelegramMini";
import PublicChat from "@/pages/PublicChat";
import PublicDocs from "@/pages/PublicDocs";
import GoldenGoalLanding from "@/pages/GoldenGoalLanding";
import Automations from "@/pages/Automations";
import Heartbeats from "@/pages/Heartbeats";
import CalendarPage from "@/pages/Calendar";
import NotFound from "@/pages/NotFound";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const MissingSupabaseConfig = () => (
  <main className="min-h-safe-screen flex items-center justify-center bg-background px-6 text-foreground">
    <section className="w-full max-w-xl space-y-5 border border-border bg-card p-6 shadow-glow-sm">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Deployment config missing
        </p>
        <h1 className="text-2xl font-light tracking-tight">Supabase environment variables are not set.</h1>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This build is missing <span className="font-mono text-foreground">VITE_SUPABASE_URL</span> and/or{" "}
        <span className="font-mono text-foreground">VITE_SUPABASE_PUBLISHABLE_KEY</span>. Add them to the Lovable
        project environment, then publish/update the app again.
      </p>
    </section>
  </main>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {isSupabaseConfigured ? <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/mini" element={<TelegramMini />} />
          <Route path="/chat" element={<PublicChat />} />
          <Route path="/docs" element={<PublicDocs />} />
          <Route path="/golden-goal" element={<GoldenGoalLanding />} />
          <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Chat />} />
            <Route path="lovable-chat" element={<LovableChat />} />
            <Route path="dashboard" element={<MissionControl />} />
            <Route path="sections" element={<Dashboard />} />
            <Route path="soul" element={<Soul />} />
            <Route path="identity" element={<Identity />} />
            <Route path="memory" element={<Memory />} />
            <Route path="media" element={<Media />} />
            <Route path="interfaces" element={<Interfaces />} />
            <Route path="tools" element={<Tools />} />
            <Route path="skills" element={<Skills />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="groups" element={<Navigate to="/conversations?tab=groups" replace />} />
            <Route path="automations" element={<Automations />} />
            <Route path="heartbeats" element={<Heartbeats />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter> : <MissingSupabaseConfig />}
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
