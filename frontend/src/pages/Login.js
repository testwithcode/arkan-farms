import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('https://static.prod-images.emergentagent.com/jobs/0e5f496c-b62d-4592-aca2-ac22a2b9af8a/images/6298779450eabab2ebd3b4ba74efb626263d6f61e2858ffb7c2f00630b336b0d.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="glass-card rounded-2xl p-8 space-y-6" data-testid="login-form">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Outfit']">
              {t('welcomeBack')}
            </h1>
            <p className="text-white/60 text-sm">
              {t('loginToContinue')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 glass-input rounded-xl"
                placeholder="admin@poultry.com"
                required
                data-testid="email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 glass-input rounded-xl"
                placeholder="••••••••"
                required
                data-testid="password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-medium py-3 rounded-xl transition-colors duration-200 disabled:opacity-50"
              data-testid="login-submit-button"
            >
              {loading ? 'Logging in...' : t('login')}
            </button>

            <p className="text-center text-white/60 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#E67E22] hover:text-[#D35400] font-medium" data-testid="register-link">
                Sign Up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
