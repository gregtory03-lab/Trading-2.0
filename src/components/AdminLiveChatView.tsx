import { useState, useEffect, useRef, useCallback, createRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, User, Bot, Headphones, RefreshCw, Pencil, Trash2, Check, X } from 'lucide-react';
import { ChatFormatToolbar } from '@/components/chat/ChatFormatToolbar';
import { FormattedMessage } from '@/components/chat/FormattedMessage';

interface ChatMessage {
  id: string;
  user_id: string;
  session_id: string;
  message: string;
  sender_type: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface UserConversation {
  user_id: string;
  user_name: string;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface AdminLiveChatViewProps {
  adminId: string;
  onUnreadCountChange?: (count: number) => void;
}

function getAdminReadTimestamps(): Record<string, string> {
  try {
    const stored = localStorage.getItem('admin_chat_read_timestamps');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setAdminReadTimestamp(userId: string) {
  const timestamps = getAdminReadTimestamps();
  timestamps[userId] = new Date().toISOString();
  localStorage.setItem('admin_chat_read_timestamps', JSON.stringify(timestamps));
  return timestamps;
}

export default function AdminLiveChatView({ adminId, onUnreadCountChange }: AdminLiveChatViewProps) {
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedUserIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedUserId, conversations]);

  const fetchChatMessages = useCallback(async () => {
    setLoading(true);
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (messages) {
      const readTimestamps = getAdminReadTimestamps();
      const userMessages: { [userId: string]: ChatMessage[] } = {};
      
      for (const msg of messages) {
        if (!userMessages[msg.user_id]) {
          userMessages[msg.user_id] = [];
        }
        userMessages[msg.user_id].push(msg);
      }

      const userIds = Object.keys(userMessages);
      const convs: UserConversation[] = [];

      for (const userId of userIds) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', userId)
          .single();

        const userMsgs = userMessages[userId];
        const lastMsg = userMsgs[userMsgs.length - 1];

        const readTs = readTimestamps[userId];
        const unread = readTs
          ? userMsgs.filter(m => m.sender_type === 'user' && m.created_at > readTs).length
          : userMsgs.filter(m => m.sender_type === 'user').length;

        convs.push({
          user_id: userId,
          user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown User',
          messages: userMsgs.map(m => ({ ...m, profiles: profile })),
          lastMessage: lastMsg.message,
          lastMessageTime: lastMsg.created_at,
          unreadCount: unread
        });
      }

      convs.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      setConversations(convs);
      
      // Report total unread to parent
      const totalUnread = convs.reduce((sum, c) => sum + c.unreadCount, 0);
      onUnreadCountChange?.(totalUnread);
    }
    setLoading(false);
  }, [onUnreadCountChange]);

  useEffect(() => {
    fetchChatMessages();

    // Real-time subscription for new chat messages
    const channel = supabase
      .channel('admin_chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', newMsg.user_id)
            .single();

          const userName = profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown User';

          // If admin is viewing this user's chat, mark as read automatically
          const isViewing = selectedUserIdRef.current === newMsg.user_id;
          if (isViewing && newMsg.sender_type === 'user') {
            setAdminReadTimestamp(newMsg.user_id);
          }

          // Update conversations
          setConversations(prev => {
            const existingConv = prev.find(c => c.user_id === newMsg.user_id);
            
            let updated;
            if (existingConv) {
              updated = prev.map(c => {
                if (c.user_id === newMsg.user_id) {
                  return {
                    ...c,
                    messages: [...c.messages, { ...newMsg, profiles: profile }],
                    lastMessage: newMsg.message,
                    lastMessageTime: newMsg.created_at,
                    unreadCount: newMsg.sender_type === 'user' && !isViewing
                      ? c.unreadCount + 1 
                      : c.unreadCount
                  };
                }
                return c;
              }).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
            } else {
              updated = [{
                user_id: newMsg.user_id,
                user_name: userName,
                messages: [{ ...newMsg, profiles: profile }],
                lastMessage: newMsg.message,
                lastMessageTime: newMsg.created_at,
                unreadCount: newMsg.sender_type === 'user' && !isViewing ? 1 : 0
              }, ...prev];
            }
            
            const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
            onUnreadCountChange?.(totalUnread);
            return updated;
          });

          if (newMsg.sender_type === 'user' && !isViewing) {
            toast({
              title: `New message from ${userName}`,
              description: newMsg.message.substring(0, 50) + (newMsg.message.length > 50 ? '...' : ''),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const sendReply = async () => {
    if (!replyMessage.trim() || !selectedUserId) return;

    setSending(true);
    try {
      const selectedConv = conversations.find(c => c.user_id === selectedUserId);
      const sessionId = selectedConv?.messages[0]?.session_id || crypto.randomUUID();

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: selectedUserId,
          session_id: sessionId,
          message: replyMessage.trim(),
          sender_type: 'admin'
        });

      if (error) throw error;

      // Trigger Web Push notification to user's devices
      supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: selectedUserId,
          message: replyMessage.trim(),
          title: '💬 New Support Message',
        },
      }).catch((err) => console.error('Push notification error:', err));

      toast({
        title: "Reply Sent",
        description: "Your message has been sent to the user",
      });

      setReplyMessage('');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Error",
        description: "Failed to send reply",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = conversations.find(c => c.user_id === selectedUserId);

  const deleteMessage = async (messageId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;

      setConversations(prev => prev.map(c => {
        if (c.user_id !== userId) return c;
        const updated = c.messages.filter(m => m.id !== messageId);
        if (updated.length === 0) return null as any;
        const last = updated[updated.length - 1];
        return { ...c, messages: updated, lastMessage: last.message, lastMessageTime: last.created_at };
      }).filter(Boolean));

      toast({ title: "Message deleted" });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    }
  };

  const saveEdit = async (messageId: string, userId: string) => {
    if (!editText.trim()) return;
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ message: editText.trim() })
        .eq('id', messageId);
      if (error) throw error;

      setConversations(prev => prev.map(c => {
        if (c.user_id !== userId) return c;
        const updated = c.messages.map(m => m.id === messageId ? { ...m, message: editText.trim() } : m);
        const last = updated[updated.length - 1];
        return { ...c, messages: updated, lastMessage: last.message };
      }));

      setEditingMessageId(null);
      setEditText('');
      toast({ title: "Message updated" });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">Loading chat messages...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Conversations List */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversations
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchChatMessages}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[500px]">
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.user_id}
                    onClick={() => {
                      setSelectedUserId(conv.user_id);
                      // Mark as read in localStorage
                      setAdminReadTimestamp(conv.user_id);
                      // Clear unread count immediately
                      setConversations(prev => {
                        const updated = prev.map(c => 
                          c.user_id === conv.user_id ? { ...c, unreadCount: 0 } : c
                        );
                        const totalUnread = updated.reduce((sum, c) => sum + c.unreadCount, 0);
                        onUnreadCountChange?.(totalUnread);
                        return updated;
                      });
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === conv.user_id
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{conv.user_name}</span>
                      {conv.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conv.lastMessage}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(conv.lastMessageTime).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat View */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {selectedConversation ? (
              <span className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Chat with {selectedConversation.user_name}
              </span>
            ) : (
              'Select a conversation'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {selectedConversation ? (
            <div className="flex flex-col h-[480px]">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {selectedConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex group ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] flex gap-2 ${msg.sender_type === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.sender_type === 'admin'
                            ? 'bg-green-500'
                            : msg.sender_type === 'bot'
                            ? 'bg-blue-500'
                            : 'bg-primary'
                        }`}>
                          {msg.sender_type === 'admin' ? (
                            <Headphones className="h-4 w-4 text-white" />
                          ) : msg.sender_type === 'bot' ? (
                            <Bot className="h-4 w-4 text-white" />
                          ) : (
                            <User className="h-4 w-4 text-white" />
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
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id, msg.user_id); }
                                }}
                                autoFocus
                              />
                              <button onClick={() => saveEdit(msg.id, msg.user_id)} className="text-green-500 hover:text-green-400"><Check className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { setEditingMessageId(null); setEditText(''); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <div className={`px-3 py-2 rounded-lg text-sm ${
                              msg.sender_type === 'admin'
                                ? 'bg-black border border-gray-700 text-white'
                                : msg.sender_type === 'bot'
                                ? 'bg-blue-50 dark:bg-blue-950'
                                : 'bg-muted'
                            }`}>
                              <FormattedMessage text={msg.message} />
                            </div>
                          )}
                          <div className="flex items-center gap-1 px-1">
                            <p className="text-xs text-muted-foreground">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="ml-2 capitalize">{msg.sender_type}</span>
                            </p>
                            {msg.sender_type === 'admin' && editingMessageId !== msg.id && (
                              <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setEditingMessageId(msg.id); setEditText(msg.message); }}
                                  className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                                  title="Edit message"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => deleteMessage(msg.id, msg.user_id)}
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
              <div className="pt-4 border-t mt-4 space-y-1">
                <ChatFormatToolbar
                  textareaRef={replyTextareaRef}
                  value={replyMessage}
                  onChange={setReplyMessage}
                />
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={replyTextareaRef}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply... (Shift+Enter for new line)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    className="flex-1 min-h-[44px] max-h-[140px] resize-none text-sm"
                    rows={2}
                  />
                  <Button onClick={sendReply} disabled={!replyMessage.trim() || sending} className="h-10">
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[480px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
