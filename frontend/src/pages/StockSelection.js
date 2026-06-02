import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const farmImages = [
  'https://static.prod-images.emergentagent.com/jobs/0e5f496c-b62d-4592-aca2-ac22a2b9af8a/images/851811d744bcb2cd44708aa2bf0bac4ec0bffa2a045c2abd22abecb93c648e07.png',
  'https://static.prod-images.emergentagent.com/jobs/0e5f496c-b62d-4592-aca2-ac22a2b9af8a/images/42efc3c8d1a9c4fe8327cb92398f4f429a1408bcdcf1acd8779372be2741d4c4.png',
  'https://static.prod-images.emergentagent.com/jobs/0e5f496c-b62d-4592-aca2-ac22a2b9af8a/images/828053fea1de2835501fa76518844523def99733c02eb5200e7d5ee70b742e59.png'
];

export default function StockSelection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/farms`, {
        withCredentials: true
      });
      setFarms(data);
    } catch (error) {
      console.error('Error fetching farms:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFarmLocation = (name) => {
    const locations = { Badshah: t('gitodiya'), Amayrah: t('narsanda'), Qismat: t('jod') };
    return locations[name] || '';
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
        <div className="p-6 lg:p-8 space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-light text-white mb-2 font-['Outfit']" data-testid="stock-selection-title">
              {t('stockManagement')}
            </h1>
            <p className="text-white/50 text-sm">{t('selectFarm')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {farms.map((farm, index) => (
              <button
                key={farm.id}
                onClick={() => navigate(`/stock/${farm.id}`, { state: { farm } })}
                className="group glass-card rounded-2xl overflow-hidden hover:-translate-y-2 hover:border-white/20 transition-all duration-300"
                data-testid={`farm-card-${farm.name.toLowerCase()}`}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={farmImages[index]}
                    alt={farm.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                </div>
                
                <div className="p-6">
                  <h2 className="text-2xl font-medium text-white mb-2 font-['Outfit'] flex items-center justify-between">
                    {t(farm.name.toLowerCase())} ({getFarmLocation(farm.name)})
                    <ChevronRight className="w-6 h-6 text-[#E67E22] group-hover:translate-x-1 transition-transform" />
                  </h2>
                  <p className="text-white/60 text-sm">View stock management</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}