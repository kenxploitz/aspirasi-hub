import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; }

const ClientAiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hai! Aku di sini kalau kamu mau curhat soal sekolah, pertemanan, atau apa aja. Ada yang mau kamu ceritain?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim(); setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("ai-client-chat", {
        body: { messages: newMessages, sessionId: sessionId.current },
      });

      if (error) throw error;
      const response = data?.response || "Maaf, ada gangguan teknis.";
      setMessages([...newMessages, { role: "assistant", content: response }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Maaf, ada gangguan teknis. Coba lagi nanti ya." }]);
    } finally { setIsLoading(false); }
  };

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)}
      className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-strong hover:bg-primary/90 transition-colors">
      <MessageCircle className="h-5 w-5" />
    </button>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96">
      <Card className="border border-border shadow-strong flex flex-col" style={{ height: "480px" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Curhat AI</p>
              <p className="text-[10px] text-muted-foreground">Ruang curhat rahasia siswa</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="px-3 py-2 bg-muted/50 border-b border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Ruang curhat ini didampingi AI dan bersifat rahasia. Untuk masalah mendesak, tetap hubungi guru BK di sekolah.
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bot className="h-3 w-3 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />Mengetik...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ceritakan perasaanmu..." className="h-8 text-xs" disabled={isLoading} />
            <Button size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSend} disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientAiChatWidget;
