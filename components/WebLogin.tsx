"use client";

import { useState, useEffect } from "react";
import { Lock, User, Eye, EyeOff, Shield, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, Mail, KeyRound, X } from "lucide-react";
import { UserAccount } from "@/lib/types";
import { DataService } from "@/lib/dataService";

interface WebLoginProps {
  onLoginSuccess: (user: UserAccount) => void;
  sessionNotice?: string | null;
}

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://jica-backend-production.up.railway.app")
  .replace(/\/+$/, "")
  .trim();

export default function WebLogin({ onLoginSuccess, sessionNotice }: WebLoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(sessionNotice || null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (sessionNotice) {
      setErrorMessage(sessionNotice);
    }
  }, [sessionNotice]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage("Please enter both username/email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: identifier.trim(),
          password: password,
          app: "web"
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.detail || "Invalid credentials or insufficient access role.");
        setIsLoading(false);
        return;
      }

      if (data?.user && data?.session_token) {
        const authenticatedUser: UserAccount = {
          id: data.user.id,
          name: data.user.full_name || data.user.name || "User",
          username: data.user.username || identifier.trim(),
          role: data.user.role || "Staff",
          email: data.user.email || "",
          phone: data.user.phone_number || data.user.phone || "",
          assignedTruckId: data.user.assigned_truck_id || data.user.assignedTruckId,
          photoUrl: data.user.photo_url || data.user.photoUrl,
          active: true,
          activeSessionToken: data.session_token,
          createdAt: data.user.created_at || new Date().toISOString()
        };

        if (authenticatedUser.role !== "Owner" && authenticatedUser.role !== "Staff") {
          setErrorMessage("Access Denied: Only the Owner and Office Staff can sign in to the Web Dashboard.");
          setIsLoading(false);
          return;
        }

        const sessionPayload = {
          user: authenticatedUser,
          token: data.token,
          sessionToken: data.session_token,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        };
        localStorage.setItem("jica_web_session", JSON.stringify(sessionPayload));
        localStorage.setItem("jica_auth_token", data.token || "");
        localStorage.setItem("jica_session_token", data.session_token);
        DataService.setCurrentUser(authenticatedUser);
        onLoginSuccess(authenticatedUser);
      } else {
        setErrorMessage("Unexpected authentication response from server.");
      }
    } catch (err: any) {
      setErrorMessage(
        "Unable to reach authentication server to establish a single active session. Please verify your internet connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError("Please enter your username or registered email.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setMaskedEmail(data.masked_email || data.email_masked || "your registered Gmail");
        setForgotSuccess(data.message || "Verification code sent to your registered Gmail address.");
        setForgotStep(2);
      } else {
        setForgotError(data.detail || "Unable to send reset code. Please ensure your account has a registered Gmail.");
      }
    } catch {
      setForgotError("Failed to connect to authentication server. Please check your network connection.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setForgotError("Please enter the 6-digit numeric OTP sent to your email.");
      return;
    }

    if (newPassword.length < 4) {
      setForgotError("New password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match. Please re-enter.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/verify-otp-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          otp: otpCode.trim(),
          otp_code: otpCode.trim(),
          new_password: newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setForgotSuccess("Password reset successfully! You can now log in with your new password.");
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setIdentifier(forgotIdentifier.trim());
          setPassword("");
          setForgotSuccess(null);
        }, 1800);
      } else {
        setForgotError(data.detail || "Invalid or expired OTP code. Please request a new code.");
      }
    } catch {
      setForgotError("Failed to connect to authentication server. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-br from-[#004D40] via-[#00875A] to-[#00251A] flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white/20 overflow-hidden backdrop-blur-md">
        <div className="bg-[#00875A] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-transparent to-transparent" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/10 rounded-2xl p-2.5 backdrop-blur-sm border border-white/20 mb-3 shadow-inner flex items-center justify-center">
              <img
                src="/jica-logo.png"
                alt="JICA Ice Logistics Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>

            <h1 className="text-2xl font-black text-yellow-400 tracking-wider uppercase drop-shadow-md">
              J.I.C.A ICE LOGISTICS
            </h1>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mt-1">
              JICA ICEPLANT, #69 Old Road Gusa, CDOC 9000
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Sign In to Web Dispatch
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Authorized access restricted exclusively to JICA Owner and Office Staff. Single active session enforced.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your username or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#00875A] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep(1);
                    setForgotIdentifier(identifier);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-bold text-[#00875A] dark:text-emerald-400 hover:underline py-1"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#00875A] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 min-h-[48px] bg-[#00875A] hover:bg-[#007048] active:bg-[#005838] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dispatch</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Single-Device Locked Session • RA 10173 Compliant</span>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 sm:p-7 relative max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-10">
              <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-[#00875A] dark:text-emerald-300">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Reset Password / PIN
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {forgotStep === 1 ? "Step 1 of 2: Email Verification" : "Step 2 of 2: Set New Password"}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Enter your registered username or Gmail address to receive a 6-digit verification code.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Username or Registered Gmail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter username or email"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2.5 min-h-[44px] text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 min-h-[44px] bg-[#00875A] hover:bg-[#007048] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit OTP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                  Verification code sent to <strong className="text-slate-900 dark:text-white">{maskedEmail}</strong>.
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    6-Digit Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full px-4 py-2.5 text-center font-mono text-xl tracking-widest font-black bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 4 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 min-h-[44px] px-2"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 min-h-[44px] bg-[#00875A] hover:bg-[#007048] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
