import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">

        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-900 mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">CE</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cable Manufacturing ERP</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition"
                placeholder="admin@cableerp.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 pr-11 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 hover:bg-gray-700
                text-white text-sm font-semibold rounded-xl transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Default credentials hint */}
          <div className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1.5">Default Credentials</p>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2 text-xs text-blue-600">
                <span className="font-medium w-20">Email:</span>
                <code className="font-mono">admin@cableerp.com</code>
              </div>
              <div className="flex gap-2 text-xs text-blue-600">
                <span className="font-medium w-20">Password:</span>
                <code className="font-mono">Admin@1234</code>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 Cable Manufacturing ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}