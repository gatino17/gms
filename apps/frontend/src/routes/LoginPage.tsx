import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineArrowRight, HiOutlineShieldCheck } from 'react-icons/hi';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, from, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const { data } = await api.post('/login/access-token', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const u = (data as any)?.user
            login(data.access_token, {
                email: u?.email || email,
                id: u?.id,
                full_name: u?.full_name,
                is_superuser: u?.is_superuser,
                tenant_id: u?.tenant_id,
            });
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Credenciales inválidas. Revisa tu correo y contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fafafa] relative overflow-hidden font-sans">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fuchsia-100/50 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[120px]" />
            
            <div className="relative w-full max-w-[480px] p-6 animate-in fade-in zoom-in duration-700">
                <div className="bg-white rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
                    {/* Header Section */}
                    <div className="px-10 pt-12 pb-8 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-fuchsia-600 to-purple-600 rounded-[28px] shadow-xl shadow-fuchsia-200 mx-auto mb-8 flex items-center justify-center text-white rotate-3">
                           <HiOutlineShieldCheck size={44} />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Bienvenido</h2>
                        <p className="text-gray-400 font-medium px-4">Ingresa tus credenciales para acceder al sistema de gestión.</p>
                    </div>

                    {/* Form Section */}
                    <form className="px-10 pb-12 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-2">Correo Electrónico</label>
                                <div className="relative group">
                                    <HiOutlineMail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-[24px] pl-14 pr-6 py-4 font-bold text-gray-700 transition-all outline-none"
                                        placeholder="ejemplo@correo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-2">Contraseña</label>
                                <div className="relative group">
                                    <HiOutlineLockClosed className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-[24px] pl-14 pr-6 py-4 font-bold text-gray-700 transition-all outline-none"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-600 text-xs font-bold text-center animate-in shake duration-300">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Verificando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Acceder al Panel</span>
                                    <HiOutlineArrowRight className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <button type="button" className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-fuchsia-600 transition-colors">
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                    </form>
                </div>
                
                {/* Footer Credits */}
                <div className="mt-8 text-center">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Powered by Antigravity Pro</p>
                </div>
            </div>
        </div>
    );
};
