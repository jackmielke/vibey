# Integrating with Vibey (Web Chat API)

Vibey is a community AI agent. This document describes how an external agent or app can chat with Vibey through a single HTTPS endpoint. Drop the **System Prompt** at the bottom into your other agent and it will know how to call Vibey on its own.

---

## Endpoint

```
POST https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/chat-with-vibey
```

**Required headers**

```
Content-Type: application/json
apikey: <VIBEY_ANON_KEY>
Authorization: Bearer <VIBEY_ANON_KEY>   # or a signed-in user's JWT (see "User identity")
```

`VIBEY_ANON_KEY` is the public Supabase anon key for the Vibey project. It is safe to embed in clients:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM
```

## Request body

```json
{
  "messages": [
    { "role": "user", "content": "Hey Vibey, what's the vibe today?" }
  ],
  "context": {
    "surface": "my-app",
    "external_id": "user-123",
    "external_handle": "alex"
  }
}
```

- `messages` — full conversation history. Roles: `user` | `assistant` | `system`. Cap to the last ~20 turns.
- `context` *(optional)* — identifies the caller so Vibey can persist conversation history per-user. `surface` is a free-form label for your app. `external_id` should be stable per user.

## Response (Server-Sent Events)

The endpoint streams `text/event-stream`. Three event types:

1. **Default OpenAI-style chunks** — concatenate `choices[0].delta.content`:
   ```
   data: {"choices":[{"delta":{"content":"Hey"}}]}
   ```
2. **`event: tool`** — breadcrumbs while Vibey calls internal tools. Optional to display.
3. **`event: images`** — final list of gallery images Vibey wants to attach (after the text stream ends):
   ```
   event: images
   data: [{"id":"...","url":"https://...","title":"..."}]
   ```
4. Stream ends with `data: [DONE]`.

### Minimal Node example

```ts
const resp = await fetch(
  "https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/chat-with-vibey",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: VIBEY_ANON_KEY,
      Authorization: `Bearer ${VIBEY_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Hi Vibey" }],
      context: { surface: "my-app", external_id: "user-123" },
    }),
  }
);

const reader = resp.body!.getReader();
const decoder = new TextDecoder();
let text = "";
let buffer = "";
let pendingEvent: string | null = null;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).replace(/\r$/, "");
    buffer = buffer.slice(nl + 1);
    if (line === "") { pendingEvent = null; continue; }
    if (line.startsWith("event: ")) { pendingEvent = line.slice(7).trim(); continue; }
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") break;
    if (pendingEvent === "images" || pendingEvent === "tool") continue; // handle if you want
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (delta) text += delta;
    } catch {}
  }
}
console.log(text);
```

## User identity (today vs. next step)

- **Today:** pass an `external_id` in `context`. Vibey will keep a separate conversation thread per `(surface, external_id)`.
- **Next step (planned):** users sign in to your app with their Vibey hub profile (OAuth-style). You'll forward their Vibey JWT in the `Authorization` header instead of the anon key, and Vibey will recognize them by name + community memory automatically. No code change needed on the request shape.

## Errors

| Status | Meaning |
|---|---|
| 400 | `messages` missing or malformed |
| 402 | Vibey is out of model credits |
| 429 | Rate limited — back off and retry |
| 500 | Server error — check `error` field in JSON body |

---

## System Prompt — paste this into your other agent

```text
You can talk to Vibey, the community AI agent, by POSTing to:
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

Always include the FULL conversation history in `messages` (last ~20 turns), and
always include `context.external_id` so Vibey can keep a per-user thread.

The response is a Server-Sent Events stream. Concatenate `choices[0].delta.content`
from each `data:` line to build Vibey's reply. Ignore `event: tool` lines unless
you want to surface tool-call breadcrumbs. After the text stream, an
`event: images` line may include gallery image URLs Vibey wants to attach —
render them as image cards if your UI supports it. The stream ends with `data: [DONE]`.

Never invent a Vibey reply. Always call the endpoint and stream the actual response.
```
