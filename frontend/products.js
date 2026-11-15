const products = [
  // Roses
  { id: 1, name: "Pink Rose Bouquet", category: "roses", price: 49.99, image: "images/roses/pink-rose-bouquet-01.jpg", desc: "Elegant soft pink roses arranged with baby's breath." },
  { id: 2, name: "Classic Red Rose Bouquet", category: "roses", price: 54.99, image: "images/roses/red-rose-bouquet-01.jpg", desc: "Timeless red roses perfect for romance." },
  { id: 3, name: "White Rose Bouquet", category: "roses", price: 52.99, image: "images/roses/white-rose-01.jpg", desc: "Pure white roses for elegance and purity." },
  { id: 4, name: "Yellow Rose Bouquet", category: "roses", price: 48.99, image: "images/roses/yellow-rose-01.jpg", desc: "Bright yellow roses symbolizing friendship and joy." },
  { id: 5, name: "Purple Rose Bouquet", category: "roses", price: 55.99, image: "images/roses/purple-rose-01.jpg", desc: "Mysterious purple roses for unique moments." },
  { id: 6, name: "Peach Rose Bouquet", category: "roses", price: 51.99, image: "images/roses/peach-rose-01.jpg", desc: "Soft peach tones for gentle appreciation." },
  { id: 7, name: "Mixed Color Roses", category: "roses", price: 59.99, image: "images/roses/red-bouquet-table-01.jpg", desc: "A vibrant mix of rose colors." },
  { id: 8, name: "Luxury 50 Red Roses", category: "roses", price: 129.99, image: "images/roses/red-roses-many-01.jpg", desc: "Grand statement of 50 premium red roses." },
  { id: 9, name: "Luxury 100 Red Roses", category: "roses", price: 249.99, image: "images/roses/red-roses-closeup-01.jpg", desc: "Ultimate luxury — 100 stunning red roses." },
  { id: 10, name: "Heart-Shaped Rose Arrangement", category: "roses", price: 89.99, image: "images/roses/rose-heart-01.jpg", desc: "Romantic heart-shaped design of red roses." },
  { id: 11, name: "Roses in Flower Box", category: "roses", price: 79.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "Premium roses presented in an elegant box." },
  { id: 12, name: "Single Stem Rose", category: "roses", price: 12.99, image: "images/roses/single-rose-01.jpg", desc: "Perfect single stem for a simple gesture." },

  // Tulips
  { id: 13, name: "Pink Tulips", category: "tulips", price: 39.99, image: "images/tulips/pink-tulips-01.jpg", desc: "Fresh pink tulips in a classic bunch." },
  { id: 14, name: "White Tulips", category: "tulips", price: 38.99, image: "images/tulips/white-tulips-01.jpg", desc: "Crisp white tulips for clean beauty." },
  { id: 15, name: "Yellow Tulips", category: "tulips", price: 37.99, image: "images/tulips/yellow-tulips-01.jpg", desc: "Sunny yellow tulips full of cheer." },
  { id: 16, name: "Purple Tulips", category: "tulips", price: 41.99, image: "images/tulips/purple-tulips-01.jpg", desc: "Deep purple tulips with striking presence." },
  { id: 17, name: "Red Tulips", category: "tulips", price: 39.99, image: "images/tulips/pink-tulips-01.jpg", desc: "Bold red tulips for passionate messages." },
  { id: 18, name: "Mixed Tulip Bouquet", category: "tulips", price: 44.99, image: "images/tulips/tulips-vase-01.jpg", desc: "Colorful mix of spring tulips." },
  { id: 19, name: "Luxury Tulip Arrangement", category: "tulips", price: 69.99, image: "images/tulips/tulips-vase-01.jpg", desc: "Premium tulip design with foliage." },
  { id: 20, name: "Tulips in Glass Vase", category: "tulips", price: 49.99, image: "images/tulips/tulips-vase-01.jpg", desc: "Ready-to-display tulips in elegant glass." },

  // Sunflowers
  { id: 21, name: "Classic Sunflower Bouquet", category: "sunflowers", price: 42.99, image: "images/sunflowers/sunflower-01.jpg", desc: "Bright and cheerful classic sunflowers." },
  { id: 22, name: "Sunflowers with White Roses", category: "sunflowers", price: 54.99, image: "images/sunflowers/sunflower-01.jpg", desc: "Sunflowers paired with soft white roses." },
  { id: 23, name: "Sunflowers with Pink Flowers", category: "sunflowers", price: 52.99, image: "images/sunflowers/sunflower-01.jpg", desc: "Warm sunflowers mixed with pink blooms." },
  { id: 24, name: "Luxury Sunflower Arrangement", category: "sunflowers", price: 74.99, image: "images/sunflowers/sunflower-vase-01.jpg", desc: "Elevated sunflower design for special gifts." },
  { id: 25, name: "Sunflowers in Flower Box", category: "sunflowers", price: 64.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "Sunflowers presented in a stylish box." },
  { id: 26, name: "Sunflowers in Vase", category: "sunflowers", price: 48.99, image: "images/sunflowers/sunflower-vase-01.jpg", desc: "Ready sunflower arrangement in a vase." },

  // Lilies
  { id: 27, name: "White Lilies", category: "lilies", price: 45.99, image: "images/lilies/white-lily-01.jpg", desc: "Pure white lilies symbolizing renewal." },
  { id: 28, name: "Pink Lilies", category: "lilies", price: 47.99, image: "images/lilies/pink-lily-01.jpg", desc: "Soft pink lilies for gentle affection." },
  { id: 29, name: "Orange Lilies", category: "lilies", price: 46.99, image: "images/lilies/stargazer-lily-01.jpg", desc: "Vibrant orange lilies full of energy." },
  { id: 30, name: "Stargazer Lilies", category: "lilies", price: 54.99, image: "images/lilies/stargazer-lily-01.jpg", desc: "Fragrant stargazer lilies with dramatic petals." },
  { id: 31, name: "Mixed Lily Bouquet", category: "lilies", price: 58.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "A beautiful mix of lily varieties." },
  { id: 32, name: "Luxury Lily Arrangement", category: "lilies", price: 79.99, image: "images/lilies/white-lily-01.jpg", desc: "Premium lily design for elegant occasions." },

  // Luxury Flower Boxes
  { id: 33, name: "Pink Luxury Flower Box", category: "flower-boxes", price: 89.99, image: "images/flower-boxes/pastel-box-01.jpg", desc: "Soft pink blooms in a premium box." },
  { id: 34, name: "Red Rose Flower Box", category: "flower-boxes", price: 99.99, image: "images/roses/red-roses-many-01.jpg", desc: "Classic red roses in a luxury presentation box." },
  { id: 35, name: "White Rose Flower Box", category: "flower-boxes", price: 94.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "Elegant white roses boxed to perfection." },
  { id: 36, name: "Heart-Shaped Flower Box", category: "flower-boxes", price: 109.99, image: "images/roses/rose-heart-01.jpg", desc: "Romantic heart-shaped luxury box." },
  { id: 37, name: "Round Luxury Flower Box", category: "flower-boxes", price: 84.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "Modern round box filled with fresh blooms." },
  { id: 38, name: "Premium Mixed Flower Box", category: "flower-boxes", price: 119.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "Designer mixed arrangement in a premium box." },
  { id: 39, name: "Pastel Flower Box", category: "flower-boxes", price: 92.99, image: "images/flower-boxes/pastel-box-01.jpg", desc: "Soft pastel tones in an elegant box." },
  { id: 40, name: "Luxury Gift Flower Box", category: "flower-boxes", price: 129.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "The ultimate gift — luxury boxed flowers." },

  // Mixed Bouquets
  { id: 41, name: "Pastel Mixed Bouquet", category: "mixed", price: 54.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "Soft pastel flowers for a dreamy look." },
  { id: 42, name: "Pink and White Bouquet", category: "mixed", price: 49.99, image: "images/roses/pink-rose-bouquet-01.jpg", desc: "Classic pink and white combination." },
  { id: 43, name: "Purple and White Bouquet", category: "mixed", price: 52.99, image: "images/roses/purple-rose-01.jpg", desc: "Elegant purple and white blooms." },
  { id: 44, name: "Red and White Bouquet", category: "mixed", price: 51.99, image: "images/roses/red-bouquet-table-01.jpg", desc: "Striking red and white contrast." },
  { id: 45, name: "Spring Flower Bouquet", category: "mixed", price: 48.99, image: "images/mixed-bouquets/spring-bouquet-01.jpg", desc: "Fresh spring flowers in season." },
  { id: 46, name: "Garden-Style Bouquet", category: "mixed", price: 56.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "Natural garden-inspired arrangement." },
  { id: 47, name: "Premium Mixed Bouquet", category: "mixed", price: 74.99, image: "images/flower-boxes/luxury-box-01.jpg", desc: "Designer mixed flowers at their finest." },
  { id: 48, name: "Colorful Seasonal Bouquet", category: "mixed", price: 59.99, image: "images/sunflowers/sunflower-01.jpg", desc: "Vibrant seasonal color mix." },

  // Wedding
  { id: 49, name: "White Bridal Bouquet", category: "wedding", price: 129.99, image: "images/wedding/bridal-01.jpg", desc: "Classic white bridal bouquet for the big day." },
  { id: 50, name: "Pink Bridal Bouquet", category: "wedding", price: 134.99, image: "images/roses/pink-rose-bouquet-01.jpg", desc: "Romantic pink bridal arrangement." },
  { id: 51, name: "Luxury Wedding Roses", category: "wedding", price: 159.99, image: "images/roses/red-roses-closeup-01.jpg", desc: "Premium roses for wedding parties." },
  { id: 52, name: "Wedding Table Flowers", category: "wedding", price: 79.99, image: "images/wedding/wedding-table-01.jpg", desc: "Elegant centerpieces for reception tables." },
  { id: 53, name: "Wedding Flower Decorations", category: "wedding", price: 99.99, image: "images/wedding/bridal-01.jpg", desc: "Decorative arrangements for the venue." },
  { id: 54, name: "Romantic Wedding Arrangement", category: "wedding", price: 149.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "Romantic full wedding floral design." },

  // Special Occasions
  { id: 55, name: "Birthday Flower Bouquet", category: "occasions", price: 49.99, image: "images/mixed-bouquets/mixed-01.jpg", desc: "Cheerful flowers to celebrate a birthday." },
  { id: 56, name: "Valentine's Day Roses", category: "occasions", price: 69.99, image: "images/roses/red-roses-many-01.jpg", desc: "Classic Valentine's red roses." },
  { id: 57, name: "Anniversary Flowers", category: "occasions", price: 79.99, image: "images/occasions/anniversary-01.jpg", desc: "Elegant arrangement for anniversaries." },
  { id: 58, name: "Graduation Flowers", category: "occasions", price: 54.99, image: "images/sunflowers/sunflower-01.jpg", desc: "Bright blooms to congratulate graduates." },
  { id: 59, name: "Mother's Day Flowers", category: "occasions", price: 59.99, image: "images/tulips/pink-tulips-01.jpg", desc: "Loving flowers for Mother's Day." },
  { id: 60, name: "Romantic Surprise Bouquet", category: "occasions", price: 64.99, image: "images/roses/pink-rose-bouquet-01.jpg", desc: "Surprise your loved one with this romantic mix." }
];

