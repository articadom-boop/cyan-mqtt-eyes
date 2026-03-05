import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EventRecord = Tables<'events'>;

const Events = () => {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setEvents(data);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-metric-danger/10 text-metric-danger';
      case 'high': return 'bg-metric-warning/10 text-metric-warning';
      case 'medium': return 'bg-metric-info/10 text-metric-info';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
        </div>
        <Button onClick={fetchEvents} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Sesión</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Severidad</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No hay eventos registrados aún.
                </td></tr>
              ) : events.map(e => (
                <tr key={e.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4">{new Date(e.created_at).toLocaleString('es-ES')}</td>
                  <td className="p-4 font-mono text-xs">{e.session_id?.slice(0, 8)}...</td>
                  <td className="p-4 font-medium">{e.event_type}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityStyle(e.severity)}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs max-w-xs truncate">{JSON.stringify(e.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Events;
