import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, Download, FileText, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { DatePicker } from '../components/DatePicker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FeedManagement() {
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
  
  const [formData, setFormData] = useState({
    date: '',
    feed_name: '',
    bags: '',
    weight: '',
    used: '',
    notes: ''
  });

  useEffect(() => {
    if (farmId) {
      fetchEntries();
    }
  }, [farmId]);

  const fetchEntries = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/feed/${farmId}`, {
        withCredentials: true
      });
      setEntries(data);
    } catch (error) {
      toast.error('Failed to fetch entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const weight = parseFloat(formData.weight) || 0;
    const used = parseFloat(formData.used) || 0;
    const remaining = weight - used;

    const payload = {
      farm_id: farmId,
      date: formData.date,
      feed_name: formData.feed_name,
      bags: parseInt(formData.bags),
      weight,
      used,
      remaining,
      notes: formData.notes
    };

    try {
      if (editingEntry) {
        await axios.put(`${API_URL}/api/feed/${editingEntry.id}`, payload, {
          withCredentials: true
        });
        toast.success('Entry updated successfully');
      } else {
        await axios.post(`${API_URL}/api/feed`, payload, {
          withCredentials: true
        });
        toast.success('Entry added successfully');
      }
      
      fetchEntries();
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/feed/${id}`, {
        withCredentials: true
      });
      toast.success('Entry deleted successfully');
      fetchEntries();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      feed_name: entry.feed_name,
      bags: entry.bags,
      weight: entry.weight,
      used: entry.used,
      notes: entry.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      date: '',
      feed_name: '',
      bags: '',
      weight: '',
      used: '',
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
    doc.text('Feed Management Report', 14, 28);
    
    // Sort by date ASC for PDF and group by week
    const sortedEntries = [...filteredEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const tableData = [];
    let weekCounter = 0;
    sortedEntries.forEach((entry, idx) => {
      tableData.push([
        entry.date,
        entry.feed_name,
        entry.bags,
        entry.weight,
        entry.used,
        entry.remaining,
        entry.notes || '-'
      ]);
      // Add weekly separator every 7 entries
      if ((idx + 1) % 7 === 0 && idx < sortedEntries.length - 1) {
        weekCounter++;
        tableData.push([{
          content: `--- End of Week ${weekCounter} ---`,
          colSpan: 7,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [230, 126, 34], textColor: [255, 255, 255] }
        }]);
      }
    });
    
    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Feed Name', 'Bags', 'Weight', 'Used', 'Remaining', 'Notes']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 }
    });
    
    doc.save(`${farmName}_feed_report.pdf`);
    toast.success('PDF downloaded');
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredEntries.map(e => ({
        Date: e.date,
        'Feed Name': e.feed_name,
        Bags: e.bags,
        'Weight (kg)': e.weight,
        'Used (kg)': e.used,
        'Remaining (kg)': e.remaining,
        Notes: e.notes || ''
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Feed');
    XLSX.writeFile(wb, `${farm?.name || 'farm'}_feed.xlsx`);
    toast.success('Excel downloaded');
  };

  const filteredEntries = entries.filter(entry =>
    entry.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.feed_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalFeed: entries.reduce((sum, e) => sum + e.weight, 0),
    feedUsed: entries.reduce((sum, e) => sum + e.used, 0),
    remainingFeed: entries.reduce((sum, e) => sum + e.remaining, 0)
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
                onClick={() => navigate('/feed')}
                className="flex items-center gap-2 text-white/60 hover:text-white mb-2 transition-colors"
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('feedManagement')}
              </button>
              <h1 className="text-4xl font-light text-white font-['Outfit']" data-testid="farm-title">
                {farm ? `${t(farm.name.toLowerCase())} (${farm.location})` : 'Feed Management'}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('totalFeed')}
              </p>
              <p className="text-3xl font-medium text-white" data-testid="total-feed">
                {stats.totalFeed.toFixed(2)} kg
              </p>
            </div>
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('feedUsed')}
              </p>
              <p className="text-3xl font-medium text-red-400" data-testid="feed-used">
                {stats.feedUsed.toFixed(2)} kg
              </p>
            </div>
            <div className="glass-card rounded-xl p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                {t('remainingFeed')}
              </p>
              <p className="text-3xl font-medium text-green-400" data-testid="feed-remaining">
                {stats.remainingFeed.toFixed(2)} kg
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
              <table className="w-full" data-testid="feed-table">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('date')}
                    </th>
                    <th className="text-left p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('feedName')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('bags')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('weight')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('used')}
                    </th>
                    <th className="text-right p-3 text-xs tracking-[0.2em] uppercase font-bold text-white/50">
                      {t('remaining')}
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
                      <td colSpan="8" className="text-center py-8 text-white/40">
                        No entries found
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry, index) => {
                      // Show separator every 7 entries (when sorted DESC, we need entry index)
                      const showWeekSeparator = (index + 1) % 7 === 0 && index < filteredEntries.length - 1;
                      const weekNumber = Math.ceil((filteredEntries.length - index) / 7);
                      return (
                      <React.Fragment key={entry.id}>
                      <tr
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        data-testid={`entry-row-${index}`}
                      >
                        <td className="p-3 text-white">{entry.date}</td>
                        <td className="p-3 text-white">{entry.feed_name}</td>
                        <td className="p-3 text-right text-white">{entry.bags}</td>
                        <td className="p-3 text-right text-white">{entry.weight}</td>
                        <td className="p-3 text-right text-red-400">{entry.used}</td>
                        <td className="p-3 text-right text-green-400">{entry.remaining}</td>
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
                              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                              data-testid={`delete-button-${index}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {showWeekSeparator && (
                        <tr data-testid={`week-separator-${index}`}>
                          <td colSpan="8" className="p-0">
                            <div className="border-t-2 border-[#E67E22] my-1 relative">
                              <span className="absolute -top-3 left-4 bg-[#0A0B09] px-3 text-xs text-[#E67E22] font-bold tracking-widest">
                                WEEK {weekNumber}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
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
        <DialogContent className="bg-[#121410] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Outfit']">
              {editingEntry ? t('editEntry') : t('addEntry')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="entry-form">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('date')}</label>
              <DatePicker
                value={formData.date}
                onChange={(date) => setFormData({...formData, date})}
                testId="date-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t('feedName')}</label>
              <input
                type="text"
                value={formData.feed_name}
                onChange={(e) => setFormData({...formData, feed_name: e.target.value})}
                className="w-full px-4 py-2 glass-input rounded-xl"
                required
                data-testid="feed-name-input"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('bags')}</label>
                <input
                  type="number"
                  value={formData.bags}
                  onChange={(e) => setFormData({...formData, bags: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="bags-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('weight')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="weight-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('used')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.used}
                  onChange={(e) => setFormData({...formData, used: e.target.value})}
                  className="w-full px-4 py-2 glass-input rounded-xl"
                  required
                  data-testid="used-input"
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
                data-testid="save-button"
              >
                {t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
