import React, {
  useState,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  useEffect,
} from "react";
import {
  Upload as UploadIcon,
  Send,
  Image,
  AlertTriangle,
  Info,
} from "lucide-react";

/* helper – File → base-64 data URL */
const readAsDataURL = (file: File) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

/* call our serverless endpoint */
async function askOpenAI(user: string, images: File[]) {
  const imgMsgs = await Promise.all(
    images.map(async (f) => ({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: await readAsDataURL(f) },
        },
      ],
    }))
  );

  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are an evidence-based assistant specialising in Feline Infectious Peritonitis (FIP). " +
            "If the user supplies images (bloodwork, X-rays, ultrasound photos) they are included *below* " +
            "as image_url messages—describe what you see and relate it to FIP diagnostics. " +
            "If no images are provided, work only from the text.",
        },
        { role: "user", content: user || "(See attached images)" },
        ...imgMsgs,
      ],
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
    }),
  }).then((r) => r.json());

  return resp?.choices?.[0]?.message?.content ?? "⚠️ No response from OpenAI.";
}

export default function FipDiagnosticChatbot() {
  /* state */
  const [msgs, setMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* autoscroll */
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [
    msgs,
    busy,
  ]);

  /* pick images (only JPG / PNG) */
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const valid = Array.from(e.target.files).filter((f) =>
      /^image\/(png|jpe?g)$/i.test(f.type)
    );
    if (valid.length < e.target.files.length) {
      alert("Only JPEG / PNG images are supported right now.");
    }
    setImages((prev) => [...prev, ...valid]);
  };

  /* send */
  const send = async () => {
    if (!input.trim() && images.length === 0) return;
    setMsgs((m) => [
      ...m,
      {
        role: "user",
        content:
          input ||
          `📎 Sent ${images.length} image${images.length > 1 ? "s" : ""}.`,
      },
    ]);
    setBusy(true);
    try {
      const reply = await askOpenAI(input, images);
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, I hit an internal error. Please try again in a minute.",
        },
      ]);
    } finally {
      setInput("");
      setImages([]);
      setBusy(false);
    }
  };

  /* Enter to send */
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 md:p-12 flex flex-col gap-10">
      <header className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
          FIP Diagnostic Assistant
        </h1>
        <p className="text-gray-700">
          Upload lab images or describe symptoms—powered by GPT-4o vision +
          FIP Warriors® India protocols
        </p>
      </header>

      <section className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* history */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-gray-500">🤖 Bot is typing…</p>}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className="border-t bg-white p-4 space-y-3">
          {/* selected file chips */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((f, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-200 px-2 py-1 rounded-md"
                >
                  {f.name}
                </span>
              ))}
            </div>
          )}

          {/* hidden picker */}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="hidden"
            onChange={onFiles}
          />

          <div className="flex gap-3">
            {/* single Upload button */}
            <label className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer">
              <UploadIcon className="w-4 h-4" />
              <span>Upload image(s)</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                multiple
                className="hidden"
                onChange={onFiles}
              />
            </label>

            {/* textarea */}
            <textarea
              rows={3}
              className="flex-1 p-3 border border-gray-300 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Describe symptoms, age, lab values…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
            />

            {/* send */}
            <button
              onClick={send}
              disabled={busy || (!input.trim() && images.length === 0)}
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <footer className="max-w-3xl mx-auto text-xs text-gray-500 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Built for the FIP Warriors® community • Powered by OpenAI
      </footer>
    </div>
  );
}
