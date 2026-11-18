'use client';

import React, { useState, useTransition } from 'react';
import {
  Tags,
  Scale,
  ArrowRightLeft,
  Plus,
  Archive,
  RotateCcw,
  Edit3,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CategoryRecord,
  UnitRecord,
  UnitConversionRecord,
  UnitDimension,
} from '@/types/database';
import {
  createCategoryAction,
  updateCategoryAction,
  toggleArchiveCategoryAction,
  createUnitAction,
  upsertUnitConversionAction,
} from '@/services/inventory.actions';
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

const DIMENSION_LABELS: Record<UnitDimension, string> = {
  MASS: 'Berat / Massa (kg, g)',
  VOLUME: 'Volume / Cairan (L, ml)',
  COUNT: 'Hitungan Satuan (pcs)',
  PACK: 'Kemasan (botol, box)',
};

interface CategoriesUnitsClientProps {
  categories: CategoryRecord[];
  units: UnitRecord[];
  conversions: UnitConversionRecord[];
  canManage: boolean;
}

export function CategoriesUnitsClient({
  categories,
  units,
  conversions,
  canManage,
}: CategoriesUnitsClientProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'conversions'>('categories');
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Category Form State
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Unit Form State
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitDimension, setUnitDimension] = useState<UnitDimension>('MASS');
  const [unitAllowDecimal, setUnitAllowDecimal] = useState(true);

  // Unit Conversion Form State
  const [fromUnitId, setFromUnitId] = useState(units[0]?.id ?? '');
  const [toUnitId, setToUnitId] = useState(units[1]?.id ?? '');
  const [multiplier, setMultiplier] = useState('1000');

  const visibleCategories = categories.filter((c) =>
    showArchived ? true : !c.is_archived
  );

  const handleOpenEditCategory = (cat: CategoryRecord) => {
    setEditingCategory(cat);
    setCatCode(cat.code);
    setCatName(cat.name);
    setCatDesc(cat.description ?? '');
  };

  const handleResetCategoryForm = () => {
    setEditingCategory(null);
    setCatCode('');
    setCatName('');
    setCatDesc('');
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        code: catCode,
        name: catName,
        description: catDesc,
      };
      const res = editingCategory
        ? await updateCategoryAction(editingCategory.id, payload)
        : await createCategoryAction(payload);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      handleResetCategoryForm();
    });
  };

  const handleToggleArchiveCategory = (cat: CategoryRecord) => {
    startTransition(async () => {
      const res = await toggleArchiveCategoryAction(cat.id, !cat.is_archived);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  };

  const handleCreateUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUnitAction({
        code: unitCode,
        name: unitName,
        dimension: unitDimension,
        allow_decimal: unitAllowDecimal,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setUnitCode('');
      setUnitName('');
    });
  };

  const handleConversionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertUnitConversionAction({
        from_unit_id: fromUnitId,
        to_unit_id: toUnitId,
        multiplier: Number(multiplier),
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant={activeTab === 'categories' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('categories')}
        >
          <Tags className="h-4 w-4" />
          Kategori Produk ({categories.filter((c) => !c.is_archived).length})
        </Button>
        <Button
          type="button"
          variant={activeTab === 'units' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('units')}
        >
          <Scale className="h-4 w-4" />
          Master Satuan ({units.length})
        </Button>
        <Button
          type="button"
          variant={activeTab === 'conversions' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('conversions')}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Konversi Satuan ({conversions.length})
        </Button>
      </div>

      {/* TAB 1: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {canManage && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                  </CardTitle>
                  {editingCategory && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleResetCategoryForm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Kelompokkan bahan baku, minuman, kemasan, atau produk jadi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="catCode">Kode Kategori</Label>
                    <Input
                      id="catCode"
                      placeholder="Contoh: CAT-BERAS"
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value)}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="catName">Nama Kategori</Label>
                    <Input
                      id="catName"
                      placeholder="Contoh: Beras & Biji-bijian"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="catDesc">Deskripsi (Opsional)</Label>
                    <Input
                      id="catDesc"
                      placeholder="Keterangan jenis bahan..."
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Daftar Kategori Produk</CardTitle>
                <CardDescription>
                  Digunakan untuk memfilter katalog bahan baku dan laporan stok.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowArchived((prev) => !prev)}
              >
                {showArchived ? 'Sembunyikan Arsip' : 'Tampilkan Arsip'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Kode</th>
                      <th className="px-4 py-3">Nama Kategori</th>
                      <th className="px-4 py-3">Deskripsi</th>
                      <th className="px-4 py-3">Status</th>
                      {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleCategories.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canManage ? 5 : 4}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Belum ada kategori yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      visibleCategories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono text-xs font-semibold">
                            {cat.code}
                          </td>
                          <td className="px-4 py-3 font-medium">{cat.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {cat.description || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {cat.is_archived ? (
                              <Badge variant="secondary">Diarsipkan</Badge>
                            ) : (
                              <Badge variant="success">Aktif</Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditCategory(cat)}
                                  disabled={isPending}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleArchiveCategory(cat)}
                                  disabled={isPending}
                                  title={
                                    cat.is_archived ? 'Pulihkan' : 'Arsipkan'
                                  }
                                >
                                  {cat.is_archived ? (
                                    <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Archive className="h-3.5 w-3.5 text-amber-600" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeTab === 'units' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {canManage && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Tambah Satuan Ukur</CardTitle>
                <CardDescription>
                  Mendukung kg, g, L, ml, pcs, botol, box, atau satuan khusus dapur.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUnitSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="unitCode">Simbol Satuan</Label>
                    <Input
                      id="unitCode"
                      placeholder="Contoh: kg, g, L, ml, pcs, pack"
                      value={unitCode}
                      onChange={(e) => setUnitCode(e.target.value)}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unitName">Nama Lengkap Satuan</Label>
                    <Input
                      id="unitName"
                      placeholder="Contoh: Kilogram"
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unitDim">Dimensi Satuan</Label>
                    <select
                      id="unitDim"
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                      value={unitDimension}
                      onChange={(e) =>
                        setUnitDimension(e.target.value as UnitDimension)
                      }
                      disabled={isPending}
                    >
                      {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="unitAllowDecimal"
                      type="checkbox"
                      checked={unitAllowDecimal}
                      onChange={(e) => setUnitAllowDecimal(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Label htmlFor="unitAllowDecimal" className="text-xs">
                      Izinkan nilai pecahan / desimal (contoh: 1.5 kg)
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    <Plus className="h-4 w-4" />
                    Simpan Satuan
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <CardHeader>
              <CardTitle className="text-base">Daftar Satuan Terdaftar</CardTitle>
              <CardDescription>
                Setiap produk memiliki satu Satuan Dasar (Base Unit) untuk normalisasi Inventory Ledger.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Simbol</th>
                      <th className="px-4 py-3">Nama Satuan</th>
                      <th className="px-4 py-3">Dimensi</th>
                      <th className="px-4 py-3">Desimal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {units.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-bold text-primary">
                          {u.code}
                        </td>
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-xs">
                          <Badge variant="outline">
                            {DIMENSION_LABELS[u.dimension]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.allow_decimal ? 'Ya (Desimal)' : 'Bulat (Integer)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: UNIT CONVERSIONS */}
      {activeTab === 'conversions' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {canManage && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">
                  Atur Konversi Satuan
                </CardTitle>
                <CardDescription>
                  Sistem menolak konversi lintas dimensi yang tidak kompatibel (misal kg ke Liter).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConversionSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fromUnit">Dari Satuan (1 Unit Asal)</Label>
                    <select
                      id="fromUnit"
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                      value={fromUnitId}
                      onChange={(e) => setFromUnitId(e.target.value)}
                      disabled={isPending}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code}) — [{u.dimension}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="toUnit">Ke Satuan Tujuan</Label>
                    <select
                      id="toUnit"
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                      value={toUnitId}
                      onChange={(e) => setToUnitId(e.target.value)}
                      disabled={isPending}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code}) — [{u.dimension}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="multiplier">Faktor Pengali (Multiplier)</Label>
                    <Input
                      id="multiplier"
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={multiplier}
                      onChange={(e) => setMultiplier(e.target.value)}
                      required
                      disabled={isPending}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Contoh: 1 kg = 1000 g (isi 1000). Kebalikannya (1 g = 0.001 kg) akan dibuat otomatis.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    <ArrowRightLeft className="h-4 w-4" />
                    Simpan Rumus Konversi
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <CardHeader>
              <CardTitle className="text-base">
                Tabel Konversi Satuan Aktif
              </CardTitle>
              <CardDescription>
                Digunakan secara otomatis saat menormalisasi kuantitas Restock, Penyesuaian, dan Transaksi ke Satuan Dasar Produk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Satuan Asal</th>
                      <th className="px-4 py-3">Rumus Konversi</th>
                      <th className="px-4 py-3">Satuan Tujuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {conversions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Belum ada aturan konversi satuan.
                        </td>
                      </tr>
                    ) : (
                      conversions.map((conv) => (
                        <tr key={conv.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium">
                            1 {conv.from_unit?.name} ({conv.from_unit?.code})
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-primary">
                            = {Number(conv.multiplier)} {conv.to_unit?.code}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {conv.to_unit?.name} ({conv.to_unit?.code})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
