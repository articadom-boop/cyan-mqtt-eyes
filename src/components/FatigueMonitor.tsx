import { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Settings, RotateCcw, Eye, AlertTriangle, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import mqtt, { MqttClient } from 'mqtt';

interface MqttConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  topic: string;
}

interface FatigueData {
  timestamp: string;
  drowsiness_score: number;
  drowsiness_level: string;
  alert_triggered: boolean;
  advanced_metrics: {
    ear: number;
    mar: number;
    perclos: number;
    perclos_level: string;
    pitch: number;
    yaw: number;
    roll: number;
    blinks_per_minute: number;
    total_blinks: number;
    total_yawns: number;
    total_nods: number;
  };
  micro_sleep: {
    count: number;
  };
  flicker: {
    count: string | number;
  };
  yawn: {
    count: string | number;
  };
  pitch: {
    count: string | number;
  };
}

interface EventLogEntry {
  timestamp: string;
  topic: string;
  payload: string;
}

interface TimelineEvent {
  time: string;
  level: 'normal' | 'warning' | 'danger';
}

const FatigueMonitor = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('-');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);
  
  const [config, setConfig] = useState<MqttConfig>({
    host: 'hbc0fc94.ala.us-east-1.emqxsl.com',
    port: '8084',
    username: 'Cristian',
    password: 'Noviembre0824@',
    topic: 'fatiga/#'
  });

  const [metrics, setMetrics] = useState({
    ear: 0,
    mar: 0,
    perclos: 0,
    blinksPerMin: 0,
    pitch: 0,
    yaw: 0,
    roll: 0
  });

  const [counters, setCounters] = useState({
    blinks: 0,
    yawns: 0,
    microSleeps: 0,
    nods: 0
  });

  const [fatigueLevel, setFatigueLevel] = useState({
    score: 0,
    level: 'NORMAL'
  });

  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const handleMessage = useCallback((topic: string, message: Buffer) => {
    const payload = message.toString();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES');
    
    // Add to event log
    setEventLog(prev => [{
      timestamp: timeStr,
      topic,
      payload
    }, ...prev].slice(0, 50));

    setLastUpdate(timeStr);

    // Try to parse as fatigue data
    try {
      const data: FatigueData = JSON.parse(payload);
      
      // Update metrics from advanced_metrics
      if (data.advanced_metrics) {
        const am = data.advanced_metrics;
        setMetrics({
          ear: am.ear || 0,
          mar: am.mar || 0,
          perclos: (am.perclos || 0) * 100,
          blinksPerMin: am.blinks_per_minute || 0,
          pitch: am.pitch || 0,
          yaw: am.yaw || 0,
          roll: am.roll || 0
        });

        setCounters({
          blinks: am.total_blinks || 0,
          yawns: am.total_yawns || 0,
          microSleeps: data.micro_sleep?.count || 0,
          nods: am.total_nods || 0
        });
      }

      // Update fatigue level
      setFatigueLevel({
        score: data.drowsiness_score || 0,
        level: data.drowsiness_level || 'NORMAL'
      });

      // Add to timeline
      const level: 'normal' | 'warning' | 'danger' = 
        data.drowsiness_level === 'HIGH' || data.drowsiness_level === 'CRITICAL' 
          ? 'danger' 
          : data.drowsiness_level === 'MEDIUM' 
            ? 'warning' 
            : 'normal';
      
      setTimeline(prev => [...prev, { time: timeStr, level }].slice(-60));
      
    } catch (e) {
      console.log('Non-JSON message received:', payload);
    }
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
    }

    const url = `wss://${config.host}:${config.port}/mqtt`;
    
    const client = mqtt.connect(url, {
      username: config.username,
      password: config.password,
      protocol: 'wss',
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      setIsConnected(true);
      client.subscribe(config.topic, (err) => {
        if (err) {
          console.error('Subscribe error:', err);
        } else {
          console.log(`Subscribed to: ${config.topic}`);
        }
      });
    });

    client.on('message', handleMessage);

    client.on('error', (err) => {
      console.error('MQTT error:', err);
      setIsConnected(false);
    });

    client.on('close', () => {
      console.log('MQTT connection closed');
      setIsConnected(false);
    });

    clientRef.current = client;
  }, [config, handleMessage]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const resetCounters = () => {
    setCounters({ blinks: 0, yawns: 0, microSleeps: 0, nods: 0 });
    setTimeline([]);
    setEventLog([]);
  };

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, []);

  const getFatigueLevelColor = () => {
    switch (fatigueLevel.level) {
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-metric-danger';
      case 'MEDIUM':
        return 'bg-metric-warning';
      default:
        return 'bg-metric-success';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Monitor de Fatiga del Conductor</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={isConnected ? disconnect : connect}
            variant={isConnected ? "destructive" : "default"}
            className="gap-2"
          >
            {isConnected ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            {isConnected ? 'Desconectar' : 'Conectar'}
          </Button>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-metric-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={isConnected ? 'text-metric-success' : 'text-muted-foreground'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-muted-foreground text-sm">Last Update: {lastUpdate}</span>
          
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Configuración MQTT</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 p-4 bg-card-elevated rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Configuración de Conexión</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-primary mb-1 block">Host</label>
                    <Input
                      value={config.host}
                      onChange={(e) => setConfig({ ...config, host: e.target.value })}
                      className="bg-input-bg border-input-border"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-primary mb-1 block">Puerto WebSocket</label>
                    <Input
                      value={config.port}
                      onChange={(e) => setConfig({ ...config, port: e.target.value })}
                      className="bg-input-bg border-input-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-primary mb-1 block">Usuario</label>
                    <Input
                      value={config.username}
                      onChange={(e) => setConfig({ ...config, username: e.target.value })}
                      className="bg-input-bg border-input-border"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-primary mb-1 block">Contraseña</label>
                    <Input
                      type="password"
                      value={config.password}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      className="bg-input-bg border-input-border"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-primary mb-1 block">Topic</label>
                  <Input
                    value={config.topic}
                    onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                    placeholder="fatiga/#"
                    className="bg-input-bg border-input-border"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (isConnected) disconnect();
                    connect();
                    setSettingsOpen(false);
                  }}
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {isConnected ? (
                    <>
                      <WifiOff className="h-4 w-4 mr-2" />
                      Desconectar
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 mr-2" />
                      Conectar
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Metrics */}
        <div className="space-y-6">
          {/* Real-time Metrics */}
          <div className="bg-card rounded-lg p-6 border border-border">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Métricas en Tiempo Real</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-muted-foreground text-xs">EAR</span>
                <p className="text-2xl font-mono text-metric-primary">{metrics.ear.toFixed(3)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">MAR</span>
                <p className="text-2xl font-mono text-metric-secondary">{metrics.mar.toFixed(3)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">PERCLOS</span>
                <p className="text-2xl font-mono text-metric-success">{metrics.perclos.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">BLINKS/MIN</span>
                <p className="text-2xl font-mono text-metric-primary">{metrics.blinksPerMin.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">PITCH</span>
                <p className="text-2xl font-mono text-metric-secondary">{metrics.pitch.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">YAW/ROLL</span>
                <p className="text-2xl font-mono text-metric-success">
                  {metrics.yaw.toFixed(1)} / {metrics.roll.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Fatigue Level & Counters */}
        <div className="space-y-6">
          {/* Fatigue Level */}
          <div className="bg-card rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Nivel de Fatiga</h2>
              <span className="text-3xl font-mono text-foreground">{fatigueLevel.score.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-card-elevated rounded-full h-8 overflow-hidden">
              <div 
                className={`h-full ${getFatigueLevelColor()} transition-all duration-500`}
                style={{ width: `${Math.min(fatigueLevel.score, 100)}%` }}
              />
            </div>
            <p className="text-center mt-2 text-muted-foreground font-semibold">{fatigueLevel.level}</p>
          </div>

          {/* Counters Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border text-center">
              <Eye className="h-8 w-8 mx-auto text-metric-purple mb-2" />
              <p className="text-3xl font-mono text-metric-purple">{counters.blinks}</p>
              <p className="text-sm text-muted-foreground">Total Blinks</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-metric-warning mb-2" />
              <p className="text-3xl font-mono text-metric-warning">{counters.yawns}</p>
              <p className="text-sm text-muted-foreground">Bostezos</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border text-center">
              <Clock className="h-8 w-8 mx-auto text-metric-danger mb-2" />
              <p className="text-3xl font-mono text-metric-danger">{counters.microSleeps}</p>
              <p className="text-sm text-muted-foreground">Microsueños</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border text-center">
              <Activity className="h-8 w-8 mx-auto text-metric-info mb-2" />
              <p className="text-3xl font-mono text-metric-info">{counters.nods}</p>
              <p className="text-sm text-muted-foreground">Cabeceos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6 bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Historial de Eventos</h2>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {timeline.length > 0 ? (
            timeline.map((event, i) => (
              <div
                key={i}
                className={`w-2 h-6 rounded-sm flex-shrink-0 ${
                  event.level === 'danger' ? 'bg-metric-danger' :
                  event.level === 'warning' ? 'bg-metric-warning' : 'bg-metric-success'
                }`}
                title={event.time}
              />
            ))
          ) : (
            <div className="flex gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="w-2 h-6 rounded-sm bg-card-elevated flex-shrink-0" />
              ))}
            </div>
          )}
        </div>
        {timeline.length > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{timeline[0]?.time}</span>
            <span>{timeline[timeline.length - 1]?.time}</span>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <Button
        onClick={resetCounters}
        className="w-full mt-6 bg-primary hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reiniciar Contadores
      </Button>

      {/* Event Log */}
      <div className="mt-6 bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Event Log</h2>
        <div className="max-h-64 overflow-y-auto space-y-2 font-mono text-sm">
          {eventLog.length > 0 ? (
            eventLog.map((entry, i) => (
              <div key={i} className="p-2 bg-card-elevated rounded text-muted-foreground break-all">
                <span className="text-metric-info">[{entry.timestamp}]</span>{' '}
                <span className="text-metric-primary">[{entry.topic}]</span>{' '}
                <span className="text-foreground">{entry.payload}</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center">No recent events</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FatigueMonitor;
