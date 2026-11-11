export interface SeedProduct {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  rating: number;
  isActive?: boolean;
}

export const seedProducts: SeedProduct[] = [
  {
    name: 'Quantum Mechanical Keyboard',
    description: 'Hot-swappable 75% keyboard with gasket mount, PBT keycaps and per-key RGB lighting.',
    price: 149.99,
    stock: 42,
    category: 'Accessories',
    rating: 4.8,
  },
  {
    name: 'Nebula ANC Headphones',
    description: 'Over-ear wireless headphones with adaptive noise cancelling and a 40-hour battery.',
    price: 249,
    stock: 18,
    category: 'Audio',
    rating: 4.7,
  },
  {
    name: 'Photon 27" 4K Monitor',
    description: '27-inch IPS panel, 144 Hz refresh rate, HDR600 and 90 W USB-C power delivery.',
    price: 429,
    stock: 9,
    category: 'Displays',
    rating: 4.6,
  },
  {
    name: 'Orbit Smartwatch Pro',
    description: 'AMOLED smartwatch with ECG, dual-band GPS and a 7-day battery life.',
    price: 299,
    stock: 25,
    category: 'Wearables',
    rating: 4.4,
  },
  {
    name: 'Ion 8-in-1 USB-C Hub',
    description: 'Aluminium hub with HDMI 4K60, 100 W pass-through charging, SD reader and Gigabit Ethernet.',
    price: 59.9,
    stock: 120,
    category: 'Accessories',
    rating: 4.5,
  },
  {
    name: 'Vector Ergonomic Mouse',
    description: 'Vertical wireless mouse with silent switches and multi-device pairing.',
    price: 79,
    stock: 64,
    category: 'Accessories',
    rating: 4.6,
  },
  {
    name: 'Aurora Smart Desk Lamp',
    description: 'Glare-free LED desk lamp with adjustable colour temperature and ambient light sensor.',
    price: 89,
    stock: 33,
    category: 'Home Office',
    rating: 4.3,
  },
  {
    name: 'Pulse Fitness Band',
    description: 'Lightweight fitness tracker with heart-rate and sleep monitoring (discontinued).',
    price: 49.99,
    stock: 0,
    category: 'Wearables',
    rating: 4.1,
    isActive: false,
  },
  {
    name: 'Stellar 4K Webcam',
    description: '4K webcam with auto-framing, dual noise-reducing microphones and a privacy shutter.',
    price: 129,
    stock: 0,
    category: 'Video',
    rating: 4.2,
  },
  {
    name: 'Cosmos Ergonomic Chair',
    description: 'Mesh office chair with dynamic lumbar support and 4D armrests.',
    price: 389,
    stock: 7,
    category: 'Home Office',
    rating: 4.7,
  },
  {
    name: 'Nova Portable SSD 2TB',
    description: 'Pocket-sized NVMe SSD with up to 2,000 MB/s transfers over USB 3.2 Gen 2x2.',
    price: 179,
    stock: 48,
    category: 'Storage',
    rating: 4.8,
  },
  {
    name: 'Zenith Wireless Earbuds',
    description: 'True wireless earbuds with spatial audio, ANC and wireless charging case.',
    price: 139,
    stock: 76,
    category: 'Audio',
    rating: 4.5,
  },
];
