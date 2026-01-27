import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Phone, Shield, Trash2, Edit, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminEmergencyStaff() {
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    whatsapp: '',
    role: 'emergency'
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    const data = await base44.entities.EmergencyStaff.list();
    setStaff(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingStaff) {
        await base44.entities.EmergencyStaff.update(editingStaff.id, formData);
        toast.success('تم التحديث');
      } else {
        await base44.entities.EmergencyStaff.create(formData);
        toast.success('تم الإضافة');
      }
      
      setShowForm(false);
      setEditingStaff(null);
      setFormData({ full_name: '', whatsapp: '', role: 'emergency' });
      loadStaff();
    } catch (error) {
      toast.error('فشل الحفظ');
    }
  };

  const handleEdit = (member) => {
    setEditingStaff(member);
    setFormData({
      full_name: member.full_name,
      whatsapp: member.whatsapp,
      role: member.role
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من الحذف؟')) {
      await base44.entities.EmergencyStaff.delete(id);
      toast.success('تم الحذف');
      loadStaff();
    }
  };

  const toggleActive = async (member) => {
    await base44.entities.EmergencyStaff.update(member.id, {
      is_active: !member.is_active
    });
    loadStaff();
  };

  const getRoleBadge = (role) => {
    const styles = {
      emergency: 'bg-red-100 text-red-800',
      booking: 'bg-blue-100 text-blue-800',
      support: 'bg-green-100 text-green-800'
    };
    const labels = {
      emergency: 'طوارئ',
      booking: 'حجوزات',
      support: 'دعم'
    };
    return <Badge className={styles[role]}>{labels[role]}</Badge>;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              👨‍💼 فريق الطوارئ والدعم
            </h1>
            <p className="text-gray-600">إدارة موظفي الطوارئ والحجوزات</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            إضافة موظف
          </Button>
        </div>

        <div className="grid gap-4">
          {staff.map(member => (
            <Card key={member.id} className={!member.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {member.full_name.charAt(0)}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{member.full_name}</h3>
                        {getRoleBadge(member.role)}
                        {member.is_active && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                            نشط
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span className="font-mono">{member.whatsapp}</span>
                      </div>
                      
                      {member.handled_cases > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          عدد الحالات المعالجة: {member.handled_cases}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(member)}
                    >
                      {member.is_active ? 'تعطيل' : 'تفعيل'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(member)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(member.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {staff.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا يوجد موظفين حتى الآن</p>
                <p className="text-sm text-gray-500 mt-2">أضف موظف لبدء استقبال الحالات الطارئة</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'تعديل موظف' : 'إضافة موظف جديد'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>الاسم الكامل</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  required
                  placeholder="أحمد محمد"
                />
              </div>

              <div>
                <Label>رقم الواتساب</Label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                  required
                  placeholder="+967xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div>
                <Label>نوع الموظف</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({...formData, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">طوارئ</SelectItem>
                    <SelectItem value="booking">حجوزات</SelectItem>
                    <SelectItem value="support">دعم فني</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
                <Button type="submit">
                  {editingStaff ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}