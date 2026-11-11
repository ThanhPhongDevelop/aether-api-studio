import { MoreHorizontal, Package, Pencil, Plus, Send, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductDialog } from '@/components/products/ProductDialog';
import { ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useProductCategories, useProductMutations, useProducts } from '@/hooks/useCatalog';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTester } from '@/hooks/useTester';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import { formatNumber, formatPrice } from '@/lib/format';
import { loginPath } from '@/lib/navigation';
import { draftFrom, testerStore } from '@/lib/tester-store';
import type { ProductQuery } from '@/services/catalog.service';
import type { Product } from '@/types/models';

const DEFAULTS = {
  search: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  stock: '',
  sort: '-createdAt',
  status: 'active',
  page: '1',
};

const SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'price', label: 'Price, low to high' },
  { value: '-price', label: 'Price, high to low' },
  { value: 'name', label: 'Name, A to Z' },
  { value: '-rating', label: 'Best rated' },
  { value: '-stock', label: 'Most in stock' },
];

function hue(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function ProductGlyph({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  if (product.imageUrl && !failed) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 rounded-xl border border-line object-cover"
      />
    );
  }
  const base = hue(product.category);
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm text-white"
      style={{ background: `linear-gradient(140deg, hsl(${base} 65% 50%), hsl(${(base + 40) % 360} 70% 38%))` }}
      aria-hidden
    >
      {product.category.charAt(0).toUpperCase()}
    </span>
  );
}

