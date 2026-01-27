import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle2, AlertCircle, User, Calendar, FileText } from 'lucide-react';
import { toast } from "sonner";

// نظام OCR محلي للتعرف على الجوازات
export const PassportOCREngine = {
  
  // تحليل صورة الجواز واستخراج البيانات
  async analyzePassport(imageFile) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const imageData = e.target.result;
        
        // محاكاة معالجة الصورة
        setTimeout(() => {
          // في الإنتاج، هنا سيتم استخدام مكتبة OCR حقيقية
          // مثل Tesseract.js للتعرف على النصوص
          
          const extractedData = this.extractPassportData(imageData);
          resolve(extractedData);
        }, 2000);
      };
      
      reader.readAsDataURL(imageFile);
    });
  },

  // استخراج البيانات من الجواز (خوارزمية محاكاة)
  extractPassportData(imageData) {
    // هذه دالة محاكاة - في الإنتاج ستستخدم OCR حقيقي
    
    // التحقق من نوع المستند
    const isPassport = this.detectDocumentType(imageData);
    
    if (!isPassport) {
      return {
        success: false,
        error: 'المستند ليس جواز سفر صالح'
      };
    }
    
    // استخراج البيانات (محاكاة)
    const data = {
      success: true,
      confidence: 0.85,
      documentType: 'passport',
      data: {
        fullName: '',
        passportNumber: '',
        nationality: 'اليمن',
        dateOfBirth: '',
        expiryDate: '',
        issueDate: '',
        placeOfBirth: '',
        sex: '',
        photoUrl: imageData
      },
      warnings: [],
      needsRenewal: false
    };
    
    // التحقق من صلاحية الجواز
    if (data.data.expiryDate) {
      const expiryDate = new Date(data.data.expiryDate);
      const today = new Date();
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      if (expiryDate < today) {
        data.warnings.push('تحذير: الجواز منتهي الصلاحية');
        data.needsRenewal = true;
      } else if (expiryDate < sixMonthsFromNow) {
        data.warnings.push('تحذير: الجواز سينتهي خلال 6 أشهر');
      }
    }
    
    return data;
  },

  // كشف نوع المستند
  detectDocumentType(imageData) {
    // خوارزمية بسيطة للتحقق
    // في الإنتاج، ستستخدم التعلم الآلي
    return true;
  },

  // استخراج نص MRZ (Machine Readable Zone)
  extractMRZ(imageData) {
    // المنطقة القابلة للقراءة الآلية في أسفل الجواز
    // تحتوي على البيانات بتنسيق موحد
    
    return {
      line1: '',
      line2: '',
      parsed: {}
    };
  },

  // التحقق من صحة رقم الجواز
  validatePassportNumber(number) {
    // خوارزمية التحقق من صحة رقم الجواز
    const pattern = /^[A-Z0-9]{6,9}$/;
    return pattern.test(number);
  }
};

