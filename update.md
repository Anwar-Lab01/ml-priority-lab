# Update Progress Pekerjaan — 18 Mei 2026

Hari ini, kami telah berhasil menyelesaikan integrasi **Arsitektur ASB Budget Reasonableness (Kewajaran Anggaran)** ke dalam modul **Treatment Engine**. Sistem telah berpindah sepenuhnya ke alur pendekatan *budget-first*, yang mendasarkan pagu indikatif penanganan jalan pada karakteristik data teknis kondisi lapangan FormDD (DD2) dan mencocokkannya ke paket ASB struktural secara real-time.

---

## 1. Ringkasan Pencapaian Utama

1. **Penerapan File Aturan Seleksi ASB (`public/data/asb_budget_package_rules.json`)**
   - Mengodekan 6 aturan utama (`R01` hingga `R06`) untuk penentuan profil struktural berdasarkan parameter keparahan kerusakan segmen jalan (Non-Mantap %, Rusak Berat %, dan Unpaved %).
   - Menyediakan pencocokan lebar perkerasan berdasarkan metode `round_up_nearest` dan preferensi tipe aspal permukaan.
   - Menambahkan mekanisme fallback otomatis apabila karakteristik jalan melampaui rentang spesifikasi standar ASB.

2. **Integrasi Logika Pemrosesan Runtime (`TreatmentEnginePage.tsx`)**
   - Menambahkan utilitas pemrosesan `estimatePaguIndikatif` yang mengevaluasi segmen DD2 jalan secara native di dalam siklus data loader frontend.
   - Mengambil data referensi harga satuan unit dari `asb_unit_prices.json` (1.010 item harga) secara paralel dengan konfigurasi rules dan data geometri.
   - Menambahkan parameter kalkulasi mode anggaran default v0.1 (`full_segment_mode` / Pagu Usulan berbasis panjang total ruas jalan).

3. **Penyempurnaan UI/UX Dashboard Treatment Engine**
   - **ASB Overview Card**: Ditambahkan ke dashboard utama untuk memperlihatkan metrik ringkasan status estimasi kewajaran anggaran tingkat sistem secara realtime.
   - **ASB Budget Preview Panel**: Disematkan ke dalam panel detail ruas terpilih dengan rincian lengkap: tipe paket penanganan, harga satuan ASB per meter, rincian parameter kecocokan lebar/permukaan jalan, status review/flag manual, serta teks disclaimer formal.
   - **DD2 Features Table**: Diperkaya dengan kolom 'ASB Package' dan 'Pagu Indikatif' yang tersinkronisasi langsung dengan model data terestimasi.

4. **Penyediaan DEV Diagnostics Global**
   - Mengimplementasikan `window.__ASB_BUDGET_REASONABLENESS_DIAGNOSTICS__` untuk mempermudah audit runtime lewat konsol browser.

5. **Resolusi Bug Integrasi Global & Hardening Kode**
   - Menyelesaikan kendala TypeScript compiler errors terkait potensi *null pointer exception* pada `roadWidth` dan `selectedDd2Feature`.
   - Memastikan build produksi (`npm run build`) berjalan bersih dan sukses 100%.

---

## 2. Metrik & Hasil Evaluasi Sistem (Universe 350 Ruas Jalan)

Setelah memproses data referensi ASB BM 2027 dan FormDD (DD2), berikut adalah rangkuman metrik sistem yang berjalan di Treatment Engine:

- **Aturan ASB yang Dimuat:** 6 Aturan (`R01` - `R06`)
- **Item Harga Satuan ASB Dimuat:** 1.010 Item
- **Jumlah Ruas Jalan Dievaluasi:** 350 Ruas
- **Ruas Berhasil Terestimasi Pagu (Jalan Non-Mantap / Tipe A-D):** 210 Ruas
- **Ruas Tanpa Paket Major (Jalan Mantap / `no_major_asb_package`):** 140 Ruas
- **Ruas Memerlukan Review Manual (Flags):** 1 Ruas (`manual_review_width_exceeded` karena memiliki lebar ruas ekstrem melampaui spesifikasi jalan terlebar pada dokumen ASB).

---

## 3. Sampel Kalkulasi Anggaran Indikatif (5 Ruas Jalan Utama)

