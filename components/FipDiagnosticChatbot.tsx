/* components/FipDiagnosticChatbot.tsx */
import React, {
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
} from "react";
import {
  Upload as UploadIcon,
  Send,
  Info,
  AlertTriangle,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

/* -------------------------------------------------------------
   1.  helper – File → base-64 data-URL  (for images & rendered PDFs)
---------------------------------------------------------------- */
const fileToDataURL = (f: File) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(f);
  });

/* -------------------------------------------------------------
   2.  helper – Extract TEXT from PDF
---------------------------------------------------------------- */
async function pdfToText(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt = await page.getTextContent();
    full +=
      txt.items
        .map((it: any) => ("str" in it ? it.str : ""))
        .join(" ")
        .trim() + "\n";
  }
  return full.trim();
}

/* -------------------------------------------------------------
   3.  helper – Render N pages of a PDF to PNG data-URLs
---------------------------------------------------------------- */
async function pdfToImages(
  file: File,
  maxPages = 3
): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const urls: string[] = [];

  const pages = Math.min(maxPages, pdf.numPages);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    urls.push(canvas.toDataURL("image/png"));
  }
  return urls;
}

/* tiny helper to wrap a data-URL in a File-like object */
const dataUrlToFile = (url: string, idx: number) =>
  new File([url], `page-${idx}.png`, { type: "image/png" });

/* -------------------------------------------------------------
   4.  Chat completions via our serverless /api/chat
---------------------------------------------------------------- */
async function askOpenAI(
  userMsg: string,
  allImages: File[],
  pdfTexts: string[]
): Promise<string> {
  const visionMsgs = await Promise.all(
    allImages.map(async (f) => ({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: await fileToDataURL(f) },
        },
      ],
    }))
  );

  const pdfTextBlock =
    pdfTexts.length > 0
      ? [
          {
            role: "user",
            content:
              "The user also provided the following extracted PDF text:\n\n" +
              pdfTexts.join("\n\n---\n\n"),
          },
        ]
      : [];

  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are an evidence-based assistant specialising in Feline Infectious Peritonitis (FIP). " +
            "Analyse any attached images (bloodwork screenshots, X-rays, ultrasound) and/or extracted PDF text. " +
            "Cite values, explain relevance to FIP, and clearly state uncertainty.",
        },
        { role: "user", content: userMsg || "(See attached files)" },
        ...visionMsgs,
        ...pdfTextBlock,
      ],
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.2,
    }),
  }).then((r) => r.json());

  return (
    resp?.choices?.[0]?.message?.content ??
    "⚠️ OpenAI didn’t return any text."
  );
}

/* -------------------------------------------------------------
   5.  React component
---------------------------------------------------------------- */
export default function FipDiagnosticChatbot() {
  /* state */
  const [history, setHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  /* refs */
  const pickerRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  /* handle selection */
  const handleChoose = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
  };

  /* send */
  const send = async () => {
    if (!input.trim() && files.length === 0) return;

    // optimistic UI
    setHistory((h) => [
      ...h,
      {
        role: "user",
        content:
          input ||
          `📎 Sent ${files.length} file${files.length > 1 ? "s" : ""}.`,
      },
    ]);
    setBusy(true);

    try {
      const imgFiles = files.filter((f) => f.type.startsWith("image/"));
      const pdfFiles = files.filter(
        (f) => f.type === "application/pdf"
      );

      /* extract text + images from PDFs */
      const pdfTexts = await Promise.all(pdfFiles.map(pdfToText));
      const pdfImgArrays = await Promise.all(
        pdfFiles.map(pdfToImages)
      );
      const pdfImgs = pdfImgArrays
        .flat()
        .map(dataUrlToFile); // wrap as File objects

      const allImages = [...imgFiles, ...pdfImgs];

      const reply = await askOpenAI(input, allImages, pdfTexts);
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong while talking to OpenAI. Try again later.",
        },
      ]);
    } finally {
      setInput("");
      setFiles([]);
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  /* -----------------------------------------------------------
     6.  UI – polished Tailwind design
  ----------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col gap-10 p-6 md:p-10">
      {/* hero */}
      <header className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text drop-shadow-sm">
          FIP Diagnostic Assistant
        </h1>
        <p className="text-gray-700 max-w-xl mx-auto">
          Upload lab PDFs / images or describe symptoms. Powered by GPT-4o
          vision &amp; FIP Warriors® India guidelines.
        </p>
      </header>

      {/* chat card */}
      <section className="flex-1 max-w-4xl mx-auto bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* message history */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-gradient-to-b from-white/50 to-white">
          {history.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 md:p-5 whitespace-pre-wrap leading-relaxed backdrop-blur ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                    : "bg-white/70 border border-gray-200 shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <p className="text-sm text-gray-500 animate-pulse">
              🤖 Bot is typing…
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className="border-t bg-white/90 backdrop-blur p-4 md:p-6 space-y-3">
          {/* selected file chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <span
                  key={f.name + f.size}
                  className="text-xs bg-gray-200 px-2 py-1 rounded-md"
                >
                  {f.name}
                </span>
              ))}
            </div>
          )}

          {/* hidden picker */}
          <input
            ref={pickerRef}
            type="file"
            accept=".pdf,image/png,image/jpeg"
            multiple
            className="hidden"
            onChange={handleChoose}
          />

          <div className="flex gap-3">
            {/* upload label */}
            <label className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition">
              <UploadIcon className="w-4 h-4" />
              Upload files
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                multiple
                className="hidden"
                onChange={handleChoose}
              />
            </label>

            {/* text box */}
            <textarea
              rows={3}
              className="flex-1 p-3 border border-gray-300 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Describe symptoms, age, lab values… (Shift+Enter = new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
            />

            {/* send button */}
            <button
              onClick={send}
              disabled={busy || (!input.trim() && files.length === 0)}
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl disabled:opacity-50 transition shadow-md hover:shadow-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* disclaimer */}
      <aside className="max-w-4xl mx-auto bg-amber-50 border-l-4 border-amber-400 p-4 md:p-5 rounded-xl flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Disclaimer:</strong> This tool is for informational purposes
          only and does not replace a licensed veterinarian’s clinical
          judgement. Always consult your vet before starting treatment.
        </p>
      </aside>

      {/* footer */}
      <footer className="max-w-4xl mx-auto text-xs text-gray-500 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Built for the FIP Warriors® community • Powered by OpenAI
      </footer>
    </div>
  );
}
