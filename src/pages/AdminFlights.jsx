import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Plane, Search, Eye, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { autoFlightPairing } from '@/components/provider/AutoFlightPairing';

export default function AdminFlights() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [airlineFilter, setAirlineFilter] = useState('all');

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
    const [flightsData, airlinesData] = await Promise.all([
      base44.entities.Flight.list('-created_date', 100),
      base44.entities.Airline.list()
    ]);
    setFlights(flightsData);
    setAirlines(airlinesData);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف الرحلة؟')) {
      // حذف أزواج الرحلات المرتبطة
      const pairs = await base44.entities.FlightPair.filter({
        $or: [
          { outbound_flight_id: id },
          { return_flight_id: id }
        ]
      });
      
      for (const pair of pairs) {
        await base44.entities.FlightPair.delete(pair.id);
      }
      
      await base44.entities.Flight.delete(id);
      toast.success('تم حذف الرحلة وأزواجها');
      loadData();
    }
  };

  const toggleStatus = async (flight) => {
    const newStatus = flight.status === 'active' ? 'closed' : 'active';
    await base44.entities.Flight.update(flight.id, { status: newStatus });
    toast.success(`تم ${newStatus === 'active' ? 'تفعيل' : 'إغلاق'} الرحلة`);
    loadData();
  };

  const filteredFlights = flights.filter(f => {
    const matchSearch = 
      f.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.airline_name?.includes(searchTerm) ||
      f.departure_city?.includes(searchTerm) ||
      f.arrival_city?.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    const matchAirline = airlineFilter === 'all' || f.airline_id === airlineFilter;
    return matchSearch && matchStatus && matchAirline;
  });

  const statusConfig = {
    active: { label: 'نشطة', color: 'bg-green-100 text-green-700' },
    closed: { label: 'مغلقة', color: 'bg-red-100 text-red-700' },
    sold_out: { label: 'نفدت', color: 'bg-gray-100 text-gray-700' }
  };

  const classLabels = {
    economy: 'اقتصادي',
    business: 'رجال أعمال',
    first: 'درجة أولى'
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <AdminSidebar />
      
      <div className="lg:mr-64 p-6 pt-20 lg:pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">الرحلات</h1>
            <p className="text-slate-600">إدارة رحلات الطيران</p>
          </div>
          <Link to={createPageUrl('AdminFlightForm')}>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              إضافة رحلة
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث عن رحلة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="closed">مغلقة</SelectItem>
                  <SelectItem value="sold_out">نفدت</SelectItem>
                </SelectContent>
              </Select>
              <Select value={airlineFilter} onValueChange={setAirlineFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="شركة الطيران" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الشركات</SelectItem>
                  {airlines.map((airline) => (
                    <SelectItem key={airline.id} value={airline.id}>{airline.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الرحلة</TableHead>
                    <TableHead>شركة الطيران</TableHead>
                    <TableHead>المسار</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الدرجة</TableHead>
                    <TableHead>المقاعد</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlights.map((flight) => {
                    const status = statusConfig[flight.status] || statusConfig.active;
                    return (
                      <TableRow key={flight.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{flight.flight_number}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {flight.airline_logo ? (
                              <img src={flight.airline_logo} alt="" className="h-6 w-6 object-contain" />
                            ) : (
                              <Plane className="h-4 w-4 text-slate-400" />
                            )}
                            <span>{flight.airline_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{flight.departure_city}</span>
                            <span className="text-slate-400 mx-1">←</span>
                            <span className="font-medium">{flight.arrival_city}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {flight.departure_airport_code} - {flight.arrival_airport_code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {flight.departure_date && format(new Date(flight.departure_date), 'dd MMM yyyy', { locale: ar })}
                          </div>
                          <div className="text-xs text-slate-500">{flight.departure_time}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{classLabels[flight.flight_class] || 'اقتصادي'}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={flight.available_seats <= 5 ? 'text-red-600 font-semibold' : ''}>
                            {flight.available_seats || 0} / {flight.total_seats || 0}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {flight.selling_price?.toLocaleString()} ر.س
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => toggleStatus(flight)}
                              title={flight.status === 'active' ? 'إغلاق' : 'تفعيل'}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link to={createPageUrl('AdminFlightForm') + '?id=' + flight.id}>
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(flight.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}