import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/home/ModernHeader';
import ModernFooter from '@/components/home/ModernFooter';
import PremiumFlightCard from '@/components/booking/PremiumFlightCard';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { smartFlightSearch } from '@/components/ai/SmartFlightSearch';
import { strictExternalProvider } from '@/components/ai/StrictExternalProvider';
import { createPageUrl } from "@/utils";
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search, Plane, Calendar, Users, Filter, RefreshCw, SlidersHorizontal,
  Sparkles, Globe, AlertCircle, Loader2, ArrowLeftRight, TrendingUp
} from 'lucide-react';

export default function PremiumSearchResults() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchingExternal, setSearchingExternal] = useState(false);
  const [results, setResults] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const [searchParams, setSearchParams] = useState({
    from: '',
    to: '',
    date: '',
    returnDate: '',
    passengers: 1,
    class: 'economy',
    type: 'round_trip'
  });

  const [filters, setFilters] = useState({
    priceRange: [0, 3000],
    airlines: [],
    sortBy: 'price',
    showExternal: true
  });

  const [airports, setAirports] = useState({});
  const [suggestedFlights, setSuggestedFlights] = useState([]);

  useEffect(() => {
    parseUrlParams();
    loadAirports();
  }, []);

  useEffect(() => {
    if (searchParams.from && searchParams.to) {
      searchFlights();
    }
  }, [searchParams]);

  useEffect(() => {
    applyFilters();
  }, [results, externalResults, filters]);

  const parseUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    
    // استخراج رمز IATA من الاسم إذا كان النص يحتوي على قوسين
    const extractIataCode = (value) => {
      if (!value) return '';
      // إذا كان النص يحتوي على قوسين مثل "القاهرة (CAI)" أو "Cairo"
      const match = value.match(/\(([A-Z]{3})\)/);
      if (match) return match[1];
      // إذا كان رمز IATA مباشرة (3 أحرف كبيرة)
      if (/^[A-Z]{3}$/.test(value)) return value;
      // محاولة تحويل الاسم إلى رمز IATA
      return value.toUpperCase().slice(0, 3);
    };
    
    const fromValue = params.get('from') || '';
    const toValue = params.get('to') || '';
    
    setSearchParams({
      from: extractIataCode(fromValue),
      to: extractIataCode(toValue),
      fromCity: params.get('fromCity') || fromValue,
      toCity: params.get('toCity') || toValue,
      date: params.get('date') || format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      returnDate: params.get('returnDate') || '',
      passengers: parseInt(params.get('passengers') || '1'),
      class: params.get('class') || 'economy',
      type: params.get('type') || 'round_trip'
    });
  };

  const loadAirports = async () => {
    const data = await base44.entities.Airport.filter({ is_active: true });
    const airportsMap = {};
    data.forEach(a => { airportsMap[a.iata_code] = a; });
    setAirports(airportsMap);
  };

  /**
   * البحث عن الرحلات - يتبع التسلسل الصارم:
   * 1. قاعدة البيانات الداخلية أولاً
   * 2. أقرب موعد متاح
   * 3. المزود الخارجي كحل أخير فقط
   */
  const searchFlights = async () => {
    setLoading(true);
    setExternalResults([]);
    setSuggestedFlights([]);
    
    try {
      // استخدام محرك البحث الذكي الجديد
      const searchResult = await smartFlightSearch.search({
        from: searchParams.from,
        to: searchParams.to,
        date: searchParams.date,
        departureDate: searchParams.date,
        returnDate: searchParams.returnDate,
        passengers: searchParams.passengers,
        class: searchParams.class,
        seatClass: searchParams.class,
        type: searchParams.type,
        tripType: searchParams.type
      });

      if (!searchResult.success && searchResult.errors) {
        toast.error(searchResult.errors[0] || 'بيانات البحث غير مكتملة');
        setLoading(false);
        return;
      }

      // عرض النتائج الداخلية
      if (searchResult.results && searchResult.results.length > 0) {
        setResults(searchResult.results);
        setLoading(false);
        
        // لا نبحث خارجياً إذا وجدنا نتائج داخلية
        toast.success(`تم العثور على ${searchResult.results.length} رحلة متاحة`);
        return;
      }

      // عرض الرحلات المقترحة (أقرب موعد)
      if (searchResult.suggestedFlights && searchResult.suggestedFlights.length > 0) {
        setSuggestedFlights(searchResult.suggestedFlights);
        setResults([]);
        setLoading(false);
        
        // نعرض رسالة ونسمح بالبحث الخارجي كخيار
        toast.info('لم نجد رحلات في التاريخ المحدد، لكن وجدنا رحلات في تواريخ قريبة');
        return;
      }

      // لم نجد أي شيء في قاعدة البيانات - البحث الخارجي كحل أخير
      setResults([]);
      setLoading(false);
      
      if (searchResult.needsExternalSearch) {
        // البحث الخارجي تلقائياً فقط إذا لم توجد نتائج داخلية
        await searchExternalFlights();
      }

    } catch (e) {
      toast.error('حدث خطأ أثناء البحث');
      console.error('Search error:', e);
      setLoading(false);
    }
  };

  /**
   * البحث في المزود الخارجي - يعمل فقط عند عدم توفر نتائج داخلية
   * لا يظهر للعميل أي إشارة لمواقع خارجية
   */
  const searchExternalFlights = async () => {
    setSearchingExternal(true);
    
    try {
      // استخدام المزود الخارجي المنضبط
      const result = await strictExternalProvider.searchFlights({
        from: searchParams.from,
        to: searchParams.to,
        departureDate: searchParams.date,
        returnDate: searchParams.returnDate,
        passengers: searchParams.passengers,
        seatClass: searchParams.class,
        tripType: searchParams.type
      });

      if (result.success && result.flights && result.flights.length > 0) {
        setExternalResults(result.flights);
        // رسالة عامة بدون ذكر مصادر خارجية
        toast.success(`تم العثور على ${result.flights.length} رحلة إضافية`);
      } else {
        // لا نعرض رسالة فشل للمستخدم
        console.log('External search returned no results');
      }
    } catch (e) {
      console.error('External search error:', e);
    }
    
    setSearchingExternal(false);
  };

  const applyFilters = () => {
    let allResults = [...results];
    
    if (filters.showExternal) {
      allResults = [...allResults, ...externalResults];
    }

    // فلتر السعر
    allResults = allResults.filter(s => {
      const price = s.total_price || s.price_per_person || 0;
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });

    // فلتر شركات الطيران
    if (filters.airlines.length > 0) {
      allResults = allResults.filter(s => filters.airlines.includes(s.airline_name));
    }

    // الترتيب
    if (filters.sortBy === 'price') {
      allResults.sort((a, b) => (a.total_price || a.price_per_person || 0) - (b.total_price || b.price_per_person || 0));
    } else if (filters.sortBy === 'time') {
      allResults.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
    }

    setFilteredResults(allResults);
  };

  const handleSelectFlight = async (flight) => {
    const isAuth = await base44.auth.isAuthenticated();
    
    const isExternal = flight.is_external;
    
    if (!isAuth) {
      // حفظ بيانات الرحلة
      localStorage.setItem('selectedFlight', JSON.stringify({
        flight: flight,
        passengers: searchParams.passengers,
        isExternal: isExternal
      }));
      
      toast.info('يرجى تسجيل الدخول لإتمام الحجز');
      
      if (isExternal) {
        const flightData = encodeURIComponent(JSON.stringify(flight));
        base44.auth.redirectToLogin(createPageUrl('PremiumBooking') + `?external_flight=${flightData}&passengers=${searchParams.passengers}`);
      } else {
        base44.auth.redirectToLogin(createPageUrl('PremiumBooking') + `?seat_id=${flight.id}&passengers=${searchParams.passengers}`);
      }
      return;
    }

    if (isExternal) {
      const flightData = encodeURIComponent(JSON.stringify(flight));
      navigate(createPageUrl('PremiumBooking') + `?external_flight=${flightData}&passengers=${searchParams.passengers}`);
    } else {
      navigate(createPageUrl('PremiumBooking') + `?seat_id=${flight.id}&passengers=${searchParams.passengers}`);
    }
  };

  const getClassLabel = (seatClass) => {
    const classes = { economy: 'اقتصادية', business: 'رجال أعمال', first: 'الدرجة الأولى' };
    return classes[seatClass] || seatClass;
  };

  const allAirlines = [...new Set([
    ...results.map(s => s.airline_name).filter(Boolean),
    ...externalResults.map(s => s.airline_name).filter(Boolean)
  ])];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      <ModernHeader />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Search Summary */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white border-0 overflow-hidden">
              <CardContent className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-4xl font-bold">{airports[searchParams.from]?.city_ar || searchParams.from}</p>
                      <p className="text-blue-200">{searchParams.from}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-px bg-white/30" />
                      <div className="p-3 bg-white/20 rounded-full">
                        <Plane className="h-6 w-6" />
                      </div>
                      <div className="w-12 h-px bg-white/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold">{airports[searchParams.to]?.city_ar || searchParams.to}</p>
                      <p className="text-blue-200">{searchParams.to}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 flex-wrap">
                    <div>
                      <p className="text-blue-200 text-sm">تاريخ المغادرة</p>
                      <p className="font-semibold text-lg">
                        {searchParams.date && format(parseISO(searchParams.date), 'd MMMM yyyy', { locale: ar })}
                      </p>
                    </div>
                    {/* عرض تاريخ العودة إذا كانت الرحلة ذهاب وعودة */}
                    {searchParams.type === 'round_trip' && searchParams.returnDate && (
                      <div>
                        <p className="text-blue-200 text-sm">تاريخ العودة</p>
                        <p className="font-semibold text-lg">
                          {format(parseISO(searchParams.returnDate), 'd MMMM yyyy', { locale: ar })}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-blue-200 text-sm">نوع الرحلة</p>
                      <p className="font-semibold text-lg">
                        {searchParams.type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-sm">المسافرون</p>
                      <p className="font-semibold text-lg">{searchParams.passengers} مسافر</p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-sm">الدرجة</p>
                      <p className="font-semibold text-lg">{getClassLabel(searchParams.class)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters */}
            <div className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}>
              <Card className="sticky top-24 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" />
                    الفلاتر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Price Range */}
                  <div>
                    <label className="text-sm font-semibold mb-4 block">نطاق السعر</label>
                    <Slider
                      value={filters.priceRange}
                      onValueChange={(v) => setFilters({ ...filters, priceRange: v })}
                      max={3000}
                      step={50}
                      className="mb-3"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>${filters.priceRange[0]}</span>
                      <span>${filters.priceRange[1]}</span>
                    </div>
                  </div>

                  {/* Airlines */}
                  {allAirlines.length > 0 && (
                    <div>
                      <label className="text-sm font-semibold mb-4 block">شركات الطيران</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {allAirlines.map((airline) => (
                          <label key={airline} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
                            <input
                              type="checkbox"
                              checked={filters.airlines.includes(airline)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilters({ ...filters, airlines: [...filters.airlines, airline] });
                                } else {
                                  setFilters({ ...filters, airlines: filters.airlines.filter(a => a !== airline) });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{airline}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* تضمين الرحلات الإضافية */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={filters.showExternal}
                        onCheckedChange={(checked) => setFilters({ ...filters, showExternal: checked })}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold flex items-center gap-2 text-blue-700">
                          <Plane className="h-4 w-4" />
                          عرض جميع الرحلات
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          تضمين الرحلات الإضافية في النتائج
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Sort */}
                  <div>
                    <label className="text-sm font-semibold mb-3 block">ترتيب حسب</label>
                    <Select value={filters.sortBy} onValueChange={(v) => setFilters({ ...filters, sortBy: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">السعر (الأقل أولاً)</SelectItem>
                        <SelectItem value="time">وقت المغادرة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="flex-1">
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden mb-4">
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="w-full">
                  <Filter className="h-4 w-4 ml-2" />
                  {showFilters ? 'إخفاء الفلاتر' : 'عرض الفلاتر'}
                </Button>
              </div>

              {/* Results Info - بدون إظهار مصادر خارجية للعميل */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <p className="text-slate-600">
                    {loading ? 'جاري البحث عن أفضل الرحلات...' : `${filteredResults.length} رحلة متاحة`}
                  </p>
                  {externalResults.length > 0 && (
                    <Badge className="bg-green-100 text-green-700">
                      <Plane className="h-3 w-3 ml-1" />
                      {externalResults.length} رحلة إضافية
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* زر البحث الإضافي - فقط إذا لم توجد نتائج */}
                  {!searchingExternal && externalResults.length === 0 && results.length === 0 && (
                    <Button variant="outline" size="sm" onClick={searchExternalFlights}>
                      <Search className="h-4 w-4 ml-2" />
                      بحث إضافي
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={searchFlights}>
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تحديث
                  </Button>
                </div>
              </div>

              {/* Loading */}
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex gap-6">
                          <Skeleton className="h-20 w-20 rounded-2xl" />
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-16 w-40" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* External Search Loading - رسالة عامة بدون ذكر مواقع خارجية */}
              {searchingExternal && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-6 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-blue-700 font-semibold">جاري البحث عن أفضل الرحلات المتاحة...</p>
                      <p className="text-blue-500 text-sm">نبحث لك عن أفضل الأسعار والخيارات</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* No Results - Smart Suggestions */}
              {!loading && filteredResults.length === 0 && !searchingExternal && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="overflow-hidden border-0 shadow-xl">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3" />
                      <h3 className="text-2xl font-bold mb-2">لم نجد رحلات في التاريخ المحدد</h3>
                      <p className="text-amber-100">
                        {searchParams.date && format(parseISO(searchParams.date), 'd MMMM yyyy', { locale: ar })}
                      </p>
                    </div>
                    <CardContent className="p-6">
                      {/* أقرب الرحلات المتاحة */}
                      {suggestedFlights.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800">أقرب رحلة متاحة</h4>
                              <p className="text-sm text-slate-500">رحلات قريبة من التاريخ الذي بحثت عنه</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {suggestedFlights.slice(0, 3).map((flight, index) => (
                              <motion.div 
                                key={flight.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 hover:shadow-lg transition-all"
                              >
                                <div className="flex items-center gap-4 mb-3 md:mb-0">
                                  {flight.airline_logo ? (
                                    <img src={flight.airline_logo} alt="" className="h-14 w-14 rounded-xl object-contain bg-white p-1 shadow" />
                                  ) : (
                                    <div className="h-14 w-14 bg-blue-200 rounded-xl flex items-center justify-center">
                                      <Plane className="h-7 w-7 text-blue-600" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-lg text-slate-800">{flight.airline_name}</p>
                                    <p className="text-sm text-blue-600 font-medium">
                                      {flight.departure_date && format(parseISO(flight.departure_date), 'EEEE d MMMM yyyy', { locale: ar })}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {flight.departure_time} • {flight.departure_city} ← {flight.arrival_city}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-left">
                                    <p className="text-sm text-slate-500">السعر {flight.trip_type === 'round_trip' ? '(ذهاب + إياب)' : ''}</p>
                                    <p className="text-2xl font-black text-green-600">${flight.display_price || flight.total_price}</p>
                                  </div>
                                  <Button 
                                    onClick={() => handleSelectFlight(flight)}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                                  >
                                    احجز الآن
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* بحث إضافي - بدون ذكر مصادر خارجية */}
                      <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 text-center">
                        <Search className="h-10 w-10 mx-auto text-blue-500 mb-3" />
                        <h4 className="font-bold text-blue-800 mb-2">البحث المتقدم</h4>
                        <p className="text-sm text-blue-600 mb-4">
                          نبحث لك عن المزيد من الخيارات المتاحة
                        </p>
                        <Button 
                          onClick={searchExternalFlights} 
                          disabled={searchingExternal}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                        >
                          {searchingExternal ? (
                            <>
                              <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                              جاري البحث...
                            </>
                          ) : (
                            <>
                              <Search className="h-5 w-5 ml-2" />
                              بحث عن رحلات إضافية
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Results List */}
              <div className="space-y-4">
                <AnimatePresence>
                  {!loading && filteredResults.map((flight, index) => (
                    <PremiumFlightCard
                      key={flight.id}
                      flight={flight}
                      passengers={searchParams.passengers}
                      onSelect={handleSelectFlight}
                      index={index}
                      isExternal={flight.is_external}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ModernFooter />
    </div>
  );
}