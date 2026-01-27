import React, { useState, useEffect } from 'react';
import { aiEngine } from './AIServiceEngine';
import { Brain, Zap, Activity, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AIServiceMonitor() {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState({
    processed: 0,
    active: 0
  });

  useEffect(() => {
    // تشغيل المحرك
    const init = async () => {
      const unsubscribe = await aiEngine.initialize();
      setIsActive(true);
      
      return unsubscribe;
    };
    
    const cleanupPromise = init();

    return () => {
      cleanupPromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, []);

  return (
    <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Brain className="h-12 w-12" />
              {isActive && (
                <div className="absolute -top-1 -right-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                🤖 خدمة العملاء الذكية
                {isActive && <CheckCircle2 className="h-5 w-5 text-green-300" />}
              </h3>
              <p className="text-sm opacity-90">
                {isActive ? (
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 animate-pulse" />
                    نشط - يستمع للرسائل الواردة
                  </span>
                ) : (
                  'غير نشط'
                )}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold">{stats.processed}</div>
            <div className="text-sm opacity-90">رسالة معالجة</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="font-bold text-lg">{stats.active}</div>
              <div className="opacity-80">محادثات نشطة</div>
            </div>
            <div>
              <div className="font-bold text-lg flex items-center justify-center gap-1">
                <Zap className="h-4 w-4" />
                فوري
              </div>
              <div className="opacity-80">وقت الاستجابة</div>
            </div>
            <div>
              <div className="font-bold text-lg">99.9%</div>
              <div className="opacity-80">دقة الفهم</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}