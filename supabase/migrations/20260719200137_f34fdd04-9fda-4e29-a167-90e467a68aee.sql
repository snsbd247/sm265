
-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage customers" ON public.customers FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_customers_shop ON public.customers(shop_id);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_no TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  due NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_type TEXT NOT NULL DEFAULT 'cash', -- cash | due | installment
  payment_method TEXT NOT NULL DEFAULT 'cash', -- cash | bkash | bank | due
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage sales" ON public.sales FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_sales_shop_date ON public.sales(shop_id, sale_date DESC);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);

-- Sale items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  unit_cost NUMERIC(14,2),
  line_total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage sale_items" ON public.sale_items FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- Customer payments
CREATE TABLE public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage customer_payments" ON public.customer_payments FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_customer_payments_customer ON public.customer_payments(customer_id);

-- Installment schedules
CREATE TABLE public.installment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | partial | paid | overdue
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_schedules TO authenticated;
GRANT ALL ON public.installment_schedules TO service_role;
ALTER TABLE public.installment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage installment_schedules" ON public.installment_schedules FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_installments_sale ON public.installment_schedules(sale_id);
CREATE INDEX idx_installments_customer_due ON public.installment_schedules(customer_id, due_date);

-- RPC: create_sale
CREATE OR REPLACE FUNCTION public.create_sale(
  _shop_id UUID,
  _customer_id UUID,
  _invoice_no TEXT,
  _sale_date DATE,
  _discount NUMERIC,
  _paid NUMERIC,
  _payment_method TEXT,
  _sale_type TEXT,
  _note TEXT,
  _items JSONB,
  _installments INTEGER,
  _installment_frequency TEXT,
  _installment_start DATE
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sale_id UUID;
  _subtotal NUMERIC := 0;
  _total NUMERIC;
  _due NUMERIC;
  _item JSONB;
  _pid UUID;
  _qty NUMERIC;
  _price NUMERIC;
  _cost NUMERIC;
  _line NUMERIC;
  _i INTEGER;
  _inst_amount NUMERIC;
  _inst_date DATE;
  _remaining NUMERIC;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _sale_type NOT IN ('cash','due','installment') THEN
    RAISE EXCEPTION 'invalid sale_type';
  END IF;

  IF _sale_type IN ('due','installment') AND _customer_id IS NULL THEN
    RAISE EXCEPTION 'বাকি/কিস্তি বিক্রির জন্য কাস্টমার লাগবে';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC;
    _price := (_item->>'unit_price')::NUMERIC;
    _subtotal := _subtotal + (_qty * _price);
  END LOOP;

  _total := _subtotal - COALESCE(_discount,0);
  IF _sale_type = 'cash' THEN
    _paid := _total;
  END IF;
  _due := _total - COALESCE(_paid,0);
  IF _due < 0 THEN _due := 0; END IF;

  INSERT INTO public.sales(shop_id, customer_id, invoice_no, sale_date, subtotal, discount, total, paid, due, sale_type, payment_method, note, created_by)
  VALUES (_shop_id, _customer_id, _invoice_no, COALESCE(_sale_date, CURRENT_DATE), _subtotal, COALESCE(_discount,0), _total, COALESCE(_paid,0), _due, _sale_type, COALESCE(_payment_method,'cash'), _note, auth.uid())
  RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID;
    _qty := (_item->>'quantity')::NUMERIC;
    _price := (_item->>'unit_price')::NUMERIC;
    _cost := NULLIF(_item->>'unit_cost','')::NUMERIC;
    _line := _qty * _price;

    INSERT INTO public.sale_items(shop_id, sale_id, product_id, quantity, unit_price, unit_cost, line_total)
    VALUES (_shop_id, _sale_id, _pid, _qty, _price, _cost, _line);

    PERFORM public.apply_stock_movement(_shop_id, _pid, 'sale', _qty, _cost, 'sale', _sale_id, _invoice_no);
  END LOOP;

  IF _customer_id IS NOT NULL AND _due > 0 THEN
    UPDATE public.customers SET current_balance = current_balance + _due WHERE id = _customer_id AND shop_id = _shop_id;
  END IF;

  IF COALESCE(_paid,0) > 0 AND _customer_id IS NOT NULL THEN
    INSERT INTO public.customer_payments(shop_id, customer_id, sale_id, amount, payment_method, payment_date, note, created_by)
    VALUES (_shop_id, _customer_id, _sale_id, _paid, COALESCE(_payment_method,'cash'), COALESCE(_sale_date, CURRENT_DATE), 'বিক্রির সাথে পরিশোধ', auth.uid());
  END IF;

  IF _sale_type = 'installment' AND _installments IS NOT NULL AND _installments > 0 AND _due > 0 THEN
    _inst_amount := ROUND(_due / _installments, 2);
    _remaining := _due;
    FOR _i IN 1.._installments LOOP
      IF _i = _installments THEN
        _inst_amount := _remaining;
      END IF;
      IF _installment_frequency = 'weekly' THEN
        _inst_date := COALESCE(_installment_start, CURRENT_DATE) + (_i * INTERVAL '7 days');
      ELSE
        _inst_date := COALESCE(_installment_start, CURRENT_DATE) + (_i * INTERVAL '1 month');
      END IF;
      INSERT INTO public.installment_schedules(shop_id, sale_id, customer_id, installment_no, due_date, amount)
      VALUES (_shop_id, _sale_id, _customer_id, _i, _inst_date, _inst_amount);
      _remaining := _remaining - _inst_amount;
    END LOOP;
  END IF;

  RETURN _sale_id;
END; $$;

-- RPC: receive_customer_payment (allocates to oldest pending installments if any)
CREATE OR REPLACE FUNCTION public.receive_customer_payment(
  _shop_id UUID,
  _customer_id UUID,
  _amount NUMERIC,
  _payment_method TEXT,
  _payment_date DATE,
  _reference TEXT,
  _note TEXT,
  _sale_id UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _pid UUID;
  _remaining NUMERIC;
  _inst RECORD;
  _apply NUMERIC;
  _need NUMERIC;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  INSERT INTO public.customer_payments(shop_id, customer_id, sale_id, amount, payment_method, payment_date, reference, note, created_by)
  VALUES (_shop_id, _customer_id, _sale_id, _amount, COALESCE(_payment_method,'cash'), COALESCE(_payment_date, CURRENT_DATE), _reference, _note, auth.uid())
  RETURNING id INTO _pid;

  UPDATE public.customers SET current_balance = current_balance - _amount WHERE id = _customer_id AND shop_id = _shop_id;

  -- Allocate to oldest pending installments (all sales for this customer, or filter by sale)
  _remaining := _amount;
  FOR _inst IN
    SELECT * FROM public.installment_schedules
    WHERE customer_id = _customer_id AND shop_id = _shop_id
      AND status IN ('pending','partial','overdue')
      AND (_sale_id IS NULL OR sale_id = _sale_id)
    ORDER BY due_date ASC, installment_no ASC
  LOOP
    EXIT WHEN _remaining <= 0;
    _need := _inst.amount - _inst.paid_amount;
    IF _need <= 0 THEN CONTINUE; END IF;
    _apply := LEAST(_remaining, _need);
    UPDATE public.installment_schedules
      SET paid_amount = paid_amount + _apply,
          status = CASE WHEN paid_amount + _apply >= amount THEN 'paid' ELSE 'partial' END
      WHERE id = _inst.id;
    _remaining := _remaining - _apply;
  END LOOP;

  -- Update sale paid/due if sale-specific
  IF _sale_id IS NOT NULL THEN
    UPDATE public.sales SET paid = paid + _amount, due = GREATEST(due - _amount, 0)
    WHERE id = _sale_id AND shop_id = _shop_id;
  END IF;

  RETURN _pid;
END; $$;
