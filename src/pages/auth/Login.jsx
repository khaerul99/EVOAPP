import React from 'react'
import { Eye, EyeOff, Lock, User, ShieldAlert, Cpu } from 'lucide-react'
import { useLogin } from '../../hooks/auth/useLogin'

const Login = () => {
    const {
        username,
        password,
        rememberMe,
        showPassword,
        isLoading,
        loadingMessage,
        error,
        setUsername,
        setPassword,
        setRememberMe,
        setShowPassword,
        handleSubmit,
    } = useLogin()

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-navy/5 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-navy/5 blur-[120px] rounded-full" />

            <div className="w-full max-w-md relative">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-navy/10 border border-navy/20 rounded-2xl mb-4 shadow-sm">
                        <Cpu size={32} className="text-navy" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-navy mb-2">EVOSECURE</h1>
                    <p className="text-navy/40 text-sm font-medium">CCTV Monitoring Intelligence</p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-navy/5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    className="input-light w-full pl-12"
                                    placeholder="Masukkan username"
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/30" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="input-light w-full pl-12"
                                    placeholder="Masukkan password"
                                    disabled={isLoading}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(event) => setRememberMe(event.target.checked)}
                                    className="w-4 h-4 rounded border-navy/10 bg-background text-navy focus:ring-navy/20"
                                />
                                <span className="text-navy/60 group-hover:text-navy transition-colors font-semibold">Remember Username</span>
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl flex items-center space-x-2">
                                <ShieldAlert size={18} className="shrink-0" />
                                <div className="text-xs font-bold leading-tight">{error}</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-navy w-full shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span>Masuk ke Sistem</span>
                            )}
                        </button>

                        {isLoading && loadingMessage && (
                            <p className="text-[11px] text-center font-semibold text-navy/50">
                                {loadingMessage}
                            </p>
                        )}
                    </form>
                </div>

                <div className="mt-8 text-center text-[10px] text-navy/20 font-black uppercase tracking-widest">
                    Security Protocol Active v1.1.0
                </div>
            </div>
        </div>
    )
}

export default Login
