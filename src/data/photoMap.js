/* ══════════════════════════════════════════════════════════════
   PHOTO MAPPING — Maps days & locations to local image files
   ──────────────────────────────────────────────────────────────
   Photos are served from: public/photos/source/
   URL path in browser:    /photos/source/[filename]

   Naming convention used by the personal-photo set:
     dayNN_<short-slug>.jpg          — attractions / activities
     dayNN_lunch_<slug>.jpg          — lunch venues
     dayNN_dinner_<slug>.jpg         — dinner venues

   Hotels intentionally have NO photos — `hotelPhotos` is empty
   and `getHotelPhoto` always returns null so the Accommodation
   chip stays clean (text + Google Maps link only).

   When a name has no entry here, getLocationPhoto returns null and
   the line-art icon fallback renders instead.
   ══════════════════════════════════════════════════════════════ */

const PHOTO_BASE = "/photos/source/";

/* ── Per-day hero images (shown in the DayCard header) ── */
export const dayHeroPhotos = {
  1: "day01_harajuku.jpg",
  2: "day02_shinjuku-gyoen.jpg",
  3: "day03_monsters-inc.jpg",
  4: "day04_soaring.jpg",
  5: "day05_omoide-yokocho.jpg",
  6: "day06_kenrokuen.jpg",
  7: "day07_shirakawago.jpg",
  8: "day08_hirayu-onsen.jpg",
  9: "day09_matsumoto-castle.jpg",
  10: "day10_osaka-castle.jpg",
  11: "day11_nintendo-world.jpg",
  12: "day12_dotonbori.jpg",
  13: "day13_nara-deer.jpg",
  14: "day14_gion-duck.jpg",
  15: "day15_fushimi-inari.jpg",
  16: "day16_stumptown.jpg",
  17: "day17_kinkakuji.jpg",
  18: "day18_uzu-teamlab.jpg",
  19: "day19_shimokitazawa.jpg",
  20: "day20_ueno-park.jpg",
  21: "day21_akihabara.jpg",
  22: "day22_teamlab-planets.jpg",
  23: "day23_lake-kawaguchiko.jpg",
  24: "day24_the-park.jpg",
  25: "day25_fuji-view.jpg",
  26: "day26_open-air-museum.jpg",
  27: "day27_bricolage.jpg",
  28: "day28_sunshine-city.jpg",
  29: "day29_uniqlo-donki.jpg",
  30: "day30_golden-gai.jpg",
  31: "day31_shinjuku-gyoen.jpg",
};

