import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  LayoutDashboard, Plane, Ticket, Users, Building2, UserCheck,
  Settings, DollarSign, MessageSquare, Image, FileText, Menu,
  LogOut, ChevronDown, MapPin, Globe, Brain, Armchair, CreditCard, Palette
} from 'lucide-react';
import { createPageUrl } from "@/utils";

export default function AdminSidebar() {
  const navigate = useNavigate();
  const [expandedMenus, setExpandedMenus] = useState(['bookings', 'management']);

  const handleLogout = () => {
    localStorage.removeItem('systemUser');
    navigate(createPageUrl('Home'));
  };

  const toggleMenu = (menu) => {
    setExpandedMenus(prev => 
      prev.includes(menu) 
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
  };

  const menuItems = [
    { 
      label: 'لوحة التحكم', 
      icon: LayoutDashboard, 
      link: 'AdminDashboard' 
    },
    {
      label: 'إدارة الطيران',
      icon: Plane,
      id: 'flights',
      children: [
        { label: 'شركات الطيران', link: 'AdminAirlinesComplete' },
        { label: 'المطارات', link: 'AdminAirportsComplete' },
        { label: 'الرحلات', link: 'AdminFlightsComplete' },
        { label: 'المقاعد المتاحة', link: 'AdminSeatsComplete' },
      ]
    },
    {
      label: 'إدارة الحجوزات',
      icon: Ticket,
      id: 'bookings',
      children: [
        { label: 'جميع الحجوزات', link: 'AdminBookingsComplete' },
        { label: 'بانتظار الإصدار', link: 'AdminBookingsComplete?status=pending_issue' },
        { label: 'التذاكر الصادرة', link: 'AdminBookingsComplete?status=issued' },
      ]
    },
    {
      label: 'إدارة المستخدمين',
      icon: Users,
      id: 'management',
      children: [
        { label: 'المزودين', link: 'AdminProvidersComplete' },
        { label: 'الوكلاء', link: 'AdminAgents' },
        { label: 'العملاء', link: 'AdminCustomers' },
        { label: 'الموظفين', link: 'AdminEmployees' },
      ]
    },
    {
      label: 'الذكاء الاصطناعي',
      icon: Brain,
      id: 'ai',
      children: [
        { label: '🤖 لوحة الخدمة الذكية', link: 'AdminAIServiceDashboard' },
        { label: '🚀 WAHA Dashboard', link: 'AdminWAHADashboard' },
        { label: '🎮 لوحة التحكم', link: 'AdminAIServiceControl' },
        { label: '🧪 اختبار Webhook', link: 'AdminWhatsAppWebhookTest' },
        { label: '💬 خدمة العملاء الذكية', link: 'AdminAIConversations' },
        { label: '📊 رؤى السوق والذكاء التسويقي', link: 'AdminMarketInsights' },
        { label: '🎯 مراقبة نظام الرسائل', link: 'AdminMessageMonitor' },
        { label: '🚫 القائمة السوداء', link: 'AdminBlacklist' },
        { label: '🔬 اختبار الخدمة', link: 'AdminAIServiceTest' },
        { label: '🔧 WAHA Debug', link: 'AdminWAHADebug' },
        { label: 'سجل القرارات', link: 'AdminAIDecisions' },
        { label: 'فريق الطوارئ', link: 'AdminEmergencyStaff' },
        { label: 'المزود الذكي', link: 'AdminSmartProvider' },
        { label: 'مستكشف الرحلات', link: 'AdminAITasks' },
        { label: '🌐 المزود الخارجي الذكي', link: 'AdminExternalProvider' },
      ]
    },
    { 
      label: 'المالية والمحاسبة', 
      icon: DollarSign, 
      link: 'AdminFinance' 
    },
    { 
      label: 'إدارة المدفوعات', 
      icon: CreditCard, 
      link: 'AdminPaymentsComplete' 
    },
    { 
      label: 'بوابة الواتساب', 
      icon: MessageSquare, 
      link: 'AdminWhatsApp' 
    },
    { 
      label: 'الإعلانات', 
      icon: Image, 
      link: 'AdminAdvertisements' 
    },
    { 
      label: 'مصمم الواجهات', 
      icon: Palette, 
      link: 'AdminUIDesigner' 
    },
    { 
      label: 'إعدادات النظام', 
      icon: Settings, 
      link: 'AdminSettings' 
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl">
            <Plane className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">نظام الحجوزات</h1>
            <p className="text-xs text-slate-500">لوحة الإدارة</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item, index) => (
            <li key={index}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-slate-500" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${
                      expandedMenus.includes(item.id) ? 'rotate-180' : ''
                    }`} />
                  </button>
                  {expandedMenus.includes(item.id) && (
                    <ul className="mr-8 mt-1 space-y-1">
                      {item.children.map((child, childIndex) => (
                        <li key={childIndex}>
                          <Link
                            to={createPageUrl(child.link)}
                            className="block p-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  to={createPageUrl(item.link)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <item.icon className="h-5 w-5 text-slate-500" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )}
            </li>
          ))}
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
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed top-0 right-0 bottom-0 w-64 bg-white border-l shadow-sm z-40">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 right-0 left-0 bg-white border-b shadow-sm z-40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold">نظام الحجوزات</span>
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
    </>
  );
}