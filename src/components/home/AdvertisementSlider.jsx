import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';

export default function AdvertisementSlider() {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadAds();
  }, []);

  useEffect(() => {
    if (ads.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % ads.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [ads.length]);

  const loadAds = async () => {
    const data = await base44.entities.Advertisement.filter({ 
      position: 'hero', 
      is_active: true 
    });
    setAds(data);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % ads.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  };

  if (ads.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-xl">
      <div 
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(${currentIndex * 100}%)` }}
      >
        {ads.map((ad) => (
          <div key={ad.id} className="min-w-full relative">
            <a href={ad.link_url} target="_blank" rel="noopener noreferrer">
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full h-64 md:h-80 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-6 right-6 text-white">
                <h3 className="text-xl font-bold">{ad.title}</h3>
              </div>
            </a>
          </div>
        ))}
      </div>

      {ads.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white rounded-full"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white rounded-full"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {ads.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-6' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}