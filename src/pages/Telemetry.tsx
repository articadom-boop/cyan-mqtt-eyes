import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TelemetryRecord {
  id: string;
  session_id: string;
  raw_payload: Record<string, unknown>;
  topic: string;
  received_at: string;
}

const Telemetry = () => {
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTelemetry = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('telemetry_raw')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setRecords(data as TelemetryRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchTelemetry(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Telemetría Raw</h1>
        </div>
        <Button onClick={fetchTelemetry} variant="outline" size="sm" className="gap-2">
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
                <th className="text-left p-4 font-medium text-muted-foreground">Topic</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Payload</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No hay telemetría registrada. Pendiente: conectar base de datos.
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4">{new Date(r.received_at).toLocaleString('es-ES')}</td>
                  <td className="p-4 font-mono text-xs">{r.session_id?.slice(0, 8)}...</td>
                  <td className="p-4 font-mono text-xs">{r.topic}</td>
                  <td className="p-4">
                    <pre className="font-mono text-xs max-w-lg overflow-auto max-h-20 bg-muted/50 p-2 rounded">
                      {JSON.stringify(r.raw_payload, null, 2)}
                    </pre>
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

export default Telemetry;
