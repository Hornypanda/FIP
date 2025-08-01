import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST  /api/chat
 * body: { messages: ChatCompletionMessageParam[] }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { messages } = req.body;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 👉 the key lives only on the server
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",          // or gpt-4o if you have access
        temperature: 0.2,
        max_tokens: 1500,
        messages,
      }),
    });

    const data = await openaiRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
}
