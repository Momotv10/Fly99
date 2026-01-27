import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, Shield, AlertTriangle, CheckCircle2, XCircle, 
  RefreshCw, TrendingUp, TrendingDown, Eye, Loader2,
  FileSearch, AlertCircle, Sparkles, BarChart3
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from "sonner";

export default function AIFinancialAuditor() {
  const [auditing, setAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditResults, setAuditResults] = useState(null);
  const [lastAuditDate, setLastAuditDate] = useState(null);

  const runFullAudit = async () => {
    setAuditing(true);
    setAuditProgress(0);
    
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
      errors: [],
      warnings: [],
      recommendations: [],
      summary: {
        totalAccounts: 0,
        totalTransactions: 0,
        totalProviders: 0,
        totalAgents: 0,
        balanceDiscrepancies: 0,
        unbalancedEntries: 0,
        suspiciousActivity: 0
      }
    };

    try {
      // 1. تحميل البيانات
      setAuditProgress(10);
      const [accounts, journalEntries, providers, agents, bookings, transactions, providerAgents] = await Promise.all([
        base44.entities.Account.list(),
        base44.entities.JournalEntry.list('-created_date', 500),
        base44.entities.Provider.list(),
        base44.entities.Agent.list(),
        base44.entities.Booking.list('-created_date', 500),
        base44.entities.AccountTransaction.list('-created_date', 500),
        base44.entities.ProviderAgent.list()
      ]);

      results.summary.totalAccounts = accounts.length;
      results.summary.totalTransactions = transactions.length;
      results.summary.totalProviders = providers.length;
      results.summary.totalAgents = agents.length;

      // 2. فحص توازن القيود
      setAuditProgress(25);
      for (const entry of journalEntries) {
        if (!entry.is_balanced || Math.abs((entry.total_debit || 0) - (entry.total_credit || 0)) > 0.01) {
          results.errors.push({
            type: 'unbalanced_entry',
            severity: 'high',
            message: `قيد غير متوازن: ${entry.entry_number}`,
            details: `المدين: ${entry.total_debit}, الدائن: ${entry.total_credit}`,
            entity_id: entry.id,
            entity_type: 'journal_entry'
          });
          results.summary.unbalancedEntries++;
        }
      }

      results.checks.push({
        name: 'فحص توازن القيود',
        status: results.summary.unbalancedEntries === 0 ? 'passed' : 'failed',
        count: journalEntries.length,
        issues: results.summary.unbalancedEntries
      });

      // 3. فحص تطابق أرصدة المزودين
      setAuditProgress(40);
      for (const provider of providers) {
        const providerAccount = accounts.find(a => 
          a.related_entity_type === 'provider' && a.related_entity_id === provider.id
        );
        
        if (!providerAccount) {
          results.warnings.push({
            type: 'missing_account',
            severity: 'medium',
            message: `المزود ${provider.company_name_ar} ليس لديه حساب مالي`,
            entity_id: provider.id,
            entity_type: 'provider'
          });
        } else if (Math.abs((providerAccount.balance || 0) - (provider.balance || 0)) > 0.01) {
          results.errors.push({
            type: 'balance_mismatch',
            severity: 'high',
            message: `فرق في رصيد المزود ${provider.company_name_ar}`,
            details: `رصيد الحساب: ${providerAccount.balance}, رصيد المزود: ${provider.balance}`,
            entity_id: provider.id,
            entity_type: 'provider'
          });
          results.summary.balanceDiscrepancies++;
        }
      }

      results.checks.push({
        name: 'فحص أرصدة المزودين',
        status: results.summary.balanceDiscrepancies === 0 ? 'passed' : 'warning',
        count: providers.length,
        issues: results.summary.balanceDiscrepancies
      });

      // 4. فحص تطابق أرصدة الوكلاء
      setAuditProgress(55);
      let agentDiscrepancies = 0;
      for (const agent of agents) {
        const agentAccount = accounts.find(a => 
          a.related_entity_type === 'agent' && a.related_entity_id === agent.id
        );
        
        if (!agentAccount) {
          results.warnings.push({
            type: 'missing_account',
            severity: 'medium',
            message: `الوكيل ${agent.name} ليس لديه حساب مالي`,
            entity_id: agent.id,
            entity_type: 'agent'
          });
        } else if (Math.abs((agentAccount.balance || 0) - (agent.balance || 0)) > 0.01) {
          results.errors.push({
            type: 'balance_mismatch',
            severity: 'high',
            message: `فرق في رصيد الوكيل ${agent.name}`,
            details: `رصيد الحساب: ${agentAccount.balance}, رصيد الوكيل: ${agent.balance}`,
            entity_id: agent.id,
            entity_type: 'agent'
          });
          agentDiscrepancies++;
        }
      }

      results.checks.push({
        name: 'فحص أرصدة الوكلاء',
        status: agentDiscrepancies === 0 ? 'passed' : 'warning',
        count: agents.length,
        issues: agentDiscrepancies
      });

      // 5. فحص الحجوزات المعلقة
      setAuditProgress(70);
      const pendingBookings = bookings.filter(b => b.status === 'pending_payment' || b.status === 'pending_issue');
      const oldPendingBookings = pendingBookings.filter(b => {
        const createdDate = new Date(b.created_date);
        return createdDate < subDays(new Date(), 7);
      });

      if (oldPendingBookings.length > 0) {
        results.warnings.push({
          type: 'old_pending_bookings',
          severity: 'medium',
          message: `${oldPendingBookings.length} حجز معلق لأكثر من 7 أيام`,
          count: oldPendingBookings.length
        });
      }

      results.checks.push({
        name: 'فحص الحجوزات المعلقة',
        status: oldPendingBookings.length === 0 ? 'passed' : 'warning',
        count: bookings.length,
        issues: oldPendingBookings.length
      });

      // 6. فحص العمليات المشبوهة
      setAuditProgress(85);
      const recentTransactions = transactions.filter(t => {
        const transDate = new Date(t.transaction_date || t.created_date);
        return transDate >= subDays(new Date(), 7);
      });

      // البحث عن عمليات كبيرة غير عادية
      const avgAmount = recentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) / (recentTransactions.length || 1);
      const suspiciousTransactions = recentTransactions.filter(t => (t.amount || 0) > avgAmount * 5);

      if (suspiciousTransactions.length > 0) {
        for (const trans of suspiciousTransactions) {
          results.warnings.push({
            type: 'suspicious_transaction',
            severity: 'low',
            message: `عملية بمبلغ كبير: ${trans.amount} - ${trans.description}`,
            entity_id: trans.id,
            entity_type: 'transaction'
          });
          results.summary.suspiciousActivity++;
        }
      }

      results.checks.push({
        name: 'فحص العمليات غير العادية',
        status: suspiciousTransactions.length === 0 ? 'passed' : 'warning',
        count: recentTransactions.length,
        issues: suspiciousTransactions.length
      });

      // 7. توصيات الذكاء الاصطناعي
      setAuditProgress(95);
      
      if (results.errors.length > 0) {
        results.recommendations.push({
          priority: 'high',
          message: 'يجب مراجعة وإصلاح الأخطاء المكتشفة فوراً',
          action: 'review_errors'
        });
      }

      if (providers.filter(p => !p.account_id).length > 0) {
        results.recommendations.push({
          priority: 'medium',
          message: 'بعض المزودين بدون حسابات مالية - قم بمزامنة الحسابات',
          action: 'sync_accounts'
        });
      }

      if (agents.filter(a => (a.balance || 0) < 0).length > 0) {
        results.recommendations.push({
          priority: 'medium',
          message: 'بعض الوكلاء لديهم أرصدة سالبة - راجع حدود الائتمان',
          action: 'review_credit_limits'
        });
      }

      const issuedBookings = bookings.filter(b => b.status === 'issued');
      const totalRevenue = issuedBookings.reduce((sum, b) => sum + (b.system_commission || 0), 0);
      const commissionAccount = accounts.find(a => a.category === 'commission_revenue');
      
      if (commissionAccount && Math.abs((commissionAccount.balance || 0) - totalRevenue) > 100) {
        results.recommendations.push({
          priority: 'high',
          message: 'فرق بين إيرادات العمولات المحسوبة والمسجلة',
          action: 'reconcile_commissions'
        });
      }

      setAuditProgress(100);
      setAuditResults(results);
      setLastAuditDate(new Date());
      toast.success('تم إكمال المراجعة المالية');

    } catch (error) {
      console.error('Audit error:', error);
      toast.error('حدث خطأ أثناء المراجعة');
    }

    setAuditing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-700';
      case 'warning': return 'bg-amber-100 text-amber-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertCircle className="h-5 w-5 text-slate-600" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Brain className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">المراجع المالي الذكي</h2>
                <p className="opacity-90">مدقق ومراجع مالي يعمل بالذكاء الاصطناعي</p>
              </div>
            </div>
            <Button 
              onClick={runFullAudit}
              disabled={auditing}
              className="bg-white text-purple-700 hover:bg-white/90"
            >
              {auditing ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري المراجعة...
                </>
              ) : (
                <>
                  <Sparkles className="ml-2 h-4 w-4" />
                  بدء المراجعة
                </>
              )}
            </Button>
          </div>

          {auditing && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>تقدم المراجعة</span>
                <span>{auditProgress}%</span>
              </div>
              <Progress value={auditProgress} className="h-2 bg-white/30" />
            </div>
          )}

          {lastAuditDate && !auditing && (
            <p className="mt-4 text-sm opacity-80">
              آخر مراجعة: {format(lastAuditDate, 'yyyy-MM-dd HH:mm')}
            </p>
          )}
        </CardContent>
      </Card>

      {auditResults && (
        <>
          {/* ملخص النتائج */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold">{auditResults.summary.totalAccounts}</p>
                <p className="text-sm text-slate-500">حساب مالي</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileSearch className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">{auditResults.summary.totalTransactions}</p>
                <p className="text-sm text-slate-500">عملية تم فحصها</p>
              </CardContent>
            </Card>
            <Card className={auditResults.errors.length > 0 ? 'bg-red-50' : 'bg-green-50'}>
              <CardContent className="p-4 text-center">
                {auditResults.errors.length > 0 ? (
                  <XCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                )}
                <p className="text-2xl font-bold">{auditResults.errors.length}</p>
                <p className="text-sm text-slate-500">أخطاء</p>
              </CardContent>
            </Card>
            <Card className={auditResults.warnings.length > 0 ? 'bg-amber-50' : 'bg-green-50'}>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                <p className="text-2xl font-bold">{auditResults.warnings.length}</p>
                <p className="text-sm text-slate-500">تحذيرات</p>
              </CardContent>
            </Card>
          </div>

          {/* نتائج الفحوصات */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                نتائج الفحوصات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditResults.checks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <p className="font-semibold">{check.name}</p>
                      <p className="text-sm text-slate-500">
                        تم فحص {check.count} عنصر
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.issues > 0 && (
                      <Badge variant="secondary">{check.issues} مشكلة</Badge>
                    )}
                    <Badge className={getStatusColor(check.status)}>
                      {check.status === 'passed' ? 'ناجح' : check.status === 'warning' ? 'تحذير' : 'فشل'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* الأخطاء */}
          {auditResults.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="bg-red-50">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <XCircle className="h-5 w-5" />
                  أخطاء تحتاج إصلاح فوري ({auditResults.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {auditResults.errors.map((error, index) => (
                  <Alert key={index} className={getSeverityColor(error.severity)}>
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{error.message}</p>
                          {error.details && (
                            <p className="text-sm mt-1">{error.details}</p>
                          )}
                        </div>
                        <Badge className="bg-red-600 text-white">
                          {error.severity === 'high' ? 'عالي' : error.severity === 'medium' ? 'متوسط' : 'منخفض'}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* التحذيرات */}
          {auditResults.warnings.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                  تحذيرات ({auditResults.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {auditResults.warnings.slice(0, 10).map((warning, index) => (
                  <Alert key={index} className={getSeverityColor(warning.severity)}>
                    <AlertDescription>
                      <p className="font-semibold">{warning.message}</p>
                    </AlertDescription>
                  </Alert>
                ))}
                {auditResults.warnings.length > 10 && (
                  <p className="text-center text-slate-500">
                    و {auditResults.warnings.length - 10} تحذيرات أخرى...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* التوصيات */}
          {auditResults.recommendations.length > 0 && (
            <Card className="border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Sparkles className="h-5 w-5" />
                  توصيات الذكاء الاصطناعي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {auditResults.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                    <Badge className={
                      rec.priority === 'high' ? 'bg-red-600' : 
                      rec.priority === 'medium' ? 'bg-amber-600' : 'bg-blue-600'
                    }>
                      {rec.priority === 'high' ? 'عاجل' : rec.priority === 'medium' ? 'مهم' : 'اقتراح'}
                    </Badge>
                    <p className="flex-1">{rec.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* حالة النظام */}
          {auditResults.errors.length === 0 && auditResults.warnings.length === 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-2xl font-bold text-green-700">النظام المالي سليم</h3>
                <p className="text-green-600 mt-2">
                  لم يتم اكتشاف أي مشاكل أو تناقضات في البيانات المالية
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!auditResults && !auditing && (
        <Card className="bg-slate-50">
          <CardContent className="p-12 text-center">
            <FileSearch className="h-16 w-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold text-slate-600">لم يتم إجراء مراجعة بعد</h3>
            <p className="text-slate-500 mt-2">
              اضغط على "بدء المراجعة" لفحص النظام المالي بالكامل
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}