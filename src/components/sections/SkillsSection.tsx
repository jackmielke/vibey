import { useEffect, useState } from "react";
import { Zap, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Skill = {
  id: string;
  name: string;
  label: string;
  description: string;
  prompt: string;
  category: string;
  is_enabled: boolean;
};

const EMPTY: Omit<Skill, "id"> = {
  name: "",
  label: "",
  description: "",
  prompt: "",
  category: "general",
  is_enabled: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<Skill, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data, error } = await supabase
      .from("agent_skills")
      .select("*")
      .order("category")
      .order("label");
    if (error) {
      toast.error("Couldn't load skills", { description: error.message });
      return;
    }
    setSkills((data ?? []) as Skill[]);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, []);

  async function toggleEnabled(skill: Skill, next: boolean) {
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, is_enabled: next } : s))
    );
    const { error } = await supabase
      .from("agent_skills")
      .update({ is_enabled: next })
      .eq("id", skill.id);
    if (error) {
      toast.error("Couldn't update skill", { description: error.message });
      reload();
    } else {
      toast.success(`${skill.label} ${next ? "enabled" : "disabled"}`);
    }
  }

  function openEdit(skill: Skill) {
    setEditing(skill);
    setDraft({
      name: skill.name,
      label: skill.label,
      description: skill.description,
      prompt: skill.prompt,
      category: skill.category,
      is_enabled: skill.is_enabled,
    });
  }

  function openCreate() {
    setCreating(true);
    setDraft(EMPTY);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
    setDraft(EMPTY);
  }

  async function save() {
    const payload = {
      ...draft,
      label: draft.label.trim(),
      description: draft.description.trim(),
      prompt: draft.prompt.trim(),
      category: draft.category.trim() || "general",
      name: (draft.name.trim() || slugify(draft.label)).trim(),
    };
    if (!payload.label || !payload.prompt || !payload.name) {
      toast.error("Label, name, and prompt are required");
      return;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("agent_skills").update(payload).eq("id", editing.id)
      : await supabase.from("agent_skills").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(editing ? "Skill updated" : "Skill created");
    closeDialog();
    reload();
  }

  async function remove(skill: Skill) {
    if (!confirm(`Delete "${skill.label}"?`)) return;
    const { error } = await supabase.from("agent_skills").delete().eq("id", skill.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Skill deleted");
    reload();
  }

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = skills.filter((s) => s.is_enabled).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {enabledCount} of {skills.length} skills active
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> New skill
        </Button>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {cat}
          </div>
          <div className="space-y-2">
            {items.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{s.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_enabled}
                          onCheckedChange={(v) => toggleEnabled(s, v)}
                          aria-label={`Toggle ${s.label}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => remove(s)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {s.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={!!editing || creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit skill" : "New skill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="skill-label">Label</Label>
                <Input
                  id="skill-label"
                  value={draft.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      label: e.target.value,
                      name: editing ? d.name : slugify(e.target.value),
                    }))
                  }
                  placeholder="Explain Vibecoin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-name">Slug</Label>
                <Input
                  id="skill-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: slugify(e.target.value) }))
                  }
                  placeholder="explain_vibecoin"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-cat">Category</Label>
              <Input
                id="skill-cat"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="community"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-desc">Description (when to use)</Label>
              <Textarea
                id="skill-desc"
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                placeholder="Short blurb shown to Vibey so it knows when to invoke this."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-prompt">Prompt / playbook</Label>
              <Textarea
                id="skill-prompt"
                rows={8}
                value={draft.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                placeholder="The actual instructions Vibey follows when invoking this skill."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !draft.label.trim()}>
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
