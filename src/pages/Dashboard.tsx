import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  User,
  Brain,
  Image as ImageIcon,
  Settings2,
  Users,
  MessagesSquare,
  UsersRound,
  ChevronDown,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import vibeyAvatar from "@/assets/vibey-avatar.png";
import { SoulSection } from "@/components/sections/SoulSection";
import { IdentitySection } from "@/components/sections/IdentitySection";
import { MemorySection } from "@/components/sections/MemorySection";
import { MediaSection } from "@/components/sections/MediaSection";
import { InterfacesSection } from "@/components/sections/InterfacesSection";
import { RelationshipsSection } from "@/components/sections/RelationshipsSection";
import { ConversationsSection } from "@/components/sections/ConversationsSection";
import { GroupsSection } from "@/components/sections/GroupsSection";

interface Section {
  key: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  component: React.ComponentType;
}

const sections: Section[] = [
  { key: "soul", title: "Soul", description: "Core personality, values, and behavioral guidelines.", icon: Sparkles, component: SoulSection },
  { key: "identity", title: "Identity", description: "Name, avatar, and intro message.", icon: User, component: IdentitySection },
  { key: "memory", title: "Memory", description: "Stored memories and knowledge.", icon: Brain, component: MemorySection },
  { key: "media", title: "Media Library", description: "Images, videos, and other assets.", icon: ImageIcon, component: MediaSection },
  { key: "interfaces", title: "Interfaces", description: "Communication channels and integrations.", icon: Settings2, component: InterfacesSection },
  { key: "relationships", title: "Relationships", description: "Vibey's relationships with community members.", icon: Users, component: RelationshipsSection },
  { key: "conversations", title: "Conversations", description: "Conversation history with members.", icon: MessagesSquare, component: ConversationsSection },
  { key: "groups", title: "Group Chats", description: "Vibey's presence in group conversations.", icon: UsersRound, component: GroupsSection },
];

export default function Dashboard() {
  const [open, setOpen] = useState<Set<string>>(new Set(["soul"]));

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <PageShell
      title="Vibey Control"
      description="Toggle any panel to edit it inline — no page hopping required."
    >
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
        <div className="w-14 h-14 rounded-lg overflow-hidden ring-1 ring-primary/20 shrink-0">
          <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-label">Agent</p>
          <p className="text-lg font-semibold">Vibey</p>
          <p className="text-xs text-muted-foreground">Your community's AI brain</p>
        </div>
      </div>

      <div className="space-y-2">
        {sections.map((section) => {
          const isOpen = open.has(section.key);
          const Icon = section.icon;
          const Component = section.component;
          return (
            <div
              key={section.key}
              className={cn(
                "rounded-lg border bg-card transition-colors",
                isOpen ? "border-primary/40" : "border-border"
              )}
            >
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 pt-4 border-t border-border">
                      <Component />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
