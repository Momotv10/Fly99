import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import PremiumFlightCard from '@/components/booking/PremiumFlightCard';
import { externalProviderAI } from '@/components/ai/ExternalProviderAI';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Search, Plane, Calendar as CalendarIcon, Users, ArrowLeftRight,
  MapPin, RefreshCw, Sparkles, Globe, Filter, SlidersHorizontal,
  X, ChevronDown, Minus, Plus, CheckCircle, Loader2, TrendingUp
} from 'lucide-react';

export default function AgentSearch() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchingExternal, setSearchingExternal] = useState(false);
  const [airports, setAirports] = useState([]);
  const [results, setResults] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [suggestedFlights, setSuggestedFlights] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // البحث
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

  const [filters, setFilters] = useState({
    priceRange: [0, 3000],
    airlines: [],
    sortBy: 'price',
    showExternal: true
  });

  const fromRef = useRef(null);
  const toRef = useRef(null);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadData(user.related_entity_id);
  }, []);

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

  useEffect(() => {
    applyFilters();
  }, [results, externalResults, filters]);

  const loadData = async (agentId) => {
    try {
      const [agentData, airportsData] = await Promise.all([
        base44.entities.Agent.filter({ id: agentId }),
        base44.entities.Airport.filter({ is_active: true }, 'name_ar', 500)
      ]);
      
      if (agentData.length > 0) setAgent(agentData[0]);
      setAirports(airportsData);
      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const smartSearch = (text, searchTerm) => {
    if (!text || !searchTerm) return false;
    const normalize = (str) => str.toLowerCase()
      .replace(/[أإآا]/g, 'ا').replace(/[ةه]/g, 'ه').replace(/[يى]/g, 'ي')
      .replace(/\s+/g, ' ').trim();
    
    const normalizedText = normalize(text);
    const normalizedSearch = normalize(searchTerm);
    
    if (normalizedText.includes(normalizedSearch)) return { match: true, score: 100 };
    if (normalizedText.startsWith(normalizedSearch)) return { match: true, score: 95 };
    
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
    
    return airports
      .filter(a => a.id !== excludeId)
      .map(airport => {
        const scores = [
          smartSearch(airport.name_ar, searchTerm),
          smartSearch(airport.name_en, searchTerm),
          smartSearch(airport.city_ar, searchTerm),
          smartSearch(airport.city_en, searchTerm),
          smartSearch(airport.country_ar, searchTerm),
          smartSearch(airport.iata_code, searchTerm)
        ];
        return { airport, score: Math.max(...scores.map(s => s.score)) };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(r => r.airport);
  };

  const handleSearch = async () => {
    if (!fromAirport || !toAirport) {
      toast.error('يرجى تحديد مطار المغادرة والوصول');
      return;
    }

    setSearching(true);
    setResults([]);
    setExternalResults([]);
    setSuggestedFlights([]);

    try {
      const formattedDate = format(departureDate, 'yyyy-MM-dd');
      
      // البحث في المقاعد المتاحة
      let allSeats = await base44.entities.AvailableSeat.filter({
        departure_airport_code: fromAirport.iata_code,
        arrival_airport_code: toAirport.iata_code,
        status: 'active'
      }, 'departure_date', 100);

      // فلترة حسب التاريخ
      allSeats = allSeats.filter(s => s.departure_date >= formattedDate);

      // فلترة المقاعد المتاحة
      let availableSeats = allSeats.filter(s => 
        (s.available_count - (s.booked_count || 0)) >= passengers
      );

      // فلترة حسب الدرجة أو عرض البديل
      let finalSeats = availableSeats.filter(s => s.seat_class === seatClass);
      
      if (finalSeats.length === 0 && availableSeats.length > 0) {
        const classOrder = { 'economy': 1, 'business': 2, 'first': 3 };
        finalSeats = availableSeats.sort((a, b) => 
          (classOrder[a.seat_class] || 1) - (classOrder[b.seat_class] || 1)
        ).map(s => ({
          ...s,
          is_alternative_class: s.seat_class !== seatClass,
          requested_class: seatClass
        }));
      }

      setResults(finalSeats);
      setSearching(false);

      // البحث في المزود الخارجي
      searchExternalFlights();

      // اقتراح أقرب رحلة
      if (finalSeats.length === 0) {
        const allAvailable = await base44.entities.AvailableSeat.filter({
          departure_airport_code: fromAirport.iata_code,
          arrival_airport_code: toAirport.iata_code,
          status: 'active'
        }, 'departure_date', 10);
        
        setSuggestedFlights(allAvailable.filter(s => 
          (s.available_count - (s.booked_count || 0)) >= passengers
        ));
      }

    } catch (error) {
      toast.error('فشل البحث');
      setSearching(false);
      searchExternalFlights();
    }
  };

  const searchExternalFlights = async () => {
    if (!fromAirport || !toAirport) return;
    
    setSearchingExternal(true);
    
    try {
      const result = await externalProviderAI.searchExternalFlights({
        from: fromAirport.iata_code,
        to: toAirport.iata_code,
        departureDate: format(departureDate, 'yyyy-MM-dd'),
        returnDate: tripType === 'round_trip' ? format(returnDate, 'yyyy-MM-dd') : null,
        passengers,
        seatClass,
        tripType
      });

      if (result.success && result.flights) {
        setExternalResults(result.flights);
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

    allResults = allResults.filter(s => {
      const price = s.total_price || s.price_per_person || 0;
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });

    if (filters.airlines.length > 0) {
      allResults = allResults.filter(s => filters.airlines.includes(s.airline_name));
    }

    if (filters.sortBy === 'price') {
      allResults.sort((a, b) => (a.total_price || a.price_per_person || 0) - (b.total_price || b.price_per_person || 0));
    } else if (filters.sortBy === 'time') {
      allResults.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
    }

    setFilteredResults(allResults);
  };

  const handleSelectFlight = (flight) => {
    const isExternal = flight.is_external;
    const totalPrice = (flight.total_price || flight.price_per_person) * passengers;
    
    if ((agent?.balance || 0) < totalPrice) {
      toast.error(`رصيدك غير كافٍ! المطلوب: $${totalPrice} - المتاح: $${agent?.balance || 0}`);
      return;
    }

    if (isExternal) {
      const flightData = encodeURIComponent(JSON.stringify(flight));
      navigate(createPageUrl('AgentBooking') + `?external_flight=${flightData}&passengers=${passengers}`);
    } else {
      navigate(createPageUrl('AgentBooking') + `?seat_id=${flight.id}&passengers=${passengers}`);
    }
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

  const allAirlines = [...new Set([
    ...results.map(s => s.airline_name).filter(Boolean),
    ...externalResults.map(s => s.airline_name).filter(Boolean)
  ])];

  const AirportItem = ({ airport, onSelect, variant = 'from' }) => (
    <button
      onClick={() => onSelect(airport)}
      className="w-full p-3 text-right hover:bg-blue-50 flex items-center gap-3 transition-colors border-b border-slate-100 last:border-0"
    >
      <div className={`p-2 rounded-xl ${variant === 'from' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
        <Plane className={`h-4 w-4 ${variant === 'to' ? 'rotate-[135deg]' : 'rotate-[-45deg]'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">{airport.city_ar || airport.city_en}</p>
        <p className="text-xs text-slate-500 truncate">{airport.name_ar || airport.name_en}</p>
      </div>
      <Badge variant="outline" className="font-mono">{airport.iata_code}</Badge>
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* عنوان الصفحة */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">البحث عن رحلات</h1>
          <p className="text-slate-600">ابحث واحجز تذاكر الطيران لعملائك</p>
          {agent && (
            <Badge className="mt-2 bg-green-100 text-green-700">
              رصيدك: ${agent.balance || 0}
            </Badge>
          )}
        </div>

        {/* نموذج البحث المطور */}
        <Card className="mb-6 shadow-xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b">
            <div className="flex gap-3">
              <Button
                variant={tripType === 'round_trip' ? 'default' : 'outline'}
                onClick={() => setTripType('round_trip')}
                className={tripType === 'round_trip' ? 'bg-blue-600' : ''}
              >
                <ArrowLeftRight className="h-4 w-4 ml-2" />
                ذهاب وإياب
              </Button>
              <Button
                variant={tripType === 'one_way' ? 'default' : 'outline'}
                onClick={() => setTripType('one_way')}
                className={tripType === 'one_way' ? 'bg-blue-600' : ''}
              >
                <Plane className="h-4 w-4 ml-2 rotate-[-45deg]" />
                ذهاب فقط
              </Button>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* مطار المغادرة */}
              <div className="lg:col-span-3 relative" ref={fromRef}>
                <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">المغادرة من</Label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-green-100 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600" />
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
                    className="h-12 pr-12 bg-slate-50 border-slate-200 rounded-xl"
                  />
                  {fromAirport && (
                    <button onClick={() => { setFromAirport(null); setFromSearch(''); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
                
                <AnimatePresence>
                  {showFromDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border max-h-72 overflow-auto"
                    >
                      {filterAirports(fromSearch, toAirport?.id).map((airport) => (
                        <AirportItem key={airport.id} airport={airport} onSelect={selectFromAirport} variant="from" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* زر التبديل */}
              <div className="lg:col-span-1 flex items-end justify-center pb-1">
                <Button variant="outline" size="icon" onClick={swapAirports} className="rounded-full">
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              {/* مطار الوصول */}
              <div className="lg:col-span-3 relative" ref={toRef}>
                <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">الوصول إلى</Label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-red-100 rounded-lg">
                    <MapPin className="h-4 w-4 text-red-600" />
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
                    className="h-12 pr-12 bg-slate-50 border-slate-200 rounded-xl"
                  />
                  {toAirport && (
                    <button onClick={() => { setToAirport(null); setToSearch(''); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
                
                <AnimatePresence>
                  {showToDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border max-h-72 overflow-auto"
                    >
                      {filterAirports(toSearch, fromAirport?.id).map((airport) => (
                        <AirportItem key={airport.id} airport={airport} onSelect={selectToAirport} variant="to" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* تاريخ المغادرة */}
              <div className="lg:col-span-2">
                <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">تاريخ المغادرة</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 justify-start bg-slate-50 border-slate-200 rounded-xl">
                      <CalendarIcon className="h-4 w-4 ml-2 text-blue-600" />
                      <span>{format(departureDate, 'd MMM', { locale: ar })}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={(date) => {
                        setDepartureDate(date);
                        if (date >= returnDate) setReturnDate(addDays(date, 7));
                      }}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* تاريخ العودة */}
              {tripType === 'round_trip' && (
                <div className="lg:col-span-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">تاريخ العودة</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-12 justify-start bg-slate-50 border-slate-200 rounded-xl">
                        <CalendarIcon className="h-4 w-4 ml-2 text-purple-600" />
                        <span>{format(returnDate, 'd MMM', { locale: ar })}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={returnDate}
                        onSelect={setReturnDate}
                        disabled={(date) => date <= departureDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* المسافرون والدرجة */}
              <div className={tripType === 'one_way' ? 'lg:col-span-3' : 'lg:col-span-1'}>
                <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">المسافرون</Label>
                <Popover open={showPassengersPopup} onOpenChange={setShowPassengersPopup}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 justify-start bg-slate-50 border-slate-200 rounded-xl">
                      <Users className="h-4 w-4 ml-2 text-amber-600" />
                      <span>{passengers}</span>
                      <ChevronDown className="h-3 w-3 mr-auto text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-bold mb-3 block">عدد المسافرين</Label>
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                          <Button variant="outline" size="icon" onClick={() => setPassengers(Math.max(1, passengers - 1))} disabled={passengers <= 1}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-2xl font-black">{passengers}</span>
                          <Button variant="outline" size="icon" onClick={() => setPassengers(Math.min(9, passengers + 1))} disabled={passengers >= 9}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold mb-3 block">درجة السفر</Label>
                        <div className="space-y-2">
                          {classOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setSeatClass(option.value)}
                              className={`w-full p-3 rounded-xl text-right flex items-center gap-3 transition-all ${
                                seatClass === option.value
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <span>{option.icon}</span>
                              <span className="font-medium">{option.label}</span>
                              {seatClass === option.value && <CheckCircle className="h-4 w-4 mr-auto" />}
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
            <Button 
              onClick={handleSearch}
              disabled={!fromAirport || !toAirport || searching}
              className="w-full h-14 mt-6 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl"
              style={{ backgroundColor: agent?.brand_color }}
            >
              {searching ? (
                <>
                  <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                  جاري البحث...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 ml-2" />
                  بحث عن الرحلات
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* النتائج */}
        {(results.length > 0 || externalResults.length > 0 || searchingExternal) && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* الفلاتر */}
            <div className={`lg:w-72 ${showFilters ? 'block' : 'hidden lg:block'}`}>
              <Card className="sticky top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <SlidersHorizontal className="h-5 w-5" />
                    الفلاتر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">نطاق السعر</Label>
                    <Slider
                      value={filters.priceRange}
                      onValueChange={(v) => setFilters({ ...filters, priceRange: v })}
                      max={3000}
                      step={50}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>${filters.priceRange[0]}</span>
                      <span>${filters.priceRange[1]}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.showExternal}
                        onCheckedChange={(checked) => setFilters({ ...filters, showExternal: checked })}
                      />
                      <div>
                        <p className="font-semibold text-purple-700 flex items-center gap-1">
                          <Sparkles className="h-4 w-4" />
                          البحث الخارجي
                        </p>
                        <p className="text-xs text-purple-600">Skyscanner, Kayak...</p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">ترتيب حسب</Label>
                    <Select value={filters.sortBy} onValueChange={(v) => setFilters({ ...filters, sortBy: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">السعر (الأقل)</SelectItem>
                        <SelectItem value="time">وقت المغادرة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* قائمة النتائج */}
            <div className="flex-1">
              <div className="lg:hidden mb-4">
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="w-full">
                  <Filter className="h-4 w-4 ml-2" />
                  {showFilters ? 'إخفاء الفلاتر' : 'عرض الفلاتر'}
                </Button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-600">{filteredResults.length} رحلة متاحة</p>
                {externalResults.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-700">
                    <Globe className="h-3 w-3 ml-1" />
                    {externalResults.length} خارجي
                  </Badge>
                )}
              </div>

              {searchingExternal && (
                <Card className="mb-4 bg-purple-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto mb-2" />
                    <p className="text-purple-700 font-medium">جاري البحث في مواقع خارجية...</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {filteredResults.map((flight, index) => (
                  <PremiumFlightCard
                    key={flight.id}
                    flight={flight}
                    passengers={passengers}
                    onSelect={handleSelectFlight}
                    index={index}
                    isExternal={flight.is_external}
                  />
                ))}
              </div>

              {/* لا توجد نتائج */}
              {!searching && !searchingExternal && filteredResults.length === 0 && fromAirport && toAirport && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Plane className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد رحلات متاحة</h3>
                    
                    {suggestedFlights.length > 0 && (
                      <div className="mt-6 text-right">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          <h4 className="font-bold">أقرب رحلة متاحة:</h4>
                        </div>
                        {suggestedFlights.slice(0, 2).map((flight) => (
                          <div key={flight.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl mb-2">
                            <div>
                              <p className="font-semibold">{flight.airline_name}</p>
                              <p className="text-sm text-slate-600">
                                {flight.departure_date && format(parseISO(flight.departure_date), 'd MMM yyyy', { locale: ar })}
                              </p>
                            </div>
                            <Button onClick={() => handleSelectFlight(flight)}>
                              احجز - ${flight.total_price}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}