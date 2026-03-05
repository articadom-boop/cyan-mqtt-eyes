import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmergencyAlert {
  id: string;
  session_id: string;
  alert_type: string;
  drowsiness_score: number;
  drowsiness_level: string;
  perclos: number;
  ear: number;
  alert_reasons: string[];
  acknowledged: boolean;
  created_at: string;
}

const Alerts = () => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('emergency_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setAlerts(data as EmergencyAlert[]);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-metric-danger/10 text-metric-danger border-metric-danger/30';
      case 'HIGH': return 'bg-metric-warning/10 text-metric-warning border-metric-warning/30';
      case 'MEDIUM': return 'bg-metric-info/10 text-metric-info border-metric-info/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-metric-danger" />
          <h1 className="text-2xl font-bold text-foreground">Alertas de Emergencia</h1>
        </div>
        <Button onClick={fetchAlerts} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando...</p>
      ) : alerts.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          No hay alertas registradas. Pendiente: conectar base de datos.
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(a => (
            <div key={a.id} className={`rounded-xl border p-5 ${getLevelStyle(a.drowsiness_level)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold">{a.alert_type || 'Alerta de Fatiga'}</span>
                  <span className="text-xs font-mono opacity-70">{a.session_id?.slice(0, 8)}</span>
                </div>
                <span className="text-sm">{new Date(a.created_at).toLocaleString('es-ES')}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="opacity-70">Score:</span>{' '}
                  <span className="font-mono font-bold">{a.drowsiness_score?.toFixed(1)}</span>
                </div>
                <div>
                  <span className="opacity-70">Nivel:</span>{' '}
                  <span className="font-bold">{a.drowsiness_level}</span>
                </div>
                <div>
                  <span className="opacity-70">PERCLOS:</span>{' '}
                  <span className="font-mono">{(a.perclos * 100)?.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="opacity-70">EAR:</span>{' '}
                  <span className="font-mono">{a.ear?.toFixed(3)}</span>
                </div>
              </div>
              {a.alert_reasons && a.alert_reasons.length > 0 && (
                <div className="mt-3 text-xs opacity-80">
                  <strong>Razones:</strong> {a.alert_reasons.join(' | ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
