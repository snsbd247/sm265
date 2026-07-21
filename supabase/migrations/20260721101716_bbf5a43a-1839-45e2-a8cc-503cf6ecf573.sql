
-- 1. Extend sale_items / sales / shops for discount + tax
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS shift_id UUID;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT false;

-- 2. POS shifts
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  closing_cash_expected NUMERIC NOT NULL DEFAULT 0,
  closing_cash_actual NUMERIC,
  cash_sales_total NUMERIC NOT NULL DEFAULT 0,
  card_sales_total NUMERIC NOT NULL DEFAULT 0,
  bkash_sales_total NUMERIC NOT NULL DEFAULT 0,
  bank_sales_total NUMERIC NOT NULL DEFAULT 0,
  other_sales_total NUMERIC NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  variance NUMERIC,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shifts TO authenticated;
GRANT ALL ON public.pos_shifts TO service_role;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift members" ON public.pos_shifts;
CREATE POLICY "shift members" ON public.pos_shifts
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- 3. Returns
CREATE TABLE IF NOT EXISTS public.sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_returns TO authenticated;
GRANT ALL ON public.sale_returns TO service_role;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_returns members" ON public.sale_returns;
CREATE POLICY "sale_returns members" ON public.sale_returns
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.sale_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_return_items TO authenticated;
GRANT ALL ON public.sale_return_items TO service_role;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_return_items members" ON public.sale_return_items;
CREATE POLICY "sale_return_items members" ON public.sale_return_items
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- 4. Shift RPCs
CREATE OR REPLACE FUNCTION public.open_shift(_shop_id UUID, _opening_cash NUMERIC, _note TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _existing UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT id INTO _existing FROM public.pos_shifts
   WHERE shop_id = _shop_id AND opened_by = auth.uid() AND status = 'open' LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  INSERT INTO public.pos_shifts(shop_id, opened_by, opening_cash, note)
    VALUES (_shop_id, auth.uid(), COALESCE(_opening_cash, 0), _note)
    RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.close_shift(_shift_id UUID, _closing_cash_actual NUMERIC, _note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sh RECORD; _cash NUMERIC:=0; _card NUMERIC:=0; _bk NUMERIC:=0; _bank NUMERIC:=0; _oth NUMERIC:=0; _tot NUMERIC:=0; _cnt INT:=0; _exp NUMERIC;
BEGIN
  SELECT * INTO _sh FROM public.pos_shifts WHERE id = _shift_id;
  IF _sh IS NULL THEN RAISE EXCEPTION 'shift not found'; END IF;
  IF NOT (public.is_shop_member(auth.uid(), _sh.shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sh.status = 'closed' THEN RAISE EXCEPTION 'shift already closed'; END IF;

  SELECT COALESCE(SUM(CASE WHEN payment_method='cash' THEN paid ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN payment_method='card' THEN paid ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN payment_method='bkash' THEN paid ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN payment_method='bank' THEN paid ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash','card','bkash','bank') THEN paid ELSE 0 END),0),
         COALESCE(SUM(total),0), COUNT(*)
    INTO _cash, _card, _bk, _bank, _oth, _tot, _cnt
    FROM public.sales WHERE shift_id = _shift_id AND status <> 'cancelled';
  _exp := _sh.opening_cash + _cash;
  UPDATE public.pos_shifts SET
    closed_at = now(), status='closed',
    cash_sales_total=_cash, card_sales_total=_card, bkash_sales_total=_bk, bank_sales_total=_bank,
    other_sales_total=_oth, total_sales=_tot, sales_count=_cnt,
    closing_cash_expected=_exp,
    closing_cash_actual=_closing_cash_actual,
    variance = COALESCE(_closing_cash_actual,0) - _exp,
    note = COALESCE(_note, note)
   WHERE id = _shift_id;
END; $$;

-- 5. Rewrite create_sale to handle new fields and shift
CREATE OR REPLACE FUNCTION public.create_sale(
  _shop_id uuid, _customer_id uuid, _invoice_no text, _sale_date date,
  _discount numeric, _paid numeric, _payment_method text, _sale_type text,
  _note text, _items jsonb, _installments integer, _installment_frequency text, _installment_start date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale_id UUID; _subtotal NUMERIC:=0; _tax_total NUMERIC:=0; _item_disc_total NUMERIC:=0;
  _total NUMERIC; _due NUMERIC; _item JSONB; _pid UUID; _qty NUMERIC; _price NUMERIC; _cost NUMERIC;
  _idisc NUMERIC; _trate NUMERIC; _tax NUMERIC; _line NUMERIC;
  _i INTEGER; _inst_amount NUMERIC; _inst_date DATE; _remaining NUMERIC; _shift UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sale_type NOT IN ('cash','due','installment') THEN RAISE EXCEPTION 'invalid sale_type'; END IF;
  IF _sale_type IN ('due','installment') AND _customer_id IS NULL THEN RAISE EXCEPTION 'বাকি/কিস্তি বিক্রির জন্য কাস্টমার লাগবে'; END IF;

  SELECT id INTO _shift FROM public.pos_shifts
    WHERE shop_id=_shop_id AND opened_by=auth.uid() AND status='open' LIMIT 1;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC;
    _price := (_item->>'unit_price')::NUMERIC;
    _idisc := COALESCE(NULLIF(_item->>'discount_amount','')::NUMERIC, 0);
    _trate := COALESCE(NULLIF(_item->>'tax_rate','')::NUMERIC, 0);
    _line := (_qty * _price) - _idisc;
    _tax  := ROUND(_line * _trate / 100.0, 2);
    _subtotal := _subtotal + (_qty * _price);
    _item_disc_total := _item_disc_total + _idisc;
    _tax_total := _tax_total + _tax;
  END LOOP;

  _total := _subtotal - _item_disc_total - COALESCE(_discount,0) + _tax_total;
  IF _sale_type = 'cash' THEN _paid := _total; END IF;
  _due := GREATEST(_total - COALESCE(_paid,0), 0);

  INSERT INTO public.sales(shop_id, customer_id, invoice_no, sale_date, subtotal, discount, tax_amount, total, paid, due, sale_type, payment_method, note, created_by, shift_id, status)
  VALUES (_shop_id, _customer_id, _invoice_no, COALESCE(_sale_date, CURRENT_DATE), _subtotal, COALESCE(_discount,0) + _item_disc_total, _tax_total, _total, COALESCE(_paid,0), _due, _sale_type, COALESCE(_payment_method,'cash'), _note, auth.uid(), _shift, 'completed')
  RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID;
    _qty := (_item->>'quantity')::NUMERIC;
    _price := (_item->>'unit_price')::NUMERIC;
    _cost := NULLIF(_item->>'unit_cost','')::NUMERIC;
    _idisc := COALESCE(NULLIF(_item->>'discount_amount','')::NUMERIC, 0);
    _trate := COALESCE(NULLIF(_item->>'tax_rate','')::NUMERIC, 0);
    _line := (_qty * _price) - _idisc;
    _tax  := ROUND(_line * _trate / 100.0, 2);
    INSERT INTO public.sale_items(shop_id, sale_id, product_id, quantity, unit_price, unit_cost, line_total, discount_amount, tax_rate, tax_amount)
    VALUES (_shop_id, _sale_id, _pid, _qty, _price, _cost, _line + _tax, _idisc, _trate, _tax);
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
      IF _i = _installments THEN _inst_amount := _remaining; END IF;
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

-- 6. Cancel sale
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale RECORD; _it RECORD;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id;
  IF _sale IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT (public.is_shop_member(auth.uid(), _sale.shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sale.status = 'cancelled' THEN RETURN; END IF;

  FOR _it IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    PERFORM public.apply_stock_movement(_sale.shop_id, _it.product_id, 'return_in', _it.quantity, _it.unit_cost, 'sale_cancel', _sale_id, 'ক্যান্সেল: ' || COALESCE(_sale.invoice_no,''));
  END LOOP;

  IF _sale.customer_id IS NOT NULL THEN
    UPDATE public.customers SET current_balance = current_balance - _sale.due WHERE id = _sale.customer_id AND shop_id = _sale.shop_id;
    IF _sale.paid > 0 THEN
      INSERT INTO public.customer_payments(shop_id, customer_id, sale_id, amount, payment_method, payment_date, note, created_by)
      VALUES (_sale.shop_id, _sale.customer_id, _sale_id, -_sale.paid, _sale.payment_method, CURRENT_DATE, 'ক্যান্সেল রিফান্ড', auth.uid());
      UPDATE public.customers SET current_balance = current_balance - _sale.paid WHERE id = _sale.customer_id AND shop_id = _sale.shop_id;
    END IF;
  END IF;

  UPDATE public.installment_schedules SET status = 'cancelled' WHERE sale_id = _sale_id;
  UPDATE public.sales SET status = 'cancelled', note = COALESCE(note,'') || ' | ক্যান্সেল: ' || COALESCE(_reason,''), due = 0, paid = 0 WHERE id = _sale_id;
END; $$;

-- 7. Create sale return (partial or full)
CREATE OR REPLACE FUNCTION public.create_sale_return(
  _sale_id UUID, _items JSONB, _refund_amount NUMERIC, _refund_method TEXT, _reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale RECORD; _ret UUID; _item JSONB; _si RECORD; _qty NUMERIC; _line NUMERIC; _total NUMERIC := 0;
  _already NUMERIC;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id;
  IF _sale IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT (public.is_shop_member(auth.uid(), _sale.shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sale.status = 'cancelled' THEN RAISE EXCEPTION 'ক্যান্সেল করা বিক্রয় রিটার্ন করা যাবে না'; END IF;

  INSERT INTO public.sale_returns(shop_id, sale_id, reason, refund_amount, refund_method, created_by)
    VALUES (_sale.shop_id, _sale_id, _reason, COALESCE(_refund_amount,0), COALESCE(_refund_method,'cash'), auth.uid())
    RETURNING id INTO _ret;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC;
    IF _qty <= 0 THEN CONTINUE; END IF;
    SELECT * INTO _si FROM public.sale_items WHERE id = (_item->>'sale_item_id')::UUID;
    IF _si IS NULL THEN CONTINUE; END IF;
    SELECT COALESCE(SUM(quantity),0) INTO _already FROM public.sale_return_items WHERE sale_item_id = _si.id;
    IF _already + _qty > _si.quantity THEN RAISE EXCEPTION 'রিটার্ন quantity বিক্রয় quantity র চেয়ে বেশি'; END IF;
    _line := _qty * _si.unit_price;
    _total := _total + _line;
    INSERT INTO public.sale_return_items(shop_id, return_id, sale_item_id, product_id, quantity, unit_price, line_total)
    VALUES (_sale.shop_id, _ret, _si.id, _si.product_id, _qty, _si.unit_price, _line);
    PERFORM public.apply_stock_movement(_sale.shop_id, _si.product_id, 'return_in', _qty, _si.unit_cost, 'sale_return', _ret, 'রিটার্ন: ' || COALESCE(_sale.invoice_no,''));
  END LOOP;

  IF _sale.customer_id IS NOT NULL AND COALESCE(_refund_amount,0) > 0 THEN
    -- refund reduces customer balance (they owe less) or gives cash back
    UPDATE public.customers SET current_balance = current_balance - _refund_amount WHERE id = _sale.customer_id AND shop_id = _sale.shop_id;
    INSERT INTO public.customer_payments(shop_id, customer_id, sale_id, amount, payment_method, payment_date, note, created_by)
    VALUES (_sale.shop_id, _sale.customer_id, _sale_id, -_refund_amount, COALESCE(_refund_method,'cash'), CURRENT_DATE, 'রিটার্ন রিফান্ড', auth.uid());
  END IF;

  -- Determine new sale status
  IF (SELECT COALESCE(SUM(sri.quantity),0) FROM public.sale_return_items sri
       JOIN public.sale_items si ON si.id = sri.sale_item_id
       WHERE si.sale_id = _sale_id)
     >= (SELECT COALESCE(SUM(quantity),0) FROM public.sale_items WHERE sale_id = _sale_id) THEN
    UPDATE public.sales SET status='returned' WHERE id = _sale_id;
  ELSE
    UPDATE public.sales SET status='partial_return' WHERE id = _sale_id;
  END IF;

  RETURN _ret;
END; $$;
