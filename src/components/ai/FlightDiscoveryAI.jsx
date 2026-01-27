import { base44 } from '@/api/base44Client';

/**
 * مكون الذكاء الاصطناعي لاكتشاف الرحلات
 * يراقب منصات التواصل الاجتماعي ومواقع شركات الطيران
 * لاكتشاف الرحلات الجديدة أو التغييرات في الجداول
 */

class FlightDiscoveryAI {
  constructor() {
    this.isRunning = false;
    this.discoveryInterval = null;
  }

  /**
   * تحليل منشور من منصات التواصل الاجتماعي
   */
  async analyzePost(airline, content, sourceUrl, sourcePlatform, imageUrl = null) {
    try {
      const prompt = `
      أنت مساعد ذكي متخصص في تحليل إعلانات شركات الطيران.
      
      شركة الطيران: ${airline.name_ar} (${airline.iata_code})
      مصدر المنشور: ${sourcePlatform}
      
      المحتوى:
      ${content}
      
      قم بتحليل هذا المنشور واستخرج المعلومات التالية إن وجدت:
      1. هل يتعلق برحلة جديدة؟
      2. هل هناك تغيير في جدول الرحلات؟
      3. هل هناك رحلة ملغية؟
      4. هل هناك رحلة إضافية؟
      
      استخرج تفاصيل الرحلة:
      - رقم الرحلة
      - مطار المغادرة
      - مطار الوصول
      - التاريخ/الأيام
      - الوقت
      `;

      const fileUrls = imageUrl ? [imageUrl] : undefined;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        file_urls: fileUrls,
        response_json_schema: {
          type: "object",
          properties: {
            is_flight_related: { type: "boolean" },
            discovery_type: { 
              type: "string",
              enum: ["new_flight", "schedule_change", "flight_cancelled", "additional_flight", "not_relevant"]
            },
            flight_details: {
              type: "object",
              properties: {
                flight_number: { type: "string" },
                departure_code: { type: "string" },
                departure_city: { type: "string" },
                arrival_code: { type: "string" },
                arrival_city: { type: "string" },
                departure_time: { type: "string" },
                arrival_time: { type: "string" },
                date: { type: "string" },
                days_of_week: { type: "array", items: { type: "number" } }
              }
            },
            confidence: { type: "number" },
            summary: { type: "string" }
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Error analyzing post:', error);
      return null;
    }
  }

  /**
   * إنشاء اكتشاف جديد وإشعار الإدارة
   */
  async createDiscovery(airline, analysisResult, sourceUrl, sourcePlatform, sourceContent, imageUrl = null) {
    if (!analysisResult.is_flight_related || analysisResult.discovery_type === 'not_relevant') {
      return null;
    }

    // التحقق من وجود الرحلة في النظام
    let existingFlightId = null;
    if (analysisResult.flight_details?.flight_number) {
      const existingFlights = await base44.entities.Flight.filter({
        airline_id: airline.id,
        flight_number: analysisResult.flight_details.flight_number
      });
      if (existingFlights.length > 0) {
        existingFlightId = existingFlights[0].id;
      }
    }

    // إنشاء سجل الاكتشاف
    const discovery = await base44.entities.AIFlightDiscovery.create({
      airline_id: airline.id,
      airline_name: airline.name_ar,
      discovery_type: analysisResult.discovery_type,
      source_platform: sourcePlatform,
      source_url: sourceUrl,
      source_content: sourceContent,
      source_image_url: imageUrl,
      discovered_flight_data: analysisResult.flight_details,
      existing_flight_id: existingFlightId,
      status: 'pending'
    });

    return discovery;
  }

  /**
   * معالجة اكتشاف معتمد من الإدارة
   */
  async processApprovedDiscovery(discoveryId) {
    const discoveries = await base44.entities.AIFlightDiscovery.filter({ id: discoveryId });
    if (discoveries.length === 0) return null;

    const discovery = discoveries[0];
    const flightData = discovery.discovered_flight_data;

    if (!flightData) return null;

    // جلب بيانات المطارات
    const airports = await base44.entities.Airport.filter({ is_active: true });
    const depAirport = airports.find(a => 
      a.iata_code?.toLowerCase() === flightData.departure_code?.toLowerCase()
    );
    const arrAirport = airports.find(a => 
      a.iata_code?.toLowerCase() === flightData.arrival_code?.toLowerCase()
    );

    // جلب بيانات شركة الطيران
    const airlines = await base44.entities.Airline.filter({ id: discovery.airline_id });
    const airline = airlines[0];

    switch (discovery.discovery_type) {
      case 'new_flight':
      case 'additional_flight':
        // إضافة رحلة جديدة
        if (depAirport && arrAirport) {
          await base44.entities.Flight.create({
            flight_number: flightData.flight_number,
            airline_id: discovery.airline_id,
            airline_name: airline?.name_ar,
            airline_logo: airline?.logo_url,
            departure_airport_id: depAirport.id,
            departure_airport_code: depAirport.iata_code,
            departure_airport_name: depAirport.name_ar,
            departure_city: depAirport.city_ar,
            departure_country: depAirport.country_ar,
            arrival_airport_id: arrAirport.id,
            arrival_airport_code: arrAirport.iata_code,
            arrival_airport_name: arrAirport.name_ar,
            arrival_city: arrAirport.city_ar,
            arrival_country: arrAirport.country_ar,
            departure_time: flightData.departure_time,
            arrival_time: flightData.arrival_time,
            days_of_week: flightData.days_of_week || [],
            source: 'ai_discovery',
            ai_discovery_source: discovery.source_url,
            is_active: true
          });
        }
        break;

      case 'schedule_change':
        // تحديث جدول الرحلة
        if (discovery.existing_flight_id) {
          await base44.entities.Flight.update(discovery.existing_flight_id, {
            departure_time: flightData.departure_time,
            arrival_time: flightData.arrival_time,
            days_of_week: flightData.days_of_week
          });
        }
        break;

      case 'flight_cancelled':
        // إيقاف الرحلة
        if (discovery.existing_flight_id) {
          await base44.entities.Flight.update(discovery.existing_flight_id, {
            is_active: false
          });
        }
        break;
    }

    // تحديث حالة الاكتشاف
    await base44.entities.AIFlightDiscovery.update(discoveryId, {
      status: 'approved',
      processed_at: new Date().toISOString()
    });

    return discovery;
  }

  /**
   * رفض اكتشاف
   */
  async rejectDiscovery(discoveryId, notes = '') {
    await base44.entities.AIFlightDiscovery.update(discoveryId, {
      status: 'rejected',
      admin_notes: notes,
      processed_at: new Date().toISOString()
    });
  }
}

export const flightDiscoveryAI = new FlightDiscoveryAI();
export default FlightDiscoveryAI;