// مكون واجهة رفع الجواز
export default function PassportOCRUploader({ onDataExtracted }) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [manualData, setManualData] = useState({
    fullName: '',
    passportNumber: '',
    nationality: 'اليمن',
    dateOfBirth: '',
    expiryDate: '',
    sex: 'male'
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى رفع صورة فقط');
      return;
    }
    
    // التحقق من حجم الملف (أقل من 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 5MB)');
      return;
    }
    
    setUploading(true);
    setAnalyzing(true);
    
    // عرض معاينة الصورة
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    try {
      // تحليل الجواز
      const extractedData = await PassportOCREngine.analyzePassport(file);
      
      setResult(extractedData);
      
      if (extractedData.success) {
        setManualData(prev => ({
          ...prev,
          ...extractedData.data
        }));
        toast.success('تم استخراج البيانات بنجاح');
        
        if (extractedData.warnings.length > 0) {
          extractedData.warnings.forEach(warning => {
            toast.warning(warning);
          });
        }
      } else {
        toast.error(extractedData.error || 'فشل استخراج البيانات');
      }
    } catch (error) {
      toast.error('حدث خطأ في معالجة الصورة');
    }
    
    setUploading(false);
    setAnalyzing(false);
  };

  const handleManualInput = (field, value) => {
    setManualData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfirm = () => {
    // التحقق من البيانات المطلوبة
    if (!manualData.fullName || !manualData.passportNumber) {
      toast.error('يرجى إدخال الاسم ورقم الجواز');
      return;
    }
    
    // التحقق من صحة رقم الجواز
    if (!PassportOCREngine.validatePassportNumber(manualData.passportNumber)) {
      toast.error('رقم الجواز غير صحيح');
      return;
    }
    
    // التحقق من تاريخ الانتهاء
    if (manualData.expiryDate) {
      const expiryDate = new Date(manualData.expiryDate);
      const today = new Date();
      
      if (expiryDate < today) {
        toast.error('الجواز منتهي الصلاحية - يرجى رفع صورة التجديد');
        return;
      }
    }
    
    onDataExtracted({
      ...manualData,
      photoUrl: imagePreview
    });
  };

  return (
    <div className="space-y-6">
      {/* منطقة رفع الصورة */}
      {!imagePreview ? (
        <label className="cursor-pointer block">
          <Card className="border-2 border-dashed hover:border-blue-500 transition-colors">
            <CardContent className="flex flex-col items-center justify-center p-12">
              {uploading ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                  <p className="text-lg font-semibold">جاري رفع الصورة...</p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-slate-400 mb-4" />
                  <p className="text-lg font-semibold mb-2">صوّر أو ارفع صورة الجواز</p>
                  <p className="text-sm text-slate-500">PNG, JPG حتى 5MB</p>
                </>
              )}
            </CardContent>
          </Card>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*" 
            capture="environment"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <img 
                src={imagePreview} 
                alt="Passport" 
                className="w-32 h-32 object-cover rounded border"
              />
              <div className="flex-1">
                {analyzing ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>جاري تحليل الجواز...</span>
                  </div>
                ) : result?.success ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>تم استخراج البيانات ({Math.round(result.confidence * 100)}% دقة)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span>فشل التحليل - يرجى الإدخال يدوياً</span>
                  </div>
                )}
                
                {result?.warnings && result.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.warnings.map((warning, i) => (
                      <div key={i} className="flex items-center gap-2 text-amber-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setImagePreview(null);
                  setResult(null);
                  setManualData({
                    fullName: '',
                    passportNumber: '',
                    nationality: 'اليمن',
                    dateOfBirth: '',
                    expiryDate: '',
                    sex: 'male'
                  });
                }}
              >
                تغيير
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* نموذج البيانات */}
      {imagePreview && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">بيانات المسافر</h3>
              <span className="text-sm text-slate-500">(تحقق من البيانات وعدّلها إذا لزم الأمر)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>الاسم الكامل *</Label>
                <Input
                  value={manualData.fullName}
                  onChange={(e) => handleManualInput('fullName', e.target.value)}
                  placeholder="كما في الجواز"
                />
              </div>
              
              <div>
                <Label>رقم الجواز *</Label>
                <Input
                  value={manualData.passportNumber}
                  onChange={(e) => handleManualInput('passportNumber', e.target.value.toUpperCase())}
                  placeholder="A1234567"
                  dir="ltr"
                />
              </div>
              
              <div>
                <Label>الجنسية</Label>
                <Input
                  value={manualData.nationality}
                  onChange={(e) => handleManualInput('nationality', e.target.value)}
                />
              </div>
              
              <div>
                <Label>تاريخ الميلاد</Label>
                <Input
                  type="date"
                  value={manualData.dateOfBirth}
                  onChange={(e) => handleManualInput('dateOfBirth', e.target.value)}
                />
              </div>
              
              <div>
                <Label>تاريخ انتهاء الجواز *</Label>
                <Input
                  type="date"
                  value={manualData.expiryDate}
                  onChange={(e) => handleManualInput('expiryDate', e.target.value)}
                  className={manualData.expiryDate && new Date(manualData.expiryDate) < new Date() ? 'border-red-500' : ''}
                />
                {manualData.expiryDate && new Date(manualData.expiryDate) < new Date() && (
                  <p className="text-xs text-red-500 mt-1">الجواز منتهي - يرجى رفع صورة التجديد</p>
                )}
              </div>
              
              <div>
                <Label>الجنس</Label>
                <select
                  value={manualData.sex}
                  onChange={(e) => handleManualInput('sex', e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 px-3"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleConfirm}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="ml-2 h-4 w-4" />
                تأكيد البيانات
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}