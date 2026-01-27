import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { wahaSystem } from '@/components/ai/WAHACompleteSystem';

export default function Layout({ children, currentPageName }) {
  // Pages that should have no layout wrapping
  const noLayoutPages = [
    'Home', 
    'SearchResults', 
    'BookingDetails', 
    'Payment', 
    'BookingConfirmation',
    'CustomerBookings',
    'SystemLogin',
    'AdminDashboard',
    'AdminAirlines',
    'AdminAirports',
    'AdminFlights',
    'AdminFlightForm',
    'AdminBookings',
    'AdminBookingDetails',
    'AdminAgents',
    'AdminProviders',
    'AdminCustomers',
    'AdminEmployees',
    'AdminFinance',
    'AdminMessaging',
    'AdminAdvertisements',
    'AdminSettings',
    'ProviderDashboard',
    'AgentDashboard'
  ];

  // SEO - تحديث العنوان والوصف ديناميكياً
  useEffect(() => {
    document.title = 'حجز تذاكر طيران - أفضل أسعار رحلات الطيران | نظام الحجز الذكي';
    
    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'احجز تذاكر طيران بأفضل الأسعار. رحلات الخطوط اليمنية، طيران الإمارات، الخطوط التركية، القطرية وجميع شركات الطيران. حجز فوري وآمن لجميع الوجهات.';

    // Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = 'حجز طيران، تذاكر طيران، رحلات جوية، الخطوط اليمنية، طيران الإمارات، الخطوط التركية، حجز رحلات، تذاكر سفر، حجز اون لاين، رحلات رخيصة، عروض طيران، حجز تذاكر، صنعاء، عدن، جدة، دبي، اسطنبول، القاهرة، عمان';

    // Structured Data
    let scriptLD = document.querySelector('script[type="application/ld+json"]');
    if (!scriptLD) {
      scriptLD = document.createElement('script');
      scriptLD.type = 'application/ld+json';
      document.head.appendChild(scriptLD);
    }
    scriptLD.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      "name": "نظام حجز تذاكر الطيران",
      "description": "احجز تذاكر طيران بأفضل الأسعار لجميع الوجهات حول العالم",
      "url": window.location.origin,
      "priceRange": "$$",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "رحلات الطيران"
      }
    });
  }, []);

  return (
    <div dir="rtl" className="font-sans">
      <style>{`
        :root {
          --font-sans: 'Tajawal', 'Segoe UI', sans-serif;
        }
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        
        body {
          font-family: var(--font-sans);
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}