'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit3,
  Archive,
  RotateCcw,
  Eye,
  Lock,
  Loader2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CategoryRecord,
  ProductRecord,
  ProductType,
  UnitRecord,
} from '@/types/database';
import {
  createProductAction,
  updateProductAction,
  toggleArchiveProductAction,
} from '@/services/inventory.actions';
import { formatQuantity, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  RAW_MATERIAL: 'Bahan Baku (Raw Material)',
  FINISHED_PRODUCT: 'Produk Jadi (Finished Product)',
  PACKAGING: 'Kemasan (Packaging)',
  OTHER: 'Lainnya (Other)',
};

interface ProductsCatalogClientProps {
  products: ProductRecord[];
  categories: CategoryRecord[];
  units: UnitRecord[];
  canManage: boolean;
}

export function ProductsCatalogClient({
  products,
  categories,
  units,
  canManage,
}: ProductsCatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  // Form fields (Notice: current_stock is NEVER editable here)
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [productType, setProductType] = useState<ProductType>('RAW_MATERIAL');
  const [baseUnitId, setBaseUnitId] = useState(units[0]?.id ?? '');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [trackExpiration, setTrackExpiration] = useState(true);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openCreateForm = () => {
    setEditingProduct(null);
    setSku('');
    setBarcode('');
    setName('');
    setCategoryId(categories.find((c) => !c.is_archived)?.id ?? '');
    setProductType('RAW_MATERIAL');
    setBaseUnitId(units[0]?.id ?? '');
    setPurchasePrice('0');
    setSellingPrice('0');
    setMinStock('5');
    setTrackExpiration(true);
    setDescription('');
    setIsActive(true);
    setIsFormOpen(true);
  };

  const openEditForm = (product: ProductRecord) => {
    setEditingProduct(product);
    setSku(product.sku);
    setBarcode(product.barcode ?? '');
    setName(product.name);
    setCategoryId(product.category_id);
    setProductType(product.product_type);
    setBaseUnitId(product.base_unit_id);
    setPurchasePrice(String(product.purchase_price));
    setSellingPrice(String(product.selling_price));
    setMinStock(String(product.min_stock));
    setTrackExpiration(product.track_expiration);
    setDescription(product.description ?? '');
    setIsActive(product.is_active);
    setIsFormOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        sku,
        barcode,
        name,
        category_id: categoryId,
        product_type: productType,
        base_unit_id: baseUnitId,
        purchase_price: Number(purchasePrice),
        selling_price: Number(sellingPrice),
        min_stock: Number(minStock),
        track_expiration: trackExpiration,
        description,
        image_url: '',
        is_active: isActive,
      };

      const res = editingProduct
        ? await updateProductAction(editingProduct.id, payload)
        : await createProductAction(payload);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setIsFormOpen(false);
      setEditingProduct(null);
    });
  };

  const handleToggleArchive = (product: ProductRecord) => {
    startTransition(async () => {
      const res = await toggleArchiveProductAction(
        product.id,
        !product.is_archived
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (selectedCategory !== 'ALL' && p.category_id !== selectedCategory)
        return false;
      if (selectedType !== 'ALL' && p.product_type !== selectedType)
        return false;

      const stock = Number(p.current_stock ?? 0);
      const min = Number(p.min_stock ?? 0);

      if (selectedStockStatus === 'OUT_OF_STOCK' && stock > 0) return false;
      if (selectedStockStatus === 'LOW_STOCK' && (stock <= 0 || stock > min))
        return false;
      if (selectedStockStatus === 'AVAILABLE' && stock <= min) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchBarcode = (p.barcode ?? '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBarcode) return false;
      }

      return true;
    });
  }, [
    products,
    showArchived,
    selectedCategory,
    selectedType,
    selectedStockStatus,
    searchQuery,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Katalog Produk &amp; Bahan Baku
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola spesifikasi bahan baku, produk jadi, dan kemasan. Stok hanya dapat diubah melalui mutasi Inventory Ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Link href="/inventory/adjustments">
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4" />
                  Penyesuaian / Stok Awal
                </Button>
              </Link>
              <Button size="sm" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Tambah Produk Baru
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Product Form Card */}
      {isFormOpen && canManage && (
        <Card className="border-primary/40 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
            <div>
              <CardTitle className="text-base">
                {editingProduct
                  ? `Edit Produk: ${editingProduct.name} (${editingProduct.sku})`
                  : 'Tambah Produk / Bahan Baku Baru'}
              </CardTitle>
              <CardDescription>
                SKU dan Barcode wajib unik. Saldo stok saat ini dikelola secara otomatis oleh sistem Inventory Ledger.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFormOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <form onSubmit={handleProductSubmit}>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku">Kode SKU (Unik) *</Label>
                <Input
                  id="sku"
                  placeholder="Contoh: RM-BERAS-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="barcode">Barcode (EAN-13 / Code 128)</Label>
                <Input
                  id="barcode"
                  placeholder="Contoh: 8991234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Produk / Bahan *</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Beras Pandan Wangi Premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="categoryId">Kategori *</Label>
                <select
                  id="categoryId"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  disabled={isPending}
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories
                    .filter((c) => !c.is_archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="productType">Tipe Produk *</Label>
                <select
                  id="productType"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={productType}
                  onChange={(e) =>
                    setProductType(e.target.value as ProductType)
                  }
                  disabled={isPending}
                >
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="baseUnitId">Satuan Dasar (Base Unit) *</Label>
                <select
                  id="baseUnitId"
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                  value={baseUnitId}
                  onChange={(e) => setBaseUnitId(e.target.value)}
                  required
                  disabled={isPending}
                >
                  <option value="">-- Pilih Satuan Dasar --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purchasePrice">Harga Beli Standar (IDR)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  min="0"
                  step="100"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sellingPrice">Harga Jual (IDR)</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  min="0"
                  step="100"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minStock">Batas Stok Minimum</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Read-Only Current Stock Field (Architectural Requirement) */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Stok Saat Ini (Read-Only Ledger)
                </Label>
                <Input
                  value={
                    editingProduct
                      ? `${editingProduct.current_stock} ${editingProduct.base_unit?.code ?? ''}`
                      : '0 (Diisi via Stok Awal / Restock)'
                  }
                  disabled
                  readOnly
                  className="bg-slate-100 font-semibold text-slate-600"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Deskripsi / Catatan Penyimpanan</Label>
                <Input
                  id="description"
                  placeholder="Contoh: Simpan di suhu ruang kering atau chiller 4°C..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 sm:col-span-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={trackExpiration}
                    onChange={(e) => setTrackExpiration(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Wajib Lacak Batch &amp; Tanggal Kedaluwarsa (FEFO)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Status Produk Aktif (Dapat Ditransaksikan)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4 sm:col-span-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingProduct ? 'Simpan Perubahan' : 'Simpan Produk Baru'}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Search & Multi-Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama produk, SKU, atau scan barcode..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="ALL">Semua Tipe Produk</option>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
            >
              <option value="ALL">Semua Status Stok</option>
              <option value="AVAILABLE">Stok Aman</option>
              <option value="LOW_STOCK">Stok Menipis (&le; Min)</option>
              <option value="OUT_OF_STOCK">Stok Habis (0)</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Menampilkan <strong>{filteredProducts.length}</strong> dari{' '}
              {products.length} produk
            </span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Tampilkan produk yang diarsipkan
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Products Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3.5">SKU / Barcode</th>
                  <th className="px-4 py-3.5">Nama Produk</th>
                  <th className="px-4 py-3.5">Kategori &amp; Tipe</th>
                  <th className="px-4 py-3.5 text-right">Harga Beli / Jual</th>
                  <th className="px-4 py-3.5 text-right">Stok Saat Ini</th>
                  <th className="px-4 py-3.5">Status Stok</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Tidak ada data produk yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const stock = Number(product.current_stock ?? 0);
                    const min = Number(product.min_stock ?? 0);
                    const unitCode = product.base_unit?.code ?? '';

                    let stockBadge = (
                      <Badge variant="success">Tersedia</Badge>
                    );
                    if (product.is_archived) {
                      stockBadge = <Badge variant="secondary">Diarsipkan</Badge>;
                    } else if (stock <= 0) {
                      stockBadge = <Badge variant="destructive">Habis (0)</Badge>;
                    } else if (stock <= min) {
                      stockBadge = <Badge variant="warning">Menipis</Badge>;
                    }

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-bold text-primary">
                            {product.sku}
                          </div>
                          {product.barcode && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              BC: {product.barcode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {product.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            Min. Stok: {formatQuantity(product.min_stock, unitCode)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium">
                            {product.category?.name ?? '-'}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {PRODUCT_TYPE_LABELS[product.product_type]}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <div>Beli: {formatRupiah(product.purchase_price)}</div>
                          <div className="text-muted-foreground">
                            Jual: {formatRupiah(product.selling_price)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                          {formatQuantity(product.current_stock, unitCode)}
                        </td>
                        <td className="px-4 py-3">{stockBadge}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link href={`/products/${product.id}`}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Lihat Detail & Ledger"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {canManage && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditForm(product)}
                                  title="Edit Produk"
                                  disabled={isPending}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleArchive(product)}
                                  title={
                                    product.is_archived
                                      ? 'Pulihkan Produk'
                                      : 'Arsipkan Produk'
                                  }
                                  disabled={isPending}
                                >
                                  {product.is_archived ? (
                                    <RotateCcw className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Archive className="h-4 w-4 text-amber-600" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
