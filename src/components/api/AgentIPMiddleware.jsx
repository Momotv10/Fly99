/**
 * نظام التحقق من IP للوكلاء
 * Agent IP Whitelisting Middleware
 */

import { base44 } from '@/api/base44Client';

export const AgentIPMiddleware = {
  
  /**
   * التحقق من صلاحية IP
   */
  async verifyIP(agent, requestIP) {
    // إذا لم تكن هناك قائمة بيضاء، السماح للجميع
    if (!agent.api_whitelist_ips || agent.api_whitelist_ips.length === 0) {
      return { allowed: true };
    }
    
    // التحقق من وجود IP في القائمة البيضاء
    const isWhitelisted = agent.api_whitelist_ips.includes(requestIP);
    
    if (!isWhitelisted) {
      return {
        allowed: false,
        error: 'IP_NOT_WHITELISTED',
        message: `عنوان IP (${requestIP}) غير مسموح. يرجى إضافته للقائمة البيضاء في الإعدادات.`,
        current_ip: requestIP,
        whitelisted_ips: agent.api_whitelist_ips
      };
    }
    
    return { allowed: true };
  },
  
  /**
   * إضافة IP للقائمة البيضاء
   */
  async addIPToWhitelist(agentId, newIP) {
    try {
      const agents = await base44.entities.Agent.filter({ id: agentId });
      if (agents.length === 0) {
        return { success: false, error: 'Agent not found' };
      }
      
      const agent = agents[0];
      const currentIPs = agent.api_whitelist_ips || [];
      
      if (currentIPs.includes(newIP)) {
        return { success: false, error: 'IP already whitelisted' };
      }
      
      const updatedIPs = [...currentIPs, newIP];
      await base44.entities.Agent.update(agentId, {
        api_whitelist_ips: updatedIPs
      });
      
      return { 
        success: true, 
        message: `تم إضافة IP ${newIP} للقائمة البيضاء`,
        whitelisted_ips: updatedIPs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  /**
   * إزالة IP من القائمة البيضاء
   */
  async removeIPFromWhitelist(agentId, ipToRemove) {
    try {
      const agents = await base44.entities.Agent.filter({ id: agentId });
      if (agents.length === 0) {
        return { success: false, error: 'Agent not found' };
      }
      
      const agent = agents[0];
      const currentIPs = agent.api_whitelist_ips || [];
      const updatedIPs = currentIPs.filter(ip => ip !== ipToRemove);
      
      await base44.entities.Agent.update(agentId, {
        api_whitelist_ips: updatedIPs
      });
      
      return { 
        success: true, 
        message: `تم إزالة IP ${ipToRemove}`,
        whitelisted_ips: updatedIPs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  /**
   * الحصول على IP الحالي
   */
  async getCurrentIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }
};

export default AgentIPMiddleware;