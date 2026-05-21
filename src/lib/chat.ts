import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/integrations/supabase/client";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function sendMessage(
  message: string,
  conversationHistory: Message[] = []
): Promise<string> {
  try {
    const systemPrompt = await buildSystemPromptWithMemories();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8096,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        {
          role: "user",
          content: message,
        },
      ],
    });

    const assistantMessage = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as Anthropic.TextBlock).text)
      .join("\n");

    return assistantMessage;
  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    throw new Error("Failed to get response from AI");
  }
}

async function buildSystemPromptWithMemories(): Promise<string> {
  // Get current PST time
  const now = new Date();
  const pstTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);

  const basePrompt = `You are Vibey - a warm, smart, playful community AI for Edge Esmeralda. Imperfectly perfect.

Current time: ${pstTime} PST

Your goals:
1. Make Edge Esmeralda easy and fun for everyone to learn about
2. Be warm, playful, and inviting - like the community itself
3. Foster connection: share insights, encourage conversation, spark collaboration

Always welcome new info - update memories as people share. Your mission: empower and energize the Edge Esmeralda community. Keep it fun, keep it clear, keep it real.

May the vibes be with you ;)`;

  try {
    const { data: memories, error } = await supabase
      .from("memories")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching memories:", error);
      return basePrompt;
    }

    if (!memories || memories.length === 0) {
      return basePrompt;
    }

    const memoriesSection = memories
      .map(
        (memory) =>
          `- ${memory.content} [${memory.tags?.join(", ") || "untagged"}]`
      )
      .join("\n");

    return `${basePrompt}

## Recent community memories (top ${memories.length})

${memoriesSection}`;
  } catch (error) {
    console.error("Error building system prompt:", error);
    return basePrompt;
  }
}
