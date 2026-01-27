import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ModernAdvertisements() {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadAds();
  }, []);

  useEffect(() => {
    if (ads.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [ads.length]);

  const loadAds = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await base44.entities.Advertisement.filter({
        is_active: true,
        position: 'hero'
      }, 'display_order', 10);
      
      // فلترة الإعلانات الصالحة
      const validAds = data.filter(ad => {
        if (!ad.start_date && !ad.end_date) return true;
        if (ad.start_date && ad.start_date > today) return false;
        if (ad.end_date && ad.end_date < today) return false;
        return true;
      });

      setAds(validAds);
    } catch (e) {
      console.error('Error loading ads:', e);
    }
  };

  if (ads.length === 0) return null;

  const goNext = () => setCurrentIndex(prev => (prev + 1) % ads.length);
  const goPrev = () => setCurrentIndex(prev => (prev - 1 + ads.length) % ads.length);

  return (
    <section className="py-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="relative h-80 md:h-96"
            >
              {/* Background Image */}
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${ads[currentIndex]?.image_url})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative h-full flex items-center px-8 md:px-16">
                <div className="max-w-xl text-white">
                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-3xl md:text-4xl font-bold mb-4"
                  >
                    {ads[currentIndex]?.title}
                  </motion.h3>
                  {ads[currentIndex]?.description && (
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-lg text-white/90 mb-6"
                    >
                      {ads[currentIndex]?.description}
                    </motion.p>
                  )}
                  {ads[currentIndex]?.link_url && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Button 
                        asChild
                        size="lg"
                        className="bg-white text-slate-900 hover:bg-white/90 rounded-full px-8"
                      >
                        <a href={ads[currentIndex]?.link_url} target="_blank" rel="noopener noreferrer">
                          اعرف المزيد
                          <ExternalLink className="h-4 w-4 mr-2" />
                        </a>
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          {ads.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
              <button
                onClick={goNext}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {ads.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentIndex 
                        ? 'bg-white w-8' 
                        : 'bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}