/* ── Per-location photos (keyed by attraction/restaurant name in tripData) ── */
export const locationPhotos = {
  // ───── Day 1 — Tokyo ─────
  "Harajuku & Omotesando": "day01_harajuku.jpg",
  "Meiji Shrine": "day01_meiji.jpg",
  "Meiji Shrine + Yoyogi Park": "day01_meiji.jpg",
  "AFURI Harajuku": "day01_afuri.jpg",
  "Anakuma Cafe": "day01_anakuma.jpg",
  "Shibuya Crossing": "day01_shibuya-crossing.jpg",
  "Nezu Museum": "day01_nezu.jpg",
  "Don Quijote Shibuya": "day01_donki-shibuya.jpg",
  "GIGO Arcade Shibuya": "day01_gigo.jpg",
  "Yoyogi Park": "day01_yoyogi.jpg",
  "Sushi Zanmai": "day01_dinner_zanmai.jpg",

  // ───── Day 2 — Tokyo ─────
  "Shinjuku Gyoen": "day02_shinjuku-gyoen.jpg",
  "Shinjuku": "day02_shinjuku.jpg",
  "Golden Gai": "day02_golden-gai.jpg",
  "FUUNJI": "day02_lunch_fuunji.jpg",
  "Golden Gai Bar": "day02_dinner_golden-gai.jpg",

  // ───── Day 3 — Tokyo Disney ─────
  "Monsters Inc.": "day03_monsters-inc.jpg",
  "Beauty and the Beast": "day03_beauty-beast.jpg",
  "Buzz Lightyear": "day03_buzz.jpg",
  "Space Mountain": "day03_space-mountain.jpg",
  "Splash Mountain": "day03_splash-mountain.jpg",
  "Haunted Mansion": "day03_haunted-mansion.jpg",
  "Pirates of the Caribbean": "day03_pirates.jpg",
  "Grandma Sara's Kitchen": "day03_lunch_grandma-sara.jpg",
  "Konbini": "day03_dinner_konbini.jpg",

  // ───── Day 4 — Tokyo DisneySea ─────
  "Soaring: Fantastic Flight": "day04_soaring.jpg",
  "Journey to the Center of the Earth": "day04_journey.jpg",
  "Indiana Jones": "day04_indiana.jpg",
  "Little Mermaid Lagoon": "day04_mermaid-lagoon.jpg",
  "20,000 Leagues Under the Sea": "day04_20k-leagues.jpg",
  "Tower of Terror": "day04_tower-of-terror.jpg",
  "Toy Story Mania": "day04_toy-story.jpg",
  "DisneySea Restaurant": "day04_lunch_disneysea.jpg",
  "Ichiran Ramen Shinjuku": "day04_dinner_ichiran-shinjuku.jpg",

  // ───── Day 5 — Tokyo ─────
  "Little Darling Coffee Roasters": "day05_little-darling.jpg",
  "Shibuya — Hachiko": "day05_hachiko.jpg",
  "PARCO Shibuya (Pokemon Center)": "day05_parco-pokemon.jpg",
  "Standing Sushi Shibuya": "day05_standing-sushi.jpg",
  "Uogashi Nihon-Ichi Shibuya Dogenzaka": "day05_standing-sushi.jpg",
  "Omoide Yokocho": "day05_omoide-yokocho.jpg",
  "3D Billboard Shinjuku": "day05_3d-billboard.jpg",
  "Little Darling Coffee": "day05_lunch_little-darling.jpg",
  "Izakaya at Omoide Yokocho": "day05_dinner_izakaya.jpg",

  // ───── Day 6 — Kanazawa ─────
  "Shinkansen to Kanazawa": "day06_shinkansen.jpg",
  "Omicho Fish Market": "day06_omicho.jpg",
  "Kenroku-en Garden": "day06_kenrokuen.jpg",
  "Kanazawa Castle": "day06_kanazawa-castle.jpg",
  "Omicho Fish Market Sushi": "day06_lunch_omicho-sushi.jpg",
  "Mazesoba Restaurant": "day06_dinner_mazesoba.jpg",

  // ───── Day 7 — Takayama ─────
  "Shirakawa-go": "day07_shirakawago.jpg",
  "Shirakawago Purin no Ie": "day07_purin-no-ie.jpg",
  "Keyaki (Ramen)": "day07_lunch_keyaki.jpg",
  "Takumiya Yasukawa": "day07_dinner_takumiya.jpg",

  // ───── Day 8 — Matsumoto ─────
  "Hiryu Ski Resort": "day08_hiryu-ski.jpg",
  "Hirayu no Mori Onsen": "day08_hirayu-onsen.jpg",
  "Hirayu Onsen Ski Area": "day08_lunch_hirayu.jpg",
  "McDonald's Matsumoto": "day08_dinner_mcdonalds.jpg",

  // ───── Day 9 — Nagoya ─────
  "Michelin Café": "day09_michelin-cafe.jpg",
  "Matsumoto Castle": "day09_matsumoto-castle.jpg",
  "Kusama Yayoi Museum": "day09_kusama.jpg",
  "Shishimaru Ramen": "day09_dinner_shishimaru.jpg",

  // ───── Day 10 — Osaka ─────
  "Osaka Castle": "day10_osaka-castle.jpg",
  "Food Tour with Liran": "day10_food-tour.jpg",
  "Ramen Hayato": "day10_lunch_hayato.jpg",
  "Food Tour": "day10_dinner_food-tour.jpg",
  "Karaoke Night": "day10_karaoke.jpg",

  // ───── Day 11 — Osaka Universal ─────
  "Super Nintendo World": "day11_nintendo-world.jpg",
  "Flying Dinosaur": "day11_flying-dinosaur.jpg",
  "XR Dreamor": "day11_xr-dreamor.jpg",
  "Wizarding World of Harry Potter": "day11_harry-potter.jpg",
  "Spider-Man": "day11_spiderman.jpg",
  "Jurassic Park": "day11_jurassic.jpg",
  "JAWS": "day11_jaws.jpg",
  "Minions Ride": "day11_minions.jpg",
  "Universal Studios": "day11_lunch_usj.jpg",
  "Kura Sushi (Conveyor Belt)": "day11_kura.jpg",

  // ───── Day 12 — Osaka ─────
  "Namba Yasaka Shrine": "day12_namba-yasaka.jpg",
  "Kuromon Ichiba Market": "day12_kuromon.jpg",
  "Dotonbori": "day12_dotonbori.jpg",
  "Round1 Arcade": "day12_round.jpg",
  "Ichiran Ramen Dotonbori": "day12_dinner_ichiran-dotonbori.jpg",

  // ───── Day 13 — Nara ─────
  "Nara Park & Deer": "day13_nara-deer.jpg",
  "Todai-ji Temple": "day13_todaiji.jpg",
  "Ramen in Nara": "day13_lunch_nara-ramen.jpg",

  // ───── Day 14 — Kyoto ─────
  "Maruyama Park": "day14_maruyama.jpg",
  "GION DUCK": "day14_gion-duck.jpg",
  "Musubi": "day14_lunch_musubi.jpg",
  "Gyoza Motoi": "day14_dinner_motoi.jpg",

  // ───── Day 15 — Kyoto ─────
  "Fushimi Inari Shrine": "day15_fushimi-inari.jpg",
  "Ogawa Coffee": "day15_ogawa-coffee.jpg",
  "Nishiki Market": "day15_lunch_nishiki.jpg",
  "Burger Revolution Kyoto": "day15_dinner_burger-revolution.jpg",

  // ───── Day 16 — Kyoto (rest day) ─────
  "Stumptown Coffee Roasters": "day16_stumptown.jpg",
  "Bar Elcanture": "day16_bar-elcanture.jpg",
  "Café": "day16_lunch_cafe.jpg",

  // ───── Day 17 — Kyoto ─────
  "Arashiyama Bamboo Grove": "day17_arashiyama-bamboo.jpg",
  "Kinkaku-ji (Golden Pavilion)": "day17_kinkakuji.jpg",
  "Hokanji Pagoda": "day17_hokanji.jpg",
  "Ramen Kyoto": "day17_lunch_kyoto-ramen.jpg",
  "PIZZA MIRITA": "day17_dinner_pizza-mirita.jpg",

  // ───── Day 18 — Kyoto ─────
  "Hokanji Morning Photos": "day18_hokanji-morning.jpg",
  "Starbucks Ninenzaka": "day18_starbucks-ninenzaka.jpg",
  "UZU Ramen (teamLab)": "day18_uzu-teamlab.jpg",

  // ───── Day 19 — Tokyo ─────
  "Shinkansen to Tokyo": "day19_shinkansen-tokyo.jpg",
  "Harajuku": "day19_harajuku-return.jpg",
  "Shimokitazawa": "day19_shimokitazawa.jpg",
  "Nakame Shumai Bar Shimokitazawa": "day19_dinner_nakame-shumai.jpg",

  // ───── Day 20 — Tokyo ─────
  "Ueno Park": "day20_ueno-park.jpg",
  "Toy Store (Ptitim rec.)": "day20_toy-store.jpg",
  "Ueno Ameyoko Market": "day20_ameyoko.jpg",
  "Kappabashi Street": "day20_kappabashi.jpg",
  "Picnic at Ueno Park": "day20_lunch_ueno-picnic.jpg",

  // ───── Day 21 — Tokyo ─────
  "Katsuobushi Shibuya": "day21_katsuobushi.jpg",
  "Akihabara": "day21_akihabara.jpg",
  "Super Potato": "day21_super-potato.jpg",
  "Radio Kaikan": "day21_radio-kaikan.jpg",
  "Tsukemen Gonokami Seisakusho Shinjuku": "day21_lunch_tsukemen.jpg",
  "LAWSON Minato Roppongi Dori": "day21_dinner_lawson.jpg",

  // ───── Day 22 — Tokyo ─────
  "teamLab Planets": "day22_teamlab-planets.jpg",
  "Odaiba — Gundam": "day22_gundam.jpg",
  "Electric Go-Kart Odaiba": "day22_gokart.jpg",
  "Ginza Uniqlo (12 Floors)": "day22_ginza-uniqlo.jpg",
  "Vegan Ramen UZU Tokyo": "day22_lunch_uzu-tokyo.jpg",
  "Chidori Roppongi": "day22_dinner_chidori.jpg",

  // ───── Day 23 — Kawaguchiko ─────
  "Toyota Rent a Car Odawara": "day23_toyota-rental.jpg",
  "Lake Kawaguchiko": "day23_lake-kawaguchiko.jpg",
  "Mizunokaze": "day23_lunch_mizunokaze.jpg",
  "Italian near hotel": "day23_dinner_italian.jpg",

  // ───── Day 24 — Hakone ─────
  "Hakone Viewpoints": "day24_hakone-viewpoints.jpg",
  "The Park (Pancakes)": "day24_the-park.jpg",
  "The Park Pancakes": "day24_lunch_pancakes.jpg",
  "Hotel Onsen": "day24_hotel-onsen.jpg",
  "Hotel Buffet": "day24_dinner_buffet.jpg",

  // ───── Day 25 — Fuji ─────
  "Mt. Fuji Clear View!": "day25_fuji-view.jpg",
  "Fuji Street & Lake": "day25_fuji-street.jpg",
  "Chureito Pagoda": "day25_chureito.jpg",
  "Starbucks Kawaguchiko": "day25_starbucks-kawaguchi.jpg",
  "Gotemba Premium Outlets": "day25_gotemba.jpg",
  "Onsen & Sunset": "day25_onsen-sunset.jpg",
  "Kawaguchiko Area": "day25_lunch_kawaguchi.jpg",

  // ───── Day 26 — Tokyo (back from Hakone) ─────
  "Hakone Open Air Museum": "day26_open-air-museum.jpg",
  "Tokyo Metropolitan Gov. Building": "day26_tmg-building.jpg",
  "GIGO Shinjuku": "day26_gigo.jpg",
  "HIRUKA Roppongi": "day26_lunch_hiruka.jpg",
  "Iruca Tokyo Roppongi": "day26_lunch_hiruka.jpg",
  "Conveyor Sushi Shinjuku": "day26_dinner_conveyor-sushi.jpg",

  // ───── Day 27 — Tokyo ─────
  "BRICOLAGE Bread & Co.": "day27_bricolage.jpg",
  "MUJI Shinjuku": "day27_muji.jpg",
  "Isetan Shinjuku": "day27_isetan-shinjuku.jpg",
  "V2 Tokyo Roppongi": "day27_v2.jpg",
  "Shin Udon": "day27_lunch_shin-udon.jpg",
  "McDonald's + V2 Club": "day27_dinner_mcd-v2.jpg",

  // ───── Day 28 — Tokyo ─────
  "Sunshine City Ikebukuro": "day28_sunshine-city.jpg",
  "Sunshine Aquarium": "day28_aquarium.jpg",
  // Note: Day-28 also has "Kappabashi Street" which is intentionally
  // mapped to the Day-20 photo (preserved). day28_kappabashi.jpg
  // remains in the source folder unused by design.
  "Kuwabara": "day28_lunch_kuwabara.jpg",
  "Kura Sushi Asakusa": "day28_dinner_kura.jpg",

  // ───── Day 29 — Tokyo ─────
  "Starbucks Reserve Nakameguro": "day29_starbucks-reserve.jpg",
  "Uniqlo & Don Quijote": "day29_uniqlo-donki.jpg",
  "Ramen HAYASHI": "day29_lunch_hayashi.jpg",
  "ARIA Roppongi": "day29_dinner_aria.jpg",

  // ───── Day 30 — Tokyo ─────
  // BRICOLAGE / Standing Sushi / Golden Gai keys are already mapped to
  // earlier-day photos (preserved). day30_bricolage.jpg, day30_golden-gai.jpg,
  // and day30_dinner_standing-sushi.jpg remain in the source folder unused.
  "Nakameguro": "day30_nakameguro.jpg",
  "Japanese Yakiniku Nikugen": "day30_lunch_nikugen.jpg",

  // ───── Day 31 — Tokyo (final day) ─────
  "Harajuku (Last Visit)": "day31_harajuku-last.jpg",
  "AFURI (Last Ramen!)": "day31_lunch_afuri.jpg",
  // "Shinjuku Gyoen" reuses the Day-2 photo (preserved).
};

