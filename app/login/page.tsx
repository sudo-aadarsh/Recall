"use client";

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import type { ClientSafeProvider } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Lock, User, Github, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<ClientSafeProvider[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    getProviders().then((providers) => {
      setOauthProviders(
        Object.values(providers ?? {}).filter((provider) => provider.id !== 'credentials')
      );
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLogin) {
      try {
        const res = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (res?.error) {
          setError("Invalid email or password");
          setLoading(false);
          return;
        }

        if (!res?.ok) {
          setError("Unable to sign in. Please try again.");
          setLoading(false);
          return;
        }

        router.push('/dashboard');
        router.refresh();
      } catch {
        setError("Unable to sign in. Please try again.");
        setLoading(false);
      }
    } else {
      // Register
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to register');
        }

        // Auto login after register
        const signInRes = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (signInRes?.error) throw new Error(signInRes.error);
        
        router.push('/dashboard');
        router.refresh();
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  }

  function handleOAuth(provider: string) {
    signIn(provider, { callbackUrl: '/dashboard' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[100px]" style={{ background: '#6366F1', pointerEvents: 'none' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[100px]" style={{ background: '#06B6D4', pointerEvents: 'none' }} />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Welcome to <span style={{ color: '#6366F1' }}>Recall AI</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? 'Sign in to access your knowledge base' : 'Create an account to start building your second brain'}
          </p>
        </div>

        <div className="glass rounded-2xl p-8 border" style={{ borderColor: 'var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!isLogin && (
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            )}
            
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-colors"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-colors"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {oauthProviders.length > 0 && (
            <>
              <div className="my-8 flex items-center gap-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }}></div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>OR CONTINUE WITH</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }}></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {oauthProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleOAuth(provider.id)}
                    type="button"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors hover:bg-white/5 active:scale-[0.98]"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    {provider.id === 'google' && (
                      <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                          <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                          <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                          <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                          <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                        </g>
                      </svg>
                    )}
                    {provider.id === 'discord' && (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
                      </svg>
                    )}
                    {provider.id === 'amazon' && (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.784 16.634c-1.579.827-3.791 1.258-5.748 1.258-4.735 0-7.794-2.227-7.794-6.304 0-4.075 3.33-6.591 8.271-6.591 1.769 0 3.398.397 4.542.924v2.793c-1.096-.653-2.617-1.12-4.143-1.12-3.136 0-5.188 1.581-5.188 4.093 0 2.224 1.472 3.618 4.381 3.618 1.815 0 3.63-.529 5.09-1.425v2.754zm.666 4.043c-3.14 1.488-7.142 1.838-10.748.887l.487-1.748c3.087.95 6.645.69 9.61-.715l.651 1.576zm5.823-3.664c-.161-.252-.468-.396-.879-.396-.409 0-1.139.29-1.928.983-.75.656-1.157 1.455-1.157 1.455s.672-1.353 1.158-2.673c.48-1.309.435-2.023.236-2.31-.2-.284-.664-.383-1.298-.225-.623.155-1.465.556-2.457 1.246-.994.693-1.849 1.564-2.583 2.502v-5.267h-3.327v11.751h3.197s-.066-1.493.033-2.585c.099-1.09.496-2.56 1.427-3.593.931-1.03 1.942-1.503 2.766-1.503.821 0 1.205.347 1.205 1.07 0 .723-.195 2.529-.195 2.529s-1.042 3.86 1.157 3.86c2.196 0 3.328-1.859 3.328-1.859l-1.683-1.486z"/>
                      </svg>
                    )}
                    {provider.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-center mt-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 font-medium hover:underline focus:outline-none"
              style={{ color: '#6366F1' }}
            >
              {isLogin ? 'Create one now' : 'Sign in instead'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
