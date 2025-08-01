import React, { useState, ChangeEvent, KeyboardEvent } from "react";

/**
 * FIP Diagnostic Chatbot component
 * – minimal UI for now: message list, textarea, file picker, send button.
 */
export default function FipDiagnosticChatbot() {
  /* ────────────────────────────────
     STATE
  ──────────────────────────────── */
  const [inputMessage, setInputMessage] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /* ────────────────────────────────
     1)  helper – File → data-URL
  ──────────────────────────────── */
  const readAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  /* ────────────────────────────────
     2)  OpenAI call
  ──────────────────────────────── */
  const analyzeWithOpenAI = async (userInput: string, files: File[] = []) => {
    /* 2-a) your domain prompt – extend / replace as you like */
    const knowledgeBaseContext = `You are a FIP (Feline Infectious Peritonitis)
specialist veterinary assistant. Use evidence-based guidelines only and be very
clear when you are uncertain.`;

    /* 2-b) map any images the user attached into vision messages */
    const visualMessages = await Promise.all(
      files
        .filter((f) => f.type.startsWith("image/"))
        .map(async (f) => ({
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: await readAsDataURL(f) },
            },
          ],
        }))
    );

    /* 2-c) hit our own serverless endpoint (pages/api/chat.ts) */
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: knowledgeBaseContext },
          {
            role: "user",
            content:
              userInput.trim() ||
              "Please analyse the uploaded files using the veterinary protocol.",
          },
          ...visualMessages,
        ],
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "No response 🤔";
  };

  /* ────────────────────────────────
     3)  send-button handler
  ──────────────────────────────── */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() && uploadedFiles.length === 0) return;

    // 3-a) show user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content:
          inputMessage ||
          (uploadedFiles.length
            ? "📎 Sent file(s) for analysis."
            : "(empty)"),
      },
    ]);
    setIsLoading(true);

    // 3-b) call OpenAI
    try {
      const reply = await analyzeWithOpenAI(inputMessage, uploadedFiles);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry 😔, I ran into a problem while talking to OpenAI. Please try again.",
        },
      ]);
    } finally {
      // 3-c) clear UI
      setIsLoading(false);
      setInputMessage("");
      setUploadedFiles([]);
    }
  };

  /* helper so Enter sends the message */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /* ────────────────────────────────
     RENDER
  ──────────────────────────────── */
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>FIP Diagnostic Chatbot</h2>

      {/* message list */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          height: 300,
          overflowY: "auto",
          marginBottom: 12,
        }}
      >
        {messages.map((m, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            <strong>{m.role === "user" ? "🧑‍⚕️ You:" : "🤖 Bot:"}</strong>{" "}
            {m.content}
          </p>
        ))}
        {isLoading && <p>🤖 Bot is typing…</p>}
      </div>

      {/* input area */}
      <textarea
        style={{ width: "100%", height: 70 }}
        value={inputMessage}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setInputMessage(e.target.value)
        }
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about FIP…"
      />

      {/* file picker */}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) =>
          setUploadedFiles(e.target.files ? Array.from(e.target.files) : [])
        }
        style={{ marginTop: 8 }}
      />

      {/* send button */}
      <button
        onClick={handleSendMessage}
        disabled={isLoading}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          cursor: "pointer",
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
