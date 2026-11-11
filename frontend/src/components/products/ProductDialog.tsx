import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Switch';
import { useProductMutations } from '@/hooks/useCatalog';
import { useToast } from '@/hooks/useToast';
import { errorMessage, fieldErrorsFrom, type FieldErrors } from '@/lib/form-errors';
import type { ProductInput } from '@/services/catalog.service';
import type { Product, ProductCategory } from '@/types/models';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'VND'];

interface ProductFormProps {
  product: Product | null;
  categories: ProductCategory[];
  onClose: () => void;
}

function ProductForm({ product, categories, onClose }: ProductFormProps) {
  const { create, update } = useProductMutations();
  const toast = useToast();
  const listId = useId();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    category: product?.category ?? '',
    price: product ? String(product.price) : '',
    currency: product?.currency ?? 'USD',
    stock: product ? String(product.stock) : '0',
    rating: product ? String(product.rating) : '0',
    imageUrl: product?.imageUrl ?? '',
    description: product?.description ?? '',
    isActive: product?.isActive ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const pending = create.isPending || update.isPending;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): FieldErrors => {
    const local: FieldErrors = {};
    const price = Number(form.price);
    const stock = Number(form.stock);
    const rating = Number(form.rating);
    if (form.name.trim().length < 2) local.name = 'Enter at least 2 characters';
    if (!form.category.trim()) local.category = 'Choose or type a category';
    if (!form.price || !Number.isFinite(price) || price <= 0) local.price = 'Enter a price above 0';
    else if (Math.round(price * 100) !== price * 100) local.price = 'Use at most 2 decimal places';
    if (!Number.isInteger(stock) || stock < 0) local.stock = 'Enter a whole number, 0 or more';
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) local.rating = 'Enter a rating from 0 to 5';
    if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl.trim()))
      local.imageUrl = 'Use an http:// or https:// address';
    return local;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length) return;

    const input: ProductInput = {
      name: form.name.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      currency: form.currency,
      stock: Number(form.stock),
      rating: Number(form.rating),
      imageUrl: form.imageUrl.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    };
    try {
      const saved = product ? await update.mutateAsync({ id: product.id, input }) : await create.mutateAsync(input);
      toast.success(product ? 'Product updated' : 'Product created', saved.name);
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error(product ? 'Product not updated' : 'Product not created', errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name} className="sm:col-span-2">
          {(control) => (
            <Input
              {...control}
              autoFocus
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={120}
            />
          )}
        </Field>
        <Field label="Category" error={errors.category}>
          {(control) => (
            <>
              <Input
                {...control}
                value={form.category}
                onChange={(event) => set('category', event.target.value)}
                list={listId}
                maxLength={60}
              />
              <datalist id={listId}>
                {categories.map((category) => (
                  <option key={category.name} value={category.name} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
          <Field label="Price" error={errors.price}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.price}
                onChange={(event) => set('price', event.target.value)}
                placeholder="49.90"
              />
            )}
          </Field>
          <Field label="Currency" error={errors.currency}>
            {(control) => (
              <Select {...control} value={form.currency} onChange={(event) => set('currency', event.target.value)}>
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Stock" error={errors.stock}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={form.stock}
              onChange={(event) => set('stock', event.target.value)}
            />
          )}
        </Field>
        <Field label="Rating" hint="0 to 5" error={errors.rating}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={form.rating}
              onChange={(event) => set('rating', event.target.value)}
            />
          )}
        </Field>
        <Field label="Image URL" aside="Optional" error={errors.imageUrl} className="sm:col-span-2">
          {(control) => (
            <Input
              {...control}
              value={form.imageUrl}
              onChange={(event) => set('imageUrl', event.target.value)}
              placeholder="https://images.example.com/product.jpg"
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Description" aside="Optional" error={errors.description} className="sm:col-span-2">
          {(control) => (
            <Textarea
              {...control}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={2000}
            />
          )}
        </Field>
      </div>
      <Checkbox
        checked={form.isActive}
        onChange={(checked) => set('isActive', checked)}
        label="Visible in the public catalogue (inactive products are only shown to administrators)"
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {product ? 'Save product' : 'Create product'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ProductDialogProps {
  open: boolean;
  product: Product | null;
  categories: ProductCategory[];
  onClose: () => void;
}

export function ProductDialog({ open, product, categories, onClose }: ProductDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={product ? `Edit ${product.name}` : 'New product'} size="lg">
      <ProductForm product={product} categories={categories} onClose={onClose} />
    </Dialog>
  );
}
