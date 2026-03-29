import { useState } from 'react';
import { Car, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { cn } from '../utils';

const IS_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password);
  };

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
            <Car size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">DS Car ERP</h1>
          <p className="text-sm text-slate-500 mt-1">Centro Automotivo · Manaus, AM</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-surface p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Entrar</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Seu login"
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {IS_MOCK && (
              <p className="text-xs text-center text-slate-400 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                Modo demo — usuário: qualquer · senha: <span className="font-bold text-slate-600">dscar</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                loading || !username.trim() || !password.trim()
                  ? "bg-primary/50 text-white cursor-not-allowed"
                  : "bg-primary text-white hover:bg-primary/90 active:scale-[0.98]"
              )}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Entrando...</>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Paddock Solutions · dscar.paddock.solutions
        </p>
      </div>
    </div>
  );
}
