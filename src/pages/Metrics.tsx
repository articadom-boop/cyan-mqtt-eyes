import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MetricsSummary = Tables<'metrics_summary'>;

const Metrics = () => {
  const [metrics, setMetrics] = useState<MetricsSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('metrics_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error && data) setMetrics(data);
    setLoading(false);
  };

  useEffect(() => { fetchMetrics(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Resumen de Métricas</h1>
        </div>
        <Button onClick={fetchMetrics} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Sesión</th>
                <th className="text-left p-4 font-medium text-muted-foreground">EAR Prom.</th>
                <th className="text-left p-4 font-medium text-muted-foreground">MAR Prom.</th>
                <th className="text-left p-4 font-medium text-muted-foreground">PERCLOS Prom.</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Blinks</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Bostezos</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Microsueños</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Max Score</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : metrics.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No hay métricas registradas aún.
                </td></tr>
              ) : metrics.map(m => (
                <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono text-xs">{m.session_id?.slice(0, 8)}...</td>
                  <td className="p-4 font-mono">{m.avg_ear?.toFixed(3)}</td>
                  <td className="p-4 font-mono">{m.avg_mar?.toFixed(3)}</td>
                  <td className="p-4 font-mono">{((m.avg_perclos || 0) * 100).toFixed(1)}%</td>
                  <td className="p-4 font-mono">{m.total_blinks}</td>
                  <td className="p-4 font-mono">{m.total_yawns}</td>
                  <td className="p-4 font-mono">{m.total_microsleeps}</td>
                  <td className="p-4 font-mono">{m.max_drowsiness_score?.toFixed(1)}</td>
                  <td className="p-4">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
