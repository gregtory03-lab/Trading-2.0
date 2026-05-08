import { useState, useEffect, useRef, useCallback, createRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { MessageCircle, Send, Bot, Headphones, User, ArrowLeft, Plus, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react';
import { useUnreadSupportMessages } from '@/hooks/useUnreadSupportMessages';
import { ChatFormatToolbar } from '@/components/chat/ChatFormatToolbar';
import { FormattedMessage } from '@/components/chat/FormattedMessage';

interface ChatMessage {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  session_id: string;
}

interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  hasAdminMessages: boolean;
}

export default function SupportInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play: playNotification } = useNotificationSound();
  const { showNotification } = useBrowserNotifications();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [longPressedMessageId, setLongPressedMessageId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newConvTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { markAsRead } = useUnreadSupportMessages();

  // Mark as read when inbox is first opened
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // Mark as read when selecting a session (e.g. on mobile)
  useEffect(() => {
    if (selectedSessionId) {
      markAsRead();
    }
  }, [selectedSessionId, markAsRead]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedSessionId, sessions]);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }

    if (data) {
      // Group messages by session
      const sessionMap: { [sessionId: string]: ChatMessage[] } = {};
      
      for (const msg of data) {
        if (!sessionMap[msg.session_id]) {
          sessionMap[msg.session_id] = [];
        }
        sessionMap[msg.session_id].push(msg);
      }

      // Convert to ChatSession array
      const sessionList: ChatSession[] = Object.entries(sessionMap).map(([sessionId, messages]) => {
        const lastMsg = messages[messages.length - 1];
        const hasAdminMessages = messages.some(m => m.sender_type === 'admin');
        
        return {
          session_id: sessionId,
          messages,
          lastMessage: lastMsg.message,
          lastMessageTime: lastMsg.created_at,
          hasAdminMessages
        };
      });

      // Sort by last message time (most recent first)
      sessionList.sort((a, b) => 
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setSessions(sessionList);
      
      // Auto-select first session if none selected
      if (!selectedSessionId && sessionList.length > 0) {
        setSelectedSessionId(sessionList[0].session_id);
      }
    }
    setLoading(false);
  };

  const handleRefresh = useCallback(async () => {
    await fetchMessages();
  }, [user]);

  const { pulling, refreshing, pullDistance, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    if (user) {
      fetchMessages();

      // Real-time subscription
      const channel = supabase
        .channel('user_support_inbox')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            
            setSessions(prev => {
              const existingSession = prev.find(s => s.session_id === newMsg.session_id);
              
              if (existingSession) {
                return prev.map(s => {
                  if (s.session_id === newMsg.session_id) {
                    return {
                      ...s,
                      messages: [...s.messages, newMsg],
                      lastMessage: newMsg.message,
                      lastMessageTime: newMsg.created_at,
                      hasAdminMessages: s.hasAdminMessages || newMsg.sender_type === 'admin'
                    };
                  }
                  return s;
                }).sort((a, b) => 
                  new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
                );
              } else {
                // New session
                return [{
                  session_id: newMsg.session_id,
                  messages: [newMsg],
                  lastMessage: newMsg.message,
                  lastMessageTime: newMsg.created_at,
                  hasAdminMessages: newMsg.sender_type === 'admin'
                }, ...prev];
              }
            });

            if (newMsg.sender_type === 'admin') {
              // User is actively viewing inbox, so mark as read immediately
              markAsRead();
              playNotification();
              toast({
                title: "New message from Support",
                description: "You have a new reply from our team",
              });
              // Show browser notification if tab is not focused
              showNotification(
                "New message from Support",
                newMsg.message.substring(0, 100),
                () => {
                  setSelectedSessionId(newMsg.session_id);
                }
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, toast, playNotification]);

  const AUTO_REPLY = "Thank you for your message. Our support team has received it and will get back to you as soon as possible.";

  const sendAutoReply = async (sessionId: string) => {
    if (!user) return;
    // Only send the auto-reply once per session
    const { data: existing } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('session_id', sessionId)
      .eq('sender_type', 'admin')
      .eq('message', AUTO_REPLY)
      .limit(1);

    if (existing && existing.length > 0) return;

    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: sessionId,
      message: AUTO_REPLY,
      sender_type: 'admin',
    });
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || !selectedSessionId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          session_id: selectedSessionId,
          message: newMessage.trim(),
          sender_type: 'user'
        });

      if (error) throw error;

      setNewMessage('');
      markAsRead();
      await sendAutoReply(selectedSessionId);
      toast({
        title: "Message sent",
        description: "Your message has been sent to support",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async () => {
    if (!user || !newMessage.trim()) return;

    setSending(true);
    try {
      const newSessionId = crypto.randomUUID();
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          session_id: newSessionId,
          message: newMessage.trim(),
          sender_type: 'user'
        });

      if (error) throw error;

      setNewMessage('');
      setSelectedSessionId(newSessionId);
      await sendAutoReply(newSessionId);
      toast({
        title: "Conversation started",
        description: "Your message has been sent to support",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string, sessionId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions(prev => {
        return prev.map(s => {
          if (s.session_id !== sessionId) return s;
          const updatedMessages = s.messages.filter(m => m.id !== messageId);
          if (updatedMessages.length === 0) return null as any;
          const lastMsg = updatedMessages[updatedMessages.length - 1];
          return {
            ...s,
            messages: updatedMessages,
            lastMessage: lastMsg.message,
            lastMessageTime: lastMsg.created_at,
            hasAdminMessages: updatedMessages.some(m => m.sender_type === 'admin'),
          };
        }).filter(Boolean);
      });

      toast({ title: "Message deleted" });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    }
  };

  const isEditable = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < 3 * 60 * 1000; // 3 minutes
  };

  const startEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditText(msg.message);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const saveEdit = async (messageId: string, sessionId: string) => {
    if (!user || !editText.trim()) return;
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ message: editText.trim() })
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions(prev => prev.map(s => {
        if (s.session_id !== sessionId) return s;
        const updatedMessages = s.messages.map(m =>
          m.id === messageId ? { ...m, message: editText.trim() } : m
        );
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        return { ...s, messages: updatedMessages, lastMessage: lastMsg.message };
      }));

      setEditingMessageId(null);
      setEditText('');
      toast({ title: "Message updated" });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);

  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedMessageId(prev => prev === msgId ? null : msgId);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <CryptoDashboardLayout>
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="animate-pulse">Loading your conversations...</div>
            </CardContent>
          </Card>
        </div>
      </CryptoDashboardLayout>
    );
  }

  const showChatOnMobile = selectedSessionId !== null || showNewConversation;

  return (
    <CryptoDashboardLayout>
      <div className="p-0 sm:p-4 md:p-6 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 sm:gap-4 flex-1 min-h-0">
          {/* Conversations List - hidden on mobile when a chat is selected */}
          <Card className={`md:col-span-1 flex flex-col overflow-hidden border-0 sm:border rounded-none sm:rounded-lg ${showChatOnMobile ? 'hidden md:flex' : 'flex'}`}>
             <CardHeader className="pb-2 p-3 sm:p-4">
              {/* Pull to refresh indicator */}
              {(pulling || refreshing) && (
                <div
                  className="flex items-center justify-center transition-all md:hidden"
                  style={{ height: pulling ? pullDistance * 0.5 : refreshing ? 32 : 0 }}
                >
                  <RefreshCw className={`h-5 w-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  Support Inbox
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => {
                  setSelectedSessionId(null);
                  setShowNewConversation(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
             </CardHeader>
            <CardContent
              className="flex-1 p-2 overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <ScrollArea className="h-full">
                {sessions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 px-4">
                    <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2 text-sm">No conversations yet</p>
                    <p className="text-xs sm:text-sm">Start a new conversation below</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.session_id}
                        onClick={() => { setSelectedSessionId(session.session_id); setShowNewConversation(false); }}
                        className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedSessionId === session.session_id
                            ? 'bg-primary/10 border border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {session.hasAdminMessages ? (
                              <Headphones className="h-4 w-4 text-green-500" />
                            ) : (
                              <Bot className="h-4 w-4 text-blue-500" />
                            )}
                            <span className="font-medium text-xs sm:text-sm">
                              {session.hasAdminMessages ? 'Live Support' : 'Pending'}
                            </span>
                          </div>
                          <Badge variant={session.hasAdminMessages ? "default" : "secondary"} className="text-xs">
                            {session.messages.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.lastMessage}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(session.lastMessageTime)} • {formatTime(session.lastMessageTime)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat View - hidden on mobile when no chat is selected */}
          <Card className={`md:col-span-2 flex flex-col overflow-hidden border-0 sm:border rounded-none sm:rounded-lg ${showChatOnMobile ? 'flex' : 'hidden md:flex'}`}>
            <CardHeader className="pb-2 border-b p-3 sm:p-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                {/* Back button for mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-1 h-8 w-8"
                  onClick={() => { setSelectedSessionId(null); setShowNewConversation(false); }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedSession ? (
                  <>
                    {selectedSession.hasAdminMessages ? (
                      <Headphones className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                    ) : (
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                    )}
                    <span className="text-sm sm:text-base">
                      {selectedSession.hasAdminMessages ? 'Chat with Support' : 'Awaiting Support'}
                    </span>
                    {selectedSession.hasAdminMessages && (
                      <Badge variant="outline" className="ml-1 sm:ml-2 text-green-600 border-green-300 text-xs">
                        Connected
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base">Start a Conversation</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-2 sm:p-4 flex flex-col overflow-hidden">
              {selectedSession ? (
                <>
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 pr-2 sm:pr-4 mb-2 sm:mb-4" onClick={() => setLongPressedMessageId(null)}>
                    <div className="space-y-3">
                      {selectedSession.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex group ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                          onTouchStart={() => msg.sender_type === 'user' ? handleTouchStart(msg.id) : undefined}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                        >
                          <div className={`max-w-[90%] sm:max-w-[85%] flex gap-1.5 sm:gap-2 ${msg.sender_type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              msg.sender_type === 'user' 
                                ? 'bg-primary' 
                                : msg.sender_type === 'admin'
                                ? 'bg-green-500'
                                : 'bg-blue-500'
                            }`}>
                              {msg.sender_type === 'user' ? (
                                <User className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              ) : msg.sender_type === 'admin' ? (
                                <Headphones className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              ) : (
                                <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              {editingMessageId === msg.id ? (
                                <div className="flex items-start gap-1">
                                  <Textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="text-xs min-h-[32px] max-h-[100px] resize-none"
                                    rows={2}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id, msg.session_id); }
                                    }}
                                    autoFocus
                                  />
                                  <button onClick={() => saveEdit(msg.id, msg.session_id)} className="text-green-500 hover:text-green-400"><Check className="h-3.5 w-3.5" /></button>
                                  <button onClick={cancelEditing} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                                </div>
                              ) : (
                                <div className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm ${
                                  msg.sender_type === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : msg.sender_type === 'admin'
                                    ? 'bg-black border border-gray-700 text-white'
                                    : 'bg-muted text-foreground'
                                }`}>
                                  <FormattedMessage text={msg.message} />
                                </div>
                              )}
                              <div className="flex items-center gap-1 px-1">
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {formatTime(msg.created_at)}
                                  {msg.sender_type === 'admin' && (
                                    <span className="ml-1 text-green-600">• Support</span>
                                  )}
                                </p>
                                {msg.sender_type === 'user' && (
                                  <span className={`inline-flex items-center gap-1 transition-opacity ${longPressedMessageId === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isEditable(msg.created_at) && (
                                      <button
                                        onClick={() => startEditing(msg)}
                                        className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                                        title="Edit message"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteMessage(msg.id, msg.session_id)}
                                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                                      title="Delete message"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Reply Input */}
                  <div className="pt-2 sm:pt-4 border-t space-y-1">
                    <ChatFormatToolbar
                      textareaRef={replyTextareaRef}
                      value={newMessage}
                      onChange={setNewMessage}
                    />
                    <div className="flex gap-2 items-end">
                      <Textarea
                        ref={replyTextareaRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message... (Shift+Enter for new line)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        className="flex-1 text-sm min-h-[40px] max-h-[120px] resize-none"
                        rows={1}
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="sm" className="h-10">
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">{sending ? 'Sending...' : 'Send'}</span>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                  <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-6 text-center text-sm">
                    {sessions.length > 0 
                      ? 'Select a conversation or start a new one'
                      : 'Start a new conversation with our support team'
                    }
                  </p>
                  <div className="w-full max-w-md space-y-2">
                    <ChatFormatToolbar
                      textareaRef={newConvTextareaRef}
                      value={newMessage}
                      onChange={setNewMessage}
                    />
                    <Textarea
                      ref={newConvTextareaRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Describe your issue or question..."
                      className="text-sm min-h-[80px] max-h-[160px] resize-none"
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          startNewConversation();
                        }
                      }}
                    />
                    <Button 
                      onClick={startNewConversation} 
                      disabled={!newMessage.trim() || sending}
                      className="w-full"
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? 'Starting...' : 'Start New Conversation'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CryptoDashboardLayout>
  );
}