| Nama Ruas Jalan | Aturan Pemicu | Tipe Paket ASB | Hasil Estimasi Pagu Indikatif | Keterangan / Justifikasi Teknis |
| :--- | :---: | :---: | :---: | :--- |
| **Pangeran Antasari - Loklua** | `R04` | Tipe B (Base Course) | **Rp 1.358.000.000** | Kerusakan Sedang (Non-Mantap 35.7%, Rusak Berat 0%), Lebar Ruas 12m. |
| **Teluk Mesjid - Sp. 4 Muara Banta** | `R05` | Tipe A (Surface Only) | **Rp 1.934.790.000** | Kerusakan Ringan (Non-Mantap 10%-25%), Lebar Ruas 6m. |
| **Dahlia** | `R01` | Tipe D (Base+Subbase+Fill) | **Rp 434.160.000** | Kerusakan Struktural Berat / Belum Beraspal, Lebar Ruas 6m. |
| **KS. Tubun** | `R02` | Tipe C (Base+Subbase) | **Rp 1.680.960.000** | Kerusakan Berat Tanpa Timbunan (Non-Mantap >= 40%), Lebar Ruas 6m. |
| **Singakarsa - Palas** | `R01` | Tipe D (Base+Subbase+Fill) | **Rp 16.327.080.000** | Kerusakan Struktural Berat / Belum Beraspal, Panjang Ruas 14.3km. |

---

## 4. Struktur Data Diagnostics Developer (`window`)

Untuk memeriksa keabsahan integrasi di sisi konsol browser secara real-time, Anda dapat mengeksekusi perintah berikut di Developer Tools (F12):

```javascript
console.log(window.__ASB_BUDGET_REASONABLENESS_DIAGNOSTICS__);
```

Objek yang dihasilkan akan memiliki skema di bawah ini:
```json
{
  "rulesLoaded": 6,
  "asbItemsLoaded": 1010,
  "totalRoadsEvaluated": 350,
  "estimatedRoads": 210,
  "noMajorPackage": 140,
  "missingRules": false,
  "missingItems": false,
  "sampleEstimates": [
    {
      "road_name": "Pangeran Antasari - Loklua",
      "non_mantap_pct": 35.714286,
      "asb_budget": {
        "status": "estimated",
        "rule_id": "R04",
        "rule_label": "Kerusakan Sedang",
        "confidence": "medium",
        "structural_profile": "base_course",
        "asb_type": "B",
        "asb_id": "JLN-B-6",
        "harga_satuan_rp": 2425000,
        "satuan": "m'",
        "panjang_m": 560,
        "pagu_indikatif_rp": 1358000000,
        "width_matched_m": 6,
        "surface_matched": "AC-WC",
        "costing_mode": "full_segment_mode",
        "flags": [],
        "disclaimer": "Estimasi kewajaran anggaran indikatif berdasarkan ASB BM 2027. Bukan RAB final atau DED teknis."
      }
    },
    ...
  ]
}
```

---

## 5. File yang Mengalami Perubahan

1. **`public/data/asb_budget_package_rules.json`** *(Baru)*
   - Berisi definisi metadata, klasifikasi jenis profil struktural perkerasan, 6 butir aturan penentuan tipe ASB (R01-R06), heuristics preferensi aspal permukaan, lebar asumsi default, serta mode perhitungan biaya default v0.1.
2. **`src/app/pages/TreatmentEnginePage.tsx`** *(Modifikasi)*
   - Menambahkan interfaces `ASBItem`, `ASBBudgetResult`, dan memperluas model data `DD2DataWithRules`.
   - Mengimplementasikan fungsi native `estimatePaguIndikatif` beserta seluruh penanganan error dan fallback parameter.
   - Menambahkan state loader asinkron untuk konfigurasi rules dan referensi unit price ASB.
   - Merancang serta menata ulang layout panel detail visualisasi dan datatable utama untuk menampilkan estimasi pagu dengan rapi, informatif, dan patuh terhadap kebijakan disclaimer.
   - Menambahkan DEV diagnostics global di sisi browser.
3. **`update.md`** *(Baru)*
   - Dokumen log kerja/progress harian tertanggal 18 Mei 2026.
