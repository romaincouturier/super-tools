CREATE POLICY "Dropshipping staff can read woocommerce_orders"
ON public.woocommerce_orders
FOR SELECT
TO authenticated
USING (has_module_access(auth.uid(), 'dropshipping'));