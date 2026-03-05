import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Sessions = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    
    if (!error && data) setSessions(data);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Sesiones</h1>
        </div>
        <Button onClick={fetchSessions} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">ID</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Vehículo</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Conductor</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Inicio</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Fin</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No hay sesiones registradas aún.
                </td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono text-xs">{s.id.slice(0, 8)}...</td>
                  <td className="p-4">{s.vehicle_id}</td>
                  <td className="p-4">{s.driver_id}</td>
                  <td className="p-4">{new Date(s.started_at).toLocaleString('es-ES')}</td>
                  <td className="p-4">{s.ended_at ? new Date(s.ended_at).toLocaleString('es-ES') : '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.status === 'active' ? 'bg-metric-success/10 text-metric-success' : 'bg-muted text-muted-foreground'
                    }`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sessions;
