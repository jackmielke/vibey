import { useState } from "react";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const MODEL_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", group: "Anthropic" },
  { value: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1", group: "Anthropic" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", group: "Anthropic" },
  { value: "openai/gpt-5", label: "GPT-5", group: "OpenAI" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini", group: "OpenAI" },
  { value: "openai/gpt-4.1", label: "GPT-4.1", group: "OpenAI" },
  { value: "openai/gpt-4o", label: "GPT-4o", group: "OpenAI" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", group: "Google" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", group: "Google" },
];

const CUSTOM_VALUE = "__custom__";

export function ModelSection() {
  const { agent, save } = useVibeyAgent();
  const [customModel, setCustomModel] = useState("");

  const currentModel = agent?.model ?? "";
  const isKnown = MODEL_OPTIONS.some((m) => m.value === currentModel);
  const selectValue = !currentModel ? "" : isKnown ? currentModel : CUSTOM_VALUE;

  return (
    <div className="space-y-2">
      <label className="text-label">Model</label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === CUSTOM_VALUE) {
            setCustomModel(currentModel);
            return;
          }
          if (next && next !== currentModel) save({ model: next });
        }}
      >
        <SelectTrigger className="bg-card border-border font-mono text-sm">
          <SelectValue placeholder="Choose a model…" />
        </SelectTrigger>
        <SelectContent>
          {["Anthropic", "OpenAI", "Google"].map((group) => (
            <div key={group}>
              <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                {group}
              </div>
              {MODEL_OPTIONS.filter((m) => m.group === group).map((m) => (
                <SelectItem key={m.value} value={m.value} className="font-mono text-sm">
                  {m.label}
                </SelectItem>
              ))}
            </div>
          ))}
          <SelectItem value={CUSTOM_VALUE} className="font-mono text-sm">
            Custom…
          </SelectItem>
        </SelectContent>
      </Select>

      {selectValue === CUSTOM_VALUE && (
        <Input
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          onBlur={() => {
            const next = customModel.trim();
            if (next && next !== currentModel) save({ model: next });
          }}
          placeholder="provider/model-slug"
          className="bg-card border-border font-mono text-sm"
        />
      )}

      <p className="text-xs text-muted-foreground font-mono">
        Current: <span className="text-foreground">{currentModel || "—"}</span>
      </p>
    </div>
  );
}
