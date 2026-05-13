export type MapExplorerAliasMethod = 'alias' | 'manual_alias' | 'manual_ref_alias';

export interface MapExplorerRoadAliasEntry {
  target: string;
  method: MapExplorerAliasMethod;
}

export interface MapExplorerRoadRefAliasEntry {
  ref: string;
  roadName: string;
  target: string;
  method: Extract<MapExplorerAliasMethod, 'manual_ref_alias'>;
}

export const MAP_EXPLORER_ROAD_ALIASES: Record<string, MapExplorerRoadAliasEntry> = {
  'Jl. Mondar (Ulin - Pantai Ulin)': {
    target: 'Mondar (Ulin-Pantai Ulin) - Ds. Ulin',
    method: 'alias',
  },
  'Jl. Muning Tengah - Muning Dalam': {
    target: 'Muning Tengah - Ds. Muning Dalam',
    method: 'alias',
  },
  'Jl. Pangeran Antasari - SP. Loklua': {
    target: 'Pangeran Antasari - Loklua',
    method: 'alias',
  },
  'Sp.4 Lungau - Garis': {
    target: 'Sp. Empat Lungau - Garis',
    method: 'alias',
  },
  'SP.4 Lungau - Bangkau': {
    target: 'Sp. Empat Lungau - Bangkau',
    method: 'alias',
  },
  'Jl. Hamayung - Ds. Hakurung Dalam': {
    target: 'Hamayung - Hakurung Dalam',
    method: 'alias',
  },
  'Jl. Makam Habib Ds. Lumpangi': {
    target: 'Makam Habib - Desa Lumpangi',
    method: 'alias',
  },
  'Jl. Karya Bakti TNI - Ds. Balimau': {
    target: 'Karya Bakti - Ds. Balimau',
    method: 'alias',
  },
  'Jl.Panggang Hijau - DsTawar': {
    target: 'Panggang Hijau - Ds. Tawar',
    method: 'alias',
  },
  'Jl. Baru - Asam Desa Baru/Asam': {
    target: 'Baru - Asam Desa Baru',
    method: 'alias',
  },
  'Jl. Buluh Ds. Tebing Tinggi': {
    target: 'Buluh - Ds. Tebing Tinggi',
    method: 'alias',
  },
  'Jl. Gerilya Ds. Simpur': {
    target: 'Gerilya - Ds. Simpur',
    method: 'alias',
  },
  'Jl. Tembok Baru - Baluti': {
    target: 'Tembok Baru - Ds. Baluti',
    method: 'alias',
  },
  'Tandik - Wasah Hilir': {
    target: 'Tandik - Ds. Wasah Hilir',
    method: 'alias',
  },
  'Bajayau - Bajayau Tengah': {
    target: 'Bajayau - Ds. Bajayau Tengah',
    method: 'alias',
  },
  'Jl. Ds. Kapuh Tengah (Jl. Menuju Majelis Taklim)': {
    target: 'Ds. Kapuh Tengah (Menuju Majelis Talim)',
    method: 'alias',
  },
  'Jl. Bubuih (Ds. Halunuk)': {
    target: 'Bubuih - Ds. Halunuk',
    method: 'alias',
  },
  'Jl. Banua Hanyar - Tanjung Selor': {
    target: 'Banua Hanyar - Ds. Tanjung Selor',
    method: 'alias',
  },
  'Jl. Kesehatan - Komp. Rumah Dokter': {
    target: 'Kesehatan - Komp. Rmh Dokter',
    method: 'alias',
  },
  'Jl. Soeprapto - Jl. HM. Rusli': {
    target: 'Soeprapto - H.M Rusli',
    method: 'alias',
  },
  'Sei. Kupang Utara - SP.4 Lungau': {
    target: 'Sei Kupang Utara - Simp. Empat Lungau',
    method: 'alias',
  },
  'Jl. Guru H. Izim': {
    target: 'Guru H. Izim - Ds. Pantai Ulin',
    method: 'alias',
  },
  'SP. Mandampa Telaga Sili-Sili - SP. Sungai Bungur': {
    target: 'Sp. Mandampa Tel. Sili-Sili - Sp. Sei. Bungur',
    method: 'alias',
  },
  'Jl. Brigjend. Katamso': {
    target: 'Brigjen Katamso',
    method: 'alias',
  },
  'Jl. Tungkaran': {
    target: 'Tungkaran - Ds. Ulin',
    method: 'alias',
  },
  'Jl. Papagaran/Pelangsatan': {
    target: 'Papagaran/Palangsatan',
    method: 'alias',
  },
  'Jl. Mangamol': {
    target: 'Mangamol - Ds. Pantai Ulin',
    method: 'alias',
  },
  'Jl. Cakingan Herman': {
    target: 'Cangkingan Herman',
    method: 'alias',
  },
  'Jl. Tukang Garit': {
    target: 'Tukang Garit (Tambangan)',
    method: 'alias',
  },
  'Jl. Keminting Batu': {
    target: 'Kaminting Batu',
    method: 'alias',
  },
  'Jl. Instalasi PDAM Negara': {
    target: 'Inst. PDAM Negara',
    method: 'alias',
  },
  'Jl. Rahma Bahran': {
    target: 'Rahmah Bahran',
    method: 'alias',
  },
  'Jl. Mesjid Kuba': {
    target: 'Mesjid Quba',
    method: 'alias',
  },
  'Jl. KH. Ramli': {
    target: 'KH. Ramli - DS. Amparaya',
    method: 'alias',
  },
  'Jl. Haratai 2 (SDN Haratai2)': {
    target: 'Haratai 2 (Balai Ujung Atas) SDN Haratai2',
    method: 'alias',
  },
  'Jl. Bubuih - Kandihin': {
    target: 'Bubuih (Ds. Halunuk) - Kandihin',
    method: 'alias',
  },
  'Jl. Silaturahim': {
    target: 'Silaturrahim',
    method: 'alias',
  },
  'Jl. Baiturrahim': {
    target: 'Baiturrahim Parincahan',
    method: 'alias',
  },
  'Jl. H. Saim/Garunggang': {
    target: 'H. Saim Garunggang - Kalimput',
    method: 'alias',
  },
  'Jl. Air Miris': {
    target: 'Air Miris - Ds. Wasah Hilir',
    method: 'alias',
  },
  'Jl. Karampaci': {
    target: 'Karampaci - Ds. Kapuh',
    method: 'alias',
  },
  'Jl. At-Taubah': {
    target: 'At-Taubah - Ds. Kapuh',
    method: 'alias',
  },
  'Jl. HM. Thaib': {
    target: 'H.M. Thaib',
    method: 'alias',
  },
  'Jl. Sakincung Ds. Hakurun Dalam': {
    target: 'Sakincung - Ds. Hakurung Dalam',
    method: 'alias',
  },
  'Jl. H. Jarkasi': {
    target: 'H. Jarkasi - Ds. Sungai Paring',
    method: 'alias',
  },
  'Jl. Mangunang': {
    target: 'Mangunang - Ds. Sungai Raya Utara',
    method: 'alias',
  },
  'Jl. Buntu Muara Hatib': {
    target: 'Buntu Muara Hatib - Bts. Kab. HST',
    method: 'alias',
  },
  'Jl. Pajah Api': {
    target: 'Pajah Api - Ds. Kapuh',
    method: 'alias',
  },
  'Jl. Banua Kambang': {
    target: 'Banua Kambang - Ds. Wasah Tengah',
    method: 'alias',
  },
  'Jl. TPA Sungai Raya Selatan': {
    target: 'TPA - Ds. Sungai Raya Selatan',
    method: 'alias',
  },
  'Jl. Telapak Manuk': {
    target: 'Talapak Manuk - Ds. Kapuh',
    method: 'alias',
  },
  'Jl. Sungai Karuh Tembus Tawar': {
    target: 'Sungai Karuh',
    method: 'manual_alias',
  },
  'Jl. Habib Iberahim': {
    target: 'Habib Ibrahim - Ds. Sei Mandala',
    method: 'manual_alias',
  },
  'Jl. Pandan Sari': {
    target: 'Pandan Sari - Ds. Angkinang',
    method: 'manual_alias',
  },
  'Jl. Rawati': {
    target: 'Rawati - Ds. Panjampang Bahagia',
    method: 'manual_alias',
  },
  'Jl. Suriangpati': {
    target: 'Suriangpati - Gambah Dalam Barat',
    method: 'manual_alias',
  },
  'Jl. Manggis': {
    target: 'Manggis - Ds. Baru',
    method: 'manual_alias',
  },
  'Jl. Firdaus': {
    target: 'Firdaus - Ds. Kapuh',
    method: 'manual_alias',
  },
};

export const MAP_EXPLORER_ROAD_REF_ALIASES: MapExplorerRoadRefAliasEntry[] = [
  {
    ref: 'ruas_035',
    roadName: 'Jl. Mawar',
    target: 'Mawar (Kandangan Utara)',
    method: 'manual_ref_alias',
  },
  {
    ref: 'ruas_038',
    roadName: 'Jl. Musyawarah',
    target: 'Musyawarah (Kandangan)',
    method: 'manual_ref_alias',
  },
  {
    ref: 'ruas_083',
    roadName: 'Jl. Sekolah Islam',
    target: 'Sekolah Islam (Kandangan Barat)',
    method: 'manual_ref_alias',
  },
  {
    ref: 'ruas_129',
    roadName: 'Jl. Mawar',
    target: 'Mawar (Daha Selatan)',
    method: 'manual_ref_alias',
  },
  {
    ref: 'ruas_139',
    roadName: 'Jl. Sekolah Islam',
    target: 'Sekolah Islam (Sungai Pinang)',
    method: 'manual_ref_alias',
  },
  {
    ref: 'ruas_196',
    roadName: 'Jl. Musyawarah',
    target: 'Musyawarah (Nagara)',
    method: 'manual_ref_alias',
  },
];
