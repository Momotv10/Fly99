import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PremiumHeroSearch from '@/components/home/PremiumHeroSearch';
import ModernAdvertisements from '@/components/home/ModernAdvertisements';
import PartnersSlider from '@/components/home/PartnersSlider';
import ModernFooter from '@/components/home/ModernFooter';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { motion } from 'framer-motion';
import {
  Plane, Shield, Clock, Globe, Star, Users, Phone, Building2,
  ChevronLeft, LogIn, Download, UserCircle, Sparkles, Award, Headphones
} from 'lucide-react';

export default function PremiumHome() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [partners, setPartners] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
    checkAuth();
  }, []);

  const loadData = async () => {
    // Load settings
    const settingsData = await base44.entities.SystemSettings.filter({ setting_type: 'general' });
    const settingsMap = {};
    settingsData.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    setSettings(settingsMap);

    // Load partners (providers & agents)
    const [providers, agents] = await Promise.all([
      base44.entities.Provider.filter({ is_active: true, is_verified: true }),
      base44.entities.Agent.filter({ is_active: true, is_verified: true })
    ]);
    setPartners([...providers, ...agents]);
  };

  const checkAuth = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    setIsAuthenticated(isAuth);
    if (isAuth) {
      const userData = await base44.auth.me();
      setUser(userData);
    }
  };

  const features = [
    {
      icon: Shield,
      title: 'حجز آمن ومضمون',
      description: 'جميع المعاملات مشفرة ومحمية بأحدث تقنيات الأمان',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Clock,
      title: 'إصدار فوري',
      description: 'احصل على تذكرتك خلال دقائق من تأكيد الحجز',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Globe,
      title: 'تغطية شاملة',
      description: 'رحلات لجميع الوجهات حول العالم بأفضل الأسعار',
      color: 'from-purple-500 to-indigo-500'
    },
    {
      icon: Award,
      title: 'أفضل الأسعار',
      description: 'نقارن الأسعار من جميع المصادر لنقدم لك الأفضل',
      color: 'from-amber-500 to-orange-500'
    },
    {
      icon: Sparkles,
      title: 'بحث ذكي',
      description: 'تقنية الذكاء الاصطناعي تجد لك أفضل الرحلات',
      color: 'from-pink-500 to-rose-500'
    },
    {
      icon: Headphones,
      title: 'دعم متواصل',
      description: 'فريق دعم متخصص على مدار الساعة',
      color: 'from-teal-500 to-cyan-500'
    }
  ];

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Premium Header */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              {settings.company_logo ? (
                <img 
                  src={settings.company_logo} 
                  alt={settings.company_name} 
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <Plane className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {settings.company_name || 'نظام الحجوزات'}
                  </span>
                </div>
              )}
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link to={createPageUrl('CustomerBookings')}>
                    <Button variant="ghost" className="text-white hover:bg-white/10">
                      حجوزاتي
                    </Button>
                  </Link>
                  <Link to={createPageUrl('CustomerProfile')}>
                    <Button className="bg-white text-slate-900 hover:bg-white/90">
                      <UserCircle className="h-5 w-5 ml-2" />
                      {user?.full_name?.split(' ')[0] || 'حسابي'}
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button 
                  onClick={() => base44.auth.redirectToLogin(createPageUrl('PremiumHome'))}
                  className="bg-white text-slate-900 hover:bg-white/90"
                >
                  <LogIn className="h-5 w-5 ml-2" />
                  تسجيل الدخول
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero with Search */}
      <PremiumHeroSearch settings={settings} />

      {/* Advertisements */}
      <ModernAdvertisements />

      {/* Features */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-blue-100 text-blue-700 border-blue-200">مميزاتنا</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">لماذا تختارنا؟</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              نقدم لك تجربة حجز استثنائية مع أفضل الأسعار وأعلى مستوى من الأمان
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="relative bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 group overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} transform scale-x-0 group-hover:scale-x-100 transition-transform origin-right`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <PartnersSlider />

      {/* Download Apps Section */}
      <section className="py-12 bg-gradient-to-r from-slate-100 to-blue-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">حمّل تطبيقك الآن</h3>
            <div className="flex items-center justify-center gap-6">
              <a href="#" className="transform hover:scale-105 transition-transform">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" 
                  alt="App Store" 
                  className="h-14"
                />
              </a>
              <a href="#" className="transform hover:scale-105 transition-transform">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" 
                  alt="Google Play" 
                  className="h-14"
                />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <ModernFooter settings={settings} />
    </div>
  );
}