const fallbackCatalogMap = new Map(products.map(p => [String(p.id), p.image]));

/* Bridge: prefer admin-managed catalog (ce_products) when present, with self-healing for legacy image URLs */
(function () {
  try {
    const rawStored = localStorage.getItem('ce_products');
    const stored = JSON.parse(rawStored || 'null');
    if (stored && Array.isArray(stored) && stored.length) {
      let needsResave = false;
      const mapped = stored
        .filter(p => (p.status || 'active') === 'active' && (p.price || 0) > 0)
        .map(p => {
          let img = p.image || '';
          // Heal broken/remote Unsplash URLs or empty images from default catalog
          if (!img || img.startsWith('http') || img.includes('photo-1468327768560') || img.includes('photo-1490750967861') || img.includes('photo-1455659817273')) {
            const canonical = fallbackCatalogMap.get(String(p.id));
            if (canonical) {
              img = canonical;
              p.image = canonical;
              needsResave = true;
            }
          }
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.discountPrice != null && p.discountPrice > 0 ? p.discountPrice : p.price,
            image: img,
            desc: p.desc || ''
          };
        });

      if (needsResave) {
        try {
          localStorage.setItem('ce_products', JSON.stringify(stored));
        } catch (_) {}
      }

      if (mapped.length) {
        products.length = 0;
        mapped.forEach(m => products.push(m));
      }
    }
  } catch (e) {}
})();

// Load the authoritative catalog from the backend when the API is available.
(async function loadServerCatalog() {
  try {
    const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.products) || !payload.products.length) return;
    products.splice(0, products.length, ...payload.products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.discountPrice ?? p.price,
      image: p.image || fallbackCatalogMap.get(String(p.id)) || 'images/roses/pink-rose-bouquet-01.jpg',
      desc: p.desc || '',
      stock: p.stock
    })));
    window.dispatchEvent(new CustomEvent('catalog:updated'));
  } catch (_) {
    // Static catalog remains available when the API/database is offline.
  }
})();
