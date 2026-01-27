import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plane, Menu, User, LogOut, LayoutDashboard, Ticket, ChevronDown } from 'lucide-react';
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';

export default function Header() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [systemUser, setSystemUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    checkAuth();
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkAuth = async () => {
    const authenticated = await base44.auth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      const userData = await base44.auth.me();
      setUser(userData);
      
      // Check if system user (admin, agent, provider)
      const systemUsers = await base44.entities.SystemUser.filter({ email: userData.email });
      if (systemUsers.length > 0) {
        setSystemUser(systemUsers[0]);
      }
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const getDashboardUrl = () => {
    if (systemUser) {
      switch (systemUser.role) {
        case 'admin':
        case 'employee':
          return createPageUrl('AdminDashboard');
        case 'agent':
          return createPageUrl('AgentDashboard');
        case 'provider':
          return createPageUrl('ProviderDashboard');
        default:
          return createPageUrl('CustomerBookings');
      }
    }
    return createPageUrl('CustomerBookings');
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to={createPageUrl('Home')} className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isScrolled ? 'bg-blue-600' : 'bg-white/20 backdrop-blur-sm'}`}>
              <Plane className={`h-6 w-6 ${isScrolled ? 'text-white' : 'text-white'}`} />
            </div>
            <span className={`text-xl font-bold ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
              نظام الحجوزات
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to={createPageUrl('Home')} 
              className={`font-medium transition-colors ${isScrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white/90 hover:text-white'}`}
            >
              الرئيسية
            </Link>
            <Link 
              to={createPageUrl('SearchResults')} 
              className={`font-medium transition-colors ${isScrolled ? 'text-slate-700 hover:text-blue-600' : 'text-white/90 hover:text-white'}`}
            >
              البحث عن رحلات
            </Link>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant={isScrolled ? "outline" : "secondary"}
                    className={`gap-2 ${!isScrolled && 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30'}`}
                  >
                    <User className="h-4 w-4" />
                    <span className="max-w-[100px] truncate">{user?.full_name || user?.email}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to={getDashboardUrl()} className="cursor-pointer">
                      <LayoutDashboard className="ml-2 h-4 w-4" />
                      لوحة التحكم
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl('CustomerBookings')} className="cursor-pointer">
                      <Ticket className="ml-2 h-4 w-4" />
                      حجوزاتي
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                    <LogOut className="ml-2 h-4 w-4" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  onClick={handleLogin}
                  className={`hidden sm:flex ${!isScrolled && 'text-white hover:bg-white/20'}`}
                >
                  تسجيل الدخول
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      className={`${isScrolled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white text-blue-900 hover:bg-white/90'}`}
                    >
                      <User className="ml-2 h-4 w-4" />
                      دخول الأنظمة
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('SystemLogin') + '?type=admin'} className="cursor-pointer">
                        مدير النظام
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('SystemLogin') + '?type=agent'} className="cursor-pointer">
                        وكيل مبيعات
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('SystemLogin') + '?type=provider'} className="cursor-pointer">
                        مزود خدمة
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogin} className="cursor-pointer">
                      <User className="ml-2 h-4 w-4" />
                      تسجيل دخول العملاء
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={`md:hidden ${!isScrolled && 'text-white hover:bg-white/20'}`}>
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <nav className="flex flex-col gap-4 mt-8">
                  <Link to={createPageUrl('Home')} className="text-lg font-medium py-2">
                    الرئيسية
                  </Link>
                  <Link to={createPageUrl('SearchResults')} className="text-lg font-medium py-2">
                    البحث عن رحلات
                  </Link>
                  {isAuthenticated && (
                    <>
                      <Link to={getDashboardUrl()} className="text-lg font-medium py-2">
                        لوحة التحكم
                      </Link>
                      <Link to={createPageUrl('CustomerBookings')} className="text-lg font-medium py-2">
                        حجوزاتي
                      </Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}