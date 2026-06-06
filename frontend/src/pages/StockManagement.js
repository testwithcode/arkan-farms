import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, Download, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { DatePicker } from '../components/DatePicker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const sortEntriesByDate = (items) => [...items].sort((a, b) => new Date(b.date) - new Date(a.date));

export default function StockManagement() {
  const { farmId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const farm = location.state?.farm;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [formData, setFormData] = useState({
    day: '',
    date: '',
    stock: '',
    dead: '',
    notes: ''
  });

  const fetchEntries = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/stock/${farmId}`, {
        withCredentials: true
      });
      setEntries(sortEntriesByDate(data));
    } catch (error) {
      toast.error('Failed to fetch entries');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchEntries();
    }
  }, [farmId, fetchEntries]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const stock = parseInt(formData.stock) || 0;
    const dead = parseInt(formData.dead) || 0;
    const left = stock - dead;

    const payload = {
      farm_id: farmId,
      day: parseInt(formData.day),
      date: formData.date,
      stock,
      dead,
      left,
      notes: formData.notes
    };

    setSaving(true);
    try {
      let savedEntry;
      if (editingEntry) {
        const { data } = await axios.put(`${API_URL}/api/stock/${editingEntry.id}`, payload, {
          withCredentials: true
        });
        savedEntry = data;
        toast.success('Entry updated successfully');
      } else {
        const { data } = await axios.post(`${API_URL}/api/stock`, payload, {
          withCredentials: true
        });
        savedEntry = data;
        toast.success('Entry added successfully');
      }

      setEntries((current) => {
        const withoutOldEntry = editingEntry
          ? current.filter((entry) => entry.id !== editingEntry.id)
          : current;
        return sortEntriesByDate([savedEntry, ...withoutOldEntry]);
      });
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setDeletingId(id);
    try {
      await axios.delete(`${API_URL}/api/stock/${id}`, {
        withCredentials: true
      });
      toast.success('Entry deleted successfully');
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      toast.error('Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      day: entry.day,
      date: entry.date,
      stock: entry.stock,
      dead: entry.dead,
      notes: entry.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      day: '',
      date: '',
      stock: '',
      dead: '',
      notes: ''
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const farmName = farm?.name || 'Farm';
    const farmLocation = farm?.location || '';
    
    doc.setFontSize(18);
    doc.text(`${farmName} (${farmLocation})`, 14, 20);
    doc.setFontSize(12);
    doc.text('Stock Management Report', 14, 28);
    
    // Sort by day ASC for PDF with weekly separators
    const sortedEntries = [...filteredEntries].sort((a, b) => a.day - b.day);
    const tableData = [];
    sortedEntries.forEach((entry, idx) => {
      tableData.push([
        entry.day,
        entry.date,
        entry.stock,
        entry.dead,
        entry.left,
        entry.notes || '-'
      ]);
      // Add weekly separator after every 7th day
      if (entry.day % 7 === 0 && idx < sortedEntries.length - 1) {
        tableData.push([{
          content: `--- End of Week ${entry.day / 7} ---`,
          colSpan: 6,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [230, 126, 34], textColor: [255, 255, 255] }
        }]);
      }
    });
    
    autoTable(doc, {
      startY: 35,
      head: [['Day', 'Date', 'Stock', 'Dead', 'Left', 'Notes']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    
    doc.save(`${farmName}_stock_report.pdf`);
    toast.success('PDF downloaded');
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredEntries.map(e => ({
        Day: e.day,
        Date: e.date,
        Stock: e.stock,
        Dead: e.dead,
        Left: e.left,
        Notes: e.notes || ''
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `${farm?.name || 'farm'}_stock.xlsx`);
    toast.success('Excel downloaded');
  };

  const filteredEntries = entries.filter(entry =>
    entry.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    currentStock: entries[0]?.left || 0,
    totalDead: entries.reduce((sum, e) => sum + e.dead, 0)
  };

  const shouldShowWeekSeparator = (index) => {
    if (index === filteredEntries.length - 1) return false;
    // Since entries are sorted DESC by date, the next entry in the array is older
    const currentDay = filteredEntries[index].day;
    const nextDay = filteredEntries[index + 1].day;
    // Show separator when crossing a week boundary (e.g., from day 8 to day 7)
    return Math.floor((currentDay - 1) / 7) !== Math.floor((nextDay - 1) / 7);
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
              <button
                onClick={() => navigate('/stock')}
                className="flex items-center gap-2 text-white/60 hover:text-white mb-2 transition-colors"
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('stockManagement')}
              </button>
              <h1 className="text-4xl font-light text-white font-['Outfit']" data-testid="farm-title">
                {farm ? `${t(farm.name.toLowerCase())} (${farm.location})` : 'Stock Management'}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('currentLiveStock')}
              </p>
              <p className="text-3xl font-medium text-green-400" data-testid="current-stock">
                {stats.currentStock}
              </p>
            </div>
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('totalDead')}
              </p>
              <p className="text-3xl font-medium text-red-400" data-testid="total-dead">
                {stats.totalDead}
              </p>
            </div>
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('lastUpdated')}
              </p>
              <p className="text-lg font-medium text-white">
                {entries[0]?.date || 'N/A'}
              </p>
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
                  onClick={exportToPDF}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="export-pdf-button"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="export-excel-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  onClick={() => { resetForm(); setShowModal(true); }}
                  className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                  data-testid="add-entry-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addEntry')}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" data-testid="stock-table">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('day')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('date')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('stock')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('dead')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('left')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('notes')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-white/40">
                        No entries found
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry, index) => (
                      <React.Fragment key={entry.id}>
                        <tr
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          data-testid={`entry-row-${index}`}
                        >
                          <td className="p-3 text-white">{entry.day}</td>
                          <td className="p-3 text-white">{entry.date}</td>
                          <td className="p-3 text-right text-white">{entry.stock}</td>
                          <td className="p-3 text-right text-red-400">{entry.dead}</td>
                          <td className="p-3 text-right text-green-400">{entry.left}</td>
                          <td className="p-3 text-white/70 text-sm">{entry.notes || '-'}</td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                data-testid={`edit-button-${index}`}
                              >
                                <Edit2 className="w-4 h-4 text-white/70" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId === entry.id}
                                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50"
                                data-testid={`delete-button-${index}`}
                              >
                                {deletingId === entry.id ? (
                                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {shouldShowWeekSeparator(index) && (
                          <tr data-testid={`week-separator-${index}`}>
                            <td colSpan="7" className="p-0">
                              <div className="border-t-2 border-[#E67E22] my-1 relative">
                                <span className="absolute -top-3 left-4 bg-[#0A0B09] px-3 text-xs text-[#E67E22] font-bold tracking-widest">
                                  WEEK {Math.ceil(entry.day / 7)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showModal} onOpenChange={(open) => !saving && setShowModal(open)}>
        <DialogContent className="bg-[#121410] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Outfit']">
              {editingEntry ? t('editEntry') : t('addEntry')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="entry-form">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('day')}</label>
                <input
                  type="number"
                  value={formData.day}
                  onChange={(e) => setFormData({...formData, day: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  disabled={saving}
                  data-testid="day-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('date')}</label>
                <DatePicker
                  value={formData.date}
                  onChange={(date) => setFormData({...formData, date})}
                  disabled={saving}
                  testId="date-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('stock')}</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  disabled={saving}
                  data-testid="stock-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('dead')}</label>
                <input
                  type="number"
                  value={formData.dead}
                  onChange={(e) => setFormData({...formData, dead: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  disabled={saving}
                  data-testid="dead-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-2 glass-input rounded-xl"
                rows="3"
                disabled={saving}
                data-testid="notes-input"
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={saving}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-[#E67E22] hover:bg-[#D35400] text-white"
                disabled={saving}
                data-testid="save-button"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? (editingEntry ? 'Updating...' : 'Adding...') : t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
