import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Building2, Plane, Users } from 'lucide-react';

export default function PartnersSlider() {
  const [partners, setPartners] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const [providersData, agentsData, airlinesData] = await Promise.all([
        base44.entities.Provider.filter({ is_active: true, is_verified: true }),
        base44.entities.Agent.filter({ is_active: true, is_verified: true }),
        base44.entities.Airline.filter({ is_active: true })
      ]);

      const allPartners = [
        ...providersData.map(p => ({
          id: p.id,
          name: p.company_name_ar || p.company_name_en,
          logo: p.logo_url,
          type: 'provider',
          color: p.brand_color
        })),
        ...agentsData.map(a => ({
          id: a.id,
          name: a.name || a.name_en,
          logo: a.logo_url,
          type: 'agent',
          color: a.brand_color
        }))
      ];

      const processedAirlines = airlinesData.map(a => ({
        id: a.id,
        name: a.name_ar || a.name_en,
        code: a.iata_code,
        logo: a.logo_url,
        type: 'airline'
      }));

      setPartners(allPartners);
      setAirlines(processedAirlines);
    } catch (error) {
      console.error('Error loading partners:', error);
    }
    setLoading(false);
  };

  if (loading || (partners.length === 0 && airlines.length === 0)) {
    return null;
  }

  const allItems = [...airlines, ...partners];

  // Duplicate items for seamless loop
  const duplicatedItems = [...allItems, ...allItems, ...allItems];

  return (
    <section className="py-16 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold text-slate-900 mb-4">شركاؤنا</h2>
          <p className="text-slate-600">نفخر بالتعاون مع أفضل شركات الطيران والمزودين والوكلاء</p>
        </motion.div>
      </div>

      {/* Airlines Row - Moving Right - شعارات فقط */}
      {airlines.length > 0 && (
        <div className="mb-8 relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
          
          <motion.div
            className="flex gap-6 items-center"
            animate={{ x: ['0%', '-33.33%'] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          >
            {[...airlines, ...airlines, ...airlines].map((airline, index) => (
              <motion.div
                key={`airline-${index}`}
                className="flex-shrink-0 p-4 bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                whileHover={{ scale: 1.1 }}
              >
                {airline.logo ? (
                  <img 
                    src={airline.logo} 
                    alt="" 
                    className="h-14 w-20 object-contain"
                  />
                ) : (
                  <div className="h-14 w-20 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Plane className="h-8 w-8 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Partners Row - Moving Left - شعارات فقط */}
      {partners.length > 0 && (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-50 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-50 to-transparent z-10" />
          
          <motion.div
            className="flex gap-6 items-center"
            animate={{ x: ['-33.33%', '0%'] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          >
            {[...partners, ...partners, ...partners].map((partner, index) => (
              <motion.div
                key={`partner-${index}`}
                className="flex-shrink-0 p-4 bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                whileHover={{ scale: 1.1 }}
              >
                {partner.logo ? (
                  <img 
                    src={partner.logo} 
                    alt="" 
                    className="h-14 w-20 object-contain"
                  />
                ) : (
                  <div className={`h-14 w-20 rounded-xl flex items-center justify-center ${
                    partner.type === 'provider' 
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                      : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                  }`}>
                    {partner.type === 'provider' ? (
                      <Building2 className="h-8 w-8 text-white" />
                    ) : (
                      <Users className="h-8 w-8 text-white" />
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}