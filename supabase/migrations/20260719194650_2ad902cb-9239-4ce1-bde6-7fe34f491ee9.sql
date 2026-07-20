
-- Categories
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
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Units
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
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Products
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
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stock movements
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

-- Function to apply stock adjustment atomically
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _shop_id UUID,
  _product_id UUID,
  _movement_type TEXT,
  _quantity NUMERIC,
  _unit_cost NUMERIC,
  _reference_type TEXT,
  _reference_id UUID,
  _note TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _delta NUMERIC;
  _mid UUID;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _movement_type IN ('purchase','return_in','opening') THEN
    _delta := _quantity;
  ELSIF _movement_type IN ('sale','return_out') THEN
    _delta := -_quantity;
  ELSIF _movement_type = 'adjustment' THEN
    _delta := _quantity;
  ELSE
    RAISE EXCEPTION 'invalid movement_type';
  END IF;

  INSERT INTO public.stock_movements(shop_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
  VALUES (_shop_id, _product_id, _movement_type, _quantity, _unit_cost, _reference_type, _reference_id, _note, auth.uid())
  RETURNING id INTO _mid;

  UPDATE public.products SET stock_quantity = stock_quantity + _delta,
    purchase_price = CASE WHEN _movement_type='purchase' AND _unit_cost IS NOT NULL THEN _unit_cost ELSE purchase_price END
  WHERE id = _product_id AND shop_id = _shop_id;

  RETURN _mid;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID,UUID,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT) TO authenticated;
