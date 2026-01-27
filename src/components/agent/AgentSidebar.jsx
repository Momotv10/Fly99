import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home, Search, Ticket, FileText, DollarSign, Settings,
  LogOut, Menu, X, ChevronDown, ChevronLeft, User,
  Link2, BookOpen, Receipt, TrendingUp, HelpCircle, Bell
} from 'lucide-react';

export default function AgentSidebar({ agent, balance }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(['operations']);

  const menuItems = [
    {
      label: 'الرئيسية',
      icon: Home,
      href: 'AgentDashboard'
    },
    {
      label: 'البحث والحجز',
      icon: Search,
      href: 'AgentSearch'
    },
    {
      label: 'إدارة الحجوزات',
      icon: Ticket,
      href: 'AgentBookings'
    },
    {
      label: 'الحساب المالي',
      icon: DollarSign,
      id: 'financial',
      children: [
        { label: 'الرصيد والمعاملات', href: 'AgentBalance' },
        { label: 'التقارير المالية', href: 'AgentReports' }
      ]
    },
    {
      label: 'ربط API',
      icon: Link2,
      href: 'AgentApiDocs'
    },
    {
      label: 'الإعدادات',
      icon: Settings,
      href: 'AgentSettings'
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem('systemUser');
    navigate(createPageUrl('Home'));
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const currentPath = location.pathname;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* الشعار والاسم */}
      <div 
        className="p-4 border-b"
        style={{ backgroundColor: agent?.brand_color || '#3B82F6' }}
      >
        <div className="flex items-center gap-3">
          {agent?.logo_url ? (
            <img src={agent.logo_url} alt="" className="h-12 w-12 rounded-xl bg-white p-1 object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1 text-white">
            <h2 className="font-bold text-lg truncate">{agent?.name || 'الوكيل'}</h2>
            <p className="text-sm opacity-90">وكيل مبيعات</p>
          </div>
        </div>
        
        {/* الرصيد */}
        <div className="mt-4 p-3 rounded-xl bg-white/10 backdrop-blur">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm opacity-90">الرصيد المتاح</span>
            <DollarSign className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">
            ${(balance || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* القائمة */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus.includes(item.id);
            const isActive = item.href && currentPath.includes(item.href);

            return (
              <li key={index}>
                {hasChildren ? (
                  <div>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors ${isExpanded ? 'bg-slate-100' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <ul className="mt-1 mr-4 space-y-1">
                        {item.children.map((child, childIndex) => {
                          const isChildActive = currentPath.includes(child.href);
                          return (
                            <li key={childIndex}>
                              <Link
                                to={createPageUrl(child.href)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                                  isChildActive 
                                    ? 'bg-blue-50 text-blue-700 font-medium' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                onClick={() => setIsOpen(false)}
                              >
                                <ChevronLeft className="h-3 w-3" />
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={createPageUrl(item.href)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* زر تسجيل الخروج */}
      <div className="p-4 border-t">
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 ml-2" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed right-0 top-0 w-72 h-full bg-white border-l shadow-sm z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div 
        className="lg:hidden fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-4"
        style={{ backgroundColor: agent?.brand_color || '#3B82F6' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOpen(true)} className="text-white p-2">
            <Menu className="h-6 w-6" />
          </button>
          {agent?.logo_url ? (
            <img src={agent.logo_url} alt="" className="h-8 w-8 rounded-lg bg-white p-0.5" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
          )}
          <span className="text-white font-bold">{agent?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-0">
            ${(balance || 0).toLocaleString()}
          </Badge>
          <Button variant="ghost" size="icon" className="text-white">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute right-0 top-0 w-72 h-full bg-white shadow-xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute left-3 top-3 p-2 rounded-full hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}