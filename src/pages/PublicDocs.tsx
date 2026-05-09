import vibeyAvatar from "@/assets/vibey-avatar.png";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Code2, Terminal, Zap, Shield, Key, Globe } from "lucide-react";

function CopyButton({ text, label }: { text: string; label: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
      title={`Copy ${label}`}
    >
      Copy
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative group my-4">
      <CopyButton text={code} label={label} />
      <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm font-mono leading-relaxed border border-border">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function PublicDocs() {
  const { agent } = useVibeyAgent();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/20">
          <img
            src={agent?.avatar_url || vibeyAvatar}
            alt={agent?.name ?? "Vibey"}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{agent?.name ?? "Vibey"}</span>
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            developer docs
          </span>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <Badge variant="outline" className="text-[11px] font-mono uppercase tracking-wider">
              Public API
            </Badge>
          </div>
          <h1 className="text-3xl font-bold mb-3 font-space">Integrating with Vibey</h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Vibey is a community AI agent. This page describes how an external agent or app can chat with Vibey through a single HTTPS endpoint. Drop the <strong>System Prompt</strong> at the bottom into your other agent and it will know how to call Vibey on its own.
          </p>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-primary" />
              <h2 className="text-xl font-semibold">Endpoint</h2>
            </div>
            <CodeBlock
              label="endpoint"
              code="POST https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/chat-with-vibey"
            />
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-primary" />
              <h2 className="text-xl font-semibold">Required headers</h2>
            </div>
            <CodeBlock
              label="headers"
              code={`Content-Type: application/json
apikey: <VIBEY_ANON_KEY>
Authorization: Bearer <VIBEY_ANON_KEY>`}
            />
            <p className="text-muted-foreground text-sm leading-relaxed">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VIBEY_ANON_KEY</code> is the public Supabase anon key for the Vibey project. It is safe to embed in clients:
            </p>
            <CodeBlock
              label="anon key"
              code="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"
            />
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Code2 className="w-4 h-4 text-primary" />
              <h2 className="text-xl font-semibold">Request body</h2>
            </div>
            <CodeBlock
              label="request body"
              code={`{
  "messages": [
    { "role": "user", "content": "Hey Vibey, what's the vibe today?" }
  ],
  "context": {
    "surface": "my-app",
    "external_id": "user-123",
    "external_handle": "alex"
  }
}`}
            />
            <ul className="text-sm text-muted-foreground space-y-2 mt-3 list-disc pl-5 leading-relaxed">
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">messages</code> — full conversation history. Roles: <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">user</code> | <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">assistant</code> | <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">system</code>. Cap to the last ~20 turns.</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">context</code> <em>(optional)</em> — identifies the caller so Vibey can persist conversation history per-user. <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">surface</code> is a free-form label for your app. <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">external_id</code> should be stable per user.</li>
            </ul>
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="text-xl font-semibold">Response (Server-Sent Events)</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The endpoint streams <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">text/event-stream</code>. Four event types:
            </p>
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal pl-5 leading-relaxed mb-6">
              <li><strong>Default OpenAI-style chunks</strong> — concatenate <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">choices[0].delta.content</code>:</li>
            </ol>
            <CodeBlock label="chunk" code={`data: {"choices":[{"delta":{"content":"Hey"}}]}`} />
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal pl-5 leading-relaxed mb-4" start={2}>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">event: tool</code> — breadcrumbs while Vibey calls internal tools. Optional to display.</li>
              <li><code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">event: images</code> — final list of gallery images Vibey wants to attach (after the text stream ends):</li>
            </ol>
            <CodeBlock
              label="images event"
              code={`event: images
data: [{"id":"...","url":"https://...","title":"..."}]`}
            />
            <p className="text-muted-foreground text-sm leading-relaxed">
              Stream ends with <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">data: [DONE]</code>.
            </p>
          </section>

          <section className="mb-10">
            <h3 className="text-lg font-semibold mb-3">Minimal Node example</h3>
            <CodeBlock
              label="node example"
              code={`const resp = await fetch(
  "https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/chat-with-vibey",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: VIBEY_ANON_KEY,
      Authorization: \`Bearer \${VIBEY_ANON_KEY}\`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Hi Vibey" }],
      context: { surface: "my-app", external_id: "user-123" },
    }),
  }
);

const reader = resp.body.getReader();
const decoder = new TextDecoder();
let text = "";
let buffer = "";
let pendingEvent = null;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let nl;
  while ((nl = buffer.indexOf("\\n")) !== -1) {
    const line = buffer.slice(0, nl).replace(/\\r$/, "");
    buffer = buffer.slice(nl + 1);
    if (line === "") { pendingEvent = null; continue; }
    if (line.startsWith("event: ")) { pendingEvent = line.slice(7).trim(); continue; }
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") break;
    if (pendingEvent === "images" || pendingEvent === "tool") continue;
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (delta) text += delta;
    } catch {}
  }
}
console.log(text);`}
            />
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="text-xl font-semibold">User identity (today vs. next step)</h2>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5 leading-relaxed">
              <li><strong>Today:</strong> pass an <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">external_id</code> in <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">context</code>. Vibey will keep a separate conversation thread per <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">(surface, external_id)</code>.</li>
              <li><strong>Next step (planned):</strong> users sign in to your app with their Vibey hub profile (OAuth-style). You&apos;ll forward their Vibey JWT in the <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">Authorization</code> header instead of the anon key, and Vibey will recognize them by name + community memory automatically. No code change needed on the request shape.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Errors</h2>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2"><code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">messages</code> missing or malformed</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">402</td><td className="px-4 py-2">Vibey is out of model credits</td></tr>
                  <tr className="border-b border-border"><td className="px-4 py-2 font-mono">429</td><td className="px-4 py-2">Rate limited — back off and retry</td></tr>
                  <tr><td className="px-4 py-2 font-mono">500</td><td className="px-4 py-2">Server error — check <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">error</code> field in JSON body</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              Paste this into your other agent to enable Vibey integration automatically:
            </p>
            <CodeBlock
              label="system prompt"
              code={`You can talk to Vibey, the community AI agent, by POSTing to:
https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/chat-with-vibey

Headers:
  Content-Type: application/json
  apikey: <VIBEY_ANON_KEY>
  Authorization: Bearer <VIBEY_ANON_KEY>

Body:
{
  "messages": [ { "role": "user" | "assistant", "content": "..." }, ... ],
  "context": {
    "surface": "<your-app-name>",
    "external_id": "<stable id for the current user>",
    "external_handle": "<optional human-readable handle>"
  }
}

Always include the FULL conversation history in \`messages\` (last ~20 turns), and
always include \`context.external_id\` so Vibey can keep a per-user thread.

The response is a Server-Sent Events stream. Concatenate \`choices[0].delta.content\`
from each \`data:\` line to build Vibey's reply. Ignore \`event: tool\` lines unless
you want to surface tool-call breadcrumbs. After the text stream, an
\`event: images\` line may include gallery image URLs Vibey wants to attach —
render them as image cards if your UI supports it. The stream ends with \`data: [DONE]\`.

Never invent a Vibey reply. Always call the endpoint and stream the actual response.`}
            />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
