import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, MessageSquare, User, Bot, Image, FileText, Send } from 'lucide-react';

export default function WhatsAppConversations() {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const allMessages = await base44.entities.WhatsAppMessage.list('-created_date', 500);
    
    // تجميع المحادثات حسب الرقم
    const convMap = new Map();
    
    for (const msg of allMessages) {
      const key = msg.direction === 'incoming' ? msg.from_number : msg.to_number;
      if (!convMap.has(key)) {
        convMap.set(key, {
          phone: key,
          name: msg.from_name || key,
          messages: [],
          lastMessage: msg,
          unreadCount: 0,
          type: msg.related_entity_type
        });
      }
      convMap.get(key).messages.push(msg);
      if (msg.direction === 'incoming' && !msg.processed) {
        convMap.get(key).unreadCount++;
      }
    }
    
    setConversations(Array.from(convMap.values()));
    setMessages(allMessages);
    setLoading(false);
  };

  const filteredConversations = conversations.filter(conv => {
    const matchSearch = conv.phone.includes(searchTerm) || 
                       (conv.name && conv.name.includes(searchTerm));
    const matchType = filterType === 'all' || conv.type === filterType;
    return matchSearch && matchType;
  });

  const selectedMessages = selectedConversation
    ? messages.filter(m => 
        m.from_number === selectedConversation.phone || 
        m.to_number === selectedConversation.phone
      ).sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    // إنشاء رسالة جديدة
    await base44.entities.WhatsAppMessage.create({
      direction: 'outgoing',
      to_number: selectedConversation.phone,
      content: newMessage,
      message_type: 'text',
      status: 'pending'
    });
    
    setNewMessage('');
    loadConversations();
  };

  const typeLabels = {
    booking: 'حجز',
    provider: 'مزود',
    customer: 'عميل',
    ai_task: 'ذكاء اصطناعي'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* قائمة المحادثات */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="customer">العملاء</SelectItem>
                <SelectItem value="provider">المزودين</SelectItem>
                <SelectItem value="ai_task">الذكاء الاصطناعي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-350px)]">
            {filteredConversations.map((conv, i) => (
              <div
                key={i}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${
                  selectedConversation?.phone === conv.phone ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                      {conv.type === 'ai_task' ? (
                        <Bot className="h-5 w-5 text-purple-600" />
                      ) : (
                        <User className="h-5 w-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{conv.name}</p>
                      <p className="text-xs text-slate-500" dir="ltr">{conv.phone}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-green-500">{conv.unreadCount}</Badge>
                    )}
                    {conv.type && (
                      <Badge variant="outline" className="text-xs mt-1 block">
                        {typeLabels[conv.type]}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-2 truncate">
                  {conv.lastMessage?.content}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {conv.lastMessage?.created_date && 
                    format(new Date(conv.lastMessage.created_date), 'dd MMM HH:mm', { locale: ar })}
                </p>
              </div>
            ))}
            
            {filteredConversations.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد محادثات</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* عرض المحادثة */}
      <Card className="lg:col-span-2 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    {selectedConversation.type === 'ai_task' ? (
                      <Bot className="h-5 w-5 text-purple-600" />
                    ) : (
                      <User className="h-5 w-5 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedConversation.name}</CardTitle>
                    <p className="text-sm text-slate-500" dir="ltr">{selectedConversation.phone}</p>
                  </div>
                </div>
                {selectedConversation.type && (
                  <Badge>{typeLabels[selectedConversation.type]}</Badge>
                )}
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {selectedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      msg.direction === 'outgoing' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-100'
                    }`}>
                      {msg.message_type === 'image' && msg.media_url && (
                        <img src={msg.media_url} alt="" className="max-w-full rounded mb-2" />
                      )}
                      {msg.message_type === 'document' && (
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5" />
                          <span className="text-sm">مستند</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className={`flex items-center justify-between mt-1 text-xs ${
                        msg.direction === 'outgoing' ? 'text-blue-200' : 'text-slate-400'
                      }`}>
                        <span>
                          {msg.created_date && format(new Date(msg.created_date), 'HH:mm')}
                        </span>
                        {msg.direction === 'outgoing' && (
                          <span>
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="اكتب رسالة..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} className="bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>اختر محادثة للعرض</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}