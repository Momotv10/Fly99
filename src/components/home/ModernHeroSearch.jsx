import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { createPageUrl } from "@/utils";
import { 
  Search, Plane, Calendar as CalendarIcon, Users, ArrowLeftRight,
  Loader2, MapPin
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ModernHeroSearch() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState([]);
  const [searching, setSearching] = useState(false);

  const [searchParams, setSearchParams] = useState({
    tripType: 'round_trip',
    from: '',
    fromName: '',
    to: '',
    toName: '',
    departureDate: addDays(new Date(), 7),
    returnDate: addDays(new Date(), 14),
    passengers: 1,
    seatClass: 'economy'
  });

  useEffect(() => {
    loadAirports();
  }, []);

  const loadAirports = async () => {
    try {
      const data = await base44.entities.Airport.filter({ is_active: true });
      setAirports(data);
    } catch (e) {
      console.error('Error loading airports:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchParams.from || !searchParams.to) {
      toast.error('يرجى تحديد مطار المغادرة والوصول');
      return;
    }

    setSearching(true);
    
    // حفظ البحث في localStorage
    localStorage.setItem('lastSearch', JSON.stringify({
      ...searchParams,
      departureDate: searchParams.departureDate?.toISOString(),
      returnDate: searchParams.returnDate?.toISOString()
    }));

    // الانتقال لصفحة النتائج
    const params = new URLSearchParams({
      from: searchParams.from,
      to: searchParams.to,
      date: format(searchParams.departureDate, 'yyyy-MM-dd'),
      returnDate: searchParams.tripType === 'round_trip' ? format(searchParams.returnDate, 'yyyy-MM-dd') : '',
      passengers: searchParams.passengers,
      class: searchParams.seatClass,
      type: searchParams.tripType
    });

    navigate(createPageUrl('SearchResults') + '?' + params.toString());
  };

  const swapAirports = () => {
    setSearchParams({
      ...searchParams,
      from: searchParams.to,
      fromName: searchParams.toName,
      to: searchParams.from,
      toName: searchParams.fromName
    });
  };

  const handleAirportSelect = (field, airport) => {
    if (field === 'from') {
      setSearchParams({
        ...searchParams,
        from: airport.iata_code,
        fromName: `${airport.city_ar} (${airport.iata_code})`
      });
    } else {
      setSearchParams({
        ...searchParams,
        to: airport.iata_code,
        toName: `${airport.city_ar} (${airport.iata_code})`
      });
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full filter blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        {/* Airplane Pattern */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(20)].map((_, i) => (
            <Plane 
              key={i} 
              className="absolute text-white" 
              style={{ 
                top: `${Math.random() * 100}%`, 
                left: `${Math.random() * 100}%`,
                transform: `rotate(${Math.random() * 360}deg)`,
                width: `${20 + Math.random() * 30}px`
              }} 
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-12">
        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            احجز رحلتك بسهولة
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            اكتشف أفضل الأسعار لرحلات الطيران مع تجربة حجز سلسة وآمنة
          </p>
        </motion.div>

        {/* Search Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-0 rounded-3xl overflow-hidden">
            <div className="p-6 md:p-8">
              {/* Trip Type */}
              <div className="flex flex-wrap gap-3 mb-6">
                <Button
                  variant={searchParams.tripType === 'round_trip' ? 'default' : 'outline'}
                  onClick={() => setSearchParams({ ...searchParams, tripType: 'round_trip' })}
                  className="rounded-full px-6"
                >
                  ذهاب وعودة
                </Button>
                <Button
                  variant={searchParams.tripType === 'one_way' ? 'default' : 'outline'}
                  onClick={() => setSearchParams({ ...searchParams, tripType: 'one_way' })}
                  className="rounded-full px-6"
                >
                  ذهاب فقط
                </Button>
              </div>

              {/* Search Fields */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* From */}
                <div className="md:col-span-3">
                  <Label className="text-slate-600 mb-2 block">من</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-14 justify-start text-right rounded-xl border-2 hover:border-blue-400"
                      >
                        <MapPin className="h-5 w-5 ml-2 text-blue-600" />
                        <span className={searchParams.fromName ? 'text-slate-900' : 'text-slate-400'}>
                          {searchParams.fromName || 'اختر مطار المغادرة'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="max-h-64 overflow-auto">
                        {airports.map((airport) => (
                          <button
                            key={airport.id}
                            onClick={() => handleAirportSelect('from', airport)}
                            className="w-full p-3 text-right hover:bg-blue-50 flex items-center gap-3 border-b"
                          >
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Plane className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{airport.city_ar}</p>
                              <p className="text-sm text-slate-500">{airport.name_ar} ({airport.iata_code})</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Swap */}
                <div className="md:col-span-1 flex items-end justify-center">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={swapAirports}
                    className="rounded-full h-14 w-14 border-2 hover:bg-blue-50 hover:border-blue-400"
                  >
                    <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                  </Button>
                </div>

                {/* To */}
                <div className="md:col-span-3">
                  <Label className="text-slate-600 mb-2 block">إلى</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-14 justify-start text-right rounded-xl border-2 hover:border-blue-400"
                      >
                        <MapPin className="h-5 w-5 ml-2 text-green-600" />
                        <span className={searchParams.toName ? 'text-slate-900' : 'text-slate-400'}>
                          {searchParams.toName || 'اختر مطار الوصول'}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="max-h-64 overflow-auto">
                        {airports.map((airport) => (
                          <button
                            key={airport.id}
                            onClick={() => handleAirportSelect('to', airport)}
                            className="w-full p-3 text-right hover:bg-green-50 flex items-center gap-3 border-b"
                          >
                            <div className="p-2 bg-green-100 rounded-lg">
                              <Plane className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{airport.city_ar}</p>
                              <p className="text-sm text-slate-500">{airport.name_ar} ({airport.iata_code})</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Departure Date */}
                <div className="md:col-span-2">
                  <Label className="text-slate-600 mb-2 block">تاريخ المغادرة</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-14 justify-start text-right rounded-xl border-2 hover:border-blue-400"
                      >
                        <CalendarIcon className="h-5 w-5 ml-2 text-blue-600" />
                        {format(searchParams.departureDate, 'd MMM', { locale: ar })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={searchParams.departureDate}
                        onSelect={(date) => setSearchParams({ ...searchParams, departureDate: date })}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Return Date */}
                {searchParams.tripType === 'round_trip' && (
                  <div className="md:col-span-2">
                    <Label className="text-slate-600 mb-2 block">تاريخ العودة</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full h-14 justify-start text-right rounded-xl border-2 hover:border-blue-400"
                        >
                          <CalendarIcon className="h-5 w-5 ml-2 text-purple-600" />
                          {format(searchParams.returnDate, 'd MMM', { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={searchParams.returnDate}
                          onSelect={(date) => setSearchParams({ ...searchParams, returnDate: date })}
                          disabled={(date) => date < searchParams.departureDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Passengers */}
                <div className={searchParams.tripType === 'round_trip' ? 'md:col-span-1' : 'md:col-span-3'}>
                  <Label className="text-slate-600 mb-2 block">المسافرون</Label>
                  <Select 
                    value={String(searchParams.passengers)}
                    onValueChange={(v) => setSearchParams({ ...searchParams, passengers: Number(v) })}
                  >
                    <SelectTrigger className="h-14 rounded-xl border-2">
                      <Users className="h-5 w-5 ml-2 text-blue-600" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} مسافر</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search Button */}
              <div className="mt-6">
                <Button 
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full h-16 text-xl font-bold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30"
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-6 w-6 ml-3 animate-spin" />
                      جاري البحث...
                    </>
                  ) : (
                    <>
                      <Search className="h-6 w-6 ml-3" />
                      بحث عن الرحلات
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-8 mt-10 text-white"
        >
          <div className="text-center">
            <p className="text-3xl font-bold">50+</p>
            <p className="text-blue-200">وجهة</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">10K+</p>
            <p className="text-blue-200">عميل سعيد</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">24/7</p>
            <p className="text-blue-200">دعم فني</p>
          </div>
        </motion.div>
      </div>

    </section>
  );
}