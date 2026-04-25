import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Three-state theme picker (Light / System / Dark) for the sidebar footer.
 * Matches the small inline pattern used in apps like Claude.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "system", icon: Monitor, label: "System (follow OS)" },
    { value: "dark", icon: Moon, label: "Dark" },
  ] as const;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-0.5",
        className
      )}
      role="group"
      aria-label="Theme"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = (theme ?? "system") === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-label={opt.label}
            aria-pressed={active}
            title={opt.label}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              active
                ? "bg-sidebar-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
