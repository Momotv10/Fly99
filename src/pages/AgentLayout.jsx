import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, Search, Ticket, DollarSign, Users, BookOpen,
  Settings, LogOut, Menu, Bell
} from 'lucide-react';
import { createPageUrl } from "@/utils";

export default function AgentLayout({ children, currentPage }) {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadAgent(user.related_entity_id);
  }, []);

  const loadAgent = async (agentId) => {
    const data = await base44.entities.Agent.filter({ id: agentId });
    if (data.length > 0) {
      setAgent(data[0]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('systemUser');
    navigate(createPageUrl('SystemLogin') + '?type=agent');
  };

  const menuItems = [
    { label: 'لوحة التحكم', icon: LayoutDashboard, link: 'AgentDashboard' },
    { label: 'بحث وحجز', icon: Search, link: 'AgentSearch' },
    { label: 'حجوزاتي', icon: Ticket, link: 'AgentBookings' },
    { label: 'كشف الحساب', icon: DollarSign, link: 'AgentFinance' },
    { label: 'عملائي', icon: Users, link: 'AgentCustomers' },
    { label: 'دليل API', icon: BookOpen, link: 'AgentAPIDoc' },
    { label: 'الإعدادات', icon: Settings, link: 'AgentSettings' }
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b" style={{ backgroundColor: agent?.brand_color }}>
        <div className="flex items-center gap-3">
          {agent?.logo_url ? (
            <img src={agent.logo_url} alt="" className="h-12 w-12 rounded bg-white p-1" />
          ) : (
            <div className="h-12 w-12 rounded bg-white/20 flex items-center justify-center text-white text-xl font-bold">
              {agent?.name?.charAt(0)}
            </div>
          )}
          <div className="text-white">
            <h1 className="font-bold text-lg">{agent?.name}</h1>
            <p className="text-sm opacity-90">وكيل مبيعات</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white/20 rounded-lg text-white">
          <p className="text-xs opacity-90">الرصيد المتاح</p>
          <p className="text-2xl font-bold">${agent?.balance || 0}</p>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentPage === item.link;
            
            return (
              <li key={index}>
                <Link
                  to={createPageUrl(item.link)}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'font-semibold' 
                      : 'hover:bg-slate-100'
                  }`}
                  style={isActive ? { backgroundColor: `${agent?.brand_color}20`, color: agent?.brand_color } : {}}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="ml-2 h-5 w-5" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed top-0 right-0 bottom-0 w-64 bg-white border-l shadow-sm z-40">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 right-0 left-0 bg-white border-b shadow-sm z-40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agent?.logo_url && (
              <img src={agent.logo_url} alt="" className="h-8 w-8" />
            )}
            <span className="font-bold">{agent?.name}</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:mr-64 pt-20 lg:pt-0">
        {children}
      </div>
    </div>
  );
}