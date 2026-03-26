import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { 
  User, Wrench, Palette, Bell, Monitor, Save, Camera, Lock, 
  Smartphone, Shield, Eye, EyeOff, Trash2, Moon, Sun, Laptop,
  Mail, MessageSquare, AlertTriangle, Check, X, Loader2
} from 'lucide-react';
import { api } from '../src/services/api';

const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { tab } = useParams<{ tab: string }>();
  const activeTab = tab || 'profile';

  const NAV_ITEMS = [
    { id: 'profile', label: t('settings.profile', 'Profile'), icon: User },
    { id: 'account', label: t('settings.account', 'Account'), icon: Wrench },
    { id: 'appearance', label: t('settings.appearance', 'Appearance'), icon: Palette },
    { id: 'notifications', label: t('settings.notifications', 'Notifications'), icon: Bell },
    { id: 'display', label: t('settings.display', 'Display'), icon: Monitor },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileForm />;
      case 'account':
        return <AccountForm />;
      case 'appearance':
        return <AppearanceForm />;
      case 'notifications':
        return <NotificationsForm />;
      case 'display':
        return <DisplayForm />;
      default:
        return <ProfileForm />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 md:px-8">
      <div className="space-y-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('settings.title', 'Settings')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.subtitle', 'Manage your account settings and preferences.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700 mb-8" />

      <div className="flex flex-col lg:flex-row lg:space-x-12 space-y-8 lg:space-y-0">
        <aside className="lg:w-1/5 shrink-0">
          <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  to={`/settings/${item.id}`}
                  className={`
                    flex items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 lg:max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// ==================== Profile ====================
const ProfileForm: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    username: currentUser?.username || '',
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    bio: t('settings.defaultBio', 'I am a ProDB user.'),
    avatar: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.profile', 'Profile')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.profileDescription', 'This is how others will see you on the site.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.avatar', 'Avatar')}</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white">
              {formData.fullName?.[0] || formData.username?.[0] || 'U'}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Camera className="w-4 h-4" />
              {t('settings.changeAvatar', 'Change Avatar')}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.username', 'Username')}</label>
          <input 
            type="text" 
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            {t('settings.usernameDescription', 'This is your public display name. You can only change this once every 30 days.')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.fullName', 'Full Name')}</label>
          <input 
            type="text" 
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.email', 'Email')}</label>
          <input 
            type="email" 
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            {t('settings.emailDescription', 'You can manage verified email addresses in your email settings.')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.bio', 'Bio')}</label>
          <textarea 
            value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
            rows={4}
            className="flex min-h-[120px] w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
          />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            {t('settings.bioDescription', 'Brief description for your profile. Max 160 characters.')}
          </p>
        </div>

        <div className="flex justify-start pt-4">
          <button 
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {loading ? t('settings.saving', 'Saving...') : saved ? t('settings.saved', 'Saved!') : t('settings.updateProfile', 'Update profile')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ==================== Account ====================
const AccountForm: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert(t('settings.passwordsNotMatch', 'New passwords do not match'));
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    alert(t('settings.passwordUpdated', 'Password updated successfully'));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.account', 'Account')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.accountDescription', 'Update your account settings and security preferences.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Change Password */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          {t('settings.changePassword', 'Change Password')}
        </h4>
        
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">{t('settings.currentPassword', 'Current Password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">{t('settings.newPassword', 'New Password')}</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">{t('settings.confirmNewPassword', 'Confirm New Password')}</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            {loading ? t('settings.updating', 'Updating...') : t('settings.updatePassword', 'Update password')}
          </button>
        </form>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Two-Factor Authentication */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t('settings.twoFactorAuth', 'Two-Factor Authentication')}
        </h4>
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.authenticatorApp', 'Authenticator App')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.authenticatorDescription', 'Use an authenticator app to generate one-time codes')}</p>
            </div>
          </div>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            {t('common.enable', 'Enable')}
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Delete Account */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {t('settings.deleteAccount', 'Delete Account')}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('settings.deleteAccountWarning', 'Once you delete your account, there is no going back. Please be certain.')}
        </p>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 h-10 py-2 px-4">
          <Trash2 className="w-4 h-4 mr-2" />
          {t('settings.deleteAccount', 'Delete Account')}
        </button>
      </div>
    </div>
  );
};

// ==================== Appearance ====================
const AppearanceForm: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState('medium');
  const [borderRadius, setBorderRadius] = useState('medium');

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.appearance', 'Appearance')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.appearanceDescription', 'Customize the appearance of the application.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Theme Selection */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.theme', 'Theme')}</h4>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
              theme === 'light' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Sun className="w-8 h-8 text-yellow-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200">{t('common.light', 'Light')}</span>
          </button>
          <button
            onClick={() => handleThemeChange('dark')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
              theme === 'dark' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Moon className="w-8 h-8 text-purple-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200">{t('common.dark', 'Dark')}</span>
          </button>
          <button
            onClick={() => handleThemeChange('system')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
              theme === 'system' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Laptop className="w-8 h-8 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200">{t('common.system', 'System')}</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Font Size */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.fontSize', 'Font Size')}</h4>
        <div className="flex gap-2">
          {['small', 'medium', 'large'].map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                fontSize === size
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t(`settings.fontSize_${size}`, size.charAt(0).toUpperCase() + size.slice(1))}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Border Radius */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.borderRadius', 'Border Radius')}</h4>
        <div className="flex gap-2">
          {['none', 'small', 'medium', 'large'].map((radius) => (
            <button
              key={radius}
              onClick={() => setBorderRadius(radius)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                borderRadius === radius
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t(`settings.borderRadius_${radius}`, radius.charAt(0).toUpperCase() + radius.slice(1))}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== Notifications ====================
const NotificationsForm: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
    securityAlerts: true,
    weeklyDigest: true,
    mentionNotifications: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const NotificationItem = ({ 
    title, 
    description, 
    icon: Icon, 
    settingKey 
  }: { 
    title: string; 
    description: string; 
    icon: any; 
    settingKey: keyof typeof settings;
  }) => (
    <div className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <button
        onClick={() => toggleSetting(settingKey)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          settings[settingKey] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            settings[settingKey] ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.notifications', 'Notifications')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.notificationsDescription', 'Configure how you receive notifications.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {t('settings.emailNotifications', 'Email Notifications')}
        </h4>
        
        <div className="space-y-3">
          <NotificationItem
            title={t('settings.emailNotifications', 'Email Notifications')}
            description={t('settings.emailNotificationsDesc', 'Receive notifications via email')}
            icon={Mail}
            settingKey="emailNotifications"
          />
          <NotificationItem
            title={t('settings.marketingEmails', 'Marketing Emails')}
            description={t('settings.marketingEmailsDesc', 'Receive emails about new features and promotions')}
            icon={MessageSquare}
            settingKey="marketingEmails"
          />
          <NotificationItem
            title={t('settings.weeklyDigest', 'Weekly Digest')}
            description={t('settings.weeklyDigestDesc', 'Get a weekly summary of your activity')}
            icon={Check}
            settingKey="weeklyDigest"
          />
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {t('settings.pushNotifications', 'Push Notifications')}
        </h4>
        
        <div className="space-y-3">
          <NotificationItem
            title={t('settings.pushNotifications', 'Push Notifications')}
            description={t('settings.pushNotificationsDesc', 'Receive push notifications in your browser')}
            icon={Bell}
            settingKey="pushNotifications"
          />
          <NotificationItem
            title={t('settings.securityAlerts', 'Security Alerts')}
            description={t('settings.securityAlertsDesc', 'Get notified about important security events')}
            icon={AlertTriangle}
            settingKey="securityAlerts"
          />
          <NotificationItem
            title={t('settings.mentionNotifications', 'Mention Notifications')}
            description={t('settings.mentionNotificationsDesc', 'Get notified when someone mentions you')}
            icon={MessageSquare}
            settingKey="mentionNotifications"
          />
        </div>
      </div>
    </div>
  );
};

// ==================== Display ====================
const DisplayForm: React.FC = () => {
  const { t } = useTranslation();
  const [density, setDensity] = useState('comfortable');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [tableRows, setTableRows] = useState(25);

  const densityOptions = [
    { id: 'compact', label: t('settings.densityCompact', 'Compact'), desc: t('settings.densityCompactDesc', 'More content, less spacing') },
    { id: 'comfortable', label: t('settings.densityComfortable', 'Comfortable'), desc: t('settings.densityComfortableDesc', 'Balanced spacing') },
    { id: 'spacious', label: t('settings.densitySpacious', 'Spacious'), desc: t('settings.densitySpaciousDesc', 'More spacing between elements') },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('settings.display', 'Display')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.displayDescription', 'Customize your viewing experience.')}</p>
      </div>
      
      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Interface Density */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.interfaceDensity', 'Interface Density')}</h4>
        <div className="grid grid-cols-3 gap-4">
          {densityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setDensity(option.id)}
              className={`flex flex-col items-start gap-1 p-4 rounded-lg border text-left transition-all ${
                density === option.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{option.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Table Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.tableSettings', 'Table Settings')}</h4>
        <div className="space-y-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">{t('settings.defaultRowsPerPage', 'Default rows per page')}</label>
          <select
            value={tableRows}
            onChange={(e) => setTableRows(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value={10}>10 {t('settings.rows', 'rows')}</option>
            <option value={25}>25 {t('settings.rows', 'rows')}</option>
            <option value={50}>50 {t('settings.rows', 'rows')}</option>
            <option value={100}>100 {t('settings.rows', 'rows')}</option>
          </select>
        </div>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* Other Options */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.otherOptions', 'Other Options')}</h4>
        
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.autoCollapseSidebar', 'Auto-collapse Sidebar')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.autoCollapseSidebarDesc', 'Automatically collapse sidebar on smaller screens')}</p>
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('settings.enableAnimations', 'Enable Animations')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.enableAnimationsDesc', 'Show animations throughout the interface')}</p>
          </div>
          <button
            onClick={() => setAnimationsEnabled(!animationsEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              animationsEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                animationsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
