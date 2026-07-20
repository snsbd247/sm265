
-- suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_shop ON public.suppliers(shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_shop_access" ON public.suppliers FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_no TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  due NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_shop ON public.purchases(shop_id, purchase_date DESC);
CREATE INDEX idx_purchases_supplier ON public.purchases(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_shop_access" ON public.purchases FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- purchase_items
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pitems_purchase ON public.purchase_items(purchase_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pitems_shop_access" ON public.purchase_items FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- supplier_payments
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_spay_shop ON public.supplier_payments(shop_id, payment_date DESC);
CREATE INDEX idx_spay_supplier ON public.supplier_payments(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spay_shop_access" ON public.supplier_payments FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- create_purchase RPC
CREATE OR REPLACE FUNCTION public.create_purchase(
  _shop_id UUID,
  _supplier_id UUID,
  _invoice_no TEXT,
  _purchase_date DATE,
  _discount NUMERIC,
  _paid NUMERIC,
  _payment_method TEXT,
  _note TEXT,
  _items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _purchase_id UUID;
  _subtotal NUMERIC := 0;
  _total NUMERIC;
  _due NUMERIC;
  _item JSONB;
  _qty NUMERIC;
  _cost NUMERIC;
  _line NUMERIC;
  _pid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC;
    _cost := (_item->>'unit_cost')::NUMERIC;
    _subtotal := _subtotal + (_qty * _cost);
  END LOOP;

  _total := _subtotal - COALESCE(_discount, 0);
  _due := _total - COALESCE(_paid, 0);

  INSERT INTO public.purchases(shop_id, supplier_id, invoice_no, purchase_date, subtotal, discount, total, paid, due, payment_method, note, created_by)
  VALUES (_shop_id, _supplier_id, _invoice_no, COALESCE(_purchase_date, CURRENT_DATE), _subtotal, COALESCE(_discount,0), _total, COALESCE(_paid,0), _due, COALESCE(_payment_method,'cash'), _note, auth.uid())
  RETURNING id INTO _purchase_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID;
    _qty := (_item->>'quantity')::NUMERIC;
    _cost := (_item->>'unit_cost')::NUMERIC;
    _line := _qty * _cost;

    INSERT INTO public.purchase_items(shop_id, purchase_id, product_id, quantity, unit_cost, line_total)
    VALUES (_shop_id, _purchase_id, _pid, _qty, _cost, _line);

    PERFORM public.apply_stock_movement(_shop_id, _pid, 'purchase', _qty, _cost, 'purchase', _purchase_id, _invoice_no);
  END LOOP;

  IF _supplier_id IS NOT NULL THEN
    UPDATE public.suppliers SET current_balance = current_balance + _due WHERE id = _supplier_id AND shop_id = _shop_id;

    IF COALESCE(_paid,0) > 0 THEN
      INSERT INTO public.supplier_payments(shop_id, supplier_id, purchase_id, amount, payment_method, payment_date, note, created_by)
      VALUES (_shop_id, _supplier_id, _purchase_id, _paid, COALESCE(_payment_method,'cash'), COALESCE(_purchase_date, CURRENT_DATE), 'ক্রয়ের সাথে পরিশোধ', auth.uid());
    END IF;
  END IF;

  RETURN _purchase_id;
END; $$;

-- pay_supplier RPC
CREATE OR REPLACE FUNCTION public.pay_supplier(
  _shop_id UUID,
  _supplier_id UUID,
  _amount NUMERIC,
  _payment_method TEXT,
  _payment_date DATE,
  _reference TEXT,
  _note TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  INSERT INTO public.supplier_payments(shop_id, supplier_id, amount, payment_method, payment_date, reference, note, created_by)
  VALUES (_shop_id, _supplier_id, _amount, COALESCE(_payment_method,'cash'), COALESCE(_payment_date, CURRENT_DATE), _reference, _note, auth.uid())
  RETURNING id INTO _pid;

  UPDATE public.suppliers SET current_balance = current_balance - _amount WHERE id = _supplier_id AND shop_id = _shop_id;
  RETURN _pid;
END; $$;
