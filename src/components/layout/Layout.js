import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Truck, FileText, Bell, User, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sales', label: 'Sales', icon: ShoppingCart },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/purchasing', label: 'Purchasing', icon: Truck },
  { path: '/reports', label: 'Reports', icon: FileText },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false); // close sidebar on mobile after nav
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div>
          <div className="text-base font-bold text-gray-900 leading-tight">Cable ERP</div>
          <div className="text-xs text-gray-400 mt-0.5">Manufacturing System</div>
        </div>
        {/* Close button only on mobile */}
        <button
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-150 text-left
                ${isActive
                  ? 'bg-gray-50 text-gray-900 border-r-2 border-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 py-3">
        <div className="px-6 py-2 mb-1">
          <div className="text-xs text-gray-400">Signed in as</div>
          <div className="text-sm font-medium text-gray-700 truncate">{user?.name || user?.email || 'Admin'}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 text-left"
        >
          <LogOut size={18} className="flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">

      {/* ── Desktop Sidebar (always visible on md+) ── */}
      <aside className="hidden md:flex flex-col w-64 min-w-[256px] bg-white border-r border-gray-100 z-10">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar Drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-white border-r border-gray-100
          transform transition-transform duration-300 ease-in-out md:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent />
      </aside>

      {/* ── Main Area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center justify-between h-14 md:h-16 px-4 md:px-7 bg-white border-b border-gray-100 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-gray-800 md:hidden">Cable ERP</span>
            <span className="hidden md:block text-sm font-semibold text-gray-700">
              {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition" title="Notifications">
              <Bell size={18} />
            </button>
            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition" title={user?.name}>
              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                {(user?.name || user?.email || 'A')[0].toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}