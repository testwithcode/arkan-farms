import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Package, Beef, FileText, LogOut, Menu, X, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();

  const menuItems = [
    { path: '/dashboard', icon: Home, label: t('dashboard') },
    { path: '/stock', icon: Package, label: t('stockManagement') },
    { path: '/feed', icon: Beef, label: t('feedManagement') },
    { path: '/billing', icon: FileText, label: t('billing') },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavLink = ({ item }) => {
    const isActive = location.pathname.startsWith(item.path);
    const Icon = item.icon;
    
    return (
      <Link
        to={item.path}
        onClick={() => setIsOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-[#E67E22] text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
        data-testid={`nav-${item.path.substring(1)}`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-sm font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass-card rounded-xl text-white"
        data-testid="mobile-menu-toggle"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-[#121410]/80 backdrop-blur-2xl border-r border-white/10 z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white font-['Outfit']" data-testid="app-title">
              Poultry Farm
            </h1>
            <p className="text-sm text-white/50 mt-1">Management System</p>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>

          <div className="space-y-3 pt-6 border-t border-white/10">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 w-full"
              data-testid="language-toggle"
            >
              <Globe className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-sm font-medium">{language === 'en' ? 'ગુજરાતી' : 'English'}</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 w-full"
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-sm font-medium">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
