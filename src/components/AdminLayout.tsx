import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, AlertTriangle, FileText, 
  Database, Settings, Menu, X, Truck, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Monitor en Vivo', icon: Activity },
  { to: '/sessions', label: 'Sesiones', icon: FileText },
  { to: '/metrics', label: 'Métricas', icon: LayoutDashboard },
  { to: '/events', label: 'Eventos', icon: Database },
  { to: '/alerts', label: 'Alertas de Emergencia', icon: AlertTriangle },
  { to: '/telemetry', label: 'Telemetría Raw', icon: Truck },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-foreground text-sm">SomnoAlert</h1>
              <p className="text-[10px] text-muted-foreground">Panel Administrativo</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <div className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            !sidebarOpen && "justify-center"
          )}>
            <Truck className="h-3 w-3" />
            {sidebarOpen && <span>truck_042 / driver_007</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
