import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPageUrl } from "@/utils";
import { 
  Link2, Copy, Key, Shield, RefreshCw, Download, FileText,
  Code, CheckCircle, AlertCircle, Printer, ExternalLink,
  Plane, Search, Ticket, User, CreditCard, HelpCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function AgentApiDocs() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState('airports');

  const baseUrl = window.location.origin;

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=agent');
      return;
    }
    
    const user = JSON.parse(systemUser);
    loadData(user.related_entity_id);
  }, []);

  const loadData = async (agentId) => {
    try {
      const agentData = await base44.entities.Agent.filter({ id: agentId });
      if (agentData.length > 0) setAgent(agentData[0]);
      setLoading(false);
    } catch (error) {
      toast.error('فشل تحميل البيانات');
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const printDocs = () => {
    window.print();
    toast.success('جاري الطباعة...');
  };

  // اختبار API
  const handleTestApi = async () => {
    if (!agent?.api_enabled || !agent?.api_key) {
      toast.error('ربط API غير مفعّل');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const startTime = Date.now();
      let result;
      
      // استدعاء AgentAPIService مباشرة للاختبار
      const { AgentAPIService } = await import('@/components/api/AgentAPIService');
      
      if (testEndpoint === 'airports') {
        result = await AgentAPIService.getAirports();
      } else if (testEndpoint === 'airlines') {
        result = await AgentAPIService.getAirlines();
      } else if (testEndpoint === 'balance') {
        result = await AgentAPIService.getBalance(agent);
      } else if (testEndpoint === 'test') {
        result = await AgentAPIService.testConnection(agent);
      }
      
      const responseTime = Date.now() - startTime;
      
      setTestResult({
        success: true,
        data: result,
        responseTime,
        status: 200
      });
      
      toast.success(`تم الاختبار بنجاح - ${responseTime}ms`);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
        suggestion: getSuggestion(error.message)
      });
      toast.error('فشل الاختبار');
    }
    
    setTesting(false);
  };
  
  // اقتراحات تصحيح الأخطاء
  const getSuggestion = (error) => {
    if (error.includes('401') || error.includes('Unauthorized')) {
      return 'تأكد من صحة API Key و API Secret';
    }
    if (error.includes('403') || error.includes('Forbidden')) {
      return 'تأكد من أن IP الخاص بك مضاف للقائمة البيضاء';
    }
    if (error.includes('429')) {
      return 'تجاوزت الحد المسموح للطلبات، انتظر قليلاً';
    }
    return 'تحقق من الاتصال بالإنترنت وأعد المحاولة';
  };

  // نماذج الأكواد
  const endpoints = [
    {
      id: 'test',
      title: 'اختبار الاتصال',
      method: 'GET',
      endpoint: '/api/agent/test',
      description: 'اختبار صحة الاتصال والتحقق من عمل جميع الخدمات',
      request: null,
      response: {
        success: true,
        message: 'الاتصال ناجح!',
        agent_id: 'AG001',
        agent_name: 'وكالة السفر',
        api_enabled: true,
        timestamp: '2026-01-23T10:00:00Z',
        services: {
          airports: true,
          airlines: true,
          search: true,
          booking: true,
          balance: true
        }
      }
    },
    {
      id: 'airports',
      title: 'جلب المطارات (مزامنة)',
      method: 'GET',
      endpoint: '/api/agent/airports',
      description: 'جلب قائمة المطارات المتاحة في النظام لمزامنتها مع نظامك',
      request: null,
      response: {
        success: true,
        airports: [
          { airport_code: "ADE", airport_name: "مطار عدن الدولي", city: "عدن", country: "اليمن" },
          { airport_code: "CAI", airport_name: "مطار القاهرة الدولي", city: "القاهرة", country: "مصر" },
          { airport_code: "JED", airport_name: "مطار الملك عبدالعزيز الدولي", city: "جدة", country: "السعودية" }
        ]
      }
    },
    {
      id: 'airlines',
      title: 'جلب شركات الطيران (مزامنة)',
      method: 'GET',
      endpoint: '/api/public/airlines',
      description: 'جلب قائمة شركات الطيران المتاحة لمزامنتها مع نظامك',
      request: null,
      response: {
        success: true,
        airlines: [
          { airline_code: "IY", airline_name: "الخطوط الجوية اليمنية", logo_url: "https://..." }
        ]
      }
    },
    {
      id: 'search',
      title: 'البحث عن الرحلات',
      method: 'POST',
      endpoint: '/api/agent/flights/search',
      description: 'البحث عن الرحلات المتاحة حسب المسار والتاريخ - يظهر اسم شركة الطيران بوضوح',
      request: {
        from: "ADE",
        to: "CAI",
        date: "2026-01-25",
        passengers: 1
      },
      response: {
        success: true,
        flights: [
          {
            flight_id: "FL123",
            airline_code: "IY",
            airline_name: "الخطوط الجوية اليمنية",
            airline_logo: "https://...",
            flight_number: "IY611",
            departure: { city: "عدن", code: "ADE", time: "23:30", date: "2026-01-25" },
            arrival: { city: "القاهرة", code: "CAI", time: "02:30" },
            seat_class: "economy",
            trip_type: "round_trip",
            price: 730,
            available_seats: 4,
            currency: "USD"
          }
        ]
      }
    },
    {
      id: 'payment_create',
      title: 'إنشاء طلب الدفع',
      method: 'POST',
      endpoint: '/api/agent/payment/create',
      description: 'إنشاء طلب دفع لحجز رحلة',
      request: {
        flight_id: "FL123",
        amount: 730,
        currency: "USD",
        customer_phone: "967771234567"
      },
      response: {
        success: true,
        payment_id: "PAY789",
        booking_number: "BK-2026-0001",
        amount: 730,
        currency: "USD",
        status: "PENDING",
        expires_at: "2026-01-25T14:00:00Z"
      }
    },
    {
      id: 'passport',
      title: 'رفع صورة الجواز',
      method: 'POST',
      endpoint: '/api/agent/passport/upload',
      description: 'رفع صورة الجواز واستخراج البيانات تلقائياً - النظام يتولى حفظ الصورة وربطها بالحجز',
      request: {
        payment_id: "PAY789",
        passenger_index: 0,
        passport_image: "base64_image_or_url"
      },
      response: {
        success: true,
        extracted_data: {
          full_name: "AHMED MOHAMMED ALI",
          passport_number: "A12345678",
          nationality: "YEMEN",
          date_of_birth: "1990-01-15",
          expiry_date: "2030-05-20"
        },
        warnings: []
      }
    },
    {
      id: 'payment_confirm',
      title: 'تأكيد الدفع',
      method: 'POST',
      endpoint: '/api/agent/payment/confirm',
      description: 'تأكيد الدفع وخصم المبلغ من رصيد الوكيل',
      request: {
        payment_id: "PAY789",
        transaction_id: "TX998877"
      },
      response: {
        success: true,
        status: "SUCCESS",
        booking_id: "BK456",
        booking_number: "BK-2026-0001",
        agent_balance_after: 1270,
        message: "تم تأكيد الحجز وخصم $730 من رصيدك"
      }
    },
    {
      id: 'payment_status',
      title: 'استعلام عن حالة العملية',
      method: 'GET',
      endpoint: '/api/agent/payment/status/{payment_id}',
      description: 'الحصول على حالة عملية الدفع والحجز',
      request: null,
      response: {
        success: true,
        payment_id: "PAY789",
        booking_number: "BK-2026-0001",
        status: "SUCCESS",
        booking_status: "issued",
        ticket_number: "123-4567890123",
        ticket_url: "https://..../ticket.pdf"
      }
    },
    {
      id: 'balance',
      title: 'استعلام رصيد الوكيل',
      method: 'GET',
      endpoint: '/api/agent/balance',
      description: 'الحصول على رصيد الوكيل الحالي للتحقق قبل الدفع',
      request: null,
      response: {
        success: true,
        agent_id: "AG001",
        balance: 2000,
        credit_limit: 0,
        available: 2000,
        currency: "USD"
      }
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 print:bg-white" dir="rtl">
      <AgentSidebar agent={agent} balance={agent?.balance} />
      
      <main className="lg:mr-72 p-4 lg:p-6 pt-20 lg:pt-6 print:mr-0 print:pt-0">
        {/* العنوان */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">وثائق ربط API</h1>
            <p className="text-slate-600">دليل ربط نظامك بخدماتنا</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={printDocs}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة المستندات
            </Button>
          </div>
        </div>

        {/* حالة API */}
        <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Link2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">حالة ربط API</h3>
                  <p className="text-sm text-slate-600">
                    {agent?.api_enabled ? 'ربط API مفعّل ويمكنك استخدامه' : 'ربط API غير مفعّل - تواصل مع الدعم لتفعيله'}
                  </p>
                </div>
              </div>
              <Badge className={agent?.api_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {agent?.api_enabled ? 'مفعّل' : 'غير مفعّل'}
              </Badge>
            </div>

            {agent?.api_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-slate-600">API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={agent.api_key || ''} readOnly className="font-mono bg-white" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(agent.api_key, 'API Key')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-600">API Secret</Label>
                  <div className="flex gap-2 mt-1">
                    <Input 
                      type={showSecret ? 'text' : 'password'} 
                      value={agent.api_secret || ''} 
                      readOnly 
                      className="font-mono bg-white" 
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <Key className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(agent.api_secret, 'API Secret')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* اختبار API مباشرة */}
        <Card className="mb-6 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              اختبار API مباشرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700 mb-4">اختبر الربط مباشرة من هنا للتأكد من عمل الخدمة</p>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>اختر الخدمة للاختبار</Label>
                <select 
                  value={testEndpoint} 
                  onChange={(e) => setTestEndpoint(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                >
                  <option value="test">اختبار الاتصال (Test Connection)</option>
                  <option value="airports">جلب المطارات</option>
                  <option value="airlines">جلب شركات الطيران</option>
                  <option value="balance">استعلام الرصيد</option>
                </select>
              </div>
              <Button 
                onClick={handleTestApi} 
                disabled={testing || !agent?.api_enabled}
                className="bg-green-600 hover:bg-green-700"
              >
                {testing ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle className="h-4 w-4 ml-2" />}
                اختبار الآن
              </Button>
            </div>
            
            {testResult && (
              <div className={`mt-4 p-4 rounded-xl ${testResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-bold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.success ? `نجح الاختبار (${testResult.responseTime}ms)` : 'فشل الاختبار'}
                  </span>
                </div>
                
                {testResult.success && testResult.data && (
                  <pre className="bg-white p-3 rounded-lg text-xs overflow-auto max-h-48 mt-2">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                )}
                
                {!testResult.success && (
                  <div className="mt-2">
                    <p className="text-red-700 text-sm">{testResult.error}</p>
                    {testResult.suggestion && (
                      <p className="text-amber-700 text-sm mt-1 flex items-center gap-1">
                        <HelpCircle className="h-4 w-4" />
                        اقتراح: {testResult.suggestion}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* البداية السريعة */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              البداية السريعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="js">
              <TabsList className="mb-4">
                <TabsTrigger value="js">JavaScript</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>
              
              <TabsContent value="js">
                <div className="bg-slate-900 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-green-400">
{`// إعداد الطلب
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': '${agent?.api_key || 'YOUR_API_KEY'}',
  'X-API-Secret': '${showSecret ? (agent?.api_secret || 'YOUR_API_SECRET') : '***************'}'
};

// البحث عن رحلات
const response = await fetch('${baseUrl}/api/agent/flights/search', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    from: 'ADE',
    to: 'CAI',
    date: '2026-01-25',
    passengers: 1
  })
});

const data = await response.json();
console.log(data.flights); // قائمة الرحلات مع اسم شركة الطيران`}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="curl">
                <div className="bg-slate-900 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-amber-400">
{`# البحث عن رحلات
curl -X POST '${baseUrl}/api/agent/flights/search' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: ${agent?.api_key || 'YOUR_API_KEY'}' \\
  -H 'X-API-Secret: ${showSecret ? (agent?.api_secret || 'YOUR_API_SECRET') : '***************'}' \\
  -d '{
    "from": "ADE",
    "to": "CAI",
    "date": "2026-01-25",
    "passengers": 1
  }'

# إنشاء طلب دفع
curl -X POST '${baseUrl}/api/agent/payment/create' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -H 'X-API-Secret: YOUR_API_SECRET' \\
  -d '{
    "flight_id": "FL123",
    "amount": 730,
    "currency": "USD",
    "customer_phone": "967771234567"
  }'

# استعلام الرصيد
curl -X GET '${baseUrl}/api/agent/balance' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -H 'X-API-Secret: YOUR_API_SECRET'`}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="python">
                <div className="bg-slate-900 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-blue-400">
{`import requests

BASE_URL = '${baseUrl}'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': '${agent?.api_key || 'YOUR_API_KEY'}',
    'X-API-Secret': '${showSecret ? (agent?.api_secret || 'YOUR_API_SECRET') : '***************'}'
}

# البحث عن رحلات
response = requests.post(
    f'{BASE_URL}/api/agent/flights/search',
    headers=headers,
    json={
        'from': 'ADE',
        'to': 'CAI',
        'date': '2026-01-25',
        'passengers': 1
    }
)
flights = response.json()['flights']

# استعلام الرصيد
balance_response = requests.get(
    f'{BASE_URL}/api/agent/balance',
    headers=headers
)
print(f"الرصيد: {balance_response.json()['balance']}$")`}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="php">
                <div className="bg-slate-900 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-purple-400">
{`<?php
$baseUrl = '${baseUrl}';
$headers = [
    'Content-Type: application/json',
    'X-API-Key: ${agent?.api_key || 'YOUR_API_KEY'}',
    'X-API-Secret: ${showSecret ? (agent?.api_secret || 'YOUR_API_SECRET') : '***************'}'
];

// البحث عن رحلات
$ch = curl_init($baseUrl . '/api/agent/flights/search');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'from' => 'ADE',
    'to' => 'CAI',
    'date' => '2026-01-25',
    'passengers' => 1
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

// عرض الرحلات
foreach ($response['flights'] as $flight) {
    echo $flight['airline_name'] . ' - ' . $flight['price'] . '$' . PHP_EOL;
}
?>`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* نقاط النهاية */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">نقاط النهاية (Endpoints)</h2>

          {endpoints.map((endpoint) => (
            <Card key={endpoint.id} className="print:break-inside-avoid">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <Badge className={endpoint.method === 'POST' ? 'bg-green-600' : 'bg-blue-600'}>
                      {endpoint.method}
                    </Badge>
                    <span className="font-mono text-base">{endpoint.endpoint}</span>
                  </CardTitle>
                </div>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="request" className="w-full">
                  <TabsList>
                    {endpoint.request && <TabsTrigger value="request">الطلب</TabsTrigger>}
                    <TabsTrigger value="response">الاستجابة</TabsTrigger>
                  </TabsList>
                  
                  {endpoint.request && (
                    <TabsContent value="request">
                      <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                        <pre className="text-amber-400 text-sm">
                          {JSON.stringify(endpoint.request, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  )}
                  
                  <TabsContent value="response">
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-green-400 text-sm">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* الأخطاء الشائعة */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              أكواد الأخطاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { code: 401, message: 'Unauthorized', desc: 'مفاتيح API غير صحيحة' },
                { code: 402, message: 'Insufficient Balance', desc: 'رصيد الوكيل غير كافٍ' },
                { code: 404, message: 'Not Found', desc: 'الحجز أو الرحلة غير موجودة' },
                { code: 409, message: 'Conflict', desc: 'المقاعد المطلوبة غير متاحة' },
                { code: 422, message: 'Validation Error', desc: 'بيانات الطلب غير صحيحة' },
                { code: 429, message: 'Too Many Requests', desc: 'تجاوز حد الطلبات المسموح' }
              ].map((error) => (
                <div key={error.code} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <Badge variant="outline" className="font-mono">{error.code}</Badge>
                  <span className="font-mono text-sm text-slate-600">{error.message}</span>
                  <span className="text-sm text-slate-500">{error.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* مسار العمل الكامل */}
        <Card className="mt-6 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              مسار العمل الكامل (Full Workflow)
            </CardTitle>
            <CardDescription className="text-green-700">
              خطوات الربط من البداية حتى إصدار التذكرة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* الخطوة 1 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">استعلام الرصيد</h4>
                  <p className="text-sm text-slate-600 mb-2">تأكد من توفر رصيد كافي قبل بدء عملية الحجز</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    GET /api/agent/balance
                  </div>
                </div>
              </div>
              
              {/* الخطوة 2 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">البحث عن الرحلات</h4>
                  <p className="text-sm text-slate-600 mb-2">ابحث عن الرحلات المتاحة للمسار المطلوب</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    POST /api/agent/flights/search → flight_id
                  </div>
                </div>
              </div>
              
              {/* الخطوة 3 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">إنشاء طلب الدفع</h4>
                  <p className="text-sm text-slate-600 mb-2">أنشئ طلب دفع للرحلة المختارة مع رقم هاتف العميل</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    POST /api/agent/payment/create → payment_id, booking_number
                  </div>
                </div>
              </div>
              
              {/* الخطوة 4 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">4</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">رفع صورة الجواز</h4>
                  <p className="text-sm text-slate-600 mb-2">ارفع صورة جواز المسافر وسيتم استخراج البيانات تلقائياً</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    POST /api/agent/passport/upload → extracted_data
                  </div>
                </div>
              </div>
              
              {/* الخطوة 5 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">5</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">تأكيد الدفع</h4>
                  <p className="text-sm text-slate-600 mb-2">أكد الدفع وسيتم خصم المبلغ من رصيدك تلقائياً</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    POST /api/agent/payment/confirm → agent_balance_after
                  </div>
                </div>
              </div>
              
              {/* الخطوة 6 */}
              <div className="flex gap-4 items-start p-4 bg-white rounded-xl border border-green-200">
                <div className="h-10 w-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">6</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">متابعة الحالة</h4>
                  <p className="text-sm text-slate-600 mb-2">تابع حالة الحجز حتى إصدار التذكرة</p>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs">
                    GET /api/agent/payment/status/{'{'}<span className="text-blue-600">payment_id</span>{'}'} → ticket_number, ticket_url
                  </div>
                </div>
              </div>
            </div>
            
            {/* مثال كامل */}
            <div className="mt-6 p-4 bg-slate-900 rounded-xl">
              <p className="text-green-400 text-sm font-mono mb-2">// مثال كامل للربط</p>
              <pre className="text-amber-400 text-xs overflow-x-auto">
{`// 1. التحقق من الرصيد
const balance = await api.getBalance();
if (balance.available < 730) throw new Error('رصيد غير كافي');

// 2. البحث عن رحلة
const flights = await api.searchFlights({ from: 'ADE', to: 'CAI', date: '2026-01-25' });
const flight = flights.flights[0];

// 3. إنشاء طلب الدفع
const payment = await api.createPayment({
  flight_id: flight.flight_id,
  amount: flight.price,
  customer_phone: '967771234567'
});

// 4. رفع صورة الجواز
await api.uploadPassport({
  payment_id: payment.payment_id,
  passenger_index: 0,
  passport_image: passportImageUrl
});

// 5. تأكيد الدفع
const result = await api.confirmPayment({
  payment_id: payment.payment_id,
  transaction_id: 'TX' + Date.now()
});

console.log('تم الحجز بنجاح:', result.booking_number);`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* ملاحظات هامة */}
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <HelpCircle className="h-5 w-5" />
              ملاحظات هامة
            </CardTitle>
          </CardHeader>
          <CardContent className="text-amber-900">
            <ul className="space-y-2 list-disc list-inside">
              <li>جميع الطلبات يجب أن تحتوي على Headers التوثيق (X-API-Key و X-API-Secret)</li>
              <li>يتم خصم المبالغ من رصيدك تلقائياً عند تأكيد الحجز</li>
              <li>لا يمكن تأكيد حجز إذا كان رصيدك غير كافٍ</li>
              <li>الحد الأقصى للطلبات: {agent?.api_rate_limit || 100} طلب/دقيقة</li>
              <li>يرجى حفظ API Secret في مكان آمن ولا تشاركه مع أي شخص</li>
              <li>طلب الدفع ينتهي بعد 30 دقيقة إذا لم يتم تأكيده</li>
              <li>يمكنك رفع صورة الجواز كرابط URL أو كـ Base64</li>
              <li>النظام يستخرج بيانات الجواز تلقائياً ويحفظها في الحجز</li>
            </ul>
          </CardContent>
        </Card>
        
        {/* الدعم الفني */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <HelpCircle className="h-5 w-5" />
              الدعم الفني
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-900">
            <p className="mb-4">للحصول على مساعدة في ربط API أو أي استفسارات:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-sm text-slate-500">البريد الإلكتروني</p>
                <p className="font-semibold">api-support@example.com</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-sm text-slate-500">واتساب الدعم الفني</p>
                <p className="font-semibold" dir="ltr">+967 XXX XXX XXX</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}