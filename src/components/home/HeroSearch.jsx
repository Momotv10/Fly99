import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, Plane, Users, Search, ArrowLeftRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function HeroSearch() {
  const navigate = useNavigate();
  const [tripType, setTripType] = useState("round_trip");
  const [departureAirport, setDepartureAirport] = useState(null);
  const [arrivalAirport, setArrivalAirport] = useState(null);
  const [departureDate, setDepartureDate] = useState(null);
  const [returnDate, setReturnDate] = useState(null);
  const [passengers, setPassengers] = useState(1);
  const [airports, setAirports] = useState([]);
  const [openDeparture, setOpenDeparture] = useState(false);
  const [openArrival, setOpenArrival] = useState(false);

  useEffect(() => {
    loadAirports();
  }, []);

  const loadAirports = async () => {
    const data = await base44.entities.Airport.list();
    setAirports(data.filter(a => a.is_active !== false));
  };

  const handleSearch = () => {
    if (!departureAirport || !arrivalAirport || !departureDate) {
      return;
    }
    
    const searchParams = new URLSearchParams({
      from: departureAirport.id,
      to: arrivalAirport.id,
      departure: format(departureDate, 'yyyy-MM-dd'),
      return: returnDate ? format(returnDate, 'yyyy-MM-dd') : '',
      passengers: passengers.toString(),
      type: tripType
    });
    
    navigate(createPageUrl('SearchResults') + '?' + searchParams.toString());
  };

  const swapAirports = () => {
    const temp = departureAirport;
    setDepartureAirport(arrivalAirport);
    setArrivalAirport(temp);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-20 lg:py-32">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
            احجز رحلتك بسهولة
          </h1>
          <p className="text-lg md:text-xl text-blue-200 max-w-2xl mx-auto">
            اكتشف أفضل العروض على تذاكر الطيران إلى جميع أنحاء العالم
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 max-w-5xl mx-auto">
          {/* Trip Type */}
          <div className="mb-6">
            <RadioGroup
              value={tripType}
              onValueChange={setTripType}
              className="flex gap-6"
              dir="rtl"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="round_trip" id="round" />
                <Label htmlFor="round" className="cursor-pointer font-medium">ذهاب وعودة</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="one_way" id="one" />
                <Label htmlFor="one" className="cursor-pointer font-medium">ذهاب فقط</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Departure Airport */}
            <div className="lg:col-span-1">
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">من</Label>
              <Popover open={openDeparture} onOpenChange={setOpenDeparture}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right h-14 border-slate-200 hover:border-blue-400 transition-colors"
                  >
                    <MapPin className="ml-2 h-5 w-5 text-blue-600" />
                    <span className={cn("truncate", !departureAirport && "text-slate-400")}>
                      {departureAirport ? `${departureAirport.city} (${departureAirport.code})` : "اختر المطار"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command dir="rtl">
                    <CommandInput placeholder="ابحث عن مطار..." />
                    <CommandList>
                      <CommandEmpty>لا توجد نتائج</CommandEmpty>
                      <CommandGroup>
                        {airports.map((airport) => (
                          <CommandItem
                            key={airport.id}
                            onSelect={() => {
                              setDepartureAirport(airport);
                              setOpenDeparture(false);
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Plane className="h-4 w-4 text-slate-400" />
                            <div>
                              <div className="font-medium">{airport.city}</div>
                              <div className="text-sm text-slate-500">{airport.name} ({airport.code})</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Swap Button (Desktop) */}
            <div className="hidden lg:flex items-end pb-2 justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={swapAirports}
                className="rounded-full hover:bg-blue-50 transition-colors"
              >
                <ArrowLeftRight className="h-5 w-5 text-blue-600" />
              </Button>
            </div>

            {/* Arrival Airport */}
            <div className="lg:col-span-1">
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">إلى</Label>
              <Popover open={openArrival} onOpenChange={setOpenArrival}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right h-14 border-slate-200 hover:border-blue-400 transition-colors"
                  >
                    <MapPin className="ml-2 h-5 w-5 text-blue-600" />
                    <span className={cn("truncate", !arrivalAirport && "text-slate-400")}>
                      {arrivalAirport ? `${arrivalAirport.city} (${arrivalAirport.code})` : "اختر المطار"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command dir="rtl">
                    <CommandInput placeholder="ابحث عن مطار..." />
                    <CommandList>
                      <CommandEmpty>لا توجد نتائج</CommandEmpty>
                      <CommandGroup>
                        {airports.filter(a => a.id !== departureAirport?.id).map((airport) => (
                          <CommandItem
                            key={airport.id}
                            onSelect={() => {
                              setArrivalAirport(airport);
                              setOpenArrival(false);
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Plane className="h-4 w-4 text-slate-400" />
                            <div>
                              <div className="font-medium">{airport.city}</div>
                              <div className="text-sm text-slate-500">{airport.name} ({airport.code})</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Departure Date */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">تاريخ المغادرة</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right h-14 border-slate-200 hover:border-blue-400 transition-colors"
                  >
                    <CalendarIcon className="ml-2 h-5 w-5 text-blue-600" />
                    <span className={cn(!departureDate && "text-slate-400")}>
                      {departureDate ? format(departureDate, 'dd MMM yyyy', { locale: ar }) : "اختر التاريخ"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={setDepartureDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Return Date */}
            {tripType === "round_trip" && (
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">تاريخ العودة</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-right h-14 border-slate-200 hover:border-blue-400 transition-colors"
                    >
                      <CalendarIcon className="ml-2 h-5 w-5 text-blue-600" />
                      <span className={cn(!returnDate && "text-slate-400")}>
                        {returnDate ? format(returnDate, 'dd MMM yyyy', { locale: ar }) : "اختر التاريخ"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={returnDate}
                      onSelect={setReturnDate}
                      disabled={(date) => date < (departureDate || new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Passengers & Search */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6 items-end">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">عدد المسافرين</Label>
              <div className="flex items-center gap-3 h-14 px-4 border border-slate-200 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPassengers(Math.max(1, passengers - 1))}
                  className="h-8 w-8 rounded-full"
                >
                  -
                </Button>
                <span className="font-semibold text-lg w-8 text-center">{passengers}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPassengers(Math.min(9, passengers + 1))}
                  className="h-8 w-8 rounded-full"
                >
                  +
                </Button>
              </div>
            </div>
            
            <Button
              onClick={handleSearch}
              className="h-14 px-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-300"
              disabled={!departureAirport || !arrivalAirport || !departureDate}
            >
              <Search className="ml-2 h-5 w-5" />
              بحث عن رحلات
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}