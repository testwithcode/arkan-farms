import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Plus, Download, FileText, Edit2, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/DatePicker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Billing() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    customer_name: '',
    mobile_number: '',
    address: '',
    farm_id: '',
    items: [{ product_name: '', quantity: 1, rate: 0, total: 0 }],
    subtotal: 0,
    gst_enabled: false,
    gst_amount: 0,
    total: 0,
    payment_status: 'unpaid',
    notes: ''
  });

  useEffect(() => {
    fetchFarms();
    fetchInvoices();
  }, []);

  useEffect(() => {
    generateInvoiceNumber();
  }, [invoices]);

  const fetchFarms = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/farms`, {
        withCredentials: true
      });
      setFarms(data);
    } catch (error) {
      console.error('Error fetching farms:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/invoices`, {
        withCredentials: true
      });
      setInvoices(data);
    } catch (error) {
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const count = invoices.length + 1;
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    setFormData(prev => ({ ...prev, invoice_number: invoiceNo }));
  };

  const calculateTotals = (items, gstEnabled) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const gstAmount = gstEnabled ? subtotal * 0.18 : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].total = newItems[index].quantity * newItems[index].rate;
    }
    
    const totals = calculateTotals(newItems, formData.gst_enabled);
    setFormData({
      ...formData,
      items: newItems,
      ...totals
    });
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_name: '', quantity: 1, rate: 0, total: 0 }]
    });
  };

  const removeProduct = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const totals = calculateTotals(newItems, formData.gst_enabled);
    setFormData({
      ...formData,
      items: newItems,
      ...totals
    });
  };

  const handleGSTToggle = () => {
    const gstEnabled = !formData.gst_enabled;
    const totals = calculateTotals(formData.items, gstEnabled);
    setFormData({
      ...formData,
      gst_enabled: gstEnabled,
      ...totals
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API_URL}/api/invoices`, formData, {
        withCredentials: true
      });
      toast.success('Invoice generated successfully');
      fetchInvoices();
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      date: new Date().toISOString().split('T')[0],
      customer_name: '',
      mobile_number: '',
      address: '',
      farm_id: '',
      items: [{ product_name: '', quantity: 1, rate: 0, total: 0 }],
      subtotal: 0,
      gst_enabled: false,
      gst_amount: 0,
      total: 0,
      payment_status: 'unpaid',
      notes: ''
    });
    generateInvoiceNumber();
  };

  const updatePaymentStatus = async (invoiceId, newStatus) => {
    try {
      await axios.put(
        `${API_URL}/api/invoices/${invoiceId}`,
        { payment_status: newStatus },
        { withCredentials: true }
      );
      toast.success('Payment status updated');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/invoices/${invoiceId}`, {
        withCredentials: true
      });
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const generatePDF = (invoice) => {
    const doc = new jsPDF();
    const farm = farms.find(f => f.id === invoice.farm_id);
    const farmName = farm ? `${farm.name} (${farm.location})` : 'Farm';
    
    doc.setFontSize(20);
    doc.text(farmName, 14, 20);
    doc.setFontSize(12);
    doc.text('Poultry Farm Management', 14, 28);
    doc.setFontSize(10);
    doc.text(`Invoice: ${invoice.invoice_number}`, 14, 36);
    doc.text(`Date: ${invoice.date}`, 14, 42);
    
    doc.text(`Customer: ${invoice.customer_name}`, 120, 36);
    doc.text(`Mobile: ${invoice.mobile_number}`, 120, 42);
    doc.text(`Address: ${invoice.address}`, 120, 48);
    
    const tableData = invoice.items.map(item => [
      item.product_name,
      item.quantity,
      `₹${item.rate}`,
      `₹${item.total}`
    ]);
    
    autoTable(doc, {
      startY: 55,
      head: [['Product', 'Quantity', 'Rate', 'Total']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10 }
    });
    
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ₹${invoice.subtotal}`, 140, finalY);
    if (invoice.gst_amount > 0) {
      doc.text(`GST (18%): ₹${invoice.gst_amount}`, 140, finalY + 6);
    }
    doc.setFontSize(12);
    doc.text(`Total: ₹${invoice.total}`, 140, finalY + (invoice.gst_amount > 0 ? 12 : 6));
    doc.setFontSize(10);
    doc.text(`Payment Status: ${invoice.payment_status.toUpperCase()}`, 14, finalY + 10);
    
    if (invoice.notes) {
      doc.text(`Notes: ${invoice.notes}`, 14, finalY + 16);
    }
    
    doc.save(`${invoice.invoice_number}.pdf`);
    toast.success('PDF downloaded');
  };

  const downloadAllInvoicesPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('All Invoices Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const tableData = filteredInvoices.map(inv => {
      const farm = farms.find(f => f.id === inv.farm_id);
      return [
        inv.invoice_number,
        inv.date,
        inv.customer_name,
        farm?.name || '-',
        `₹${inv.total}`,
        inv.payment_status
      ];
    });
    
    autoTable(doc, {
      startY: 35,
      head: [['Invoice #', 'Date', 'Customer', 'Farm', 'Total', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 }
    });
    
    doc.save('all_invoices_report.pdf');
    toast.success('All invoices PDF downloaded');
  };

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-green-400 bg-green-500/20';
      case 'partial': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-red-400 bg-red-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 lg:ml-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E67E22]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 overflow-y-auto bg-[#0A0B09]">
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl lg:text-5xl font-light text-white mb-2 font-['Outfit']" data-testid="billing-title">
                {t('billing')}
              </h1>
              <p className="text-white/50 text-sm">Manage invoices and billing</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder={t('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 glass-input rounded-xl text-sm"
                  data-testid="search-input"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={downloadAllInvoicesPDF}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="download-all-button"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t('downloadAllInvoices')}
                </Button>
                <Button
                  onClick={() => { resetForm(); setShowModal(true); }}
                  className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                  data-testid="generate-invoice-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('generateInvoice')}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" data-testid="invoices-table">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('invoiceNumber')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('date')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('customerName')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      Farm
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('total')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('paymentStatus')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-white/40">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice, index) => {
                      const farm = farms.find(f => f.id === invoice.farm_id);
                      return (
                        <tr
                          key={invoice.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          data-testid={`invoice-row-${index}`}
                        >
                          <td className="p-3 text-white font-mono text-sm">{invoice.invoice_number}</td>
                          <td className="p-3 text-white">{invoice.date}</td>
                          <td className="p-3 text-white">{invoice.customer_name}</td>
                          <td className="p-3 text-white">{farm?.name || '-'}</td>
                          <td className="p-3 text-right text-white">₹{invoice.total.toLocaleString('en-IN')}</td>
                          <td className="p-3">
                            <select
                              value={invoice.payment_status}
                              onChange={(e) => updatePaymentStatus(invoice.id, e.target.value)}
                              className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.payment_status)} border-0 cursor-pointer`}
                              data-testid={`status-select-${index}`}
                            >
                              <option value="paid">{t('paid')}</option>
                              <option value="unpaid">{t('unpaid')}</option>
                              <option value="partial">{t('partial')}</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => generatePDF(invoice)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                data-testid={`download-pdf-${index}`}
                              >
                                <Download className="w-4 h-4 text-white/70" />
                              </button>
                              <button
                                onClick={() => deleteInvoice(invoice.id)}
                                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                data-testid={`delete-invoice-${index}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#121410] border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Outfit']">{t('generateInvoice')}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="invoice-form">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('invoiceNumber')}</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  readOnly
                  className="w-full px-4 py-2 glass-input rounded-xl bg-white/5"
                  data-testid="invoice-number-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('date')}</label>
                <DatePicker
                  value={formData.date}
                  onChange={(date) => setFormData({...formData, date})}
                  testId="date-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('customerName')}</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="customer-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('mobileNumber')}</label>
                <input
                  type="tel"
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({...formData, mobile_number: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="mobile-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('address')}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="address-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('selectFarm')}</label>
                <Select
                  value={formData.farm_id}
                  onValueChange={(value) => setFormData({...formData, farm_id: value})}
                >
                  <SelectTrigger className="glass-input rounded-xl" data-testid="farm-select">
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121410] border-white/10 text-white">
                    {farms.map(farm => (
                      <SelectItem key={farm.id} value={farm.id} data-testid={`farm-option-${farm.name.toLowerCase()}`}>
                        {farm.name} ({farm.location})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">Products</label>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder={t('productName')}
                      value={item.product_name}
                      onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-sm"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder={t('quantity')}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-sm"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder={t('rate')}
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-sm"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.total}
                      readOnly
                      className="w-full px-3 py-2 glass-input rounded-xl text-sm bg-white/5"
                    />
                  </div>
                  <div className="col-span-1">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                onClick={addProduct}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="add-product-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('addProduct')}
              </Button>
            </div>

            <div className="space-y-2 p-4 glass-card rounded-xl">
              <div className="flex justify-between text-white">
                <span>{t('subtotal')}:</span>
                <span>₹{formData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.gst_enabled}
                    onChange={handleGSTToggle}
                    className="rounded"
                    data-testid="gst-checkbox"
                  />
                  <span>{t('gst')} (18%)</span>
                </label>
                <span className="text-white">₹{formData.gst_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-medium text-white pt-2 border-t border-white/10">
                <span>{t('total')}:</span>
                <span>₹{formData.total.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('paymentStatus')}</label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) => setFormData({...formData, payment_status: value})}
              >
                <SelectTrigger className="glass-input rounded-xl" data-testid="payment-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121410] border-white/10 text-white">
                  <SelectItem value="paid">{t('paid')}</SelectItem>
                  <SelectItem value="unpaid">{t('unpaid')}</SelectItem>
                  <SelectItem value="partial">{t('partial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-2 glass-input rounded-xl"
                rows="2"
                data-testid="notes-input"
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                data-testid="save-invoice-button"
              >
                {t('generateInvoice')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
