import { useState, useRef, useEffect, createRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Bot, User, MinusCircle, Headphones } from 'lucide-react';
import { ChatFormatToolbar } from '@/components/chat/ChatFormatToolbar';
import { FormattedMessage } from '@/components/chat/FormattedMessage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'support' | 'bot';
  timestamp: string;
  isAdmin?: boolean;
}

export const LiveChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnectedToSupport, setIsConnectedToSupport] = useState(false);
  const [hasUnreadAdminMessage, setHasUnreadAdminMessage] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const { toast } = useToast();
  const { user } = useAuth();
  
  const welcomeMessage: Message = {
    id: 1,
    text: "👋 Welcome! I'm your AI trading assistant. I can help with basic questions, or connect you to live support for advanced help.",
    sender: 'bot',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for external open requests (e.g., from Dashboard support button)
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      setHasUnreadAdminMessage(false);
    };
    window.addEventListener('open-live-chat', handleOpenChat);
    return () => window.removeEventListener('open-live-chat', handleOpenChat);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all existing messages and set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const fetchAllMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        // Use the most recent session_id
        const lastSessionId = data[data.length - 1].session_id;
        setSessionId(lastSessionId);

        const dbMessages: Message[] = data.map((msg) => ({
          id: Date.now() + Math.random(),
          text: msg.message,
          sender: msg.sender_type === 'admin' ? 'support' as const : msg.sender_type === 'bot' ? 'bot' as const : 'user' as const,
          timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAdmin: msg.sender_type === 'admin'
        }));

        const hasAdmin = data.some(m => m.sender_type === 'admin');
        if (hasAdmin) {
          setIsConnectedToSupport(true);
        }
        if (data.length > 0) {
          setHasReceivedAutoReply(true);
        }

        // Replace default messages with DB messages
        setMessages([welcomeMessage, ...dbMessages]);
        
        // Check for unread admin messages
        const lastMsg = data[data.length - 1];
        if (lastMsg.sender_type === 'admin') {
          setHasUnreadAdminMessage(true);
        }
      }
    };

    fetchAllMessages();

    // Real-time subscription for new admin messages
    const channel = supabase
      .channel('chat_messages_user')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.sender_type === 'admin') {
            const adminMessage: Message = {
              id: Date.now(),
              text: payload.new.message,
              sender: 'support',
              timestamp: new Date(payload.new.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isAdmin: true
            };

            setMessages(prev => [...prev, adminMessage]);
            setIsConnectedToSupport(true);
            
            if (!isOpen) {
              setHasUnreadAdminMessage(true);
            }

            toast({
              title: "New message from Support",
              description: "You have a new message from our team",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, isOpen]);

  const [hasReceivedAutoReply, setHasReceivedAutoReply] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: message,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');

    // Persist message to database if user is logged in
    if (user) {
      await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          message: currentMessage,
          sender_type: 'user'
        });
    }

    if (isConnectedToSupport) {
      // When connected to support, just add the message and wait for manual reply
      toast({
        title: "Message sent to support",
        description: "Our team will respond shortly",
      });
      return;
    }

    // First message from user - send auto-reply and connect to support
    if (!hasReceivedAutoReply) {
      setIsTyping(true);
      setHasReceivedAutoReply(true);

      setTimeout(() => {
        const autoReplyMessage: Message = {
          id: Date.now() + 1,
          text: `Hello,

Thank you for reaching out to us. Your message has been successfully received.

Our support team is currently reviewing your request and will get back to you as soon as possible. We appreciate your patience and look forward to assisting you.

Best regards,
Edge Trade Win Support Team`,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, autoReplyMessage]);
        setIsTyping(false);
        setIsConnectedToSupport(true);
        
        toast({
          title: "Message received",
          description: "Our support team will respond shortly",
        });
      }, 1500);
      return;
    }
  };

  const connectToSupport = () => {
    setIsConnectedToSupport(true);
    const supportMessage: Message = {
      id: Date.now(),
      text: "🔗 Connecting you to live support... You'll be connected to a human agent shortly.",
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, supportMessage]);
    
    setTimeout(() => {
      const welcomeMessage: Message = {
        id: Date.now() + 1,
        text: "Hello! This is Sarah from EdgeTrade Pro support. I'm here to help you with any trading questions. What can I assist you with today?",
        sender: 'support',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: true
      };
      setMessages(prev => [...prev, welcomeMessage]);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (action: string) => {
    if (action.includes('Connect to live support')) {
      connectToSupport();
    } else {
      setMessage(action);
      setTimeout(() => handleSendMessage(), 100);
    }
  };

  const quickActions = [
    "📊 Current market status",
    "💡 Trading tips", 
    "🔍 Technical analysis",
    "💰 Portfolio review",
    "🔗 Connect to live support"
  ];

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => {
            setIsOpen(true);
            setHasUnreadAdminMessage(false);
          }}
          className={`rounded-full w-14 h-14 bg-gradient-primary shadow-lg hover:shadow-xl transition-all duration-300 ${
            hasUnreadAdminMessage ? 'ring-4 ring-red-400 ring-opacity-75 animate-pulse' : ''
          }`}
          size="lg"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
        {hasUnreadAdminMessage && (
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
        )}
        <Badge className={`absolute -top-2 -left-2 text-white ${
          hasUnreadAdminMessage 
            ? 'bg-red-500 animate-bounce shadow-lg shadow-red-500/50' 
            : isConnectedToSupport 
              ? 'bg-green-500' 
              : 'bg-primary'
        }`}>
          {hasUnreadAdminMessage ? '1 New' : isConnectedToSupport ? 'Live' : 'Chat'}
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed bottom-2 right-2 sm:bottom-6 sm:right-6 z-50">
      <Card className={`w-[calc(100vw-1rem)] sm:w-96 shadow-2xl border-2 border-primary/20 transition-all duration-300 ${
        isMinimized ? 'h-16' : 'h-[calc(100vh-5rem)] sm:h-[500px]'
      }`}>
        <CardHeader className="p-4 bg-gradient-primary text-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-background/20 rounded-full flex items-center justify-center">
                {isConnectedToSupport ? <Headphones className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div>
                <CardTitle className="text-sm">
                  {isConnectedToSupport ? 'Live Support Chat' : 'AI Trading Assistant'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isConnectedToSupport ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                  <span className="text-xs opacity-90">
                    {isConnectedToSupport ? 'Connected to Sarah' : 'AI Online'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-background hover:bg-background/20 h-8 w-8 p-0"
              >
                <MinusCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-background hover:bg-background/20 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[calc(100%-4rem)] sm:h-[432px]">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] flex gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                        msg.sender === 'user' 
                          ? 'bg-primary' 
                          : msg.sender === 'support'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                      }`}>
                        {msg.sender === 'user' ? (
                          <User className="h-3 w-3 text-white" />
                        ) : msg.sender === 'support' ? (
                          <Headphones className="h-3 w-3 text-white" />
                        ) : (
                          <Bot className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className={`px-3 py-2 rounded-lg text-sm ${
                          msg.sender === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-black border border-gray-700 text-white'
                        }`}>
                          <FormattedMessage text={msg.text} />
                        </div>
                        <p className="text-xs text-muted-foreground px-1">
                          {msg.timestamp}
                          {msg.isAdmin && <span className="ml-1 text-green-600">• Support</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex gap-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <div className="bg-muted px-3 py-2 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {!isConnectedToSupport && messages.length <= 1 && (
              <div className="p-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
                <div className="flex flex-wrap gap-1">
                  {quickActions.map((action) => (
                    <Button
                      key={action}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleQuickAction(action)}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-border space-y-1">
              <ChatFormatToolbar
                textareaRef={chatTextareaRef}
                value={message}
                onChange={setMessage}
              />
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={chatTextareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isConnectedToSupport ? "Message support..." : "Ask about trading, crypto, etc..."}
                  onKeyDown={handleKeyPress}
                  className="flex-1 min-h-[40px] max-h-[100px] resize-none text-sm"
                  rows={1}
                />
                <Button onClick={handleSendMessage} size="sm" disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};