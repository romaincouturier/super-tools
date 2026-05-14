
CREATE TABLE public.webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'woocommerce',
    event_type TEXT,
    payload JSONB NOT NULL,
    headers JSONB,
    wc_order_id BIGINT,
    status TEXT NOT NULL DEFAULT 'received',
    response_status INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webhook_logs_source ON public.webhook_logs(source);
CREATE INDEX idx_webhook_logs_wc_order_id ON public.webhook_logs(wc_order_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs(status);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service can insert webhook logs"
ON public.webhook_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can delete webhook logs"
ON public.webhook_logs FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));
