import { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Settings, RotateCcw, Eye, AlertTriangle, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import mqtt, { MqttClient } from 'mqtt';

// Thresholds for fatigue detection
const EAR_CLOSED_THRESHOLD = 0.2;
const PERCLOS_WARNING_THRESHOLD = 0.2;
const PERCLOS_DANGER_THRESHOLD = 0.5;
const PERCLOS_CRITICAL_THRESHOLD = 0.8;

interface MqttConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  topic: string;
}

interface AdvancedMetrics {
  timestamp?: number;
  ear: number;
  ear_left?: number;
  ear_right?: number;
  eye_state?: string;
  blink_detected?: boolean;
  blink_duration_ms?: number;
  blink_type?: string | null;
  blink_frequency_hz?: number;
  blinks_per_minute: number;
  total_blinks: number;
  normal_blinks?: number;
  prolonged_blinks?: number;
  critical_blinks?: number;
  perclos: number;
  perclos_level: string;
  mar: number;
  mouth_state?: string;
  yawn_detected?: boolean;
  yawn_in_progress?: boolean;
  yawn_duration?: number;
  yawns_last_minute?: number;
  yawns_last_5_minutes?: number;
  total_yawns: number;
  pitch: number;
  yaw: number;
  roll: number;
  head_state?: string;
  nod_detected?: boolean;
  head_drop_detected?: boolean;
  excessive_tilt?: boolean;
  nods_last_minute?: number;
  total_nods: number;
  head_stability?: number;
  drowsiness_score?: number;
  drowsiness_level?: string;
  alert_triggered?: boolean;
  alert_reasons?: string[];
}

interface FatigueData {
  timestamp: string;
  drowsiness_score: number;
  drowsiness_level: string;
  alert_triggered: boolean;
  advanced_metrics: AdvancedMetrics;
  micro_sleep: {
    report?: boolean;
    count: number;
    durations?: number[];
    eyes_closed?: boolean;
    eyes_closed_duration?: number;
    eyes_closed_alarm?: boolean;
  };
  flicker: {
    report?: boolean;
    count: string | number;
  };
  yawn: {
    report?: boolean;
    count: string | number;
    durations?: number[];
  };
  pitch: {
    report?: boolean;
    count: string | number;
    durations?: number[];
  };
  eye_rub_first_hand?: {
    report?: boolean;
    count: number;
    durations?: number[];
  };
  eye_rub_second_hand?: {
    report?: boolean;
    count: number;
    durations?: number[];
  };
}

// Compute effective fatigue level considering PERCLOS priority
const computeEffectiveFatigueLevel = (
  drowsinessLevel: string,
  drowsinessScore: number,
  perclos: number,
  perclosLevel: string,
  ear: number,
  eyesClosed: boolean
): { level: string; score: number; isOverridden: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  let effectiveLevel = drowsinessLevel;
  let effectiveScore = drowsinessScore;
  let isOverridden = false;

  // Rule: PERCLOS critical overrides everything
  if (perclos >= PERCLOS_CRITICAL_THRESHOLD || perclosLevel === 'critical') {
    if (drowsinessLevel === 'LOW' || drowsinessLevel === 'NORMAL') {
      effectiveLevel = 'CRITICAL';
      effectiveScore = Math.max(effectiveScore, 80);
      isOverridden = true;
      reasons.push(`PERCLOS crítico: ${(perclos * 100).toFixed(0)}% tiempo con ojos cerrados`);
    }
  }

  // Rule: EAR = 0 with sustained closed eyes indicates critical state
  if (ear <= EAR_CLOSED_THRESHOLD && eyesClosed) {
    if (effectiveLevel === 'LOW' || effectiveLevel === 'NORMAL') {
      effectiveLevel = 'HIGH';
      effectiveScore = Math.max(effectiveScore, 70);
      isOverridden = true;
      reasons.push('Ojos cerrados sostenidos detectados');
    }
  }

  // Rule: Cannot show NORMAL if PERCLOS > 50%
  if (perclos > PERCLOS_DANGER_THRESHOLD && effectiveLevel === 'NORMAL') {
    effectiveLevel = 'MEDIUM';
    effectiveScore = Math.max(effectiveScore, 50);
    isOverridden = true;
    reasons.push(`PERCLOS elevado: ${(perclos * 100).toFixed(0)}%`);
  }

  return { level: effectiveLevel, score: effectiveScore, isOverridden, reasons };
};

