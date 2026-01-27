import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, Phone, Mail, MapPin, Facebook, Twitter, Instagram } from 'lucide-react';
import { createPageUrl } from "@/utils";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo & Description */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Plane className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold">نظام الحجوزات</span>
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed">
              نوفر لك أفضل العروض على تذاكر الطيران إلى جميع أنحاء العالم بأسعار منافسة وخدمة مميزة
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6">روابط سريعة</h3>
            <ul className="space-y-4">
              <li>
                <Link to={createPageUrl('Home')} className="text-slate-400 hover:text-white transition-colors">
                  الصفحة الرئيسية
                </Link>
              </li>
              <li>
                <Link to={createPageUrl('SearchResults')} className="text-slate-400 hover:text-white transition-colors">
                  البحث عن رحلات
                </Link>
              </li>
              <li>
                <Link to={createPageUrl('CustomerBookings')} className="text-slate-400 hover:text-white transition-colors">
                  حجوزاتي
                </Link>
              </li>
            </ul>
          </div>

          {/* For Partners */}
          <div>
            <h3 className="text-lg font-semibold mb-6">للشركاء</h3>
            <ul className="space-y-4">
              <li>
                <Link to={createPageUrl('SystemLogin') + '?type=agent'} className="text-slate-400 hover:text-white transition-colors">
                  بوابة الوكلاء
                </Link>
              </li>
              <li>
                <Link to={createPageUrl('SystemLogin') + '?type=provider'} className="text-slate-400 hover:text-white transition-colors">
                  بوابة المزودين
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-6">تواصل معنا</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-slate-400">
                <Phone className="h-5 w-5 text-blue-500" />
                <span dir="ltr">+966 12 345 6789</span>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <Mail className="h-5 w-5 text-blue-500" />
                <span>info@booking.com</span>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <MapPin className="h-5 w-5 text-blue-500" />
                <span>الرياض، المملكة العربية السعودية</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
          <p>© {new Date().getFullYear()} نظام الحجوزات. جميع الحقوق محفوظة</p>
        </div>
      </div>
    </footer>
  );
}