import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Truck, FileText, Bell, User, LogOut, Menu, X, ChevronsLeft, ChevronsRight, Maximize2, Minimize2 } from 'lucide-react';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  useEffect(() => {
    const updateFullScreen = () => setIsFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullScreen);
    return () => document.removeEventListener('fullscreenchange', updateFullScreen);
  }, []);

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false); // close sidebar on mobile after nav
  };

  const SidebarContent = ({ isCollapsed = false, onToggleCollapse }) => (
    <>
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-6 py-5 border-b border-gray-100`}>
        <div className={isCollapsed ? 'flex items-center justify-center w-full' : ''}>
          <div className="text-base font-bold text-gray-900 leading-tight">
            {!isCollapsed ? 'Cable ERP' : 'CE'}
          </div>
          {!isCollapsed && <div className="text-xs text-gray-400 mt-0.5">Manufacturing System</div>}
        </div>
        {!isCollapsed && (
          <button
            className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              title={label}
              className={`w-full flex items-center gap-2 ${isCollapsed ? 'justify-center px-0' : 'justify-start px-6'} py-3 text-sm font-medium transition-all duration-150 text-left
                ${isActive
                  ? 'bg-gray-50 text-gray-900 border-r-2 border-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-gray-100 py-3 ${isCollapsed ? 'px-0' : ''}`}>
        <div className={`px-6 py-2 mb-1 ${isCollapsed ? 'hidden' : ''}`}>
          <div className="text-xs text-gray-400">Signed in as</div>
          <div className="text-sm font-medium text-gray-700 truncate">{user?.name || user?.email || 'Admin'}</div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign Out"
          className={`w-full flex items-center gap-3 ${isCollapsed ? 'justify-center px-0' : 'px-6'} py-3 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 ${isCollapsed ? 'text-center' : 'text-left'}`}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!isCollapsed && 'Sign Out'}
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`mt-2 w-full flex items-center gap-3 ${isCollapsed ? 'justify-center px-0' : 'px-6'} py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all duration-150 ${isCollapsed ? 'text-center' : 'text-left'} hidden md:flex`}
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!isCollapsed && (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">

      {/* ── Desktop Sidebar (collapsible on md+) ── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-100 z-10 overflow-hidden transition-[width] duration-300 ease-in-out ${sidebarCollapsed ? 'w-20 min-w-[80px]' : 'w-64 min-w-[256px]'}`}>
        <SidebarContent isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)} />
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
        <header className="flex items-center justify-between h-14 md:h-16 px-2 md:px-7 bg-white border-b border-gray-100 flex-shrink-0 z-10">
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
            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              title={isFullScreen ? 'Exit full screen' : 'Full screen'}
              onClick={toggleFullScreen}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
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
          <div className="p-2 sm:p-3 lg:p-4 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}