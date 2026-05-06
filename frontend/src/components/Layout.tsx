import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield, Home, FolderLock, Activity, Settings, Users, LogOut, Bell, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { NotificationToast } from './NotificationToast';
import { useEffect, useRef, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import { API } from '../config/api';

const Sidebar = () => {
  const { riskLevel, riskScore, user, logout, addNotification, notifications } = useAppStore();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<any>(null);

  // Track unread notification count (increment on each new notification)
  const prevNotifCount = useRef(notifications.length);
  useEffect(() => {
    if (notifications.length > prevNotifCount.current) {
      setUnreadCount(c => c + (notifications.length - prevNotifCount.current));
    }
    prevNotifCount.current = notifications.length;
  }, [notifications]);

  // Connect to notification service Socket.IO
  useEffect(() => {
    const socket = socketIO(API.notifSocketUrl, {
      path: '/notifications',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('[Notification WS] Connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('security_alert', (data: any) => {
      addNotification(`🚨 Security Alert: ${data.message}`, 'error');
    });

    socket.on('healing_complete', (data: any) => {
      addNotification(`✅ ${data.message}`, 'success');
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  const getRiskColor = () => {
    switch(riskLevel) {
      case 'LOW':      return 'text-accent border-accent';
      case 'MEDIUM':   return 'text-warning border-warning';
      case 'HIGH':     return 'text-danger border-danger';
      case 'CRITICAL': return 'text-danger border-danger bg-danger/20 animate-pulse';
      default:         return 'text-accent border-accent';
    }
  };

  const handleLogout = () => {
    logout();
    addNotification('Signed out successfully.', 'info');
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: Home,       label: 'Dashboard' },
    { to: '/files',     icon: FolderLock, label: 'Files' },
    { to: '/security',  icon: Activity,   label: 'Security Center' },
    { to: '/admin',     icon: Users,      label: 'Admin Panel' },
    { to: '/settings',  icon: Settings,   label: 'Settings' },
  ];

  return (
    <div className="w-64 glass-panel h-screen fixed left-0 top-0 flex flex-col p-6 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
          <Shield className="text-primary w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight text-white">ShieldCloud</h1>
          <p className="text-xs text-gray-400 font-medium tracking-wider">PQC SECURED</p>
        </div>
        {/* Notification bell */}
        <button
          className="ml-auto relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Notifications"
          onClick={() => setUnreadCount(0)}
        >
          <Bell className="w-4 h-4 text-gray-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-[9px] font-black text-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* User badge */}
      {user && (
        <div className="mb-4 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user.name}</p>
            <p className="text-gray-500 text-xs truncate">{user.email}</p>
          </div>
        </div>
      )}

      {/* Risk indicator */}
      <div className={`mb-6 p-3 rounded-xl border ${getRiskColor()} bg-surfaceHighlight/30 flex items-center gap-3`}>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5">System Risk</p>
          <div className="font-bold text-base">{riskLevel}</div>
        </div>
        <div className="text-2xl font-black">{(riskScore * 100).toFixed(0)}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                isActive ? 'bg-primary/20 text-white border border-primary/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon className="w-4 h-4" /> {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs font-medium ${connected ? 'text-accent' : 'text-gray-600'}`}>
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {connected ? 'Risk Engine Connected' : 'Reconnecting...'}
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-all mt-1 text-sm"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
};

export const Layout = () => {
  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />

      <Sidebar />
      <main className="flex-1 ml-64 p-8 relative z-10 h-screen overflow-y-auto">
        <Outlet />
      </main>

      {/* Global notification overlay */}
      <NotificationToast />
    </div>
  );
};
