import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Building2,
  User,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { triggerSmartCityIntroReplay } from '../components/SmartCityIntro';
import type { UserRole } from '../types/smartcity';

const HERO_IMAGE = '/src/assets/images/mumbai_skyline_hero_1794656028817.jpg';

const DEMO_ROLES: Array<{ role: UserRole; label: string; email: string; desc: string }> = [
  { role: 'Super Admin', label: 'Super Admin', email: 'admin@smartcity.gov.in', desc: 'Full platform & RBAC control' },
  { role: 'Municipal Administrator', label: 'Municipal Admin', email: 'commissioner@smartcity.gov.in', desc: 'City-wide operations & triage' },
  { role: 'Department Officer', label: 'Dept. Officer', email: 'roads.officer@smartcity.gov.in', desc: 'Roads & Maintenance dispatch' },
  { role: 'Field Officer', label: 'Field Officer', email: 'field.squad@smartcity.gov.in', desc: 'On-ground task verification' },
  { role: 'Citizen', label: 'Citizen Portal', email: 'citizen@mumbai.in', desc: 'Report & track civic issues' },
];

export function AuthPage() {
  const { login, demoLogin, register, notify } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState('admin@smartcity.gov.in');
  const [password, setPassword] = useState('SmartCity@2026');

  // Register fields
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organisation, setOrganisation] = useState('Brihanmumbai Municipal Corporation (BMC)');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<UserRole>('Citizen');

  // Forgot password field
  const [forgotEmail, setForgotEmail] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, rememberMe);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Please complete all required registration fields.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        organisation: organisation.trim() || 'Mumbai Civic Portal',
        designation: designation.trim() || (role === 'Citizen' ? 'Mumbai Resident' : 'Municipal Officer'),
        role,
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotSent(null);
    if (!forgotEmail.trim()) {
      setErrorMsg('Please enter your registered email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotSent(res.message);
      notify('Reset instructions sent', res.message, 'info');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoQuickSignIn = async (targetRole: UserRole) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await demoLogin(targetRole);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070D18] text-[#F4F7FC] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Split: Brand, Mumbai Skyline Visual & Animated City Network */}
      <div className="lg:col-span-6 relative overflow-hidden flex flex-col justify-between p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#82AAD2]/15 min-h-[340px]">
        <img
          src={HERO_IMAGE}
          alt="Mumbai SmartCity Coastal Skyline"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#070D18]/92 via-[#091321]/78 to-[#070D18]/95" />

        {/* Subtle Animated City Network SVG */}
        <svg
          className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g stroke="#00C8FF" strokeWidth="1" strokeOpacity="0.35" fill="none">
            <path d="M120 420 L260 310 L420 350 L580 210 L710 270" />
            <path d="M260 310 L320 170 L510 140 L580 210" />
            <path d="M160 210 L260 310 L410 470 L640 410" />
          </g>
          {[
            { cx: 120, cy: 420, c: '#00D69A' },
            { cx: 260, cy: 310, c: '#00C8FF' },
            { cx: 420, cy: 350, c: '#FFB547' },
            { cx: 580, cy: 210, c: '#00C8FF' },
            { cx: 320, cy: 170, c: '#00D69A' },
            { cx: 640, cy: 410, c: '#FF5263' },
          ].map((node, idx) => (
            <g key={idx}>
              <circle cx={node.cx} cy={node.cy} r="5" fill={node.c} />
              <circle cx={node.cx} cy={node.cy} r="14" stroke={node.c} strokeOpacity="0.4" fill="none">
                <animate attributeName="r" values="8;22;8" dur={`${3 + idx * 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur={`${3 + idx * 0.5}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>

        {/* Brand Mark */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#00D69A] flex items-center justify-center text-[#070D18] font-bold text-lg shadow-lg shadow-[#00C8FF]/20">
              SC
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-[#F4F7FC]">
                SmartCity <span className="text-[#00C8FF]">AI</span>
              </span>
              <p className="text-xs text-[#91A2B8]">Mumbai Urban Command · Innovex 2026</p>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerSmartCityIntroReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#00C8FF]/30 bg-[#101D2D]/80 hover:bg-[#14243A] hover:border-[#00C8FF]/60 text-xs font-medium text-[#00C8FF] transition-colors backdrop-blur-md cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Replay Intro
          </button>
        </div>

        {/* Hero Statement */}
        <div className="relative z-10 my-10 max-w-xl">
          <p className="text-xs font-medium tracking-wide text-[#00C8FF] mb-3">
            PS 04 · Smart Cities & Sustainability
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F7FC] leading-[1.12] [text-wrap:balance]">
            Intelligence for a Smarter Tomorrow.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#91A2B8] leading-relaxed max-w-lg">
            Unify computer-vision waste & road inspection, predictive corridor traffic intelligence,
            environmental air-quality telemetry, and AI-triaged citizen governance in one command platform.
          </p>
        </div>

        {/* Bottom Summary Metrics */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 border-t border-[#82AAD2]/20 max-w-lg">
          <div>
            <p className="font-mono text-lg font-semibold text-[#00C8FF] tabular-nums">24 Wards</p>
            <p className="text-xs text-[#91A2B8]">Mumbai Demo Grid</p>
          </div>
          <div>
            <p className="font-mono text-lg font-semibold text-[#00D69A] tabular-nums">5 Modules</p>
            <p className="text-xs text-[#91A2B8]">AI & CV Pipelines</p>
          </div>
          <div>
            <p className="font-mono text-lg font-semibold text-[#F4F7FC] tabular-nums">5 Roles</p>
            <p className="text-xs text-[#91A2B8]">RBAC Access Control</p>
          </div>
        </div>
      </div>

      {/* Right Split: Auth Forms & Role Demo Launchers */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-[#070D18]">
        <div className="w-full max-w-md space-y-6">
          {/* Segmented Mode Switcher */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#F4F7FC]">
                {mode === 'login'
                  ? 'Command Sign In'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Reset Password'}
              </h2>
              <p className="text-xs text-[#91A2B8] mt-1">
                {mode === 'login'
                  ? 'Authenticate to access SmartCity AI municipal operations.'
                  : mode === 'register'
                    ? 'Register as a municipal official or Mumbai civic resident.'
                    : 'Enter your email to recover access credentials.'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#101D2D] border border-[#82AAD2]/15">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-[#00C8FF] text-[#070D18]'
                    : 'text-[#91A2B8] hover:text-[#F4F7FC]'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-[#00C8FF] text-[#070D18]'
                    : 'text-[#91A2B8] hover:text-[#F4F7FC]'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-[#FF5263]/40 bg-[#FF5263]/10 px-4 py-3 text-xs text-[#FF5263]">
              {errorMsg}
            </div>
          )}

          {forgotSent && (
            <div className="rounded-xl border border-[#00D69A]/40 bg-[#00D69A]/10 px-4 py-3 text-xs text-[#00D69A]">
              {forgotSent}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#91A2B8] mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#91A2B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@smartcity.gov.in"
                    className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-10 pr-4 py-2.5 text-sm text-[#F4F7FC] placeholder:text-[#91A2B8]/50 focus:outline-none focus:border-[#00C8FF]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#91A2B8] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#91A2B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-10 pr-10 py-2.5 text-sm text-[#F4F7FC] placeholder:text-[#91A2B8]/50 focus:outline-none focus:border-[#00C8FF]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#91A2B8] hover:text-[#F4F7FC]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-[#91A2B8] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#82AAD2]/30 bg-[#101D2D] accent-[#00C8FF]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                  }}
                  className="text-[#00C8FF] hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] disabled:opacity-60 text-[#070D18] font-semibold text-sm py-2.5 px-4 transition-colors"
              >
                {submitting ? 'Authenticating...' : 'Sign In to Command Centre'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Priya Nair"
                      className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-9 pr-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@mumbai.in"
                      className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-9 pr-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 px-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 px-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Organisation</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={organisation}
                      onChange={(e) => setOrganisation(e.target.value)}
                      className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-9 pr-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#91A2B8] mb-1">Designation</label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="Ward Officer / Resident"
                      className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-9 pr-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#91A2B8] mb-1">Access Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 px-3 py-2 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                >
                  <option value="Citizen">Citizen (Public Complaint Portal)</option>
                  <option value="Field Officer">Field Officer</option>
                  <option value="Department Officer">Department Officer</option>
                  <option value="Municipal Administrator">Municipal Administrator</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00D69A] hover:bg-[#00C08A] disabled:opacity-60 text-[#070D18] font-semibold text-sm py-2.5 px-4 transition-colors"
              >
                {submitting ? 'Creating Account...' : 'Create SmartCity Account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#91A2B8] mb-1.5">Registered Email</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#91A2B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@smartcity.gov.in"
                    className="w-full rounded-xl bg-[#101D2D] border border-[#82AAD2]/20 pl-10 pr-4 py-2.5 text-sm text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex-1 rounded-xl border border-[#82AAD2]/20 py-2.5 text-sm text-[#91A2B8] hover:text-[#F4F7FC]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] font-semibold text-sm py-2.5"
                >
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {/* Instant Role Demo Access for Hackathon Evaluation */}
          <div className="pt-5 border-t border-[#82AAD2]/15">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-[#91A2B8] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00D69A]" />
                Demo Environment Quick-Access (Mumbai Seed)
              </span>
              <span className="text-[11px] font-mono text-[#91A2B8]">Pass: SmartCity@2026</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMO_ROLES.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoQuickSignIn(item.role)}
                  className="text-left rounded-xl border border-[#82AAD2]/15 bg-[#101D2D] hover:bg-[#14243A] hover:border-[#00C8FF]/45 px-3 py-2 transition-colors"
                >
                  <p className="text-xs font-semibold text-[#F4F7FC] truncate">{item.label}</p>
                  <p className="text-[11px] text-[#91A2B8] truncate">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
