import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, Heart, Shield, Minimize2 } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; }

const QUICK_PROMPTS = [
  { icon: "😔", text: "Lagi sedih nih" },
  { icon: "😤", text: "Ada masalah sama teman" },
  { icon: "📚", text: "Stres sama tugas" },
  { icon: "🏫", text: "Masalah di sekolah" },
];

const ClientAiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hai! 👋 Aku di sini buat dengerin kamu. Cerita aja apa yang kamu rasain — semuanya rahasia dan aman kok. 😊" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: msg }];
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
      setMessages([...newMessages, { role: "assistant", content: "Maaf, ada gangguan teknis. Coba lagi nanti ya. 🙏" }]);
    } finally { setIsLoading(false); }
  };

  // Floating button
  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 z-50 group">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full blur-lg opacity-60 group-hover:opacity-100 transition-opacity animate-pulse" />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300">
          <MessageCircle className="h-7 w-7 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">AI</span>
        </div>
      </div>
      <div className="absolute bottom-full right-0 mb-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Curhat AI — Rahasia & Aman 🔒
      </div>
    </button>
  );

  // Minimized state
  if (isMinimized) return (
    <div className="fixed bottom-6 right-6 z-50">
      <button onClick={() => setIsMinimized(false)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full shadow-2xl hover:scale-105 transition-all">
        <Bot className="h-4 w-4" />
        <span className="text-sm font-medium">Curhat AI</span>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      </button>
    </div>
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] md:w-[420px] animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-0 shadow-2xl flex flex-col overflow-hidden rounded-2xl" style={{ height: "580px" }}>
        {/* Header */}
        <div className="relative bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Curhat AI</p>
                <p className="text-white/80 text-xs">Ruang curhat rahasia siswa</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setIsMinimized(true)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 py-2 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border-b border-border/50">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3 text-green-500" />
            <span>Rahasia</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Heart className="h-3 w-3 text-pink-500" />
            <span>Aman</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-purple-500" />
            <span>AI Pendengar</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background to-muted/30">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-tr-md"
                  : "bg-card border border-border/50 text-foreground rounded-tl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">Sedang berpikir...</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick prompts (only show at start) */}
          {messages.length === 1 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground text-center">Atau pilih topik:</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button key={i} onClick={() => handleSend(prompt.text)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-card hover:bg-muted/50 border border-border/50 rounded-xl text-xs text-left transition-all hover:scale-[1.02] hover:shadow-md">
                    <span className="text-lg">{prompt.icon}</span>
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            🔒 Ruang curhat ini didampingi AI dan bersifat rahasia. Untuk masalah mendesak, hubungi guru BK.
          </p>
        </div>

        {/* Input */}
        <div className="p-3 bg-card border-t border-border/50">
          <div className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ceritakan perasaanmu..." className="flex-1 h-11 text-sm rounded-xl border-2 focus:border-pink-400" disabled={isLoading} />
            <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()}
              className="h-11 w-11 p-0 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 shadow-lg">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientAiChatWidget;
