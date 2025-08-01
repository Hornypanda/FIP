import React, {
  useState,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  useEffect,
} from "react";
import {
  Upload,
  Send,
  FileText,
  Image,
  Heart,
  Stethoscope,
  AlertTriangle,
  Info,
} from "lucide-react";

/*───────────────────────────────────────────────────────────────
  helper – File → base-64 data-URL (for OpenAI vision)
───────────────────────────────────────────────────────────────*/
const readAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/*───────────────────────────────────────────────────────────────
  OpenAI call – replaces analyzeWithClaude
───────────────────────────────────────────────────────────────*/
async function analyzeWithOpenAI(
  userInput: string,
  files: File[] = []
): Promise<string> {
  const knowledgeBaseContext = `You are an evidence-based assistant specialised
in diagnosing and managing Feline Infectious Peritonitis (FIP).  Rely ONLY on
peer-reviewed sources such as ABCD guidelines and FIP Warriors® India x FSGI
Foundation protocols.  Be clear about uncertainty and never guess.`;

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
  return (
    data?.choices?.[0]?.message?.content ??
    "I’m sorry, I didn’t receive a response."
  );
}

/*───────────────────────────────────────────────────────────────
  React component – full Tailwind layout
───────────────────────────────────────────────────────────────*/
export default function FipDiagnosticChatbot() {
  /* state */
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([
    {
      role: "assistant",
      content:
        "👋 Hi! Upload bloodwork, X-rays, ultrasound images or describe symptoms and I’ll help assess FIP.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /* refs */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* auto-scroll chat */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* file picker */
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  };

  /* send */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() && uploadedFiles.length === 0) return;

    // optimistic UI
    setMessages((m) => [
      ...m,
      {
        role: "user",
        content:
          inputMessage ||
          `📎 Sent ${uploadedFiles.length} file${
            uploadedFiles.length > 1 ? "s" : ""
          } for analysis.`,
      },
    ]);
    setIsLoading(true);

    try {
      const reply = await analyzeWithOpenAI(inputMessage, uploadedFiles);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, I ran into a problem talking to OpenAI. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setInputMessage("");
      setUploadedFiles([]);
    }
  };

  /* allow ⌨️ Enter to send */
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /*───────────────────────────────────────────────────────────────
    UI
  ────────────────────────────────────────────────────────────────*/
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-10 md:px-10 lg:px-20 flex flex-col gap-16">
      {/* ——— HERO ——— */}
      <header className="max-w-5xl mx-auto text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
          FIP Diagnostic&nbsp;Assistant
        </h1>
        <p className="text-gray-700 md:text-lg">
          Upload lab results, imaging or describe symptoms. Powered by OpenAI +
          FIP Warriors® India x FSGI protocols.
        </p>
      </header>

      {/* ——— INFO CARDS ——— */}
      <section className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Labs */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 space-y-4">
          <FileText className="w-8 h-8 text-blue-600" />
          <h3 className="text-xl font-semibold">Lab Work</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            CBC, serum chemistry, A:G ratio, protein electrophoresis—upload PDFs
            or photos of results.
          </p>
        </div>
        {/* Imaging */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 space-y-4">
          <Image className="w-8 h-8 text-purple-600" />
          <h3 className="text-xl font-semibold">Imaging</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            X-rays, ultrasound, CT. Detect effusions, granulomas and ocular
            changes relevant to FIP.
          </p>
        </div>
        {/* Symptoms */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 space-y-4">
          <Heart className="w-8 h-8 text-pink-600" />
          <h3 className="text-xl font-semibold">Clinical Signs</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Fever, weight loss, neuro signs, ocular lesions—describe everything
            you observe.
          </p>
        </div>
      </section>

      {/* ——— DISCLAIMER ——— */}
      <section className="max-w-4xl mx-auto bg-amber-50 border-l-4 border-amber-400 p-5 rounded-xl flex gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-500 mt-1" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <strong>Disclaimer:</strong> This tool is for informational purposes
          only and does not replace a licensed veterinarian’s clinical
          judgement. Always consult your vet before starting treatment.
        </p>
      </section>

      {/* ——— CHAT PANEL ——— */}
      <section className="max-w-5xl mx-auto flex-1 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* message history */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 md:p-5 whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <p className="text-sm text-gray-500">🤖 Bot is typing…</p>
          )}
          {/* anchor for auto-scroll */}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className="border-t bg-white p-4 md:p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex gap-3">
            {/* Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* textarea */}
            <textarea
              rows={3}
              className="flex-1 p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
              placeholder="Describe symptoms, ask a question… (Shift+Enter for new line)"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
            />

            {/* Send */}
            <button
              onClick={handleSendMessage}
              disabled={
                isLoading || (!inputMessage.trim() && uploadedFiles.length === 0)
              }
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* show filenames preview */}
          {uploadedFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {uploadedFiles.map((f, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-200 px-2 py-1 rounded-md"
                >
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ——— FOOTNOTE ——— */}
      <footer className="max-w-5xl mx-auto text-center text-xs text-gray-500 flex items-center justify-center gap-1">
        <Info className="w-3 h-3" />
        Built for the FIP Warriors® community • Powered by OpenAI
      </footer>
    </div>
  );
}
