/* ----------------------------------------------------------------
   1)  ADD the helper that turns a File into a data-URL
-----------------------------------------------------------------*/
const readAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/* ----------------------------------------------------------------
   2)  REPLACE the old   analyzeWithClaude   with:
-----------------------------------------------------------------*/
const analyzeWithOpenAI = async (userInput: string, files = []) => {
  // ---- 2-a) knowledge-base prompt you already build --------------
  const knowledgeBaseContext = `You are a FIP (Feline Infectious …`; // ← keep your existing code here

  /* ---- 2-b) turn any uploaded images into OpenAI "vision" chunks */
  const visualMessages = await Promise.all(
    files
      .filter((f) => f.type.startsWith("image/"))
      .map(async (f) => ({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: await readAsDataURL(f.file) },
          },
        ],
      }))
  );

  /* ---- 2-c) call our own serverless endpoint --------------------*/
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

/* ----------------------------------------------------------------
   3)  UPDATE the handler so it uses the new function
-----------------------------------------------------------------*/
const handleSendMessage = async () => {
  if (!inputMessage.trim() && uploadedFiles.length === 0) return;

  const userMessage = {
    role: "user",
    content: inputMessage || "I have uploaded files for analysis.",
    files: uploadedFiles,
  };
  setMessages((prev) => [...prev, userMessage]);
  setIsLoading(true);
  setInputMessage("");
  setUploadedFiles([]);

  try {
    /* 🔄  was  analyzeWithClaude  */
    const reply = await analyzeWithOpenAI(inputMessage, uploadedFiles);
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
  } catch (err) {
    console.error(err);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Sorry, I ran into a problem while talking to OpenAI. Please try again.",
      },
    ]);
  } finally {
    setIsLoading(false);
  }
};
