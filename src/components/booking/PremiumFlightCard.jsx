import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Plane, Clock, Briefcase, ChevronLeft, Globe, Sparkles,
  ArrowLeftRight, MapPin, Calendar, Users, CheckCircle
} from 'lucide-react';

export default function PremiumFlightCard({ 
  flight, 
  passengers = 1, 
  onSelect, 
  index = 0,
  isExternal = false 
}) {
  const getClassLabel = (seatClass) => {
    const classes = { 
      economy: 'اقتصادية', 
      business: 'رجال أعمال', 
      first: 'الدرجة الأولى' 
    };
    return classes[seatClass] || 'اقتصادية';
  };

  const getTripTypeLabel = (tripType) => {
    return tripType === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط';
  };

  const getStopsLabel = (stops) => {
    if (!stops || stops === 0) return 'مباشر';
    if (stops === 1) return 'توقف واحد';
    return `${stops} توقفات`;
  };

  const formatTimeAMPM = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const isExternalFlight = isExternal || flight.is_external;
  
  // السعر الإجمالي الواحد (كما تفعل شركات الطيران - العميل لا يرى تفكيك السعر)
  // استخدام display_price إذا كان متاحاً (يحتوي على السعر الصحيح للذهاب فقط أو الذهاب والعودة)
  const pricePerPerson = flight.display_price || flight.total_price || flight.price_per_person || 0;
  const totalPrice = pricePerPerson * passengers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="relative"
    >
      <Card className={`overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ${
        isExternalFlight 
          ? 'bg-gradient-to-br from-white to-purple-50 ring-2 ring-purple-200' 
          : 'bg-white'
      }`}>
        {/* بطاقة الرحلة الإضافية - بدون ذكر المصدر للعميل */}
        {isExternalFlight && (
          <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-4 py-1.5 rounded-br-xl flex items-center gap-1.5">
            <Plane className="h-3.5 w-3.5" />
            <span className="font-medium">رحلة متاحة</span>
          </div>
        )}

        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row">
            {/* Airline Info */}
            <div className="p-6 lg:w-56 border-b lg:border-b-0 lg:border-l border-slate-100 flex items-center gap-4 bg-gradient-to-br from-slate-50 to-white">
              <div className="relative">
                {flight.airline_logo ? (
                  <img 
                    src={flight.airline_logo} 
                    alt={flight.airline_name} 
                    className="h-16 w-16 rounded-2xl object-contain bg-white shadow-md p-2"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <Plane className="h-8 w-8 text-white" />
                  </div>
                )}
                {isExternalFlight && (
                  <div className="absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-1">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{flight.airline_name}</h3>
                <p className="text-sm text-slate-500 font-mono">{flight.flight_number}</p>
                {flight.duration && (
                  <p className="text-xs text-slate-400 mt-1">{flight.duration}</p>
                )}
              </div>
            </div>

            {/* Flight Details */}
            <div className="flex-1 p-6">
              <div className="flex items-center justify-between">
                {/* Departure */}
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="p-2 bg-green-100 rounded-full"
                    >
                      <Plane className="h-5 w-5 text-green-600 rotate-[-45deg]" />
                    </motion.div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {flight.departure_time_formatted || formatTimeAMPM(flight.departure_time) || '00:00'}
                  </p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">
                    {flight.departure_city || flight.departure_airport_code}
                  </p>
                  <p className="text-sm text-slate-400">
                    {flight.departure_airport_code || flight.departure_airport}
                  </p>
                </div>

                {/* Flight Path */}
                <div className="flex-1 px-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-full h-0.5 bg-gradient-to-r from-green-300 via-blue-300 to-red-300 rounded-full" />
                    
                    <div className="relative flex items-center justify-center w-full">
                      {/* Stops indicator */}
                      {(flight.stops > 0) && (
                        <div className="absolute flex items-center justify-center w-full">
                          {Array.from({ length: Math.min(flight.stops, 3) }).map((_, i) => (
                            <div 
                              key={i} 
                              className="w-2 h-2 bg-amber-400 rounded-full mx-1 shadow-sm"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Animated Plane */}
                      <motion.div
                        animate={{ x: [-30, 30, -30] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="relative z-10 bg-white p-2 rounded-full shadow-lg"
                      >
                        <Plane className="h-5 w-5 text-blue-600 rotate-[-90deg]" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="text-center mt-3">
                    <Badge variant="outline" className="bg-white">
                      {getStopsLabel(flight.stops)}
                    </Badge>
                  </div>
                </div>

                {/* Arrival */}
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <motion.div
                      animate={{ y: [0, 3, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="p-2 bg-red-100 rounded-full"
                    >
                      <Plane className="h-5 w-5 text-red-600 rotate-[135deg]" />
                    </motion.div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {flight.arrival_time_formatted || formatTimeAMPM(flight.arrival_time) || '00:00'}
                  </p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">
                    {flight.arrival_city || flight.arrival_airport_code}
                  </p>
                  <p className="text-sm text-slate-400">
                    {flight.arrival_airport_code || flight.arrival_airport}
                  </p>
                </div>
              </div>

              {/* Details Row */}
              <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-slate-100">
                {flight.departure_date && (
                  <Badge variant="outline" className="flex items-center gap-1.5 bg-white">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(parseISO(flight.departure_date), 'd MMM yyyy', { locale: ar })}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1.5 bg-white">
                  <Briefcase className="h-3.5 w-3.5" />
                  {getClassLabel(flight.seat_class)}
                </Badge>
                {flight.trip_type && (
                  <Badge variant="outline" className="flex items-center gap-1.5 bg-white">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {getTripTypeLabel(flight.trip_type)}
                  </Badge>
                )}
                {flight.baggage_allowance && (
                  <Badge variant="outline" className="flex items-center gap-1.5 bg-white">
                    <Briefcase className="h-3.5 w-3.5" />
                    {flight.baggage_allowance}
                  </Badge>
                )}
                {passengers > 1 && (
                  <Badge variant="outline" className="flex items-center gap-1.5 bg-white">
                    <Users className="h-3.5 w-3.5" />
                    {passengers} مسافر
                  </Badge>
                )}
              </div>

              {/* Return Flight - عرض كامل لتفاصيل رحلة العودة */}
              {flight.trip_type === 'round_trip' && flight.return_date && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-blue-800">رحلة العودة</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-slate-700">
                        {format(parseISO(flight.return_date), 'd MMMM yyyy', { locale: ar })}
                      </span>
                    </div>
                    {flight.return_departure_time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-slate-600">
                          {formatTimeAMPM(flight.return_departure_time)}
                        </span>
                      </div>
                    )}
                    {flight.return_flight_number && (
                      <div className="flex items-center gap-1.5">
                        <Plane className="h-4 w-4 text-blue-500" />
                        <span className="font-mono text-slate-600">{flight.return_flight_number}</span>
                      </div>
                    )}
                  </div>
                  {/* المسار العكسي */}
                  <div className="mt-2 text-xs text-slate-500">
                    {flight.arrival_city || flight.arrival_airport_code} ← {flight.departure_city || flight.departure_airport_code}
                  </div>
                </div>
              )}
              
              {/* رحلة العودة المرتبطة من قاعدة البيانات الداخلية */}
              {flight.return_flight && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowLeftRight className="h-5 w-5 text-green-600" />
                    <span className="font-bold text-green-800">رحلة العودة المضمنة</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-slate-700">
                        {flight.return_flight.departure_date && format(parseISO(flight.return_flight.departure_date), 'd MMMM yyyy', { locale: ar })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-green-500" />
                      <span className="text-slate-600">
                        {formatTimeAMPM(flight.return_flight.departure_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Plane className="h-4 w-4 text-green-500" />
                      <span className="font-mono text-slate-600">{flight.return_flight.flight_number}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price & Action */}
            <div className="p-6 lg:w-64 border-t lg:border-t-0 lg:border-r border-slate-100 flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
              {/* نوع التذكرة */}
              <div className="mb-2 text-center">
                <Badge className={flight.trip_type === 'round_trip' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                  {flight.trip_type === 'round_trip' ? 'ذهاب وعودة' : 'ذهاب فقط'}
                </Badge>
                {flight.is_partial_from_round_trip && (
                  <p className="text-xs text-amber-600 mt-1">ذهاب منفصل من تذكرة ذهاب وعودة</p>
                )}
              </div>
              
              {/* السعر الإجمالي الواحد - كما تعرضه شركات الطيران */}
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-1">
                  {flight.trip_type === 'round_trip' ? 'السعر (ذهاب + إياب)' : 'السعر'}
                </p>
                <p className="text-4xl font-bold text-green-600">
                  ${totalPrice}
                </p>
                {passengers > 1 && (
                  <p className="text-sm text-slate-500">
                    ${pricePerPerson} للشخص
                  </p>
                )}
              </div>
              
              {/* Available Seats */}
              {flight.available_count && !isExternalFlight && (
                <div className="flex items-center gap-1 mt-2 text-sm text-amber-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>متبقي {flight.available_count - (flight.booked_count || 0)} مقعد</span>
                </div>
              )}

              <Button 
                onClick={() => onSelect(flight)}
                className={`mt-4 w-full h-12 text-lg font-bold shadow-lg ${
                  isExternalFlight 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700' 
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                }`}
              >
                احجز الآن
                <ChevronLeft className="h-5 w-5 mr-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}