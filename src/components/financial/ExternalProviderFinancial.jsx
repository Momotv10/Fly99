import { base44 } from '@/api/base44Client';

/**
 * نظام إدارة العمليات المالية للمزود الخارجي الذكي
 */

class ExternalProviderFinancialService {
  constructor() {
    this.externalProviderAccountId = null;
    this.revenueAccountId = null;
    this.commissionAccountId = null;
  }

  /**
   * تهيئة الحسابات المالية للمزود الخارجي
   */
  async initializeAccounts() {
    try {
      // البحث عن حساب المزود الخارجي
      let externalAccount = await base44.entities.Account.filter({ 
        category: 'provider',
        name: 'المزود الخارجي الذكي'
      });

      if (externalAccount.length === 0) {
        // إنشاء حساب جديد للمزود الخارجي
        externalAccount = [await base44.entities.Account.create({
          account_number: `EXT${Date.now().toString().slice(-6)}`,
          name: 'المزود الخارجي الذكي',
          name_en: 'Smart External Provider',
          type: 'liability',
          category: 'provider',
          is_system: true,
          is_main: true,
          balance: 0
        })];
      }

      this.externalProviderAccountId = externalAccount[0].id;

      // حساب إيرادات المزود الخارجي
      let revenueAccount = await base44.entities.Account.filter({
        category: 'commission_revenue',
        name: 'إيرادات المزود الخارجي'
      });

      if (revenueAccount.length === 0) {
        revenueAccount = [await base44.entities.Account.create({
          account_number: `REV${Date.now().toString().slice(-6)}`,
          name: 'إيرادات المزود الخارجي',
          name_en: 'External Provider Revenue',
          type: 'revenue',
          category: 'commission_revenue',
          is_system: true,
          balance: 0
        })];
      }

      this.revenueAccountId = revenueAccount[0].id;

      // حساب عمولات المزود الخارجي
      let commissionAccount = await base44.entities.Account.filter({
        category: 'commission',
        name: 'عمولات المزود الخارجي'
      });

      if (commissionAccount.length === 0) {
        commissionAccount = [await base44.entities.Account.create({
          account_number: `COM${Date.now().toString().slice(-6)}`,
          name: 'عمولات المزود الخارجي',
          name_en: 'External Provider Commissions',
          type: 'revenue',
          category: 'commission',
          is_system: true,
          balance: 0
        })];
      }

      this.commissionAccountId = commissionAccount[0].id;

      // تحديث الإعدادات
      const settings = await base44.entities.ExternalProviderSettings.filter({ setting_type: 'general' });
      if (settings.length > 0) {
        await base44.entities.ExternalProviderSettings.update(settings[0].id, {
          external_provider_account_id: this.externalProviderAccountId
        });
      }

      return {
        success: true,
        accounts: {
          provider: this.externalProviderAccountId,
          revenue: this.revenueAccountId,
          commission: this.commissionAccountId
        }
      };

    } catch (error) {
      console.error('Initialize accounts error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء قيد مالي عند استلام الدفع
   */
  async createPaymentEntry(booking, paymentData) {
    try {
      await this.ensureAccountsInitialized();

      const transactionNumber = `TXN${Date.now().toString().slice(-8)}`;
      const now = new Date().toISOString();

      // 1. قيد استلام الدفع من العميل (محفظة / بوابة الدفع)
      const paymentAccount = await this.getPaymentGatewayAccount(paymentData.method);

      if (paymentAccount) {
        await base44.entities.AccountTransaction.create({
          transaction_number: transactionNumber + '-PAY',
          account_id: paymentAccount.id,
          account_name: paymentAccount.name,
          transaction_date: now,
          transaction_type: 'debit',
          amount: booking.total_price,
          description: `استلام دفعة حجز خارجي - ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          balance_before: paymentAccount.balance,
          balance_after: paymentAccount.balance + booking.total_price,
          status: 'completed'
        });

        // تحديث رصيد المحفظة
        await base44.entities.Account.update(paymentAccount.id, {
          balance: paymentAccount.balance + booking.total_price,
          debit_total: (paymentAccount.debit_total || 0) + booking.total_price
        });
      }

      // 2. قيد إيرادات المبيعات
      const revenueAccount = await base44.entities.Account.filter({ id: this.revenueAccountId });
      if (revenueAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          transaction_number: transactionNumber + '-REV',
          account_id: this.revenueAccountId,
          account_name: revenueAccount[0].name,
          transaction_date: now,
          transaction_type: 'credit',
          amount: booking.total_price,
          description: `مبيعات مزود خارجي - ${booking.booking_number}`,
          reference_type: 'booking',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          balance_before: revenueAccount[0].balance,
          balance_after: revenueAccount[0].balance + booking.total_price,
          status: 'completed'
        });

        await base44.entities.Account.update(this.revenueAccountId, {
          balance: revenueAccount[0].balance + booking.total_price,
          credit_total: (revenueAccount[0].credit_total || 0) + booking.total_price
        });
      }

      // 3. قيد العمولة المحصلة
      const commissionAccount = await base44.entities.Account.filter({ id: this.commissionAccountId });
      if (commissionAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          transaction_number: transactionNumber + '-COM',
          account_id: this.commissionAccountId,
          account_name: commissionAccount[0].name,
          transaction_date: now,
          transaction_type: 'credit',
          amount: booking.system_commission,
          description: `عمولة مزود خارجي - ${booking.booking_number}`,
          reference_type: 'commission',
          reference_id: booking.id,
          reference_number: booking.booking_number,
          balance_before: commissionAccount[0].balance,
          balance_after: commissionAccount[0].balance + booking.system_commission,
          status: 'completed'
        });

        await base44.entities.Account.update(this.commissionAccountId, {
          balance: commissionAccount[0].balance + booking.system_commission,
          credit_total: (commissionAccount[0].credit_total || 0) + booking.system_commission
        });
      }

      // تحديث الحجز بمعرف القيد المالي
      await base44.entities.ExternalProviderBooking.update(booking.id, {
        financial_entry_id: transactionNumber
      });

      return { success: true, transaction_number: transactionNumber };

    } catch (error) {
      console.error('Create payment entry error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * التأكد من تهيئة الحسابات
   */
  async ensureAccountsInitialized() {
    if (!this.externalProviderAccountId) {
      await this.initializeAccounts();
    }
  }

  /**
   * الحصول على حساب بوابة الدفع
   */
  async getPaymentGatewayAccount(paymentMethod) {
    const methodMap = {
      card: 'بوابة الدفع الإلكتروني',
      wallet: 'المحافظ الإلكترونية',
      bank_transfer: 'الحساب البنكي',
      cash: 'النقدية'
    };

    const accountName = methodMap[paymentMethod] || 'النقدية';
    const accounts = await base44.entities.Account.filter({ 
      category: 'payment_gateway',
      name: accountName
    });

    if (accounts.length > 0) {
      return accounts[0];
    }

    // إنشاء الحساب إذا لم يكن موجوداً
    const newAccount = await base44.entities.Account.create({
      account_number: `PG${Date.now().toString().slice(-6)}`,
      name: accountName,
      name_en: paymentMethod,
      type: 'asset',
      category: 'payment_gateway',
      balance: 0
    });

    return newAccount;
  }

  /**
   * إنشاء قيد مالي عند إصدار التذكرة
   */
  async createTicketIssuanceEntry(booking) {
    try {
      await this.ensureAccountsInitialized();

      const transactionNumber = `ISU${Date.now().toString().slice(-8)}`;
      const now = new Date().toISOString();

      // قيد تكلفة إصدار التذكرة (سعر المصدر)
      const externalAccount = await base44.entities.Account.filter({ id: this.externalProviderAccountId });
      if (externalAccount.length > 0) {
        await base44.entities.AccountTransaction.create({
          transaction_number,
          account_id: this.externalProviderAccountId,
          account_name: externalAccount[0].name,
          transaction_date: now,
          transaction_type: 'debit',
          amount: booking.source_price,
          description: `تكلفة إصدار تذكرة - ${booking.booking_number}`,
          reference_type: 'ticket_issue',
          reference_id: booking.id,
          reference_number: booking.ticket_number,
          balance_before: externalAccount[0].balance,
          balance_after: externalAccount[0].balance + booking.source_price,
          status: 'completed'
        });

        await base44.entities.Account.update(this.externalProviderAccountId, {
          balance: externalAccount[0].balance + booking.source_price,
          debit_total: (externalAccount[0].debit_total || 0) + booking.source_price
        });
      }

      return { success: true };

    } catch (error) {
      console.error('Create issuance entry error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على ملخص مالي
   */
  async getFinancialSummary() {
    try {
      await this.ensureAccountsInitialized();

      const allBookings = await base44.entities.ExternalProviderBooking.filter({ 
        payment_status: 'paid' 
      });

      const totalRevenue = allBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
      const totalCommission = allBookings.reduce((sum, b) => sum + (b.system_commission || 0), 0);
      const totalSourceCost = allBookings.reduce((sum, b) => sum + (b.source_price || 0), 0);
      const totalProfit = totalCommission;

      const issuedBookings = allBookings.filter(b => b.status === 'issued');
      const pendingBookings = allBookings.filter(b => b.status === 'pending_issue');

      return {
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        total_source_cost: totalSourceCost,
        total_profit: totalProfit,
        total_bookings: allBookings.length,
        issued_bookings: issuedBookings.length,
        pending_bookings: pendingBookings.length
      };

    } catch (error) {
      console.error('Get financial summary error:', error);
      return null;
    }
  }
}

export const externalProviderFinancial = new ExternalProviderFinancialService();
export default ExternalProviderFinancialService;