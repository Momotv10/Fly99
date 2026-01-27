import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, FileText, TrendingUp, Book, Receipt, Brain, Wallet } from 'lucide-react';
import AdvancedAccountsManager from '@/components/admin/AdvancedAccountsManager';
import JournalEntriesManager from '@/components/admin/JournalEntriesManager';
import FinancialReports from '@/components/admin/FinancialReports';
import FinancialVouchersManager from '@/components/admin/FinancialVouchersManager';
import AIFinancialAuditor from '@/components/admin/AIFinancialAuditor';
import { createPageUrl } from "@/utils";

export default function AdminFinance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('accounts');

  useEffect(() => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-4 lg:p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            الإدارة المالية والمحاسبية
          </h1>
          <p className="text-slate-600">نظام محاسبي متكامل لإدارة الحسابات والقيود والتقارير المالية</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-2 bg-white p-2 rounded-xl shadow-sm">
            <TabsTrigger value="accounts" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Book className="h-4 w-4" />
              شجرة الحسابات
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Receipt className="h-4 w-4" />
              السندات المالية
            </TabsTrigger>
            <TabsTrigger value="entries" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4" />
              القيود اليومية
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4" />
              التقارير
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Brain className="h-4 w-4" />
              المراجعة الذكية
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <AdvancedAccountsManager />
          </TabsContent>
          
          <TabsContent value="vouchers">
            <FinancialVouchersManager />
          </TabsContent>
          
          <TabsContent value="entries">
            <JournalEntriesManager />
          </TabsContent>
          
          <TabsContent value="reports">
            <FinancialReports />
          </TabsContent>

          <TabsContent value="audit">
            <AIFinancialAuditor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}