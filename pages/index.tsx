import dynamic from "next/dynamic";

// Avoid SSR for the heavy component
const Chatbot = dynamic(() => import("../components/FipDiagnosticChatbot"), { ssr: false });

export default function Home() {
  return <Chatbot />;
}
