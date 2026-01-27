import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, User, Key, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function AdminEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    whatsapp: '',
    role: 'employee',
    permissions: [],
    assigned_airlines: [],
    is_active: true
  });

  const permissionOptions = [
    { id: 'bookings', label: 'إدارة الحجوزات' },
    { id: 'flights', label: 'إدارة الرحلات' },
    { id: 'airlines', label: 'إدارة شركات الطيران' },
    { id: 'airports', label: 'إدارة المطارات' },
    { id: 'agents', label: 'إدارة الوكلاء' },
    { id: 'providers', label: 'إدارة المزودين' },
    { id: 'customers', label: 'إدارة العملاء' },
    { id: 'finance', label: 'المالية والمحاسبة' },
    { id: 'settings', label: 'الإعدادات' },
    { id: 'advertisements', label: 'الإعلانات' }
  ];

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
    const systemUser = localStorage.getItem('systemUser');
    if (!systemUser) {
      navigate(createPageUrl('SystemLogin') + '?type=admin');
    }
  };

  const loadData = async () => {
    const [employeesData, airlinesData] = await Promise.all([
      base44.entities.SystemUser.filter({ role: 'employee' }),
      base44.entities.Airline.list()
    ]);
    setEmployees(employeesData);
    setAirlines(airlinesData);
    setLoading(false);
  };

  const generateCredentials = () => {
    const username = `emp_${Date.now().toString(36)}`;
    const password = Math.random().toString(36).slice(-8);
    setFormData({ ...formData, username, password });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingEmployee) {
      await base44.entities.SystemUser.update(editingEmployee.id, formData);
      toast.success('تم تحديث الموظف بنجاح');
    } else {
      await base44.entities.SystemUser.create(formData);
      toast.success('تم إضافة الموظف بنجاح');
    }
    
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name || '',
      email: employee.email || '',
      username: employee.username || '',
      password: employee.password || '',
      phone: employee.phone || '',
      whatsapp: employee.whatsapp || '',
      role: 'employee',
      permissions: employee.permissions || [],
      assigned_airlines: employee.assigned_airlines || [],
      is_active: employee.is_active !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف الموظف؟')) {
      await base44.entities.SystemUser.delete(id);
      toast.success('تم حذف الموظف');
      loadData();
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      full_name: '',
      email: '',
      username: '',
      password: '',
      phone: '',
      whatsapp: '',
      role: 'employee',
      permissions: [],
      assigned_airlines: [],
      is_active: true
    });
  };

  const togglePermission = (permId) => {
    const current = formData.permissions || [];
    if (current.includes(permId)) {
      setFormData({ ...formData, permissions: current.filter(p => p !== permId) });
    } else {
      setFormData({ ...formData, permissions: [...current, permId] });
    }
  };

  const toggleAirline = (airlineId) => {
    const current = formData.assigned_airlines || [];
    if (current.includes(airlineId)) {
      setFormData({ ...formData, assigned_airlines: current.filter(a => a !== airlineId) });
    } else {
      setFormData({ ...formData, assigned_airlines: [...current, airlineId] });
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.full_name?.includes(searchTerm) || 
    e.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">الموظفين</h1>
            <p className="text-slate-600">إدارة موظفي النظام وصلاحياتهم</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة موظف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'تعديل الموظف' : 'إضافة موظف جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الاسم الكامل</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>رقم الواتساب</Label>
                    <Input
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">بيانات الدخول</h3>
                    {!editingEmployee && (
                      <Button type="button" variant="outline" size="sm" onClick={generateCredentials}>
                        <Key className="h-4 w-4 ml-1" />
                        إنشاء تلقائي
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اسم المستخدم</Label>
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          dir="ltr"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">الصلاحيات</Label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-lg">
                    {permissionOptions.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(formData.permissions || []).includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">شركات الطيران المسؤول عنها (لإشعارات الإصدار)</Label>
                  <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 rounded-lg">
                    {airlines.map((airline) => (
                      <label key={airline.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(formData.assigned_airlines || []).includes(airline.id)}
                          onCheckedChange={() => toggleAirline(airline.id)}
                        />
                        <span className="text-sm">{airline.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>نشط</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit">{editingEmployee ? 'تحديث' : 'إضافة'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث عن موظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>بيانات الدخول</TableHead>
                  <TableHead>الصلاحيات</TableHead>
                  <TableHead>الشركات المسؤول عنها</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{employee.full_name}</p>
                          <p className="text-sm text-slate-500">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-sm">{employee.username}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(employee.permissions || []).slice(0, 2).map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {permissionOptions.find(p => p.id === perm)?.label || perm}
                          </Badge>
                        ))}
                        {(employee.permissions || []).length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{(employee.permissions || []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(employee.assigned_airlines || []).slice(0, 2).map((airlineId) => {
                          const airline = airlines.find(a => a.id === airlineId);
                          return airline ? (
                            <Badge key={airlineId} variant="outline" className="text-xs">{airline.code}</Badge>
                          ) : null;
                        })}
                        {(employee.assigned_airlines || []).length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{(employee.assigned_airlines || []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={employee.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {employee.is_active !== false ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(employee)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(employee.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
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