import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { WAHAClient } from './WAHAClientClass';
import { toast } from "sonner";

export default function WhatsAppConnect({ gateway, onUpdate }) {
  const [state, setState] = useState({
    status: 'STOPPED',
    loading: false
  });

  useEffect(() => {
    if (gateway?.status === 'connected') {
      setState(s => ({ ...s, status: 'WORKING' }));
    }
  }, [gateway?.status]);





  const connect = async () => {
    setState(s => ({ ...s, loading: true }));

    try {
      const client = new WAHAClient(gateway.waha_server_url, gateway.waha_api_key);

      const testResult = await client.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.error);
      }

      await base44.entities.WhatsAppGateway.update(gateway.id, {
        session_id: 'default',
        status: 'connected',
        error_message: null
      });

      setState(s => ({ ...s, status: 'WORKING' }));
      toast.success('✅ تم الاتصال بالخادم بنجاح');
      
      if (onUpdate) onUpdate();

    } catch (err) {
      const errorMsg = err.message || 'فشل الاتصال';
      
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        status: 'error',
        error_message: errorMsg
      });

      toast.error('❌ ' + errorMsg);
    }

    setState(s => ({ ...s, loading: false }));
  };

  const disconnect = async () => {
    if (!confirm('قطع الاتصال؟')) return;

    try {
      await base44.entities.WhatsAppGateway.update(gateway.id, {
        status: 'disconnected',
        session_id: null
      });

      setState({ status: 'STOPPED', loading: false });
      toast.success('تم قطع الاتصال');

      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('حدث خطأ في قطع الاتصال');
    }
  };

  const isConnected = state.status === 'WORKING' || gateway?.status === 'connected';
  const isLoading = state.loading;

  return (
    <div className="space-y-3">
      <div className={`p-3 rounded-lg ${isConnected ? 'bg-green-50' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-slate-600" />
          )}
          <p className={`font-semibold text-sm ${isConnected ? 'text-green-700' : 'text-slate-700'}`}>
            {isConnected ? 'متصل بالخادم ✓' : 'غير متصل'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {isConnected ? (
          <Button 
            size="sm"
            variant="outline"
            onClick={disconnect}
            className="flex-1 text-red-600 hover:bg-red-50"
          >
            <WifiOff className="h-4 w-4 ml-1" />
            قطع الاتصال
          </Button>
        ) : (
          <Button 
            size="sm"
            onClick={connect}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                جاري...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 ml-1" />
                اتصال بالخادم
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}