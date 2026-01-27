import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Users, Mail, Phone, Ticket, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkAuth();
    loadCustomers();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadCustomers = async () => {
    const data = await base44.entities.Customer.list('-created_date');
    setCustomers(data);
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.full_name?.includes(searchTerm) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">العملاء</h1>
          <p className="text-slate-600">قائمة العملاء المسجلين في النظام</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن عميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {customers.length} عميل
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العميل</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>طريقة التسجيل</TableHead>
                  <TableHead>عدد الحجوزات</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          {customer.avatar_url ? (
                            <img src={customer.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <Users className="h-5 w-5 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{customer.full_name || 'بدون اسم'}</p>
                          <p className="text-xs text-slate-500">{customer.nationality}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">{customer.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="h-4 w-4" />
                          <span className="text-sm" dir="ltr">{customer.phone}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {customer.auth_provider === 'google' ? 'Google' : 'بريد إلكتروني'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-slate-400" />
                        <span>{customer.total_bookings || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.created_date && format(new Date(customer.created_date), 'dd MMM yyyy', { locale: ar })}
                    </TableCell>
                    <TableCell>
                      <Badge className={customer.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {customer.is_active !== false ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}