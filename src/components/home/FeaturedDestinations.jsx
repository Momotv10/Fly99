import React, { useState, useEffect } from 'react';
import { Plane, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FeaturedDestinations() {
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    loadDestinations();
  }, []);

  const loadDestinations = async () => {
    const airports = await base44.entities.Airport.list();
    // Get unique destinations with images
    const featured = airports.slice(0, 6).map(airport => ({
      ...airport,
      image: `https://images.unsplash.com/photo-${getRandomImage(airport.city)}?w=400&h=300&fit=crop`
    }));
    setDestinations(featured);
  };

  const getRandomImage = (city) => {
    const images = [
      '1518998053901-5348d3961a04',
      '1499856871958-5b9627545d1a',
      '1488747279002-c8523379faef',
      '1502602898657-3e91760cbb34',
      '1494522855154-9297ac14b55f',
      '1477959858617-67f85cf4f1df'
    ];
    return images[Math.floor(Math.random() * images.length)];
  };

  if (destinations.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            وجهات مميزة
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            اكتشف أجمل الوجهات السياحية حول العالم بأفضل الأسعار
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((dest, index) => (
            <div
              key={dest.id || index}
              className="group relative overflow-hidden rounded-2xl cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={`https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&h=300&fit=crop`}
                  alt={dest.city}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 right-0 left-0 p-6">
                <div className="flex items-center gap-2 text-blue-300 mb-2">
                  <Plane className="h-4 w-4" />
                  <span className="text-sm">{dest.country}</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{dest.city}</h3>
                <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                  <span>استكشف الرحلات</span>
                  <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}