export default function ProductsPage() {
  const { isAdmin, status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { dirty } = useTester();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.search);
  const [price, setPrice] = useState({ min: filters.minPrice, max: filters.maxPrice });
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const debouncedPrice = useDebouncedValue(price, 400);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const { remove } = useProductMutations();
  const categories = useProductCategories();

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  useEffect(() => {
    if (debouncedPrice.min !== filters.minPrice || debouncedPrice.max !== filters.maxPrice) {
      setFilters({ minPrice: debouncedPrice.min, maxPrice: debouncedPrice.max });
    }
  }, [debouncedPrice, filters.minPrice, filters.maxPrice, setFilters]);

  const rangeError =
    filters.minPrice !== '' && filters.maxPrice !== '' && Number(filters.minPrice) > Number(filters.maxPrice);

  const query: ProductQuery = {
    page: Number(filters.page) || 1,
    limit: 10,
    search: filters.search || undefined,
    category: filters.category || undefined,
    // An inverted range is pointed out next to the inputs instead of being sent.
    minPrice: filters.minPrice && !rangeError ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice && !rangeError ? Number(filters.maxPrice) : undefined,
    inStock: filters.stock === '' ? undefined : filters.stock === 'in',
    sort: filters.sort,
    status: isAdmin ? (filters.status as ProductQuery['status']) : undefined,
  };
  const products = useProducts(query);
  const filtered = Boolean(filters.search || filters.category || filters.minPrice || filters.maxPrice || filters.stock);

  const tryInTester = async (product: Product) => {
    if (dirty) {
      const replace = await confirm({
        title: 'Replace the request in the tester?',
        description: 'The tester has unsaved changes.',
        confirmLabel: 'Replace it',
      });
      if (!replace) return;
    }
    testerStore.load(
      draftFrom({ name: `Get ${product.name}`, method: 'GET', url: `{{baseUrl}}/products/${product.id}` }),
    );
    void navigate(status === 'authenticated' ? '/tester' : loginPath('/tester'));
  };

  const destroy = async (product: Product) => {
    const confirmed = await confirm({
      title: `Delete “${product.name}”?`,
      description: 'The product is removed from the database. To hide it instead, edit it and untick “Visible”.',
      confirmLabel: 'Delete product',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(product.id);
      toast.success('Product deleted', product.name);
    } catch (error) {
      toast.error('Product not deleted', errorMessage(error));
    }
  };

  const items = products.data?.items ?? [];

  return (
    <>
      <title>{pageTitle('Products')}</title>
      <PageHeader
        title="Products"
        description="The demo catalogue served by /api/products. Everyone can browse it; administrators can change it."
        actions={
          isAdmin ? (
            <Button icon={<Plus />} onClick={() => setEditing('new')}>
              New product
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or description"
          label="Search products"
          shortcut
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Category"
          value={filters.category}
          onChange={(event) => setFilters({ category: event.target.value })}
          className="w-40"
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.name} value={category.name}>
              {category.name} ({category.count})
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="Minimum price"
            inputMode="decimal"
            placeholder="Min price"
            value={price.min}
            aria-invalid={rangeError || undefined}
            onChange={(event) =>
              setPrice((current) => ({ ...current, min: event.target.value.replace(/[^\d.]/g, '') }))
            }
            className="w-24"
          />
          <span className="text-ink-faint" aria-hidden>
            –
          </span>
          <Input
            aria-label="Maximum price"
            inputMode="decimal"
            placeholder="Max price"
            value={price.max}
            aria-invalid={rangeError || undefined}
            onChange={(event) =>
              setPrice((current) => ({ ...current, max: event.target.value.replace(/[^\d.]/g, '') }))
            }
            className="w-24"
          />
        </div>
        <Select
          aria-label="Availability"
          value={filters.stock}
          onChange={(event) => setFilters({ stock: event.target.value })}
          className="w-36"
        >
          <option value="">Any stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </Select>
        {isAdmin ? (
          <Select
            aria-label="Visibility"
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value })}
            className="w-36"
          >
            <option value="active">Visible</option>
            <option value="inactive">Hidden</option>
            <option value="all">All products</option>
          </Select>
        ) : null}
        <Select
          aria-label="Sort by"
          value={filters.sort}
          onChange={(event) => setFilters({ sort: event.target.value })}
          className="ml-auto w-48"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>
      </div>

      {rangeError ? (
        <p className="-mt-2 mb-4 text-xs text-fail" role="alert">
          The minimum price is above the maximum, so the price filter is ignored.
        </p>
      ) : null}

      {products.isError && !products.data ? (
        <ErrorState message={errorMessage(products.error)} onRetry={() => void products.refetch()} />
      ) : (
        <div
          className={cn(
            'glass overflow-hidden rounded-[1.25rem] transition-opacity',
            products.isPlaceholderData && 'opacity-60',
          )}
        >
          {products.isPending ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={filtered ? 'No product matches these filters' : 'No products yet'}
              description={
                filtered
                  ? 'Widen the price range or clear the search.'
                  : isAdmin
                    ? 'Create the first one.'
                    : 'Check back later.'
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setPrice({ min: '', max: '' });
                      setFilters({ search: '', category: '', minPrice: '', maxPrice: '', stock: '' });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] table-fixed text-sm">
                <caption className="sr-only">Products</caption>
                <colgroup>
                  <col />
                  <col className="w-28" />
                  <col className="w-36" />
                  <col className="w-24" />
                  <col className={isAdmin ? 'w-56' : 'w-48'} />
                </colgroup>
                <thead className="border-b border-line text-left text-xs text-ink-faint">
                  <tr>
                    <th className="px-5 py-3 font-normal">Product</th>
                    <th className="px-3 py-3 text-right font-normal">Price</th>
                    <th className="px-3 py-3 font-normal">Stock</th>
                    <th className="px-3 py-3 font-normal">Rating</th>
                    <th className="px-5 py-3 text-right font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((product) => (
                    <tr
                      key={product.id}
                      className={cn('transition-colors hover:bg-line/40', !product.isActive && 'opacity-70')}
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductGlyph product={product} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium text-ink">
                              <span className="truncate">{product.name}</span>
                              {!product.isActive ? <ToneBadge tone="neutral">Hidden</ToneBadge> : null}
                            </p>
                            <p className="truncate text-xs text-ink-faint">
                              {product.category}
                              {product.description ? ` — ${product.description}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-ink tabular-nums">
                        {formatPrice(product.price, product.currency)}
                      </td>
                      <td className="px-3 py-3">
                        {product.stock > 0 ? (
                          <span className="text-ink-muted tabular-nums">{formatNumber(product.stock)} in stock</span>
                        ) : (
                          <ToneBadge tone="warn">Out of stock</ToneBadge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-ink-muted tabular-nums">
                          <Star className="size-3.5 fill-current text-warn" aria-hidden />
                          {product.rating.toFixed(1)}
                          <span className="sr-only">out of 5</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Send />} onClick={() => void tryInTester(product)}>
                            Open in tester
                          </Button>
                          {isAdmin ? (
                            <Menu
                              trigger={(props) => (
                                <Button
                                  {...props}
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 px-0"
                                  aria-label={`Actions for ${product.name}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              )}
                              items={[
                                { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing(product) },
                                {
                                  label: 'Delete',
                                  icon: <Trash2 />,
                                  tone: 'danger',
                                  onSelect: () => void destroy(product),
                                },
                              ]}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {products.data && products.data.meta.total > 0 ? (
            <Pagination
              meta={products.data.meta}
              onPageChange={(page) => setFilters({ page: String(page) })}
              noun="products"
              className="border-t border-line px-5 py-3"
            />
          ) : null}
        </div>
      )}

      <ProductDialog
        open={editing !== null}
        product={editing === 'new' ? null : editing}
        categories={categories.data ?? []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
