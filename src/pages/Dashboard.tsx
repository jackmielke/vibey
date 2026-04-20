import { useState } from "react";
import { Link } from "react-router-dom";
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
  ArrowUpRight,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import vibeyAvatar from "@/assets/vibey-avatar.png";

interface Section {
  key: string;
  title: string;
  description: string;
  url: string;
  icon: typeof Sparkles;
  preview: React.ReactNode;
}

const sections: Section[] = [
  {
    key: "soul",
    title: "Soul",
    description: "Core personality, values, and behavioral guidelines.",
    url: "/soul",
    icon: Sparkles,
    preview: (
      <p className="text-sm text-muted-foreground">
        System prompt that defines how Vibey thinks, speaks, and shows up for the community.
      </p>
    ),
  },
  {
    key: "identity",
    title: "Identity",
    description: "Name, avatar, and intro message.",
    url: "/identity",
    icon: User,
    preview: (
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-label">Name</p>
          <p className="mt-1">Vibey</p>
        </div>
        <div>
          <p className="text-label">Intro</p>
          <p className="mt-1">Hey! I'm Vibey 👋</p>
        </div>
      </div>
    ),
  },
  {
    key: "memory",
    title: "Memory",
    description: "Stored memories and knowledge.",
    url: "/memory",
    icon: Brain,
    preview: <p className="text-sm text-muted-foreground">No memories stored yet.</p>,
  },
  {
    key: "media",
    title: "Media Library",
    description: "Images, videos, and other assets.",
    url: "/media",
    icon: ImageIcon,
    preview: <p className="text-sm text-muted-foreground">No media uploaded yet.</p>,
  },
  {
    key: "interfaces",
    title: "Interfaces",
    description: "Communication channels and integrations.",
    url: "/interfaces",
    icon: Settings2,
    preview: (
      <ul className="text-sm space-y-1.5">
        <li className="flex justify-between"><span>Telegram Bot</span><span className="text-primary">On</span></li>
        <li className="flex justify-between"><span>Web Chat Widget</span><span className="text-muted-foreground">Off</span></li>
        <li className="flex justify-between"><span>Voice Agent</span><span className="text-muted-foreground">Off</span></li>
      </ul>
    ),
  },
  {
    key: "relationships",
    title: "Relationships",
    description: "Vibey's relationships with community members.",
    url: "/relationships",
    icon: Users,
    preview: <p className="text-sm text-muted-foreground">No relationships tracked yet.</p>,
  },
  {
    key: "conversations",
    title: "Conversations",
    description: "Conversation history with members.",
    url: "/conversations",
    icon: MessagesSquare,
    preview: <p className="text-sm text-muted-foreground">No conversations yet.</p>,
  },
  {
    key: "groups",
    title: "Group Chats",
    description: "Vibey's presence in group conversations.",
    url: "/groups",
    icon: UsersRound,
    preview: <p className="text-sm text-muted-foreground">No group chats configured yet.</p>,
  },
];

export default function Dashboard() {
  const [open, setOpen] = useState<string | null>("soul");

  return (
    <PageShell
      title="Vibey Control"
      description="Expand any panel to peek inside, or jump into the full editor."
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
          const isOpen = open === section.key;
          const Icon = section.icon;
          return (
            <div
              key={section.key}
              className={cn(
                "rounded-lg border bg-card transition-colors",
                isOpen ? "border-primary/40" : "border-border"
              )}
            >
              <button
                onClick={() => setOpen(isOpen ? null : section.key)}
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
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                      <div className="pt-3">{section.preview}</div>
                      <Link
                        to={section.url}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        Open {section.title}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
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
