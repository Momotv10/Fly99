import { base44 } from '@/api/base44Client';

/**
 * خدمة المحاسبة المالية
 * تقوم بتسجيل جميع الحركات المالية وقيودها تلقائياً
 */
export const FinancialService = {
  
  /**
   * تسجيل إصدار تذكرة - قيد مالي كامل
   * من: حساب المبيعات
   * إلى: حساب المزود + حساب العمولات
   */
  async recordTicketIssue({ booking, provider, agent = null }) {
    const timestamp = new Date().toISOString();
    const ticketAmount = booking.ticket_price || booking.total_amount;
    const systemCommission = booking.system_commission || provider.commission_value || 0;
    const providerAmount = ticketAmount - systemCommission;
    const agentCommission = booking.agent_commission || 0;

    // 1. جلب الحسابات المطلوبة
    const accounts = await base44.entities.Account.list();
    
    const providerAccount = accounts.find(a => 
      a.related_entity_type === 'provider' && a.related_entity_id === provider.id
    );
    
    const salesAccount = accounts.find(a => a.category === 'ticket_sales') ||
                         accounts.find(a => a.category === 'sales');
    
    const commissionAccount = accounts.find(a => a.category === 'commission_revenue') ||
                              accounts.find(a => a.category === 'commission');
    
    let agentAccount = null;
    if (agent) {
      agentAccount = accounts.find(a => 
        a.related_entity_type === 'agent' && a.related_entity_id === agent.id
      );
    }

    // 2. إنشاء القيد المحاسبي
    const entryNumber = `JE-TKT-${Date.now()}`;
    const entries = [];

    // مدين: المبيعات (أو حساب العميل/الوكيل)
    if (agentAccount) {
      entries.push({
        account_id: agentAccount.id,
        account_name: agentAccount.name,
        account_number: agentAccount.account_number,
        debit: ticketAmount,
        credit: 0,
        description: `إصدار تذكرة رقم ${booking.booking_number}`
      });
    } else if (salesAccount) {
      entries.push({
        account_id: salesAccount.id,
        account_name: salesAccount.name,
        account_number: salesAccount.account_number,
        debit: ticketAmount,
        credit: 0,
        description: `إيرادات تذكرة رقم ${booking.booking_number}`
      });
    }

    // دائن: حساب المزود بالمبلغ المستحق له
    if (providerAccount) {
      entries.push({
        account_id: providerAccount.id,
        account_name: providerAccount.name,
        account_number: providerAccount.account_number,
        debit: 0,
        credit: providerAmount,
        description: `مستحقات تذكرة للمزود - حجز ${booking.booking_number}`
      });
    }

    // دائن: حساب العمولات بعمولة النظام
    if (commissionAccount && systemCommission > 0) {
      entries.push({
        account_id: commissionAccount.id,
        account_name: commissionAccount.name,
        account_number: commissionAccount.account_number,
        debit: 0,
        credit: systemCommission,
        description: `عمولة النظام - حجز ${booking.booking_number}`
      });
    }

    // إنشاء القيد اليومي
    const journalEntry = await base44.entities.JournalEntry.create({
      entry_number: entryNumber,
      entry_date: timestamp.split('T')[0],
      description: `إصدار تذكرة - ${booking.booking_number} - ${booking.customer_name}`,
      reference_type: 'booking',
      reference_id: booking.id,
      entries,
      total_debit: ticketAmount,
      total_credit: ticketAmount,
      is_balanced: true,
      status: 'posted'
    });

    // 3. تحديث أرصدة الحسابات وإنشاء حركات
    // تحديث حساب المزود
    if (providerAccount) {
      const newBalance = (providerAccount.balance || 0) + providerAmount;
      await base44.entities.Account.update(providerAccount.id, {
        balance: newBalance,
        credit_total: (providerAccount.credit_total || 0) + providerAmount
      });

      // حركة الحساب
      await base44.entities.AccountTransaction.create({
        transaction_number: `TR-${Date.now()}-PRV`,
        account_id: providerAccount.id,
        account_name: providerAccount.name,
        account_number: providerAccount.account_number,
        transaction_date: timestamp,
        transaction_type: 'credit',
        amount: providerAmount,
        balance_before: providerAccount.balance || 0,
        balance_after: newBalance,
        description: `مستحقات تذكرة - ${booking.booking_number}`,
        reference_type: 'ticket_issue',
        reference_id: booking.id,
        reference_number: booking.booking_number,
        journal_entry_id: journalEntry.id,
        provider_id: provider.id,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        status: 'completed'
      });

      // تحديث رصيد المزود
      await base44.entities.Provider.update(provider.id, {
        balance: (provider.balance || 0) + providerAmount,
        total_revenue: (provider.total_revenue || 0) + providerAmount,
        total_commission_paid: (provider.total_commission_paid || 0) + systemCommission
      });

      // إنشاء حركة المزود
      await base44.entities.ProviderTransaction.create({
        provider_id: provider.id,
        provider_name: provider.company_name_ar,
        transaction_type: 'booking_earning',
        amount: providerAmount,
        balance_before: provider.balance || 0,
        balance_after: (provider.balance || 0) + providerAmount,
        reference_type: 'booking',
        reference_id: booking.id,
        description: `إيرادات تذكرة - ${booking.booking_number} - ${booking.customer_name}`,
        status: 'completed'
      });
    }

    // تحديث حساب العمولات
    if (commissionAccount && systemCommission > 0) {
      await base44.entities.Account.update(commissionAccount.id, {
        balance: (commissionAccount.balance || 0) + systemCommission,
        credit_total: (commissionAccount.credit_total || 0) + systemCommission
      });

      await base44.entities.AccountTransaction.create({
        transaction_number: `TR-${Date.now()}-COM`,
        account_id: commissionAccount.id,
        account_name: commissionAccount.name,
        account_number: commissionAccount.account_number,
        transaction_date: timestamp,
        transaction_type: 'credit',
        amount: systemCommission,
        balance_before: commissionAccount.balance || 0,
        balance_after: (commissionAccount.balance || 0) + systemCommission,
        description: `عمولة تذكرة - ${booking.booking_number}`,
        reference_type: 'commission',
        reference_id: booking.id,
        reference_number: booking.booking_number,
        journal_entry_id: journalEntry.id,
        provider_id: provider.id,
        booking_id: booking.id,
        status: 'completed'
      });
    }

    // تحديث حساب الوكيل إن وجد
    if (agent && agentAccount) {
      const newAgentBalance = (agentAccount.balance || 0) - ticketAmount;
      await base44.entities.Account.update(agentAccount.id, {
        balance: newAgentBalance,
        debit_total: (agentAccount.debit_total || 0) + ticketAmount
      });

      await base44.entities.AccountTransaction.create({
        transaction_number: `TR-${Date.now()}-AGT`,
        account_id: agentAccount.id,
        account_name: agentAccount.name,
        account_number: agentAccount.account_number,
        transaction_date: timestamp,
        transaction_type: 'debit',
        amount: ticketAmount,
        balance_before: agentAccount.balance || 0,
        balance_after: newAgentBalance,
        description: `خصم قيمة تذكرة - ${booking.booking_number}`,
        reference_type: 'booking',
        reference_id: booking.id,
        reference_number: booking.booking_number,
        journal_entry_id: journalEntry.id,
        agent_id: agent.id,
        booking_id: booking.id,
        status: 'completed'
      });

      // تحديث رصيد الوكيل
      await base44.entities.Agent.update(agent.id, {
        balance: (agent.balance || 0) - ticketAmount,
        total_bookings: (agent.total_bookings || 0) + 1,
        total_sales: (agent.total_sales || 0) + ticketAmount
      });

      // إنشاء حركة الوكيل
      await base44.entities.AgentTransaction.create({
        agent_id: agent.id,
        agent_name: agent.name,
        transaction_type: 'booking_payment',
        amount: -ticketAmount,
        balance_before: agent.balance || 0,
        balance_after: (agent.balance || 0) - ticketAmount,
        reference_type: 'booking',
        reference_id: booking.id,
        description: `خصم تذكرة - ${booking.booking_number}`,
        status: 'completed'
      });

      // إضافة عمولة الوكيل إن وجدت
      if (agentCommission > 0) {
        await base44.entities.Agent.update(agent.id, {
          balance: (agent.balance || 0) - ticketAmount + agentCommission,
          total_commission: (agent.total_commission || 0) + agentCommission
        });

        await base44.entities.AgentTransaction.create({
          agent_id: agent.id,
          agent_name: agent.name,
          transaction_type: 'commission',
          amount: agentCommission,
          balance_before: (agent.balance || 0) - ticketAmount,
          balance_after: (agent.balance || 0) - ticketAmount + agentCommission,
          reference_type: 'booking',
          reference_id: booking.id,
          description: `عمولة تذكرة - ${booking.booking_number}`,
          status: 'completed'
        });
      }
    }

    return { success: true, journalEntry };
  },

  /**
   * تسجيل تحويل مالي من المزود لوكيله
   */
  async recordProviderToAgentTransfer({ provider, providerAgent, amount, description }) {
    const timestamp = new Date().toISOString();
    
    // جلب الحسابات
    const accounts = await base44.entities.Account.list();
    
    const providerAccount = accounts.find(a => 
      a.related_entity_type === 'provider' && a.related_entity_id === provider.id
    );
    
    const agentAccount = accounts.find(a => 
      a.related_entity_type === 'provider_agent' && a.related_entity_id === providerAgent.id
    );

    if (!providerAccount || !agentAccount) {
      throw new Error('الحسابات المالية غير موجودة');
    }

    // إنشاء القيد
    const entryNumber = `JE-TRF-${Date.now()}`;
    const journalEntry = await base44.entities.JournalEntry.create({
      entry_number: entryNumber,
      entry_date: timestamp.split('T')[0],
      description: description || `تحويل من ${provider.company_name_ar} إلى ${providerAgent.name}`,
      reference_type: 'transfer',
      entries: [
        {
          account_id: providerAccount.id,
          account_name: providerAccount.name,
          account_number: providerAccount.account_number,
          debit: amount,
          credit: 0,
          description: `تحويل إلى ${providerAgent.name}`
        },
        {
          account_id: agentAccount.id,
          account_name: agentAccount.name,
          account_number: agentAccount.account_number,
          debit: 0,
          credit: amount,
          description: `تحويل من ${provider.company_name_ar}`
        }
      ],
      total_debit: amount,
      total_credit: amount,
      is_balanced: true,
      status: 'posted'
    });

    // تحديث الأرصدة
    // خصم من المزود
    const newProviderBalance = (provider.balance || 0) - amount;
    await base44.entities.Provider.update(provider.id, { balance: newProviderBalance });
    await base44.entities.Account.update(providerAccount.id, {
      balance: (providerAccount.balance || 0) - amount
    });

    await base44.entities.ProviderTransaction.create({
      provider_id: provider.id,
      provider_name: provider.company_name_ar,
      transaction_type: 'transfer_to_agent',
      amount: -amount,
      balance_before: provider.balance || 0,
      balance_after: newProviderBalance,
      reference_type: 'transfer',
      related_agent_id: providerAgent.id,
      related_agent_name: providerAgent.name,
      description: description || `تحويل إلى الوكيل ${providerAgent.name}`,
      status: 'completed'
    });

    // إضافة للوكيل
    const newAgentBalance = (providerAgent.balance || 0) + amount;
    await base44.entities.ProviderAgent.update(providerAgent.id, { balance: newAgentBalance });
    await base44.entities.Account.update(agentAccount.id, {
      balance: (agentAccount.balance || 0) + amount
    });

    await base44.entities.AccountTransaction.create({
      transaction_number: `TR-${Date.now()}-AGT`,
      account_id: agentAccount.id,
      account_name: agentAccount.name,
      transaction_date: timestamp,
      transaction_type: 'credit',
      amount: amount,
      balance_before: providerAgent.balance || 0,
      balance_after: newAgentBalance,
      description: description || `تحويل من ${provider.company_name_ar}`,
      reference_type: 'transfer',
      journal_entry_id: journalEntry.id,
      provider_id: provider.id,
      status: 'completed'
    });

    return { success: true, journalEntry };
  },

  /**
   * التحقق من رصيد الوكيل قبل الحجز
   */
  async validateAgentBalance(agentId, requiredAmount) {
    const agents = await base44.entities.Agent.filter({ id: agentId });
    if (agents.length === 0) {
      return { valid: false, message: 'الوكيل غير موجود' };
    }
    
    const agent = agents[0];
    const availableBalance = (agent.balance || 0) + (agent.credit_limit || 0);
    
    if (availableBalance < requiredAmount) {
      return { 
        valid: false, 
        message: `الرصيد غير كافي. المتاح: ${availableBalance}$، المطلوب: ${requiredAmount}$`,
        balance: agent.balance,
        creditLimit: agent.credit_limit,
        availableBalance
      };
    }
    
    return { valid: true, balance: agent.balance, creditLimit: agent.credit_limit, availableBalance };
  },

  /**
   * التحقق من رصيد وكيل المزود قبل الحجز
   */
  async validateProviderAgentBalance(providerAgentId, requiredAmount) {
    const agents = await base44.entities.ProviderAgent.filter({ id: providerAgentId });
    if (agents.length === 0) {
      return { valid: false, message: 'الوكيل غير موجود' };
    }
    
    const agent = agents[0];
    const availableBalance = (agent.balance || 0) + (agent.credit_limit || 0);
    
    if (availableBalance < requiredAmount) {
      return { 
        valid: false, 
        message: `الرصيد غير كافي. المتاح: ${availableBalance}$، المطلوب: ${requiredAmount}$`,
        balance: agent.balance,
        creditLimit: agent.credit_limit,
        availableBalance
      };
    }
    
    return { valid: true, balance: agent.balance, creditLimit: agent.credit_limit, availableBalance };
  }
};

export default FinancialService;