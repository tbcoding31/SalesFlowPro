import React, { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
};

// --- API MOCK ---
// TODO: Replace this function with a real API call later
const fetchAIResponse = async (userMessage: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerMsg = userMessage.toLowerCase();
      if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        resolve('Hello there! How can I assist you with SalesFlow Pro today?');
      } else if (lowerMsg.includes('help')) {
        resolve('I can help you navigate your tasks, find projects, or check your schedule. Just let me know what you need!');
      } else if (lowerMsg.includes('task')) {
        resolve('You can view your tasks in the Tasks section. Would you like me to guide you there?');
      } else {
        resolve("I'm an AI assistant. This is a simulated response. Once connected to a real API, I will provide more intelligent answers based on your data!");
      }
    }, 1500); // Simulate network delay
  });
};

export const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hi! I am your AI Assistant. How can I help you today?',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Call the API (currently mocked)
    const aiResponseText = await fetchAIResponse(newUserMsg.text);

    const newAiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: aiResponseText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newAiMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-['Inter',sans-serif]">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[360px] h-[520px] bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-[#4744e5] p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">AI Assistant</h3>
                <p className="text-[10px] text-indigo-100 font-medium">SalesFlow Pro Support</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className={`text-[9px] mt-1.5 block font-medium ${msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-sm max-h-32 outline-none resize-none py-1.5 px-2"
                rows={1}
                style={{ minHeight: '36px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="w-9 h-9 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-indigo-600 to-[#4744e5] text-white'
        }`}
      >
        <span className={`material-symbols-outlined text-2xl transition-transform duration-300 ${isOpen ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`}>
          smart_toy
        </span>
        <span className={`material-symbols-outlined text-2xl absolute transition-transform duration-300 ${isOpen ? 'rotate-0 scale-100' : '-rotate-90 scale-0'}`}>
          close
        </span>
      </button>
    </div>
  );
};
