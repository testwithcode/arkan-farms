import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { Building2, Heart, Skull, FileText, TrendingUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Dashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true
      });
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    {
      title: t('totalFarms'),
      value: stats.total_farms,
      icon: Building2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      title: t('totalLiveStock'),
      value: stats.total_live_stock,
      icon: Heart,
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      title: t('totalDead'),
      value: stats.total_dead,
      icon: Skull,
      color: 'text-red-400',
      bg: 'bg-red-500/10'
    },
    {
      title: t('totalBills'),
      value: stats.total_invoices,
      icon: FileText,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    {
      title: t('totalRevenue'),
      value: `₹${stats.total_revenue.toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'text-[#E67E22]',
      bg: 'bg-[#E67E22]/10'
    }
  ] : [];

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
        <div className="p-6 lg:p-8 space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-light text-white mb-2 font-['Outfit']" data-testid="dashboard-title">
              {t('dashboard')}
            </h1>
            <p className="text-white/50 text-sm">Welcome to your farm management system</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6" data-testid="stats-grid">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="glass-card rounded-2xl p-6 hover:-translate-y-1 transition-all duration-200 hover:border-white/20"
                  data-testid={`stat-card-${index}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${card.color}`} strokeWidth={1.5} />
                  </div>
                  <p className="text-xs tracking-[0.2em] uppercase font-bold text-white/50 mb-2">
                    {card.title}
                  </p>
                  <p className="text-3xl font-medium text-white" data-testid={`stat-value-${index}`}>
                    {card.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="glass-card rounded-2xl p-6 lg:p-8">
            <h2 className="text-2xl font-medium text-white mb-6 font-['Outfit']">
              {t('recentActivity')}
            </h2>
            <div className="space-y-4" data-testid="recent-activities">
              {stats?.recent_activities?.length > 0 ? (
                stats.recent_activities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    data-testid={`activity-${index}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#E67E22]"></div>
                    <div className="flex-1">
                      <p className="text-white text-sm">{activity.message}</p>
                      <p className="text-white/40 text-xs mt-1">{activity.date}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-center py-8">No recent activities</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
