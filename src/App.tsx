import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";
import Login from "@/pages/Login";
import Chat from "@/pages/Chat";
import Dashboard from "@/pages/Dashboard";
import Soul from "@/pages/Soul";
import Identity from "@/pages/Identity";
import Memory from "@/pages/Memory";
import Media from "@/pages/Media";
import Interfaces from "@/pages/Interfaces";
import Tools from "@/pages/Tools";
import Relationships from "@/pages/Relationships";
import Conversations from "@/pages/Conversations";
import Groups from "@/pages/Groups";
import TelegramMini from "@/pages/TelegramMini";
import Automations from "@/pages/Automations";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/mini" element={<TelegramMini />} />
          <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Chat />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="soul" element={<Soul />} />
            <Route path="identity" element={<Identity />} />
            <Route path="memory" element={<Memory />} />
            <Route path="media" element={<Media />} />
            <Route path="interfaces" element={<Interfaces />} />
            <Route path="tools" element={<Tools />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="groups" element={<Groups />} />
            <Route path="automations" element={<Automations />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
