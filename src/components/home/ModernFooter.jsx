import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plane, Phone, Mail, MapPin, Facebook, Twitter, Instagram, 
  Youtube, Linkedin, Building2, Users, ChevronLeft
} from 'lucide-react';

export default function ModernFooter() {
  const [settings, setSettings] = useState({});
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await base44.entities.SystemSettings.filter({ setting_type: 'general' });
      const settingsMap = {};
      data.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
      setSettings(settingsMap);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-950 text-white" dir="rtl">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600 rounded-xl">
                <Plane className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{settings.company_name || 'طيران اليمن'}</h3>
                <p className="text-sm text-slate-400">نظام حجز التذاكر</p>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed mb-6">
              {settings.company_description || 'نقدم لكم أفضل خدمات حجز تذاكر الطيران بأسعار تنافسية وتجربة سفر استثنائية.'}
            </p>
            <div className="flex gap-3">
              {['facebook', 'twitter', 'instagram', 'youtube'].map((social) => (
                <a
                  key={social}
                  href={settings[`social_${social}`] || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {social === 'facebook' && <Facebook className="h-5 w-5" />}
                  {social === 'twitter' && <Twitter className="h-5 w-5" />}
                  {social === 'instagram' && <Instagram className="h-5 w-5" />}
                  {social === 'youtube' && <Youtube className="h-5 w-5" />}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6">روابط سريعة</h4>
            <ul className="space-y-3">
              {[
                { label: 'الرئيسية', href: 'Home' },
                { label: 'البحث عن رحلات', href: 'SearchResults' },
                { label: 'حجوزاتي', href: 'CustomerBookings' },
                { label: 'تسجيل الدخول', href: 'SystemLogin' }
              ].map((link) => (
                <li key={link.href}>
                  <Link 
                    to={createPageUrl(link.href)} 
                    className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold mb-6">تواصل معنا</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <Phone className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">الهاتف</p>
                  <p dir="ltr">{settings.phone || '+967 1 234567'}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <Mail className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">البريد الإلكتروني</p>
                  <p>{settings.email || 'info@example.com'}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <MapPin className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">العنوان</p>
                  <p>{settings.address || 'صنعاء، اليمن'}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Business Access */}
          <div>
            <h4 className="text-lg font-bold mb-6">بوابة الأعمال</h4>
            <div className="space-y-3">
              <Link to={createPageUrl('SystemLogin') + '?type=agent'}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Building2 className="h-4 w-4 ml-2" />
                  بوابة الوكلاء
                </Button>
              </Link>
              <Link to={createPageUrl('SystemLogin') + '?type=provider'}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Building2 className="h-4 w-4 ml-2" />
                  بوابة المزودين
                </Button>
              </Link>
              <Link to={createPageUrl('SystemLogin') + '?type=external_employee'}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Users className="h-4 w-4 ml-2" />
                  موظفو الإصدار
                </Button>
              </Link>
              <Link to={createPageUrl('SystemLogin') + '?type=admin'}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Users className="h-4 w-4 ml-2" />
                  الإدارة
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} {settings.company_name || 'طيران اليمن'}. جميع الحقوق محفوظة.
            </p>
            <div className="flex gap-6 text-sm">
              <button 
                onClick={() => setPrivacyOpen(true)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                سياسة الخصوصية
              </button>
              <button 
                onClick={() => setPrivacyOpen(true)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                الشروط والأحكام
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Policy Dialog */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>سياسة الخصوصية والشروط</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm" dir="rtl">
            <div dangerouslySetInnerHTML={{ 
              __html: settings.privacy_policy || `
                <h3>سياسة الخصوصية</h3>
                <p>نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.</p>
                <h4>جمع البيانات</h4>
                <p>نقوم بجمع البيانات الضرورية لإتمام عملية الحجز فقط.</p>
                <h4>استخدام البيانات</h4>
                <p>تُستخدم بياناتك فقط لأغراض الحجز والتواصل معك.</p>
                <h4>حماية البيانات</h4>
                <p>نستخدم أحدث تقنيات التشفير لحماية بياناتك.</p>
              ` 
            }} />
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}