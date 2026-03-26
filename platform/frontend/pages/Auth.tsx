import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { api, showSuccess } from '../src/services/api';
import { toast } from '../src/hooks/use-toast';
import axios from 'axios';
import { UserPlus, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9080/api/v1';

type AuthMode = 'login' | 'register';

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  email: string;
}

export const Auth: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState<LoginCredentials>({
    username: '',
    password: '',
  });

  const [registerData, setRegisterData] = useState<RegisterData>({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    email: '',
  });

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const result = await api.auth.login(loginData);

    if (result.success) {
      showSuccess(t('auth.loginSuccess', '登录成功！'));
      navigate('/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: t('auth.loginFailed', '登录失败'),
        description: result.error || t('auth.checkCredentials', '请检查用户名和密码'),
      });
    }

    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (registerData.password !== registerData.confirmPassword) {
      setError(t('auth.passwordsNotMatch', '两次输入的密码不一致'));
      return;
    }

    if (registerData.password.length < 6) {
      setError(t('auth.passwordMinLength', '密码长度至少为6位'));
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/users`, {
        username: registerData.username,
        password: registerData.password,
        fullName: registerData.fullName || registerData.username,
        email: registerData.email,
        roles: [],
      });

      if (response.data) {
        showSuccess(t('auth.registerSuccess', '注册成功！请使用新账号登录'));
        setMode('login');
        setLoginData({ ...loginData, username: registerData.username });
        setRegisterData({
          username: '',
          password: '',
          confirmPassword: '',
          fullName: '',
          email: '',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('auth.registerFailed', '注册失败'),
        description: err.response?.data?.error || t('auth.checkInput', '请检查输入信息是否正确'),
      });
    }

    setLoading(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearMessages();
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">ProDB Manager</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">{t('app.description', '工业数据管理平台')}</p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'login'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            {t('auth.login', '登录')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'register'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            {t('auth.register', '注册')}
          </button>
        </div>

        {/* Message Notifications */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-500 text-red-600 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-500 text-green-600 dark:text-green-200 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.username', '用户名')}
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('auth.usernamePlaceholder', '请输入用户名')}
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.password', '密码')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={t('auth.passwordPlaceholder', '请输入密码')}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.loggingIn', '登录中...')}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {t('auth.login', '登录')}
                </>
              )}
            </button>

            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('auth.defaultAccount', '默认账号')}: admin / Hanatech@123
            </div>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form className="mt-8 space-y-4" onSubmit={handleRegister}>
            <div className="space-y-4">
              <div>
                <label htmlFor="reg-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.username', '用户名')} <span className="text-red-400">*</span>
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('auth.usernamePlaceholder', '请输入用户名')}
                  value={registerData.username}
                  onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="reg-fullname" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.fullName', '姓名')}
                </label>
                <input
                  id="reg-fullname"
                  type="text"
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('auth.fullNamePlaceholder', '请输入姓名（可选）')}
                  value={registerData.fullName}
                  onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.email', '邮箱')} <span className="text-red-400">*</span>
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('auth.emailPlaceholder', '请输入邮箱')}
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.password', '密码')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={t('auth.passwordMinLengthPlaceholder', '请输入密码（至少6位）')}
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.confirmPassword', '确认密码')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={t('auth.confirmPasswordPlaceholder', '请再次输入密码')}
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.registering', '注册中...')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {t('auth.register', '注册')}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
