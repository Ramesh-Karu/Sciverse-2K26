import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, User, Minimize2, Maximize2 } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface RobotAssistantProps {
  schoolContext?: any;
}

export default function RobotAssistant({ schoolContext }: RobotAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Greetings! I am the SciVerse 2K26 AI Assistant. Ask me anything about registration, participant quotas, arrival slots, competition rules, or Jaffna Hindu College Science Union!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const promptText = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: promptText,
          schoolContext: schoolContext || 'General Inquiry'
        })
      });

      if (!response.ok) {
        throw new Error('Chat failed');
      }

      const data = await response.json();
      const aiMessage: Message = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: data.answer || "I apologize, but I could not compute that. Please verify your connection or ask in a different way.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: "System communication latency or offline status detected. Please retry or contact the Jaffna Hindu College Science Union organizers.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_32px_rgba(30,58,138,0.5)] cursor-pointer border border-blue-400/30"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 animate-pulse" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-[350px] sm:w-[400px] h-[500px] rounded-2xl bg-slate-950/95 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    SciVerse AI Agent <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-slate-400">JHC Science Union Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mt-1 self-start shrink-0">
                      <Bot className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                  <div 
                    className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md'
                    }`}
                  >
                    {msg.text}
                    <div className="text-[9px] text-slate-400 mt-1.5 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30 mt-1 self-start shrink-0">
                      <User className="w-3.5 h-3.5 text-indigo-300" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mt-1 self-start animate-pulse">
                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="bg-white/5 border border-white/10 text-slate-400 p-3 rounded-2xl rounded-tl-none text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-slate-950 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about schedule, quotas, rules..."
                className="flex-1 bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
