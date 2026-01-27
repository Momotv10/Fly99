import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { motion } from 'framer-motion';
import {
  Plane, LogIn, UserCircle, Menu, X, Phone, Mail, ChevronDown
} from 'lucide-react';

export default function ModernHeader({ transparent = false }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    checkAuth();
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadSettings = async () => {
    const settingsData = await base44.entities.SystemSettings.filter({ setting_type: 'general' });
    const settingsMap = {};
    settingsData.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    setSettings(settingsMap);
  };

  const checkAuth = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    setIsAuthenticated(isAuth);
    if (isAuth) {
      const userData = await base44.auth.me();
      setUser(userData);
    }
  };

  const headerBg = transparent && !isScrolled
    ? 'bg-transparent'
    : 'bg-white/95 backdrop-blur-lg shadow-sm';

  const textColor = transparent && !isScrolled
    ? 'text-white'
    : 'text-slate-900';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to={createPageUrl('Home')} className="flex items-center gap-3">
            {settings.company_logo ? (
              <img 
                src={settings.company_logo} 
                alt={settings.company_name} 
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-3">
                <motion.div 
                  className={`p-3 rounded-xl ${transparent && !isScrolled ? 'bg-white/20 backdrop-blur' : 'bg-blue-600'}`}
                  whileHover={{ scale: 1.05 }}
                >
                  <Plane className="h-6 w-6 text-white" />
                </motion.div>
                <span className={`text-2xl font-bold ${textColor}`}>
                  {settings.company_name || 'نظام الحجوزات'}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to={createPageUrl('Home')} 
              className={`font-medium hover:text-blue-500 transition-colors ${textColor}`}
            >
              الرئيسية
            </Link>
            {isAuthenticated && (
              <Link 
                to={createPageUrl('CustomerBookings')} 
                className={`font-medium hover:text-blue-500 transition-colors ${textColor}`}
              >
                حجوزاتي
              </Link>
            )}
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link to={createPageUrl('CustomerBookings')}>
                  <Button 
                    variant={transparent && !isScrolled ? "ghost" : "outline"} 
                    className={transparent && !isScrolled ? "text-white hover:bg-white/10" : ""}
                  >
                    حجوزاتي
                  </Button>
                </Link>
                <Link to={createPageUrl('CustomerProfile')}>
                  <Button className={transparent && !isScrolled ? "bg-white text-slate-900 hover:bg-white/90" : ""}>
                    <UserCircle className="h-5 w-5 ml-2" />
                    {user?.full_name?.split(' ')[0] || 'حسابي'}
                  </Button>
                </Link>
              </div>
            ) : (
              <Button 
                onClick={() => base44.auth.redirectToLogin(createPageUrl('PremiumHome'))}
                className={transparent && !isScrolled ? "bg-white text-slate-900 hover:bg-white/90" : ""}
              >
                <LogIn className="h-5 w-5 ml-2" />
                تسجيل الدخول
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className={`md:hidden ${transparent && !isScrolled ? 'text-white hover:bg-white/10' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4 p-4 bg-white rounded-2xl shadow-xl"
          >
            <nav className="space-y-2">
              <Link 
                to={createPageUrl('Home')}
                className="block p-3 rounded-xl hover:bg-slate-50 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                الرئيسية
              </Link>
              {isAuthenticated && (
                <>
                  <Link 
                    to={createPageUrl('CustomerBookings')}
                    className="block p-3 rounded-xl hover:bg-slate-50 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    حجوزاتي
                  </Link>
                  <Link 
                    to={createPageUrl('CustomerProfile')}
                    className="block p-3 rounded-xl hover:bg-slate-50 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    حسابي
                  </Link>
                </>
              )}
              
              {settings.phone && (
                <a 
                  href={`tel:${settings.phone}`}
                  className="flex items-center gap-2 p-3 rounded-xl hover:bg-slate-50 text-slate-600"
                >
                  <Phone className="h-4 w-4" />
                  {settings.phone}
                </a>
              )}
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
}