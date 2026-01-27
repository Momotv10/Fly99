import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { User, Upload, Camera, AlertTriangle, Check, Loader2, FileImage } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format, isBefore, parseISO } from 'date-fns';

export default function PassengerForm({ index, passenger, onUpdate, flightDate }) {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [passportWarning, setPassportWarning] = useState('');
  const fileInputRef = useRef(null);
  const renewalInputRef = useRef(null);

  const handleFileUpload = async (e, isRenewal = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    // Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    if (isRenewal) {
      onUpdate({ renewal_image_url: file_url });
      setUploading(false);
      return;
    }

    onUpdate({ passport_image_url: file_url });
    setExtracting(true);

    // Extract data using AI
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `استخرج بيانات جواز السفر من الصورة المرفقة. استخرج البيانات التالية بالإنجليزية:
      - الاسم الكامل (full_name)
      - رقم الجواز (passport_number)
      - الجنسية (nationality)
      - تاريخ الميلاد بصيغة YYYY-MM-DD (date_of_birth)
      - تاريخ إصدار الجواز بصيغة YYYY-MM-DD (passport_issue_date)
      - تاريخ انتهاء الجواز بصيغة YYYY-MM-DD (passport_expiry_date)`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          passport_number: { type: "string" },
          nationality: { type: "string" },
          date_of_birth: { type: "string" },
          passport_issue_date: { type: "string" },
          passport_expiry_date: { type: "string" }
        }
      }
    });

    if (result) {
      onUpdate({
        full_name: result.full_name || passenger.full_name,
        passport_number: result.passport_number || passenger.passport_number,
        nationality: result.nationality || passenger.nationality,
        date_of_birth: result.date_of_birth || passenger.date_of_birth,
        passport_issue_date: result.passport_issue_date || passenger.passport_issue_date,
        passport_expiry_date: result.passport_expiry_date || passenger.passport_expiry_date
      });

      // Check passport expiry
      if (result.passport_expiry_date && flightDate) {
        const expiryDate = parseISO(result.passport_expiry_date);
        const flight = parseISO(flightDate);
        
        if (isBefore(expiryDate, flight)) {
          setPassportWarning('تحذير: جواز السفر منتهي الصلاحية قبل تاريخ السفر');
        } else {
          setPassportWarning('');
        }
      }
    }

    setExtracting(false);
    setUploading(false);
  };

  return (
    <div className="border rounded-xl p-6 bg-white">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="h-5 w-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold">المسافر {index + 1}</h3>
      </div>

      {/* Passport Upload */}
      <div className="mb-6">
        <Label className="mb-2 block">صورة جواز السفر</Label>
        <div className="flex gap-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            {uploading || extracting ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-2" />
                <p className="text-sm text-slate-600">
                  {uploading ? 'جاري الرفع...' : 'جاري استخراج البيانات...'}
                </p>
              </div>
            ) : passenger.passport_image_url ? (
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <img 
                    src={passenger.passport_image_url} 
                    alt="Passport" 
                    className="h-20 w-auto rounded-lg"
                  />
                  <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
                <p className="text-sm text-green-600">تم رفع الصورة بنجاح</p>
                <p className="text-xs text-slate-400 mt-1">انقر لتغيير الصورة</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-slate-100 rounded-full mb-3">
                  <Camera className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">انقر لرفع صورة الجواز</p>
                <p className="text-xs text-slate-400 mt-1">سيتم استخراج البيانات تلقائياً</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e)}
          />
        </div>
      </div>

      {/* Passport Warning */}
      {passportWarning && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{passportWarning}</span>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`renewal-${index}`}
                checked={passenger.has_renewal}
                onCheckedChange={(checked) => onUpdate({ has_renewal: checked })}
              />
              <Label htmlFor={`renewal-${index}`} className="text-sm cursor-pointer">
                يوجد تجديد
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Renewal Upload */}
      {passenger.has_renewal && (
        <div className="mb-6">
          <Label className="mb-2 block">صورة وثيقة التجديد</Label>
          <div 
            onClick={() => renewalInputRef.current?.click()}
            className="border-2 border-dashed border-orange-200 rounded-xl p-4 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all"
          >
            {passenger.renewal_image_url ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <FileImage className="h-5 w-5" />
                <span className="text-sm">تم رفع وثيقة التجديد</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <Upload className="h-5 w-5" />
                <span className="text-sm">رفع صورة التجديد</span>
              </div>
            )}
          </div>
          <input
            ref={renewalInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, true)}
          />
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>الاسم الكامل (كما في الجواز)</Label>
          <Input
            value={passenger.full_name}
            onChange={(e) => onUpdate({ full_name: e.target.value })}
            placeholder="FULL NAME"
            className="mt-1"
          />
        </div>
        <div>
          <Label>رقم الجواز</Label>
          <Input
            value={passenger.passport_number}
            onChange={(e) => onUpdate({ passport_number: e.target.value })}
            placeholder="A12345678"
            className="mt-1"
            dir="ltr"
          />
        </div>
        <div>
          <Label>الجنسية</Label>
          <Input
            value={passenger.nationality}
            onChange={(e) => onUpdate({ nationality: e.target.value })}
            placeholder="SAUDI ARABIA"
            className="mt-1"
          />
        </div>
        <div>
          <Label>تاريخ الميلاد</Label>
          <Input
            type="date"
            value={passenger.date_of_birth}
            onChange={(e) => onUpdate({ date_of_birth: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>تاريخ انتهاء الجواز</Label>
          <Input
            type="date"
            value={passenger.passport_expiry_date}
            onChange={(e) => {
              onUpdate({ passport_expiry_date: e.target.value });
              // Check expiry on manual change
              if (e.target.value && flightDate) {
                const expiryDate = parseISO(e.target.value);
                const flight = parseISO(flightDate);
                if (isBefore(expiryDate, flight)) {
                  setPassportWarning('تحذير: جواز السفر منتهي الصلاحية قبل تاريخ السفر');
                } else {
                  setPassportWarning('');
                }
              }
            }}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}