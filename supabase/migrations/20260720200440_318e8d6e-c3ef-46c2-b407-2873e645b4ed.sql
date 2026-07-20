
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage categories" ON public.categories FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, short_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage units" ON public.units FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  low_stock_alert NUMERIC(14,3) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_shop ON public.products(shop_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE UNIQUE INDEX uniq_products_shop_sku ON public.products(shop_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX uniq_products_shop_barcode ON public.products(shop_id, barcode) WHERE barcode IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage products" ON public.products FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase','sale','adjustment','return_in','return_out','opening')),
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(12,2),
  reference_type TEXT,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_shop_product ON public.stock_movements(shop_id, product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage stock movements" ON public.stock_movements FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _shop_id UUID, _product_id UUID, _movement_type TEXT, _quantity NUMERIC,
  _unit_cost NUMERIC, _reference_type TEXT, _reference_id UUID, _note TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _delta NUMERIC; _mid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _movement_type IN ('purchase','return_in','opening') THEN _delta := _quantity;
  ELSIF _movement_type IN ('sale','return_out') THEN _delta := -_quantity;
  ELSIF _movement_type = 'adjustment' THEN _delta := _quantity;
  ELSE RAISE EXCEPTION 'invalid movement_type'; END IF;
  INSERT INTO public.stock_movements(shop_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
  VALUES (_shop_id, _product_id, _movement_type, _quantity, _unit_cost, _reference_type, _reference_id, _note, auth.uid())
  RETURNING id INTO _mid;
  UPDATE public.products SET stock_quantity = stock_quantity + _delta,
    purchase_price = CASE WHEN _movement_type='purchase' AND _unit_cost IS NOT NULL THEN _unit_cost ELSE purchase_price END
  WHERE id = _product_id AND shop_id = _shop_id;
  RETURN _mid;
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID,UUID,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT) TO authenticated;

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT, address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_no TEXT, purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  due NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT, created_by UUID REFERENCES auth.users(id),
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
CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT, note TEXT,
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

CREATE OR REPLACE FUNCTION public.create_purchase(
  _shop_id UUID, _supplier_id UUID, _invoice_no TEXT, _purchase_date DATE,
  _discount NUMERIC, _paid NUMERIC, _payment_method TEXT, _note TEXT, _items JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _purchase_id UUID; _subtotal NUMERIC := 0; _total NUMERIC; _due NUMERIC;
  _item JSONB; _qty NUMERIC; _cost NUMERIC; _line NUMERIC; _pid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC; _cost := (_item->>'unit_cost')::NUMERIC;
    _subtotal := _subtotal + (_qty * _cost);
  END LOOP;
  _total := _subtotal - COALESCE(_discount, 0);
  _due := _total - COALESCE(_paid, 0);
  INSERT INTO public.purchases(shop_id, supplier_id, invoice_no, purchase_date, subtotal, discount, total, paid, due, payment_method, note, created_by)
  VALUES (_shop_id, _supplier_id, _invoice_no, COALESCE(_purchase_date, CURRENT_DATE), _subtotal, COALESCE(_discount,0), _total, COALESCE(_paid,0), _due, COALESCE(_payment_method,'cash'), _note, auth.uid())
  RETURNING id INTO _purchase_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID; _qty := (_item->>'quantity')::NUMERIC;
    _cost := (_item->>'unit_cost')::NUMERIC; _line := _qty * _cost;
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

CREATE OR REPLACE FUNCTION public.pay_supplier(
  _shop_id UUID, _supplier_id UUID, _amount NUMERIC, _payment_method TEXT,
  _payment_date DATE, _reference TEXT, _note TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  INSERT INTO public.supplier_payments(shop_id, supplier_id, amount, payment_method, payment_date, reference, note, created_by)
  VALUES (_shop_id, _supplier_id, _amount, COALESCE(_payment_method,'cash'), COALESCE(_payment_date, CURRENT_DATE), _reference, _note, auth.uid())
  RETURNING id INTO _pid;
  UPDATE public.suppliers SET current_balance = current_balance - _amount WHERE id = _supplier_id AND shop_id = _shop_id;
  RETURN _pid;
END; $$;

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT, address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT, is_active BOOLEAN NOT NULL DEFAULT true, created_by UUID,
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

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_no TEXT, sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  due NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_type TEXT NOT NULL DEFAULT 'cash',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT, created_by UUID,
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

CREATE TABLE public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT, note TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members manage customer_payments" ON public.customer_payments FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_customer_payments_customer ON public.customer_payments(customer_id);

CREATE TABLE public.installment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
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

CREATE OR REPLACE FUNCTION public.create_sale(
  _shop_id UUID, _customer_id UUID, _invoice_no TEXT, _sale_date DATE,
  _discount NUMERIC, _paid NUMERIC, _payment_method TEXT, _sale_type TEXT,
  _note TEXT, _items JSONB, _installments INTEGER, _installment_frequency TEXT, _installment_start DATE
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale_id UUID; _subtotal NUMERIC := 0; _total NUMERIC; _due NUMERIC;
  _item JSONB; _pid UUID; _qty NUMERIC; _price NUMERIC; _cost NUMERIC; _line NUMERIC;
  _i INTEGER; _inst_amount NUMERIC; _inst_date DATE; _remaining NUMERIC;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sale_type NOT IN ('cash','due','installment') THEN RAISE EXCEPTION 'invalid sale_type'; END IF;
  IF _sale_type IN ('due','installment') AND _customer_id IS NULL THEN RAISE EXCEPTION 'বাকি/কিস্তি বিক্রির জন্য কাস্টমার লাগবে'; END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::NUMERIC; _price := (_item->>'unit_price')::NUMERIC;
    _subtotal := _subtotal + (_qty * _price);
  END LOOP;
  _total := _subtotal - COALESCE(_discount,0);
  IF _sale_type = 'cash' THEN _paid := _total; END IF;
  _due := _total - COALESCE(_paid,0);
  IF _due < 0 THEN _due := 0; END IF;
  INSERT INTO public.sales(shop_id, customer_id, invoice_no, sale_date, subtotal, discount, total, paid, due, sale_type, payment_method, note, created_by)
  VALUES (_shop_id, _customer_id, _invoice_no, COALESCE(_sale_date, CURRENT_DATE), _subtotal, COALESCE(_discount,0), _total, COALESCE(_paid,0), _due, _sale_type, COALESCE(_payment_method,'cash'), _note, auth.uid())
  RETURNING id INTO _sale_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_item->>'product_id')::UUID; _qty := (_item->>'quantity')::NUMERIC;
    _price := (_item->>'unit_price')::NUMERIC; _cost := NULLIF(_item->>'unit_cost','')::NUMERIC;
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

CREATE OR REPLACE FUNCTION public.receive_customer_payment(
  _shop_id UUID, _customer_id UUID, _amount NUMERIC, _payment_method TEXT,
  _payment_date DATE, _reference TEXT, _note TEXT, _sale_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid UUID; _remaining NUMERIC; _inst RECORD; _apply NUMERIC; _need NUMERIC;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  INSERT INTO public.customer_payments(shop_id, customer_id, sale_id, amount, payment_method, payment_date, reference, note, created_by)
  VALUES (_shop_id, _customer_id, _sale_id, _amount, COALESCE(_payment_method,'cash'), COALESCE(_payment_date, CURRENT_DATE), _reference, _note, auth.uid())
  RETURNING id INTO _pid;
  UPDATE public.customers SET current_balance = current_balance - _amount WHERE id = _customer_id AND shop_id = _shop_id;
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
  IF _sale_id IS NOT NULL THEN
    UPDATE public.sales SET paid = paid + _amount, due = GREATEST(due - _amount, 0)
    WHERE id = _sale_id AND shop_id = _shop_id;
  END IF;
  RETURN _pid;
END; $$;

CREATE TABLE public.app_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL DEFAULT 'Supershop',
  tagline TEXT, logo_url TEXT, favicon_url TEXT,
  contact_email TEXT, contact_phone TEXT, contact_address TEXT,
  facebook_url TEXT, website_url TEXT, footer_note TEXT,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_branding TO authenticated;
GRANT ALL ON public.app_branding TO service_role;
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read branding" ON public.app_branding FOR SELECT USING (true);
CREATE POLICY "Super admin manages branding" ON public.app_branding FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_app_branding_updated BEFORE UPDATE ON public.app_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.app_branding (site_name, tagline)
VALUES ('Supershop', 'মুদি দোকানের সম্পূর্ণ ম্যানেজমেন্ট সফটওয়্যার')
ON CONFLICT DO NOTHING;

CREATE TABLE public.impersonation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.impersonation_tokens TO service_role;
ALTER TABLE public.impersonation_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.impersonation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.impersonation_audit TO authenticated;
GRANT ALL ON public.impersonation_audit TO service_role;
ALTER TABLE public.impersonation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view impersonation audit" ON public.impersonation_audit FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_impersonation_audit_shop ON public.impersonation_audit(shop_id, created_at DESC);
CREATE INDEX idx_impersonation_tokens_token ON public.impersonation_tokens(token);

CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text NOT NULL, email text,
  shop_name text, message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT INSERT ON public.demo_requests TO anon;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit demo requests" ON public.demo_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admins can view demo requests" ON public.demo_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update demo requests" ON public.demo_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.packages TO anon;
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT TO anon USING (is_active = true);
