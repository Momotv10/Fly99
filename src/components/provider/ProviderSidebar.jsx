import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, Plane, Calendar, Users, DollarSign, FileText, 
  Settings, LogOut, Menu, X, ChevronDown, ChevronLeft,
  BarChart3, Clock, CheckCircle2, PlusCircle, CreditCard
} from 'lucide-react';

export default function ProviderSidebar({ provider, stats = {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(['flights', 'bookings']);

  const currentPage = location.pathname.split('/').pop();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'الرئيسية',
      icon: Home,
      href: 'ProviderDashboard'
    },
    {
      id: 'flights',
      label: 'الرحلات والمقاعد',
      icon: Plane,
      submenu: [
        { label: 'المقاعد المتاحة', href: 'ProviderSeats', icon: Calendar },
        { label: 'إضافة مقاعد', href: 'ProviderSeats', icon: PlusCircle }
      ]
    },
    {
      id: 'bookings',
      label: 'الحجوزات والإصدار',
      icon: FileText,
      badge: stats.pendingBookings,
      submenu: [
        { label: 'جميع الحجوزات', href: 'ProviderBookings', icon: FileText, badge: stats.pendingBookings }
      ]
    },
    {
      id: 'agents',
      label: 'إدارة الوكلاء',
      icon: Users,
      href: 'ProviderAgents'
    },
    {
      id: 'finance',
      label: 'الإدارة المالية',
      icon: DollarSign,
      submenu: [
        { label: 'كشف الحساب', href: 'ProviderStatement', icon: FileText },
        { label: 'تحويل للوكلاء', href: 'ProviderTransfer', icon: CreditCard }
      ]
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: Settings,
      href: 'ProviderSettings'
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

  const isActive = (href) => {
    return currentPage === href || location.pathname.includes(href);
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      {/* شعار المزود */}
      <div className="p-4 border-b" style={{ backgroundColor: provider?.brand_color || '#3B82F6' }}>
        <div className="flex items-center gap-3">
          {provider?.logo_url ? (
            <img src={provider.logo_url} alt="" className="h-12 w-12 rounded-xl bg-white p-1 object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Plane className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="text-white">
            <h2 className="font-bold text-lg leading-tight">{provider?.company_name_ar || 'المزود'}</h2>
            <p className="text-xs opacity-80">لوحة التحكم</p>
          </div>
        </div>
        
        {/* الرصيد */}
        <div className="mt-4 p-3 bg-white/10 rounded-xl">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm opacity-90">الرصيد المتاح</span>
            <span className="text-xl font-bold">${(provider?.balance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* القائمة */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.submenu ? (
              <>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl transition-colors ${
                    expandedMenus.includes(item.id) ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-slate-600" />
                    <span className="font-medium">{item.label}</span>
                    {item.badge > 0 && (
                      <Badge className="bg-red-500 text-white text-xs">{item.badge}</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${
                    expandedMenus.includes(item.id) ? 'rotate-180' : ''
                  }`} />
                </button>
                
                {expandedMenus.includes(item.id) && (
                  <div className="mr-4 mt-1 space-y-1">
                    {item.submenu.map((sub) => (
                      <Link
                        key={sub.href}
                        to={createPageUrl(sub.href)}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                          isActive(sub.href)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <sub.icon className="h-4 w-4" />
                        <span className="text-sm">{sub.label}</span>
                        {sub.badge > 0 && (
                          <Badge className="bg-red-500 text-white text-xs mr-auto">{sub.badge}</Badge>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={createPageUrl(item.href)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* زر تسجيل الخروج */}
      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
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
      <aside className="hidden lg:block fixed right-0 top-0 h-full w-72 bg-white border-l shadow-sm z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div 
        className="lg:hidden fixed top-0 right-0 left-0 z-50 bg-white border-b shadow-sm"
        style={{ backgroundColor: provider?.brand_color || '#3B82F6' }}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white">
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="flex items-center gap-2 text-white">
              {provider?.logo_url && (
                <img src={provider.logo_url} alt="" className="h-8 w-8 rounded-lg bg-white p-0.5" />
              )}
              <span className="font-bold">{provider?.company_name_ar || 'المزود'}</span>
            </div>
          </div>
          <div className="text-white text-sm font-bold">
            ${(provider?.balance || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed right-0 top-0 h-full w-80 bg-white z-50 shadow-xl">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}