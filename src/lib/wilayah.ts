// Data Provinsi & Kota/Kabupaten Indonesia (Statis)
export interface WilayahItem {
  name: string;
  cities: string[];
}

export const WILAYAH_INDONESIA: WilayahItem[] = [
  {
    name: "Aceh",
    cities: ["Banda Aceh", "Sabang", "Langsa", "Lhokseumawe", "Subulussalam", "Kab. Aceh Besar", "Kab. Pidie", "Kab. Bireuen", "Kab. Aceh Utara", "Kab. Aceh Timur", "Kab. Aceh Selatan", "Kab. Aceh Barat", "Kab. Simeulue", "Kab. Aceh Singkil", "Kab. Gayo Lues", "Kab. Aceh Tenggara", "Kab. Aceh Jaya", "Kab. Nagan Raya", "Kab. Aceh Barat Daya", "Kab. Bener Meriah", "Kab. Pidie Jaya", "Kab. Aceh Tamiang", "Kab. Aceh Tengah"],
  },
  {
    name: "Sumatera Utara",
    cities: ["Medan", "Binjai", "Pematangsiantar", "Tanjungbalai", "Tebing Tinggi", "Padangsidimpuan", "Gunungsitoli", "Kab. Deli Serdang", "Kab. Langkat", "Kab. Simalungun", "Kab. Asahan", "Kab. Labuhanbatu", "Kab. Tapanuli Utara", "Kab. Tapanuli Tengah", "Kab. Tapanuli Selatan", "Kab. Nias", "Kab. Mandailing Natal", "Kab. Toba", "Kab. Karo", "Kab. Dairi", "Kab. Pakpak Bharat", "Kab. Humbang Hasundutan", "Kab. Samosir", "Kab. Nias Selatan", "Kab. Nias Barat", "Kab. Nias Utara", "Kab. Batubara", "Kab. Padang Lawas", "Kab. Padang Lawas Utara", "Kab. Labuhanbatu Utara", "Kab. Labuhanbatu Selatan", "Kab. Serdang Bedagai"],
  },
  {
    name: "Sumatera Barat",
    cities: ["Padang", "Bukittinggi", "Payakumbuh", "Solok", "Padangpanjang", "Pariaman", "Sawahlunto", "Kab. Agam", "Kab. Tanah Datar", "Kab. Lima Puluh Kota", "Kab. Pasaman", "Kab. Solok", "Kab. Pesisir Selatan", "Kab. Sijunjung", "Kab. Dharmasraya", "Kab. Solok Selatan", "Kab. Kepulauan Mentawai", "Kab. Padang Pariaman", "Kab. Pasaman Barat"],
  },
  {
    name: "Riau",
    cities: ["Pekanbaru", "Dumai", "Kab. Kampar", "Kab. Rokan Hulu", "Kab. Bengkalis", "Kab. Rokan Hilir", "Kab. Siak", "Kab. Pelalawan", "Kab. Indragiri Hulu", "Kab. Indragiri Hilir", "Kab. Kuantan Singingi", "Kab. Kepulauan Meranti"],
  },
  {
    name: "Kepulauan Riau",
    cities: ["Batam", "Tanjung Pinang", "Kab. Bintan", "Kab. Karimun", "Kab. Natuna", "Kab. Anambas", "Kab. Lingga"],
  },
  {
    name: "Jambi",
    cities: ["Jambi", "Sungai Penuh", "Kab. Kerinci", "Kab. Merangin", "Kab. Sarolangun", "Kab. Batanghari", "Kab. Muaro Jambi", "Kab. Bungo", "Kab. Tebo", "Kab. Tanjung Jabung Barat", "Kab. Tanjung Jabung Timur"],
  },
  {
    name: "Sumatera Selatan",
    cities: ["Palembang", "Prabumulih", "Lubuklinggau", "Pagar Alam", "Kab. Ogan Komering Ulu", "Kab. Ogan Komering Ilir", "Kab. Muara Enim", "Kab. Lahat", "Kab. Musi Rawas", "Kab. Musi Banyuasin", "Kab. Banyuasin", "Kab. Ogan Ilir", "Kab. OKU Timur", "Kab. OKU Selatan", "Kab. Empat Lawang", "Kab. Penukal Abab Lematang Ilir", "Kab. Musi Rawas Utara"],
  },
  {
    name: "Bangka Belitung",
    cities: ["Pangkal Pinang", "Kab. Bangka", "Kab. Belitung", "Kab. Bangka Barat", "Kab. Bangka Tengah", "Kab. Bangka Selatan", "Kab. Belitung Timur"],
  },
  {
    name: "Bengkulu",
    cities: ["Bengkulu", "Kab. Bengkulu Selatan", "Kab. Rejang Lebong", "Kab. Bengkulu Utara", "Kab. Kaur", "Kab. Seluma", "Kab. Mukomuko", "Kab. Lebong", "Kab. Kepahiang", "Kab. Bengkulu Tengah"],
  },
  {
    name: "Lampung",
    cities: ["Bandar Lampung", "Metro", "Kab. Lampung Selatan", "Kab. Lampung Tengah", "Kab. Lampung Utara", "Kab. Lampung Barat", "Kab. Tulang Bawang", "Kab. Tanggamus", "Kab. Lampung Timur", "Kab. Way Kanan", "Kab. Pesawaran", "Kab. Pringsewu", "Kab. Mesuji", "Kab. Tulang Bawang Barat", "Kab. Pesisir Barat"],
  },
  {
    name: "DKI Jakarta",
    cities: ["Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur", "Kab. Kepulauan Seribu"],
  },
  {
    name: "Jawa Barat",
    cities: ["Bandung", "Bekasi", "Bogor", "Cimahi", "Cirebon", "Depok", "Sukabumi", "Tasikmalaya", "Banjar", "Kab. Bogor", "Kab. Sukabumi", "Kab. Cianjur", "Kab. Bandung", "Kab. Garut", "Kab. Tasikmalaya", "Kab. Ciamis", "Kab. Kuningan", "Kab. Cirebon", "Kab. Majalengka", "Kab. Sumedang", "Kab. Indramayu", "Kab. Subang", "Kab. Purwakarta", "Kab. Karawang", "Kab. Bekasi", "Kab. Bandung Barat", "Kab. Pangandaran"],
  },
  {
    name: "Banten",
    cities: ["Serang", "Cilegon", "Tangerang", "Tangerang Selatan", "Kab. Serang", "Kab. Pandeglang", "Kab. Lebak", "Kab. Tangerang"],
  },
  {
    name: "DI Yogyakarta",
    cities: ["Yogyakarta", "Kab. Sleman", "Kab. Bantul", "Kab. Gunung Kidul", "Kab. Kulon Progo"],
  },
  {
    name: "Jawa Tengah",
    cities: ["Semarang", "Surakarta", "Salatiga", "Magelang", "Pekalongan", "Tegal", "Kab. Cilacap", "Kab. Banyumas", "Kab. Purbalingga", "Kab. Banjarnegara", "Kab. Kebumen", "Kab. Purworejo", "Kab. Wonosobo", "Kab. Magelang", "Kab. Boyolali", "Kab. Klaten", "Kab. Sukoharjo", "Kab. Wonogiri", "Kab. Karanganyar", "Kab. Sragen", "Kab. Grobogan", "Kab. Blora", "Kab. Rembang", "Kab. Pati", "Kab. Kudus", "Kab. Jepara", "Kab. Demak", "Kab. Semarang", "Kab. Temanggung", "Kab. Kendal", "Kab. Batang", "Kab. Pekalongan", "Kab. Pemalang", "Kab. Tegal", "Kab. Brebes"],
  },
  {
    name: "Jawa Timur",
    cities: ["Surabaya", "Malang", "Madiun", "Batu", "Blitar", "Kediri", "Mojokerto", "Pasuruan", "Probolinggo", "Kab. Pacitan", "Kab. Ponorogo", "Kab. Trenggalek", "Kab. Tulungagung", "Kab. Blitar", "Kab. Kediri", "Kab. Malang", "Kab. Lumajang", "Kab. Jember", "Kab. Banyuwangi", "Kab. Bondowoso", "Kab. Situbondo", "Kab. Probolinggo", "Kab. Pasuruan", "Kab. Sidoarjo", "Kab. Mojokerto", "Kab. Jombang", "Kab. Nganjuk", "Kab. Madiun", "Kab. Magetan", "Kab. Ngawi", "Kab. Bojonegoro", "Kab. Tuban", "Kab. Lamongan", "Kab. Gresik", "Kab. Bangkalan", "Kab. Sampang", "Kab. Pamekasan", "Kab. Sumenep"],
  },
  {
    name: "Bali",
    cities: ["Denpasar", "Kab. Badung", "Kab. Gianyar", "Kab. Tabanan", "Kab. Buleleng", "Kab. Jembrana", "Kab. Bangli", "Kab. Karangasem", "Kab. Klungkung"],
  },
  {
    name: "Nusa Tenggara Barat",
    cities: ["Mataram", "Bima", "Kab. Lombok Barat", "Kab. Lombok Tengah", "Kab. Lombok Timur", "Kab. Sumbawa", "Kab. Dompu", "Kab. Bima", "Kab. Sumbawa Barat", "Kab. Lombok Utara"],
  },
  {
    name: "Nusa Tenggara Timur",
    cities: ["Kupang", "Kab. Kupang", "Kab. Timor Tengah Selatan", "Kab. Timor Tengah Utara", "Kab. Belu", "Kab. Alor", "Kab. Lembata", "Kab. Flores Timur", "Kab. Sikka", "Kab. Ende", "Kab. Ngada", "Kab. Manggarai", "Kab. Rote Ndao", "Kab. Manggarai Barat", "Kab. Sumba Timur", "Kab. Sumba Tengah", "Kab. Sumba Barat", "Kab. Sumba Barat Daya", "Kab. Nagekeo", "Kab. Manggarai Timur", "Kab. Sabu Raijua", "Kab. Malaka"],
  },
  {
    name: "Kalimantan Barat",
    cities: ["Pontianak", "Singkawang", "Kab. Sambas", "Kab. Bengkayang", "Kab. Landak", "Kab. Pontianak", "Kab. Sanggau", "Kab. Ketapang", "Kab. Sintang", "Kab. Kapuas Hulu", "Kab. Sekadau", "Kab. Melawi", "Kab. Kayong Utara", "Kab. Kubu Raya"],
  },
  {
    name: "Kalimantan Tengah",
    cities: ["Palangka Raya", "Kab. Kotawaringin Barat", "Kab. Kotawaringin Timur", "Kab. Kapuas", "Kab. Barito Selatan", "Kab. Barito Utara", "Kab. Katingan", "Kab. Seruyan", "Kab. Sukamara", "Kab. Lamandau", "Kab. Gunung Mas", "Kab. Pulang Pisau", "Kab. Murung Raya", "Kab. Barito Timur"],
  },
  {
    name: "Kalimantan Selatan",
    cities: ["Banjarmasin", "Banjarbaru", "Kab. Tanah Laut", "Kab. Kota Baru", "Kab. Banjar", "Kab. Barito Kuala", "Kab. Tapin", "Kab. Hulu Sungai Selatan", "Kab. Hulu Sungai Tengah", "Kab. Hulu Sungai Utara", "Kab. Tabalong", "Kab. Tanah Bumbu", "Kab. Balangan"],
  },
  {
    name: "Kalimantan Timur",
    cities: ["Samarinda", "Balikpapan", "Bontang", "Kab. Paser", "Kab. Kutai Barat", "Kab. Kutai Kartanegara", "Kab. Kutai Timur", "Kab. Berau", "Kab. Penajam Paser Utara", "Kab. Mahakam Ulu"],
  },
  {
    name: "Kalimantan Utara",
    cities: ["Tarakan", "Kab. Bulungan", "Kab. Nunukan", "Kab. Malinau", "Kab. Tana Tidung"],
  },
  {
    name: "Sulawesi Utara",
    cities: ["Manado", "Bitung", "Tomohon", "Kotamobagu", "Kab. Bolaang Mongondow", "Kab. Minahasa", "Kab. Kepulauan Sangihe", "Kab. Kepulauan Talaud", "Kab. Minahasa Selatan", "Kab. Minahasa Utara", "Kab. Bolaang Mongondow Utara", "Kab. Kepulauan Siau Tagulandang Biaro", "Kab. Minahasa Tenggara", "Kab. Bolaang Mongondow Timur", "Kab. Bolaang Mongondow Selatan"],
  },
  {
    name: "Gorontalo",
    cities: ["Gorontalo", "Kab. Gorontalo", "Kab. Boalemo", "Kab. Bone Bolango", "Kab. Pohuwato", "Kab. Gorontalo Utara"],
  },
  {
    name: "Sulawesi Tengah",
    cities: ["Palu", "Kab. Banggai", "Kab. Poso", "Kab. Donggala", "Kab. Toli-Toli", "Kab. Buol", "Kab. Morowali", "Kab. Banggai Kepulauan", "Kab. Parigi Moutong", "Kab. Tojo Una-Una", "Kab. Sigi", "Kab. Banggai Laut", "Kab. Morowali Utara"],
  },
  {
    name: "Sulawesi Selatan",
    cities: ["Makassar", "Parepare", "Palopo", "Kab. Gowa", "Kab. Takalar", "Kab. Jeneponto", "Kab. Bantaeng", "Kab. Bulukumba", "Kab. Selayar", "Kab. Sinjai", "Kab. Maros", "Kab. Pangkajene dan Kepulauan", "Kab. Barru", "Kab. Bone", "Kab. Soppeng", "Kab. Wajo", "Kab. Sidenreng Rappang", "Kab. Pinrang", "Kab. Enrekang", "Kab. Luwu", "Kab. Tana Toraja", "Kab. Luwu Utara", "Kab. Luwu Timur", "Kab. Toraja Utara"],
  },
  {
    name: "Sulawesi Barat",
    cities: ["Mamuju", "Kab. Polewali Mandar", "Kab. Mamasa", "Kab. Majene", "Kab. Mamuju Utara", "Kab. Pasangkayu", "Kab. Mamuju Tengah"],
  },
  {
    name: "Sulawesi Tenggara",
    cities: ["Kendari", "Bau-Bau", "Kab. Kolaka", "Kab. Konawe", "Kab. Muna", "Kab. Buton", "Kab. Konawe Selatan", "Kab. Bombana", "Kab. Wakatobi", "Kab. Kolaka Utara", "Kab. Konawe Utara", "Kab. Buton Utara", "Kab. Kolaka Timur", "Kab. Konawe Kepulauan", "Kab. Muna Barat", "Kab. Buton Tengah", "Kab. Buton Selatan"],
  },
  {
    name: "Maluku",
    cities: ["Ambon", "Tual", "Kab. Maluku Tengah", "Kab. Maluku Tenggara", "Kab. Maluku Tenggara Barat", "Kab. Buru", "Kab. Seram Bagian Barat", "Kab. Seram Bagian Timur", "Kab. Aru", "Kab. Kepulauan Tanimbar", "Kab. Maluku Barat Daya", "Kab. Buru Selatan"],
  },
  {
    name: "Maluku Utara",
    cities: ["Ternate", "Tidore Kepulauan", "Kab. Halmahera Barat", "Kab. Halmahera Tengah", "Kab. Halmahera Utara", "Kab. Halmahera Selatan", "Kab. Kepulauan Sula", "Kab. Halmahera Timur", "Kab. Pulau Morotai", "Kab. Pulau Taliabu"],
  },
  {
    name: "Papua",
    cities: ["Jayapura", "Kab. Merauke", "Kab. Jayawijaya", "Kab. Nabire", "Kab. Kepulauan Yapen", "Kab. Biak Numfor", "Kab. Paniai", "Kab. Puncak Jaya", "Kab. Mimika", "Kab. Boven Digoel", "Kab. Mappi", "Kab. Asmat", "Kab. Yahukimo", "Kab. Pegunungan Bintang", "Kab. Tolikara", "Kab. Sarmi", "Kab. Keerom", "Kab. Waropen", "Kab. Supiori", "Kab. Mamberamo Raya", "Kab. Nduga", "Kab. Lanny Jaya", "Kab. Mamberamo Tengah", "Kab. Yalimo", "Kab. Puncak", "Kab. Dogiyai", "Kab. Intan Jaya", "Kab. Deiyai"],
  },
  {
    name: "Papua Barat",
    cities: ["Sorong", "Kab. Manokwari", "Kab. Sorong", "Kab. Fakfak", "Kab. Kaimana", "Kab. Teluk Wondama", "Kab. Teluk Bintuni", "Kab. Raja Ampat", "Kab. Tambrauw", "Kab. Maybrat", "Kab. Manokwari Selatan", "Kab. Pegunungan Arfak"],
  },
  {
    name: "Papua Selatan",
    cities: ["Merauke", "Kab. Boven Digoel", "Kab. Mappi", "Kab. Asmat"],
  },
  {
    name: "Papua Tengah",
    cities: ["Nabire", "Kab. Mimika", "Kab. Paniai", "Kab. Puncak Jaya", "Kab. Puncak", "Kab. Intan Jaya", "Kab. Dogiyai", "Kab. Deiyai"],
  },
  {
    name: "Papua Pegunungan",
    cities: ["Wamena", "Kab. Jayawijaya", "Kab. Pegunungan Bintang", "Kab. Yahukimo", "Kab. Tolikara", "Kab. Mamberamo Tengah", "Kab. Yalimo", "Kab. Lanny Jaya", "Kab. Nduga"],
  },
  {
    name: "Papua Barat Daya",
    cities: ["Sorong", "Kab. Sorong Selatan", "Kab. Raja Ampat", "Kab. Tambrauw", "Kab. Maybrat"],
  },
];