// Determine eye state from data
const computeEyeState = (
  rawEyeState: string | undefined,
  ear: number,
  perclos: number
): string => {
  // If PERCLOS is critical, eyes are effectively closed
  if (perclos >= PERCLOS_CRITICAL_THRESHOLD) {
    return 'closed';
  }
  // If EAR is below threshold, eyes are closed
  if (ear <= EAR_CLOSED_THRESHOLD) {
    return 'closed';
  }
  // If raw state is valid, use it
  if (rawEyeState && rawEyeState !== 'unknown') {
    return rawEyeState;
  }
  // Default to open if EAR is reasonable
  if (ear > EAR_CLOSED_THRESHOLD) {
    return 'open';
  }
  return 'unknown';
};

// Get PERCLOS color based on value
const getPerclosColor = (perclos: number): string => {
  if (perclos <= PERCLOS_WARNING_THRESHOLD) return 'text-metric-success';
  if (perclos <= PERCLOS_DANGER_THRESHOLD) return 'text-metric-warning';
  return 'text-metric-danger';
};

// Get EAR display with context
const getEarDisplay = (ear: number): { value: string; context: string | null } => {
  if (ear <= EAR_CLOSED_THRESHOLD) {
    return { value: ear.toFixed(3), context: '(ojos cerrados)' };
  }
  return { value: ear.toFixed(3), context: null };
};

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
    port: '8883',
    username: 'Cristian',
    password: 'Noviembre0824@',
    topic: 'Test/Connection'
  });

