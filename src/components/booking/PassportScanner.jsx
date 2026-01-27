import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Camera, Upload, User, FileText, Calendar, Globe, AlertTriangle,
  CheckCircle, Loader2, X, RefreshCw, Image, Sparkles, Scan
} from 'lucide-react';

export default function PassportScanner({ 
  onScanComplete, 
  passengerIndex = 0,
  initialData = null 
}) {
  const [scanning, setScanning] = useState(false);
  const [passportImage, setPassportImage] = useState(initialData?.passport_image_url || null);
  const [renewalImage, setRenewalImage] = useState(initialData?.renewal_image_url || null);
  const [photoUrl, setPhotoUrl] = useState(initialData?.photo_url || null);
  const [scanError, setScanError] = useState(null);
  const [showRenewal, setShowRenewal] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    passport_number: initialData?.passport_number || '',
    nationality: initialData?.nationality || '',
    date_of_birth: initialData?.date_of_birth || '',
    passport_expiry: initialData?.passport_expiry || '',
    passport_issue_date: initialData?.passport_issue_date || '',
    gender: initialData?.gender || ''
  });

  const fileInputRef = useRef(null);
  const renewalInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    setScanError(null);

    try {
      // رفع الصورة
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPassportImage(file_url);

      // تحليل الجواز بالذكاء الاصطناعي
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `
قم بتحليل صورة جواز السفر هذه واستخرج البيانات التالية:
- الاسم الكامل كما هو مكتوب في الجواز
- رقم الجواز
- الجنسية
- تاريخ الميلاد
- تاريخ إصدار الجواز
- تاريخ انتهاء الجواز
- الجنس (ذكر/أنثى)

تأكد أن الصورة هي صورة جواز سفر حقيقي.
إذا لم تكن الصورة جواز سفر، أشر إلى ذلك.
`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            is_passport: { type: "boolean" },
            confidence: { type: "number" },
            extracted_data: {
              type: "object",
              properties: {
                full_name: { type: "string" },
                passport_number: { type: "string" },
                nationality: { type: "string" },
                date_of_birth: { type: "string" },
                passport_issue_date: { type: "string" },
                passport_expiry: { type: "string" },
                gender: { type: "string" },
                photo_url: { type: "string" }
              }
            },
            error_message: { type: "string" }
          }
        }
      });

      if (!result.is_passport) {
        setScanError('الصورة المرفقة ليست جواز سفر. يرجى إرفاق صورة واضحة لجواز السفر.');
        setScanning(false);
        return;
      }

      const data = result.extracted_data;
      
      // التحقق من صلاحية الجواز
      if (data.passport_expiry) {
        const expiryDate = new Date(data.passport_expiry);
        if (expiryDate < new Date()) {
          setIsExpired(true);
          setShowRenewal(true);
          toast.warning('الجواز منتهي الصلاحية - يمكنك إضافة صورة التجديد');
        }
      }

      // تحويل التواريخ إلى صيغة YYYY-MM-DD لـ input type="date"
      const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        } catch {
          return dateStr;
        }
      };

      setFormData({
        full_name: data.full_name || '',
        passport_number: data.passport_number || '',
        nationality: data.nationality || '',
        date_of_birth: formatDateForInput(data.date_of_birth),
        passport_expiry: formatDateForInput(data.passport_expiry),
        passport_issue_date: formatDateForInput(data.passport_issue_date),
        gender: data.gender || ''
      });

      if (data.photo_url) {
        setPhotoUrl(data.photo_url);
      }

      toast.success('تم استخراج البيانات بنجاح');

    } catch (error) {
      console.error('Scan error:', error);
      setScanError('حدث خطأ أثناء تحليل الجواز. يرجى المحاولة مرة أخرى.');
    }

    setScanning(false);
  };

  const handleRenewalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setRenewalImage(file_url);
    toast.success('تم رفع صورة التجديد');
  };

  const handleConfirm = () => {
    if (!formData.full_name || !formData.passport_number) {
      toast.error('يرجى ملء البيانات المطلوبة');
      return;
    }

    onScanComplete({
      ...formData,
      passport_image_url: passportImage,
      renewal_image_url: renewalImage,
      photo_url: photoUrl
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <motion.div 
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-xl"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Scan className="h-10 w-10 text-white" />
        </motion.div>
        <h3 className="text-2xl font-bold text-slate-900">بيانات المسافر {passengerIndex + 1}</h3>
        <p className="text-slate-500 mt-2">قم بتصوير أو رفع صورة جواز السفر</p>
        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-blue-600">
          <Sparkles className="h-4 w-4" />
          <span>الذكاء الاصطناعي يستخرج البيانات تلقائياً</span>
        </div>
      </div>

      {/* Passport Upload */}
      <Card className={`border-2 border-dashed transition-all duration-300 ${
        passportImage 
          ? 'border-green-300 bg-green-50/50' 
          : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
      }`}>
        <CardContent className="p-8">

          {!passportImage ? (
            <motion.div 
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {scanning ? (
                <div className="py-8">
                  <motion.div 
                    className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-12 w-12 text-blue-600" />
                  </motion.div>
                  <p className="text-xl font-bold text-slate-700">جاري تحليل الجواز بالذكاء الاصطناعي...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Camera className="h-8 w-8 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-slate-700 mb-3">رفع صورة جواز السفر</p>
                  <p className="text-slate-500 mb-6">اختر طريقة إضافة صورة الجواز</p>
                  
                  {/* خيارين: اختيار من الملفات أو التصوير */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    {/* زر اختيار من الملفات */}
                    <input
                      type="file"
                      id="passport-file-input"
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => document.getElementById('passport-file-input').click()}
                      className="w-full sm:w-auto h-14 px-8 text-base border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                    >
                      <Image className="h-5 w-5 ml-2 text-blue-600" />
                      اختيار من الملفات
                    </Button>
                    
                    {/* زر التصوير بالكاميرا */}
                    <input
                      type="file"
                      id="passport-camera-input"
                      onChange={handleFileSelect}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => document.getElementById('passport-camera-input').click()}
                      className="w-full sm:w-auto h-14 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      <Camera className="h-5 w-5 ml-2" />
                      تصوير بالكاميرا
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      استخراج تلقائي للبيانات
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      التحقق من الصلاحية
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <div className="flex items-start gap-6">
              <div className="relative">
                <img 
                  src={passportImage} 
                  alt="Passport" 
                  className="w-40 h-56 object-cover rounded-xl border-2 border-slate-200"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-lg hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              
              {photoUrl && (
                <div className="text-center">
                  <img 
                    src={photoUrl} 
                    alt="Photo" 
                    className="w-24 h-24 object-cover rounded-full border-4 border-blue-200"
                  />
                  <p className="text-xs text-slate-500 mt-2">صورة المسافر</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      <AnimatePresence>
        {scanError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{scanError}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expired Warning */}
      <AnimatePresence>
        {isExpired && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                جواز السفر منتهي الصلاحية. يمكنك إضافة صورة التجديد إذا كان لديك تجديد.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Renewal Upload */}
      {showRenewal && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <input
              type="file"
              ref={renewalInputRef}
              onChange={handleRenewalUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-800">صورة التجديد</p>
                <p className="text-sm text-amber-600">أضف صورة صفحة التجديد من الجواز</p>
              </div>
              {renewalImage ? (
                <div className="flex items-center gap-2">
                  <img src={renewalImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <Button variant="outline" onClick={() => renewalInputRef.current?.click()}>
                  <Upload className="h-4 w-4 ml-2" />
                  رفع التجديد
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data */}
      {passportImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold">البيانات المستخرجة</h4>
            <span className="text-xs text-slate-500">(يمكنك التعديل إذا لزم الأمر)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>رقم الجواز *</Label>
              <Input
                value={formData.passport_number}
                onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                className="mt-1 font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <Label>الجنسية</Label>
              <Input
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>تاريخ الميلاد</Label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className={isExpired ? 'text-red-600' : ''}>
                تاريخ انتهاء الجواز {isExpired && '(منتهي)'}
              </Label>
              <Input
                type="date"
                value={formData.passport_expiry}
                onChange={(e) => setFormData({ ...formData, passport_expiry: e.target.value })}
                className={`mt-1 ${isExpired ? 'border-red-300' : ''}`}
              />
            </div>
          </div>

          <Button onClick={handleConfirm} className="w-full h-12 mt-4">
            <CheckCircle className="h-5 w-5 ml-2" />
            تأكيد البيانات
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}