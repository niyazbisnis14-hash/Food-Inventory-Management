# Sistem Manajemen Inventori Pangan UMKM (Food Inventory Management System)

Aplikasi manajemen inventori profesional berbasis web untuk bisnis kuliner (F&B), dirancang dengan arsitektur **Immutable Inventory Ledger**, alokasi batch **FEFO (First Expired, First Out)**, kontrol akses berbasis peran (**RBAC: Owner, Admin, Staff**), dan integrasi **Webhook Outbox n8n**.

---

## Fitur Utama & Keputusan Arsitektur

1. **Inventory Ledger Architecture (`stock_movements`)**:
   - `products.current_stock` tidak pernah diedit secara langsung dari form produk.
   - Setiap perubahan stok wajib melewati fungsi atomik PostgreSQL RPC (`record_stock_adjustment`, `process_restock_atomic`, `process_outbound_transaction`, `reverse_outbound_transaction`).
   - Rumus stok dijamin secara matematis pada level constraint database:
     $$\text{Current Stock} = \text{Total Incoming} - \text{Total Outgoing}$$
2. **Manajemen Batch & FEFO (`batches`)**:
   - Mendukung multi-batch per produk dengan nomor batch dan tanggal kedaluwarsa.
   - Transaksi keluar secara otomatis mengunci (`SELECT ... FOR UPDATE`) dan memotong batch yang memiliki tanggal kedaluwarsa paling dekat (`ORDER BY expiration_date ASC NULLS LAST`).
   - Batch yang sudah kedaluwarsa otomatis dicegah untuk konsumsi normal (`SALE` / `INTERNAL_USAGE`).
3. **Lokalisasi Indonesia**:
   - Bahasa antarmuka: **Bahasa Indonesia**.
   - Mata uang: **Rupiah (`IDR` / `Rp`)**.
   - Zona waktu: **Asia/Jakarta (`WIB`)**.

---

## Persiapan & Cara Menjalankan (Setup Guide)

### 1. Prasyarat
- **Node.js LTS** (v20.x atau v22.x) dan `npm` / `pnpm`.
- Proyek **Supabase** (Cloud atau Supabase CLI lokal).

### 2. Konfigurasi Environment Variable
Salin berkas `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Isi variabel berikut di `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` *(Hanya digunakan di server, tidak pernah diekspos ke client)*
- `N8N_WEBHOOK_URL` & `N8N_WEBHOOK_SECRET`

### 3. Jalankan Migrasi Database Supabase
Eksekusi kedua file migrasi SQL secara berurutan pada SQL Editor Supabase atau melalui Supabase CLI:
1. `supabase/migrations/20261118000001_initial_schema.sql` (16 tabel, constraint, RLS, dan fungsi RPC atomik).
2. `supabase/migrations/20261118000002_seed_reference_data.sql` (Data awal Roles, Satuan `kg/g/L/ml/pcs/btl/box`, Konversi Satuan, dan Kategori Standar F&B).

### 4. Instalasi & Menjalankan Server Development
```bash
npm install
npm run typecheck
npm run lint
npm run dev
```
Buka `http://localhost:3000` pada browser.
