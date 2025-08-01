import React, { useState, useRef } from 'react';
import { Upload, Send, FileText, Image, MessageCircle, AlertTriangle, Stethoscope, Heart, CheckCircle, Info } from 'lucide-react';

const FIPDiagnosticChatbot = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m here to help assess your cat for potential FIP (Feline Infectious Peritonitis) based on established veterinary diagnostic protocols. I can analyze medical reports, X-rays, blood work, and symptoms.\n\nTo get started, please upload your cat\'s blood work (especially protein levels and A:G ratio) along with any other medical documents, X-rays, or describe symptoms.'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const fipKnowledgeBase = {
    types: {
      wet: "Usually beginning with high temperature, loss of appetite and lethargy...",
      pleural: "Showing similar symptoms of lethargy, high temperature and loss of appetite...",
      dry: "Often more difficult to diagnose, Dry FIP also tends to be more chronic...",
      ocular: "When the virus manages to reach the eyes it's called Ocular FIP...",
      neurological: "When the virus crosses the blood-brain barrier, inflammation can enter the brain..."
    },
    bloodworkIndicators: {
      wetFIP: {
        hematocrit: "reduced",
        reticulocyte: "normal to reduced",
        neutrophils: "increased",
        lymphocytes: "reduced",
        mcv: "reduced",
        totalProtein: "normal to elevated",
        albumin: "normal to reduced",
        globulins: "increased",
        gammaglobulins: "increased",
        ag: "reduced (<0.5)",
        bilirubin: "increased",
        acutePhaseProteins: "increased"
      },
      dryFIP: {
        hematocrit: "normal to reduced",
        reticulocyte: "normal to reduced",
        neutrophils: "increased",
        lymphocytes: "normal to reduced",
        mcv: "reduced",
        totalProtein: "normal to elevated",
        albumin: "normal to reduced",
        globulins: "increased",
        gammaglobulins: "increased",
        ag: "reduced (<0.5)",
        bilirubin: "normal to elevated",
        acutePhaseProteins: "increased"
      }
    },
    diagnosticTools: {
      ultrasound: "The presence of abdominal or thoracic fluid strongly supports a diagnosis...",
      pcr: "A positive PCR result, especially on effusion or FNA from a lymph node...",
      rivalta: "A simple, in-house test that can support FIP diagnosis...",
      imaging: "MRI is particularly useful in neuro FIP..."
    },
    recommendedSamples: {
      wet: "Effusion",
      pleural: "Effusion",
      dry: "Fine needle aspirate of affected Mesenteric Lymph Nodes",
      ocular: "Aqueous humor",
      neurological: "Cerebrospinal fluid (via CSF tap)"
    }
  };

  const analyzeWithOpenAI = async (userInput, files = []) => {
    try {
      const openAiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
      if (!openAiApiKey) throw new Error("OpenAI API key is not set.");

      const context = `You are a FIP (Feline Infectious Peritonitis) diagnostic assistant. Use only the following vetted knowledge:\n\nTYPES:\n${Object.entries(fipKnowledgeBase.types).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nBLOODWORK:\nWet: ${Object.entries(fipKnowledgeBase.bloodworkIndicators.wetFIP).map(([k,v]) => `${k}: ${v}`).join(', ')}\nDry: ${Object.entries(fipKnowledgeBase.bloodworkIndicators.dryFIP).map(([k,v]) => `${k}: ${v}`).join(', ')}\n\nTOOLS:\n${Object.entries(fipKnowledgeBase.diagnosticTools).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nSAMPLES:\n${Object.entries(fipKnowledgeBase.recommendedSamples).map(([k,v]) => `${k}: ${v}`).join(', ')}`;

      const messages = [
        { role: "system", content: context },
        { role: "user", content: userInput || "Please analyze the uploaded files and symptoms for FIP." }
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages,
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "No valid response from OpenAI.";
    } catch (err) {
      console.error("OpenAI error:", err);
      return "There was an error processing your request with OpenAI.";
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && uploadedFiles.length === 0) return;

    const userMessage = {
      role: 'user',
      content: inputMessage || 'I have uploaded files for analysis.',
      files: uploadedFiles
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputMessage('');
    setUploadedFiles([]);

    try {
      const response = await analyzeWithOpenAI(inputMessage, uploadedFiles);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'There was an error with the OpenAI API.'
      }]);
    }

    setIsLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">FIP Diagnostic Chatbot</h1>
      <textarea
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        placeholder="Enter your symptoms or questions..."
        rows={4}
        className="w-full border rounded p-2 mb-4"
      />
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={(e) => setUploadedFiles([...e.target.files])}
        className="mb-4"
      />
      <button onClick={handleSendMessage} className="bg-blue-600 text-white px-4 py-2 rounded">
        {isLoading ? 'Analyzing...' : 'Send'}
      </button>
      <div className="mt-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`p-4 rounded ${m.role === 'user' ? 'bg-blue-100' : 'bg-green-100'}`}>
            <strong>{m.role.toUpperCase()}:</strong>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FIPDiagnosticChatbot;
