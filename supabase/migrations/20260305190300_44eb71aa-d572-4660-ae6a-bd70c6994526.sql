-- Create timestamps update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Sessions table
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL DEFAULT 'truck_042',
  driver_id TEXT NOT NULL DEFAULT 'driver_007',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions are readable by all" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Sessions can be inserted" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Sessions can be updated" ON public.sessions FOR UPDATE USING (true);
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Metrics Summary table
CREATE TABLE public.metrics_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  avg_ear DOUBLE PRECISION DEFAULT 0,
  avg_mar DOUBLE PRECISION DEFAULT 0,
  avg_perclos DOUBLE PRECISION DEFAULT 0,
  total_blinks INTEGER DEFAULT 0,
  total_yawns INTEGER DEFAULT 0,
  total_microsleeps INTEGER DEFAULT 0,
  total_nods INTEGER DEFAULT 0,
  max_drowsiness_score DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.metrics_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Metrics are readable by all" ON public.metrics_summary FOR SELECT USING (true);
CREATE POLICY "Metrics can be inserted" ON public.metrics_summary FOR INSERT WITH CHECK (true);
CREATE POLICY "Metrics can be updated" ON public.metrics_summary FOR UPDATE USING (true);
CREATE TRIGGER update_metrics_summary_updated_at BEFORE UPDATE ON public.metrics_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are readable by all" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events can be inserted" ON public.events FOR INSERT WITH CHECK (true);

-- 4. Emergency Alerts table
CREATE TABLE public.emergency_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'fatigue',
  drowsiness_score DOUBLE PRECISION DEFAULT 0,
  drowsiness_level TEXT NOT NULL DEFAULT 'LOW',
  perclos DOUBLE PRECISION DEFAULT 0,
  ear DOUBLE PRECISION DEFAULT 0,
  alert_reasons TEXT[] DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alerts are readable by all" ON public.emergency_alerts FOR SELECT USING (true);
CREATE POLICY "Alerts can be inserted" ON public.emergency_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Alerts can be updated" ON public.emergency_alerts FOR UPDATE USING (true);

-- 5. Telemetry Raw table
CREATE TABLE public.telemetry_raw (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  topic TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.telemetry_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Telemetry is readable by all" ON public.telemetry_raw FOR SELECT USING (true);
CREATE POLICY "Telemetry can be inserted" ON public.telemetry_raw FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_events_session_id ON public.events(session_id);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX idx_telemetry_raw_session_id ON public.telemetry_raw(session_id);
CREATE INDEX idx_telemetry_raw_received_at ON public.telemetry_raw(received_at DESC);
CREATE INDEX idx_emergency_alerts_session_id ON public.emergency_alerts(session_id);
CREATE INDEX idx_emergency_alerts_created_at ON public.emergency_alerts(created_at DESC);
CREATE INDEX idx_metrics_summary_session_id ON public.metrics_summary(session_id);