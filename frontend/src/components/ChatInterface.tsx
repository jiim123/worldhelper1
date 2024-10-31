import React, { useState, useRef, useEffect } from 'react';
import { CHATBASE_API_KEY, CHATBOT_ID } from '../config/index';
import Logo from '../logo.svg';
import emailjs from '@emailjs/browser';

interface Message {
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

// Security helper functions
const sanitizeInput = (input: string): string => {
  const sanitized = input.replace(/<[^>]*>/g, '');
  return sanitized.replace(/[^\w\s.,!?-]/g, '');
};


const isValidInput = (input: string): boolean => {
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /<script/i,
    /eval\(/i,
    /execute\(/i
  ];
  return !dangerousPatterns.some(pattern => pattern.test(input));
};

const MenuIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <line x1="4" y1="12" x2="20" y2="12"></line>
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="4" y1="18" x2="20" y2="18"></line>
  </svg>
);

export default function ChatInterface() {
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    });
  };

  // Initialize messages from localStorage or default
  const initialMessages = (): Message[] => {
    try {
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        return JSON.parse(savedMessages);
      }
    } catch (error) {
      console.warn('Error loading saved messages:', error);
    }
    return [{
      content: `Hi! 👋 I'm World Helper. How can I assist you today?`,
      role: 'assistant' as const,
      timestamp: formatTime()
    }];
  };

  // Initialize conversationId from localStorage or generate new
  const initialConversationId = () => {
    try {
      const savedId = localStorage.getItem('conversationId');
      if (savedId) return savedId;
    } catch (error) {
      console.warn('Error loading conversation ID:', error);
    }
    const newId = `conv_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('conversationId', newId);
    return newId;
  };
  
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState('main');
  const [inputMessage, setInputMessage] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState<string>(initialConversationId);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  type DrawerView = 'main' | 'about' | 'links' | 'privacy' | 'report';

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]); // Refocus after loading state changes

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      const messagesToStore = messages.slice(-100); // Keep last 100 messages
      localStorage.setItem('chatMessages', JSON.stringify(messagesToStore));
    } catch (error) {
      console.warn('Error saving messages:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        const reducedMessages = messages.slice(-50);
        localStorage.setItem('chatMessages', JSON.stringify(reducedMessages));
        setMessages(reducedMessages);
      }
    }
  }, [messages]);

  // Handle storage changes across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chatMessages' && e.newValue) {
        try {
          setMessages(JSON.parse(e.newValue));
        } catch (error) {
          console.warn('Error parsing storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save state when app goes to background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          localStorage.setItem('chatMessages', JSON.stringify(messages));
        } catch (error) {
          console.warn('Error saving state on hide:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages]);

  // Existing useEffects
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsDrawerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    setInputError(null);

    if (rawInput.length > 500) {
      setInputError('Message is too long (max 500 characters)');
      return;
    }

    if (!isValidInput(rawInput)) {
      setInputError('Invalid characters or patterns detected');
      return;
    }

    setInputMessage(sanitizeInput(rawInput));
  };

  const handleClearChat = () => {
    setShowConfirmation(true);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || inputError) return;
    if (inputMessage.length > 500) return;
    if (!isValidInput(inputMessage)) return;
  
    const sanitizedMessage = sanitizeInput(inputMessage.trim());
  
    const userMessage: Message = {
      content: sanitizedMessage,
      role: 'user' as const,
      timestamp: formatTime()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('https://www.chatbase.co/api/v1/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CHATBASE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.concat(userMessage),
          chatbotId: CHATBOT_ID,
          stream: true,
          conversationId,
          temperature: 0,
          model: 'claude-3-5-sonnet'
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let assistantResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantResponse += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.role === 'assistant') {
            lastMessage.content = assistantResponse;
            return [...newMessages];
          } else {
            const assistantMessage: Message = {
              content: assistantResponse,
              role: 'assistant' as const,
              timestamp: formatTime()
            };
            return [...newMessages, assistantMessage];
          }
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError('Sorry, something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportText.trim()) return;
    
    setIsSubmitting(true);
    setSubmitStatus('idle');
  
    try {
      emailjs.init("8gMFEyThhqn2rAmvc");
  
      const response = await emailjs.send(
        "service_hh73d1s",
        "template_trrzbqf",
        {
          to_email: 'jimandersson21@gmail.com',
          message: reportText,
          timestamp: new Date().toLocaleString(),
        }
      );
  
      console.log('EmailJS Response:', response);
      setSubmitStatus('success');
      setReportText('');
      setTimeout(() => {
        setCurrentView('main');
        setIsDrawerOpen(false);
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Submit Error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add this formatting component
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formatMessage = (text: string) => {
    // Split on code blocks
    const parts = text.split(/(```[\s\S]*?```)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
        if (!match) return part;
        
        const [, language = '', code] = match;
        return (
          <pre key={index} className="my-1 p-4 bg-stone-800 rounded-lg overflow-x-auto">
            {language && (
              <div className="text-xs text-stone-400 mb-1">{language}</div>
            )}
            <code className="text-stone-100 font-mono text-sm">{code.trim()}</code>
          </pre>
        );
      }
      

      // Format normal text with markdown-like syntax
      return (
        <div key={index} className="whitespace-pre-wrap">
          {part.split('\n').map((line, i) => {
            // Bold text
            line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Bullet points
            if (line.trim().startsWith('•')) {
              return (
                <div key={i} className="flex items-start space-x-2 my-1">
                  <span className="text-gray-400">•</span>
                  <span dangerouslySetInnerHTML={{ __html: line.slice(1) }} />
                </div>
              );
            }

            // Numbered lists
            const numberMatch = line.match(/^\d+\./);
            if (numberMatch) {
              return (
                <div key={i} className="flex items-start space-x-2 my-1">
                  <span className="text-gray-400 min-w-[20px]">{numberMatch[0]}</span>
                  <span dangerouslySetInnerHTML={{ 
                    __html: line.slice(numberMatch[0].length) 
                  }} />
                </div>
              );
            }

            return line ? (
              <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: line }} />
            ) : <br key={i} />;
          })}
        </div>
      );
    });
  };

  return <div className="message-content">{formatMessage(content)}</div>;
};

  // New clear chat function
  const clearChatHistory = () => {
    try {
      const initialMessage: Message[] = [{
        content: `Hi! 👋 I'm World Helper. How can I assist you today?`,
        role: 'assistant' as const,
        timestamp: formatTime()
      }];
      
      setMessages(initialMessage);
      localStorage.setItem('chatMessages', JSON.stringify(initialMessage));
      
      const newId = `conv_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('conversationId', newId);
      
      setIsDrawerOpen(false);
      setCurrentView('main');
    } catch (error) {
      console.warn('Error clearing chat history:', error);
      setError('Failed to clear chat history. Please try again.');
    }
  };

  const renderDrawerContent = (view: DrawerView) => {
    switch (view) {
      case 'about':
        return (
          <div className="p-4">
            <button 
              onClick={() => setCurrentView('main')}
              className="flex items-center mb-4 text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5 mr-2" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3 className="text-lg font-semibold mb-4">About World Helper</h3>
            <div className="space-y-3">
            <p>
              World Helper is an independent, community-driven project created to provide information and assistance.
            </p>
            
            <p>
              This application is not affiliated with, endorsed by, or officially connected to the World Foundation, Tools for Humanity, or any other organizations mentioned within the app. All product names, logos, brands, trademarks, and registered trademarks are the property of their respective owners.
            </p>
            
            <p>
              Any reference to third-party products, services, or organizations is for informational purposes only and does not constitute or imply endorsement, sponsorship, or recommendation. Information provided through this app is sourced from publicly available resources and is shared under fair use principles for educational and informational purposes only.
            </p>
            </div>
          </div>
        );
  
        case 'links':
          return (
            <div className="p-4">
              <button 
                onClick={() => setCurrentView('main')}
                className="flex items-center mb-4 text-gray-600 hover:text-gray-800"
              >
                <svg className="w-5 h-5 mr-2" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h3 className="text-lg font-semibold mb-4">Useful Links</h3>
              <div className="space-y-3">
                <a href="https://whitepaper.world.org/" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  World Whitepaper
                </a>
                <a href="https://worldscan.org/" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  Worldscan
                </a>
                <a href="https://docs.world.org/" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  World Developer Docs
                </a>
                <a href="https://world.org/find-orb" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  Find a Orb
                </a>
                
                <div className="flex justify-center space-x-6 mt-6">
                  <a href="https://world.org/x" className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  <a href="https://world.org/linkedin" className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <a href="https://world.org/discord" className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
                    </svg>
                  </a>
                  <a href="https://world.org/telegram" className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </a>
                  <a href="https://world.org/youtube" className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
  
      case 'privacy':
        return (
          <div className="p-4">
            <button 
              onClick={() => setCurrentView('main')}
              className="flex items-center mb-4 text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5 mr-2" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3 className="text-lg font-semibold mb-4">Privacy Policy</h3>
            <div className="space-y-3">
              <p>World Helper operate with complete anonymity - no personal data is collected, sold, or distributed, and no account information is stored or transmitted. Our conversations are solely used to improve World Helper's assistance capabilities.</p>

              <p>We encourage users to maintain their privacy by not sharing personal, sensitive, or confidential information during our interactions. The purpose of World Helper is purely informational and educational.</p>
              <p>Last updated: October 29, 2024</p>
            </div>
          </div>
        );
  
        case 'report':
          return (
            <div className="p-4">
              <button 
                onClick={() => setCurrentView('main')}
                className="flex items-center mb-4 text-gray-600 hover:text-gray-800"
              >
                <svg className="w-5 h-5 mr-2" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h3 className="text-lg font-semibold mb-4">Report Problems</h3>
              <div className="space-y-3">
                <textarea 
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full p-3 border rounded-lg resize-none h-32 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black"
                  placeholder="Describe the issue you're experiencing..."
                  disabled={isSubmitting}
                />
                {submitStatus === 'error' && (
                  <p className="text-red-500 text-sm">
                    Failed to send report. Please try again.
                  </p>
                )}
                {submitStatus === 'success' && (
                  <p className="text-green-500 text-sm">
                    Report sent successfully!
                  </p>
                )}
                <button 
                  onClick={handleReportSubmit}
                  disabled={!reportText.trim() || isSubmitting}
                  className={`
                    w-full px-4 py-3 rounded-lg transition-colors
                    ${isSubmitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-black hover:bg-gray-800'
                    }
                    text-white
                  `}
                >
                  {isSubmitting ? 'Sending...' : 'Submit Report'}
                </button>
              </div>
            </div>
          );
  
      default:
        return (
          <div className="space-y-4">
                      <div className="space-y-4">
            <button 
              onClick={() => setCurrentView('about')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
            >
              <span>About World Helper</span>
              <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button 
              onClick={() => setCurrentView('links')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
            >
              <span>Useful Links</span>
              <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button 
              onClick={() => setCurrentView('privacy')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
            >
              <span>Privacy Policy</span>
              <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button 
              onClick={() => setCurrentView('report')}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
            >
              <span>Report Problems</span>
              <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button 
              onClick={handleClearChat}
              className="w-full px-4 py-3 text-left bg-red-500 hover:bg-red-400 rounded-lg transition-colors flex items-center justify-between text-white"
            >
              <span>Clear Chat History</span>
              <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
            {showConfirmation && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 className="font-semibold text-lg mb-4">Clear Chat History?</h3>
        <p className="text-gray-600 mb-6">This will remove your current conversation. This action cannot be undone. Are you sure you want to clear this chat?</p>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              clearChatHistory();
              setShowConfirmation(false);
            }}
            className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Yes
          </button>
          <button
            onClick={() => setShowConfirmation(false)}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}   
            <button 
              onClick={() => {
                setIsDrawerOpen(false);
                setCurrentView('main');
              }}
              className="w-full px-4 py-3 text-center bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
          </div>
        );
    }
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 w-full bg-white border-b z-10">
        <div className="flex justify-between items-center px-3 py-3">
          <div className="logo-container">
            <img 
              src={Logo} 
              alt="World Helper" 
              className="logo-image h-8"
              draggable="false"
            />
          </div>
          
          {/* Menu Button */}
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* Custom Drawer */}
      {isDrawerOpen && (
  <>
    <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" />
    <div
      ref={drawerRef}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[20px] z-50 
                transform transition-transform duration-300 ease-out max-h-[90vh] overflow-y-auto"
      style={{
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
        animation: 'slideUp 300ms ease-out'
      }}
    >
      <div className="p-4">
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
        {renderDrawerContent(currentView as DrawerView)}
      </div>
    </div>
  </>
)}

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
          className="flex-1 overflow-y-auto pt-20 pb-32 px-4 space-y-6" // Increased pt-16 to pt-20 and space-y-4 to space-y-6
>
          {messages.map((message: Message, index: number) => (
            <div
              key={index}
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
            {/* Sender name and timestamp */}
            <div className={`
              flex items-center gap-2 mb-1 px-2
              ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}
            `}>
              <span className="text-xs font-medium text-gray-600">
                {message.role === 'user' ? 'You' : 'World Helper'}
              </span>
              <span className="text-xs text-gray-400">
                {message.timestamp}
              </span>
            </div>

{/* Message bubble */}
<div
  className={`
    max-w-[85%] rounded-2xl px-4 py-3 
    ${message.role === 'user' 
      ? 'bg-black text-white rounded-br-none ml-4' 
      : 'bg-white text-gray-800 rounded-bl-none mr-4 shadow-md'
    }
    relative
  `}
>
  <MessageContent content={message.content} />
</div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1 px-2">
              <span className="text-xs font-medium text-gray-600">
                World Helper
              </span>
              <span className="text-xs text-gray-400">
                {formatTime()}
              </span>
            </div>
            <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Container */}
<div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
  <form 
    onSubmit={sendMessage}
    className="flex flex-col gap-2 max-w-screen-md mx-auto"
  >
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
  autoFocus
        type="text"
        value={inputMessage}
        onChange={handleInputChange}
        placeholder="Type a message..."
        maxLength={500}
        className={`
          flex-1 p-3 border rounded-lg bg-gray-60 
          focus:outline-none focus:ring-2 focus:ring-black/5 
          focus:border-black text-[15px]
          ${inputError ? 'border-red-500' : ''}
        `}
        disabled={isLoading}
      />
<button
  type="submit"
  disabled={isLoading || !inputMessage.trim() || !!inputError}
  className="send-button"
>
  <span className="relative z-10">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="w-13 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12h14M12 5l7 7-7 7"
      />
    </svg>
  </span>
</button>
    </div>
    {inputError && (
      <span className="text-xs text-red-500 px-3">
        {inputError}
      </span>
    )}
    <span className="text-xs text-gray-400 px-3">
      World Helper may be wrong, please double check important information.
    </span>
  </form>
</div>
    </div>
  );
}