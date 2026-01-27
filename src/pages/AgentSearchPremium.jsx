import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import PremiumFlightCard from '@/components/booking/PremiumFlightCard';
import ModernHeroSearch from '@/components/home/ModernHeroSearch';
import { externalProviderAI } from '@/components/ai/ExternalProviderAI';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Plane, Sparkles, Globe } from 'lucide-react';

export default function AgentSearchPremium() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [searchParams, setSearchParams] = useState(null);

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadAgent(user.related_entity_id);
  }, []);

  const loadAgent = async (agentId) => {
    const agentData = await base44.entities.Agent.filter({ id: agentId });
    if (agentData.length > 0) setAgent(agentData[0]);
    setLoading(false);
  };

  const handleSearch = async (params) => {
    setSearching(true);
    setSearchParams(params);
    setResults([]);
    setExternalResults([]);

    // البحث الداخلي
    const internalFlights = await searchInternalFlights(params);
    setResults(internalFlights);

    // البحث الخارجي
    if (params.searchExternal) {
      const externalFlights = await searchExternalFlights(params);
      setExternalResults(externalFlights);
    }

    setSearching(false);
  };

  const searchInternalFlights = async (params) => {
    try {
      const seats = await base44.entities.AvailableSeat.filter({
        departure_airport_code: params.from.iata_code,
        arrival_airport_code: params.to.iata_code,
        status: 'active'
      });

      return seats.filter(s => 
        s.departure_date >= params.departureDate &&
        (s.available_count - (s.booked_count || 0)) >= params.passengers &&
        s.seat_class === params.seatClass
      );
    } catch {
      return [];
    }
  };

  const searchExternalFlights = async (params) => {
    try {
      const result = await externalProviderAI.searchExternalFlights({
        from: params.from.iata_code,
        to: params.to.iata_code,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
        passengers: params.passengers,
        seatClass: params.seatClass,
        tripType: params.tripType
      });

      return result.success && result.flights ? result.flights : [];
    } catch {
      return [];
    }
  };

  const handleSelectFlight = (flight) => {
    const passengers = searchParams?.passengers || 1;
    const totalPrice = (flight.total_price || flight.price_per_person) * passengers;
    
    if ((agent?.balance || 0) < totalPrice) {
      toast.error(`رصيدك غير كافٍ! المطلوب: $${totalPrice} - المتاح: $${agent?.balance || 0}`);
      return;
    }

    if (flight.is_external) {
      const flightData = encodeURIComponent(JSON.stringify({
        ...flight,
        agent_id: agent.id,
        agent_name: agent.name,
        booking_source: 'agent'
      }));
      navigate(createPageUrl('AgentBookingPremium') + `?external_flight=${flightData}&passengers=${passengers}`);
    } else {
      navigate(createPageUrl('AgentBookingPremium') + `?seat_id=${flight.id}&passengers=${passengers}`);
    }
  };

  const allResults = [...results, ...externalResults];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6">
        {/* رصيد الوكيل */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">بحث وحجز الرحلات</h1>
              <p className="text-slate-600">ابحث واحجز تذاكر الطيران لعملائك</p>
            </div>
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 border-0">
              <CardContent className="p-4">
                <p className="text-white text-sm mb-1">رصيدك المتاح</p>
                <p className="text-white text-2xl font-bold">${agent?.balance || 0}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* نموذج البحث */}
        <ModernHeroSearch 
          onSearch={handleSearch}
          hideTitle={true}
          defaultSearchExternal={true}
        />

        {/* النتائج */}
        {searching && (
          <Card className="mt-6">
            <CardContent className="p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-700">جاري البحث عن أفضل الرحلات...</p>
            </CardContent>
          </Card>
        )}

        {!searching && allResults.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-600">{allResults.length} رحلة متاحة</p>
              {externalResults.length > 0 && (
                <Badge className="bg-purple-100 text-purple-700">
                  <Globe className="h-3 w-3 ml-1" />
                  {externalResults.length} نتائج خارجية
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {allResults.map((flight, index) => (
                <PremiumFlightCard
                  key={flight.id || index}
                  flight={flight}
                  passengers={searchParams?.passengers || 1}
                  onSelect={handleSelectFlight}
                  index={index}
                  isExternal={flight.is_external}
                  showAgentInfo={true}
                  agentBalance={agent?.balance}
                />
              ))}
            </div>
          </div>
        )}

        {!searching && searchParams && allResults.length === 0 && (
          <Card className="mt-6 text-center py-12">
            <CardContent>
              <Plane className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد رحلات متاحة</h3>
              <p className="text-slate-500">جرب تغيير التواريخ أو المسار</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}