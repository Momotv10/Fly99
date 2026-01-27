/**
 * نظام الربط التلقائي لأزواج الرحلات
 * Auto Flight Pairing System
 * 
 * يربط رحلات الذهاب والإياب تلقائياً عند إدخالها
 */

import { base44 } from '@/api/base44Client';

export const autoFlightPairing = {
  
  /**
   * البحث عن رحلات قابلة للربط
   * يستدعى تلقائياً عند إضافة رحلة جديدة
   */
  async findAndCreatePairs(newFlightId) {
    try {
      console.log('=== Auto Flight Pairing ===');
      console.log('Checking for pair opportunities for flight:', newFlightId);
      
      // جلب الرحلة الجديدة
      const newFlights = await base44.entities.Flight.filter({ id: newFlightId });
      if (newFlights.length === 0) return;
      
      const newFlight = newFlights[0];
      console.log('New flight:', newFlight.flight_number, newFlight.departure_airport_code, '->', newFlight.arrival_airport_code);
      
      // البحث عن رحلة العودة المحتملة (المسار المعاكس)
      const potentialReturnFlights = await base44.entities.Flight.filter({
        airline_id: newFlight.airline_id,
        departure_airport_code: newFlight.arrival_airport_code,
        arrival_airport_code: newFlight.departure_airport_code,
        is_active: true
      });
      
      console.log('Found potential return flights:', potentialReturnFlights.length);
      
      for (const returnFlight of potentialReturnFlights) {
        // التحقق من عدم وجود زوج مسبقاً
        const existingPairs = await base44.entities.FlightPair.filter({
          outbound_flight_id: newFlight.id,
          return_flight_id: returnFlight.id
        });
        
        if (existingPairs.length > 0) {
          console.log('Pair already exists');
          continue;
        }
        
        // إنشاء الزوج تلقائياً
        await this.createFlightPair(newFlight, returnFlight);
      }
      
      // التحقق أيضاً إذا كانت الرحلة الجديدة هي رحلة عودة لرحلات موجودة
      const potentialOutboundFlights = await base44.entities.Flight.filter({
        airline_id: newFlight.airline_id,
        departure_airport_code: newFlight.arrival_airport_code,
        arrival_airport_code: newFlight.departure_airport_code,
        is_active: true
      });
      
      for (const outboundFlight of potentialOutboundFlights) {
        if (outboundFlight.id === newFlight.id) continue;
        
        const existingPairs = await base44.entities.FlightPair.filter({
          outbound_flight_id: outboundFlight.id,
          return_flight_id: newFlight.id
        });
        
        if (existingPairs.length === 0) {
          await this.createFlightPair(outboundFlight, newFlight);
        }
      }
      
    } catch (error) {
      console.error('Error in auto flight pairing:', error);
    }
  },
  
  /**
   * إنشاء زوج رحلة
   */
  async createFlightPair(outboundFlight, returnFlight) {
    try {
      // حساب أيام التشغيل المشتركة
      const outboundDays = outboundFlight.days_of_week || [];
      const returnDays = returnFlight.days_of_week || [];
      
      // الأيام المشتركة للتشغيل
      const commonDays = outboundDays.filter(day => returnDays.includes(day));
      
      if (commonDays.length === 0 && outboundDays.length > 0 && returnDays.length > 0) {
        console.log('No common operating days');
        return null;
      }
      
      const pairData = {
        outbound_flight_id: outboundFlight.id,
        outbound_flight_number: outboundFlight.flight_number,
        return_flight_id: returnFlight.id,
        return_flight_number: returnFlight.flight_number,
        airline_id: outboundFlight.airline_id,
        airline_name: outboundFlight.airline_name,
        departure_airport_code: outboundFlight.departure_airport_code,
        arrival_airport_code: outboundFlight.arrival_airport_code,
        days_of_week: commonDays.length > 0 ? commonDays : outboundDays,
        outbound_departure_time: outboundFlight.departure_time,
        return_departure_time: returnFlight.departure_time,
        is_same_day: this.checkIfSameDay(outboundFlight, returnFlight),
        is_active: true
      };
      
      const pair = await base44.entities.FlightPair.create(pairData);
      console.log('✅ Created flight pair:', outboundFlight.flight_number, '<->', returnFlight.flight_number);
      
      // ربط الرحلات ببعضها
      await base44.entities.Flight.update(outboundFlight.id, {
        return_flight_id: returnFlight.id,
        return_flight_number: returnFlight.flight_number
      });
      
      await base44.entities.Flight.update(returnFlight.id, {
        return_flight_id: outboundFlight.id,
        return_flight_number: outboundFlight.flight_number
      });
      
      return pair;
    } catch (error) {
      console.error('Error creating flight pair:', error);
      return null;
    }
  },
  
  /**
   * التحقق من إمكانية ذهاب وعودة في نفس اليوم
   */
  checkIfSameDay(outboundFlight, returnFlight) {
    try {
      const outboundTime = outboundFlight.departure_time;
      const returnTime = returnFlight.departure_time;
      
      if (!outboundTime || !returnTime) return false;
      
      const [outH] = outboundTime.split(':').map(Number);
      const [retH] = returnTime.split(':').map(Number);
      
      // إذا كانت رحلة الذهاب صباحاً والعودة مساءً في نفس اليوم
      return outH < 12 && retH >= 12;
    } catch {
      return false;
    }
  }
};

export default autoFlightPairing;