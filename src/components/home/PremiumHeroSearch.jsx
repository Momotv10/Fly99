import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Calendar as CalendarIcon, Users, Search, ArrowLeftRight,
  MapPin, ChevronDown, Sparkles, Globe, Shield, Star, CheckCircle,
  Minus, Plus, X
} from 'lucide-react';

export default function PremiumHeroSearch({ settings = {} }) {
  const navigate = useNavigate();
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [tripType, setTripType] = useState('round_trip');
  const [fromAirport, setFromAirport] = useState(null);
  const [toAirport, setToAirport] = useState(null);
  const [departureDate, setDepartureDate] = useState(addDays(new Date(), 7));
  const [returnDate, setReturnDate] = useState(addDays(new Date(), 14));
  const [passengers, setPassengers] = useState(1);
  const [seatClass, setSeatClass] = useState('economy');
  
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showPassengersPopup, setShowPassengersPopup] = useState(false);
  const [showDepartureCalendar, setShowDepartureCalendar] = useState(false);
  const [showReturnCalendar, setShowReturnCalendar] = useState(false);
  
  const fromRef = useRef(null);
  const toRef = useRef(null);

  useEffect(() => {
    loadAirports();
  }, []);

  // إغلاق القوائم عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromRef.current && !fromRef.current.contains(event.target)) {
        setShowFromDropdown(false);
      }
      if (toRef.current && !toRef.current.contains(event.target)) {
        setShowToDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAirports = async () => {
    const data = await base44.entities.Airport.filter({ is_active: true }, 'name_ar', 500);
    setAirports(data);
  };

  // بحث ذكي متقدم مع دعم الأخطاء الإملائية
  const smartSearch = (text, searchTerm) => {
    if (!text || !searchTerm) return false;
    
    // تطبيع النص العربي
    const normalize = (str) => {
      return str
        .toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[يى]/g, 'ي')
        .replace(/[ؤئء]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedText = normalize(text);
    const normalizedSearch = normalize(searchTerm);
    
    // تطابق مباشر
    if (normalizedText.includes(normalizedSearch)) return { match: true, score: 100 };
    
    // تطابق من البداية
    if (normalizedText.startsWith(normalizedSearch)) return { match: true, score: 95 };
    
    // تطابق جزئي (للأخطاء الإملائية)
    if (normalizedSearch.length >= 2) {
      let matches = 0;
      for (let i = 0; i < normalizedSearch.length; i++) {
        if (normalizedText.includes(normalizedSearch[i])) matches++;
      }
      const similarity = matches / normalizedSearch.length;
      if (similarity >= 0.7) return { match: true, score: similarity * 80 };
    }
    
    return { match: false, score: 0 };
  };

  const filterAirports = (searchTerm, excludeId = null) => {
    if (!searchTerm || searchTerm.length < 1) {
      return airports.filter(a => a.id !== excludeId).slice(0, 15);
    }
    
    const results = airports
      .filter(a => a.id !== excludeId)
      .map(airport => {
        const nameArScore = smartSearch(airport.name_ar, searchTerm);
        const nameEnScore = smartSearch(airport.name_en, searchTerm);
        const cityArScore = smartSearch(airport.city_ar, searchTerm);
        const cityEnScore = smartSearch(airport.city_en, searchTerm);
        const countryArScore = smartSearch(airport.country_ar, searchTerm);
        const countryEnScore = smartSearch(airport.country_en, searchTerm);
        const codeScore = smartSearch(airport.iata_code, searchTerm);
        
        const maxScore = Math.max(
          nameArScore.score, nameEnScore.score,
          cityArScore.score, cityEnScore.score,
          countryArScore.score, countryEnScore.score,
          codeScore.score
        );
        
        return { airport, score: maxScore };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(r => r.airport);
    
    return results;
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    
    if (!fromAirport || !toAirport) {
      return;
    }

    setLoading(true);

    const params = new URLSearchParams({
      from: fromAirport.iata_code,
      to: toAirport.iata_code,
      fromCity: fromAirport.city_ar || fromAirport.city_en,
      toCity: toAirport.city_ar || toAirport.city_en,
      date: format(departureDate, 'yyyy-MM-dd'),
      passengers: passengers.toString(),
      class: seatClass,
      type: tripType
    });

    if (tripType === 'round_trip' && returnDate) {
      params.set('returnDate', format(returnDate, 'yyyy-MM-dd'));
    }

    navigate(createPageUrl('PremiumSearchResults') + '?' + params.toString());
  };

  const swapAirports = () => {
    const temp = fromAirport;
    const tempSearch = fromSearch;
    setFromAirport(toAirport);
    setToAirport(temp);
    setFromSearch(toSearch);
    setToSearch(tempSearch);
  };

  const selectFromAirport = (airport) => {
    setFromAirport(airport);
    setFromSearch(`${airport.city_ar || airport.city_en} (${airport.iata_code})`);
    setShowFromDropdown(false);
  };

  const selectToAirport = (airport) => {
    setToAirport(airport);
    setToSearch(`${airport.city_ar || airport.city_en} (${airport.iata_code})`);
    setShowToDropdown(false);
  };

  const classOptions = [
    { value: 'economy', label: 'الدرجة الاقتصادية', icon: '✈️' },
    { value: 'business', label: 'درجة رجال الأعمال', icon: '💼' },
    { value: 'first', label: 'الدرجة الأولى', icon: '👑' }
  ];

  const AirportItem = ({ airport, onSelect, variant = 'from' }) => (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(airport)}
      className="w-full p-4 text-right hover:bg-gradient-to-l hover:from-blue-50 hover:to-transparent flex items-center gap-4 transition-all duration-200 border-b border-slate-100 last:border-0 group"
    >
      <div className={`p-3 rounded-2xl transition-all group-hover:scale-110 ${
        variant === 'from' 
          ? 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600' 
          : 'bg-gradient-to-br from-rose-100 to-red-100 text-rose-600'
      }`}>
        <Plane className={`h-5 w-5 ${variant === 'to' ? 'rotate-[135deg]' : 'rotate-[-45deg]'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-lg truncate">
          {airport.city_ar || airport.city_en}
        </p>
        <p className="text-sm text-slate-500 truncate">
          {airport.name_ar || airport.name_en}
        </p>
        <p className="text-xs text-slate-400">
          {airport.country_ar || airport.country_en}
        </p>
      </div>
      <div className="text-left">
        <Badge className="bg-slate-800 text-white font-mono text-sm px-3 py-1">
          {airport.iata_code}
        </Badge>
      </div>
    </motion.button>
  );

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* خلفية متحركة فاخرة */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage: settings.hero_image 
              ? `url(${settings.hero_image})` 
              : 'url(https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/80" />
        
        {/* تأثيرات بصرية */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* طائرات متحركة */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ x: -100, y: 100 + i * 150 }}
            animate={{ 
              x: typeof window !== 'undefined' ? window.innerWidth + 100 : 2000,
              y: 100 + i * 150 + Math.sin(i) * 50
            }}
            transition={{ 
              duration: 25 + i * 5,
              repeat: Infinity,
              delay: i * 4,
              ease: "linear"
            }}
          >
            <Plane className="h-6 w-6 text-white/10 rotate-[-90deg]" />
          </motion.div>
        ))}
      </div>

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-16 md:py-24">
        {/* العنوان */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Badge className="mb-6 bg-white/10 text-white border-white/20 backdrop-blur-xl text-sm py-2.5 px-5 rounded-full">
              <Star className="h-4 w-4 ml-2 text-yellow-400 fill-yellow-400" />
              احجز رحلتك بأفضل الأسعار المضمونة
            </Badge>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
              {settings.hero_title || 'سافر بثقة'}
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto font-light">
            {settings.hero_subtitle || 'اكتشف أفضل العروض على الرحلات الجوية إلى جميع الوجهات'}
          </p>
        </motion.div>

        {/* بطاقة البحث الرئيسية */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-black/20 overflow-hidden">
            {/* شريط نوع الرحلة */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 md:p-6 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setTripType('round_trip')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
                    tripType === 'round_trip'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  ذهاب وإياب
                </button>
                <button
                  onClick={() => setTripType('one_way')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
                    tripType === 'one_way'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <Plane className="h-4 w-4 rotate-[-45deg]" />
                  ذهاب فقط
                </button>
              </div>
            </div>

            {/* حقول البحث */}
            <div className="p-4 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                
                {/* مطار المغادرة */}
                <div className="lg:col-span-3 relative" ref={fromRef}>
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 block">
                    المغادرة من
                  </Label>
                  <div 
                    className={`relative group cursor-text transition-all duration-300 ${
                      showFromDropdown ? 'ring-2 ring-blue-500 rounded-2xl' : ''
                    }`}
                  >
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                        <MapPin className="h-5 w-5" />
                      </div>
                    </div>
                    <Input
                      value={fromSearch}
                      onChange={(e) => {
                        setFromSearch(e.target.value);
                        setShowFromDropdown(true);
                        if (!e.target.value) setFromAirport(null);
                      }}
                      onFocus={() => setShowFromDropdown(true)}
                      placeholder="ابحث عن مدينة أو مطار..."
                      className="h-16 pr-16 pl-4 text-lg font-medium bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                    {fromAirport && (
                      <button
                        onClick={() => {
                          setFromAirport(null);
                          setFromSearch('');
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {showFromDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                      >
                        <div className="p-3 bg-slate-50 border-b border-slate-200">
                          <p className="text-xs font-bold text-slate-500 uppercase">اختر مطار المغادرة</p>
                        </div>
                        <ScrollArea className="max-h-80">
                          {filterAirports(fromSearch, toAirport?.id).length > 0 ? (
                            filterAirports(fromSearch, toAirport?.id).map((airport) => (
                              <AirportItem 
                                key={airport.id} 
                                airport={airport} 
                                onSelect={selectFromAirport}
                                variant="from"
                              />
                            ))
                          ) : (
                            <div className="p-8 text-center text-slate-500">
                              <Search className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                              <p>لم يتم العثور على نتائج</p>
                              <p className="text-sm text-slate-400 mt-1">جرب البحث باسم آخر</p>
                            </div>
                          )}
                        </ScrollArea>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* زر التبديل */}
                <div className="lg:col-span-1 flex items-end justify-center pb-2">
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={swapAirports}
                    className="p-3 bg-gradient-to-br from-slate-100 to-slate-200 hover:from-blue-100 hover:to-indigo-100 rounded-full shadow-md transition-colors"
                  >
                    <ArrowLeftRight className="h-5 w-5 text-slate-600" />
                  </motion.button>
                </div>

                {/* مطار الوصول */}
                <div className="lg:col-span-3 relative" ref={toRef}>
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 block">
                    الوصول إلى
                  </Label>
                  <div 
                    className={`relative group cursor-text transition-all duration-300 ${
                      showToDropdown ? 'ring-2 ring-blue-500 rounded-2xl' : ''
                    }`}
                  >
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                      <div className="p-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl text-white shadow-lg shadow-rose-500/30">
                        <MapPin className="h-5 w-5" />
                      </div>
                    </div>
                    <Input
                      value={toSearch}
                      onChange={(e) => {
                        setToSearch(e.target.value);
                        setShowToDropdown(true);
                        if (!e.target.value) setToAirport(null);
                      }}
                      onFocus={() => setShowToDropdown(true)}
                      placeholder="ابحث عن مدينة أو مطار..."
                      className="h-16 pr-16 pl-4 text-lg font-medium bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                    {toAirport && (
                      <button
                        onClick={() => {
                          setToAirport(null);
                          setToSearch('');
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {showToDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                      >
                        <div className="p-3 bg-slate-50 border-b border-slate-200">
                          <p className="text-xs font-bold text-slate-500 uppercase">اختر مطار الوصول</p>
                        </div>
                        <ScrollArea className="max-h-80">
                          {filterAirports(toSearch, fromAirport?.id).length > 0 ? (
                            filterAirports(toSearch, fromAirport?.id).map((airport) => (
                              <AirportItem 
                                key={airport.id} 
                                airport={airport} 
                                onSelect={selectToAirport}
                                variant="to"
                              />
                            ))
                          ) : (
                            <div className="p-8 text-center text-slate-500">
                              <Search className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                              <p>لم يتم العثور على نتائج</p>
                              <p className="text-sm text-slate-400 mt-1">جرب البحث باسم آخر</p>
                            </div>
                          )}
                        </ScrollArea>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* تاريخ المغادرة */}
                <div className="lg:col-span-2">
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 block">
                    تاريخ المغادرة
                  </Label>
                  <Popover open={showDepartureCalendar} onOpenChange={setShowDepartureCalendar}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-16 justify-start text-right bg-slate-50 border-2 border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all group"
                      >
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white ml-3 shadow-lg shadow-blue-500/30">
                          <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 text-right">
                          <p className="text-lg font-bold text-slate-800">
                            {format(departureDate, 'd MMMM', { locale: ar })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(departureDate, 'EEEE', { locale: ar })}
                          </p>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl" align="start">
                      <Calendar
                        mode="single"
                        selected={departureDate}
                        onSelect={(date) => {
                          setDepartureDate(date);
                          setShowDepartureCalendar(false);
                          if (tripType === 'round_trip' && date >= returnDate) {
                            setReturnDate(addDays(date, 7));
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        className="rounded-2xl"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* تاريخ العودة */}
                {tripType === 'round_trip' && (
                  <div className="lg:col-span-2">
                    <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 block">
                      تاريخ العودة
                    </Label>
                    <Popover open={showReturnCalendar} onOpenChange={setShowReturnCalendar}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-16 justify-start text-right bg-slate-50 border-2 border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all group"
                        >
                          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl text-white ml-3 shadow-lg shadow-purple-500/30">
                            <CalendarIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 text-right">
                            <p className="text-lg font-bold text-slate-800">
                              {format(returnDate, 'd MMMM', { locale: ar })}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(returnDate, 'EEEE', { locale: ar })}
                            </p>
                          </div>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl" align="start">
                        <Calendar
                          mode="single"
                          selected={returnDate}
                          onSelect={(date) => {
                            setReturnDate(date);
                            setShowReturnCalendar(false);
                          }}
                          disabled={(date) => date <= departureDate}
                          className="rounded-2xl"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* المسافرون */}
                <div className={tripType === 'one_way' ? 'lg:col-span-3' : 'lg:col-span-1'}>
                  <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 block">
                    المسافرون
                  </Label>
                  <Popover open={showPassengersPopup} onOpenChange={setShowPassengersPopup}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-16 justify-start text-right bg-slate-50 border-2 border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all"
                      >
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white ml-3 shadow-lg shadow-amber-500/30">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="flex-1 text-right">
                          <p className="text-lg font-bold text-slate-800">{passengers}</p>
                          <p className="text-xs text-slate-500">
                            {classOptions.find(c => c.value === seatClass)?.label}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl" align="end">
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <p className="font-bold text-slate-800">المسافرون والدرجة</p>
                      </div>
                      <div className="p-4 space-y-5">
                        {/* عدد المسافرين */}
                        <div>
                          <Label className="text-sm font-bold text-slate-700 mb-3 block">عدد المسافرين</Label>
                          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                            <button
                              onClick={() => setPassengers(Math.max(1, passengers - 1))}
                              disabled={passengers <= 1}
                              className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <Minus className="h-5 w-5 text-slate-600" />
                            </button>
                            <span className="text-3xl font-black text-slate-800">{passengers}</span>
                            <button
                              onClick={() => setPassengers(Math.min(9, passengers + 1))}
                              disabled={passengers >= 9}
                              className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <Plus className="h-5 w-5 text-slate-600" />
                            </button>
                          </div>
                        </div>
                        
                        {/* درجة السفر */}
                        <div>
                          <Label className="text-sm font-bold text-slate-700 mb-3 block">درجة السفر</Label>
                          <div className="space-y-2">
                            {classOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setSeatClass(option.value)}
                                className={`w-full p-3 rounded-xl text-right flex items-center gap-3 transition-all ${
                                  seatClass === option.value
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <span className="text-xl">{option.icon}</span>
                                <span className="font-medium">{option.label}</span>
                                {seatClass === option.value && (
                                  <CheckCircle className="h-5 w-5 mr-auto" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* زر البحث */}
              <div className="mt-8">
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={!fromAirport || !toAirport || loading}
                  className="w-full h-16 md:h-18 text-xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl shadow-blue-600/30 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent ml-3" />
                      جاري البحث عن أفضل الرحلات...
                    </>
                  ) : (
                    <>
                      <Search className="h-6 w-6 ml-3" />
                      ابحث عن رحلتك
                    </>
                  )}
                </Button>
              </div>

              {/* مميزات */}
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Globe className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium">+500 شركة طيران</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="p-1.5 bg-green-100 rounded-lg">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium">حجز آمن 100%</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium">أفضل سعر مضمون</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}