const [metrics, setMetrics] = useState({
    ear: 0,
    mar: 0,
    perclos: 0, // Raw 0-1 value
    perclosPercent: 0, // Display percentage
    blinksPerMin: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    eyeState: 'unknown'
  });

  const [counters, setCounters] = useState({
    blinks: 0,
    yawns: 0,
    microSleeps: 0,
    nods: 0
  });

  const [fatigueLevel, setFatigueLevel] = useState({
    score: 0,
    level: 'NORMAL',
    isOverridden: false,
    alertReasons: [] as string[]
  });

  const [alertState, setAlertState] = useState({
    isTriggered: false,
    reasons: [] as string[],
    eyesClosed: false,
    eyesClosedDuration: 0
  });

  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const handleMessage = useCallback((topic: string, message: Buffer) => {
    const payload = message.toString();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES');
    
    setLastUpdate(timeStr);

    // Try to parse as fatigue data
    try {
      const data: FatigueData = JSON.parse(payload);
      
      if (data.advanced_metrics) {
        const am = data.advanced_metrics;
        const rawPerclos = am.perclos || 0;
        const rawEar = am.ear || 0;
        const rawPerclosLevel = am.perclos_level || 'normal';
        
        // Compute effective eye state
        const effectiveEyeState = computeEyeState(am.eye_state, rawEar, rawPerclos);
        
        // Check for sustained eye closure
        const eyesClosed = data.micro_sleep?.eyes_closed || false;
        const eyesClosedDuration = data.micro_sleep?.eyes_closed_duration || 0;
        
        // Compute effective fatigue level with PERCLOS priority
        const effectiveFatigue = computeEffectiveFatigueLevel(
          data.drowsiness_level || 'NORMAL',
          data.drowsiness_score || 0,
          rawPerclos,
          rawPerclosLevel,
          rawEar,
          eyesClosed
        );

        // Update metrics with raw values
        setMetrics({
          ear: rawEar,
          mar: am.mar || 0,
          perclos: rawPerclos,
          perclosPercent: rawPerclos * 100,
          blinksPerMin: am.blinks_per_minute || 0,
          pitch: am.pitch || 0,
          yaw: am.yaw || 0,
          roll: am.roll || 0,
          eyeState: effectiveEyeState
        });

        // Update counters
        setCounters({
          blinks: am.total_blinks || 0,
          yawns: am.total_yawns || 0,
          microSleeps: data.micro_sleep?.count || 0,
          nods: am.total_nods || 0
        });

        // Update fatigue level with override logic
        setFatigueLevel({
          score: effectiveFatigue.score,
          level: effectiveFatigue.level,
          isOverridden: effectiveFatigue.isOverridden,
          alertReasons: effectiveFatigue.reasons
        });

        // Update alert state
        setAlertState({
          isTriggered: data.alert_triggered || effectiveFatigue.isOverridden,
          reasons: am.alert_reasons || effectiveFatigue.reasons,
          eyesClosed,
          eyesClosedDuration
        });

        // Determine timeline level based on effective state
        const timelineLevel: 'normal' | 'warning' | 'danger' = 
          effectiveFatigue.level === 'HIGH' || effectiveFatigue.level === 'CRITICAL' 
            ? 'danger' 
            : effectiveFatigue.level === 'MEDIUM' || rawPerclos > PERCLOS_WARNING_THRESHOLD
              ? 'warning' 
              : 'normal';
        
        setTimeline(prev => [...prev, { time: timeStr, level: timelineLevel }].slice(-60));

        // Add meaningful events to log
        const logEntries: EventLogEntry[] = [];
        
        // Log PERCLOS critical state
        if (rawPerclos >= PERCLOS_CRITICAL_THRESHOLD) {
          logEntries.push({
            timestamp: timeStr,
            topic: 'ALERTA',
            payload: `PERCLOS crítico: ${(rawPerclos * 100).toFixed(0)}% - Ojos cerrados detectados`
          });
        }
        
        // Log microsleep
        if (data.micro_sleep?.report) {
          logEntries.push({
            timestamp: timeStr,
            topic: 'MICROSUEÑO',
            payload: `Microsueño detectado - Duración: ${eyesClosedDuration.toFixed(1)}s`
          });
        }
        
        // Log yawn
        if (am.yawn_detected) {
          logEntries.push({
            timestamp: timeStr,
            topic: 'BOSTEZO',
            payload: 'Bostezo detectado'
          });
        }
        
        // Log head nod
        if (am.nod_detected) {
          logEntries.push({
            timestamp: timeStr,
            topic: 'CABECEO',
            payload: 'Cabeceo detectado'
          });
        }
        
        // Log alert reasons
        if (effectiveFatigue.isOverridden && effectiveFatigue.reasons.length > 0) {
          logEntries.push({
            timestamp: timeStr,
            topic: 'OVERRIDE',
            payload: effectiveFatigue.reasons.join(' | ')
          });
        }

        // Always log raw data for debugging (compact format)
        logEntries.push({
          timestamp: timeStr,
          topic,
          payload: `EAR:${rawEar.toFixed(3)} MAR:${(am.mar||0).toFixed(3)} PERCLOS:${(rawPerclos*100).toFixed(0)}% Level:${effectiveFatigue.level}`
        });
        
        setEventLog(prev => [...logEntries, ...prev].slice(0, 100));
      }
      
    } catch (e) {
      // Log non-JSON messages
      setEventLog(prev => [{
        timestamp: timeStr,
        topic,
        payload
      }, ...prev].slice(0, 100));
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

  const getFatigueLevelTextColor = () => {
    switch (fatigueLevel.level) {
      case 'HIGH':
      case 'CRITICAL':
        return 'text-metric-danger';
      case 'MEDIUM':
        return 'text-metric-warning';
      default:
        return 'text-metric-success';
    }
  };

  const earDisplay = getEarDisplay(metrics.ear);
  const perclosColor = getPerclosColor(metrics.perclos);

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
                <div className="flex items-baseline gap-1">
                  <p className={`text-2xl font-mono ${metrics.ear <= EAR_CLOSED_THRESHOLD ? 'text-metric-danger' : 'text-metric-primary'}`}>
                    {earDisplay.value}
                  </p>
                  {earDisplay.context && (
                    <span className="text-xs text-metric-danger">{earDisplay.context}</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">MAR</span>
                <p className="text-2xl font-mono text-metric-secondary">{metrics.mar.toFixed(3)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">PERCLOS</span>
                <p className={`text-2xl font-mono ${perclosColor}`}>
                  {metrics.perclosPercent.toFixed(1)}%
                </p>
                {metrics.perclos >= PERCLOS_CRITICAL_THRESHOLD && (
                  <span className="text-xs text-metric-danger font-semibold">CRÍTICO</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground text-xs">BLINKS/MIN</span>
                <p className="text-2xl font-mono text-metric-primary">{metrics.blinksPerMin.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">PITCH</span>
                <p className="text-2xl font-mono text-metric-secondary">{metrics.pitch.toFixed(1)}°</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">YAW / ROLL</span>
                <p className="text-2xl font-mono text-metric-success">
                  {metrics.yaw.toFixed(1)}° / {metrics.roll.toFixed(1)}°
                </p>
              </div>
            </div>
            {/* Eye State Indicator */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Estado de Ojos</span>
                <span className={`font-semibold ${
                  metrics.eyeState === 'closed' ? 'text-metric-danger' : 
                  metrics.eyeState === 'open' ? 'text-metric-success' : 'text-muted-foreground'
                }`}>
                  {metrics.eyeState === 'closed' ? 'CERRADOS' : 
                   metrics.eyeState === 'open' ? 'ABIERTOS' : 'DESCONOCIDO'}
                </span>
              </div>
              {alertState.eyesClosed && alertState.eyesClosedDuration > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground text-sm">Duración Ojos Cerrados</span>
                  <span className="text-metric-danger font-mono">
                    {alertState.eyesClosedDuration.toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Fatigue Level & Counters */}
        <div className="space-y-6">
          {/* Fatigue Level */}
          <div className={`bg-card rounded-lg p-6 border ${
            fatigueLevel.level === 'CRITICAL' ? 'border-metric-danger border-2' :
            fatigueLevel.level === 'HIGH' ? 'border-metric-danger' :
            fatigueLevel.level === 'MEDIUM' ? 'border-metric-warning' : 'border-border'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Nivel de Fatiga</h2>
                {fatigueLevel.isOverridden && (
                  <span className="px-2 py-0.5 bg-metric-danger/20 text-metric-danger text-xs rounded-full font-semibold">
                    OVERRIDE
                  </span>
                )}
              </div>
              <span className={`text-3xl font-mono ${getFatigueLevelTextColor()}`}>
                {fatigueLevel.score.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-card-elevated rounded-full h-8 overflow-hidden">
              <div 
                className={`h-full ${getFatigueLevelColor()} transition-all duration-500`}
                style={{ width: `${Math.min(fatigueLevel.score, 100)}%` }}
              />
            </div>
            <p className={`text-center mt-2 font-bold text-lg ${getFatigueLevelTextColor()}`}>
              {fatigueLevel.level}
            </p>
            
            {/* Alert Reasons */}
            {fatigueLevel.alertReasons.length > 0 && (
              <div className="mt-4 p-3 bg-metric-danger/10 rounded-lg border border-metric-danger/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-metric-danger" />
                  <span className="text-sm font-semibold text-metric-danger">Alertas Activas</span>
                </div>
                <ul className="space-y-1">
                  {fatigueLevel.alertReasons.map((reason, i) => (
                    <li key={i} className="text-xs text-metric-danger/90">{reason}</li>
                  ))}
                </ul>
              </div>
            )}
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