/* ── Per-hotel photos ──
      Intentionally empty: per design decision the Accommodation card
      shows only the hotel name + Google Maps link, no thumbnail.
      Keeping the export so callers don't break.                       */
export const hotelPhotos = {};

/* ── Per-city fallback photos (used when no day hero exists) ── */
export const cityPhotos = {
  // Add city-overview photos here when available, e.g.:
  // "Tokyo": "tokyo-overview.jpg",
};

/* ── Helper: resolve a photo URL ── */
export function getPhotoUrl(filename) {
  if (!filename) return null;
  return `${PHOTO_BASE}${encodeURIComponent(filename)}`;
}

/* ── Helper: get the best available photo for a day ── */
export function getDayPhoto(day, city) {
  if (dayHeroPhotos[day]) return getPhotoUrl(dayHeroPhotos[day]);
  const cityBase = city?.replace(/ \d+$/, "");
  if (cityBase && cityPhotos[cityBase]) return getPhotoUrl(cityPhotos[cityBase]);
  return null;
}

/* ── Helper: get photo for a specific location (attraction / meal) ── */
export function getLocationPhoto(name) {
  if (name && locationPhotos[name]) return getPhotoUrl(locationPhotos[name]);
  return null;
}

/* ── Helper: get photo for a hotel by name ──
      Always returns null by design — hotels render as text-only chips.
      Kept as a function so existing imports keep working.              */
export function getHotelPhoto() {
  return null;
}
