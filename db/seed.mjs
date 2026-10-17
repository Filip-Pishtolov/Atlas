#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'atlas.db');
const SCHEMA_PATH = path.join(ROOT, 'db', 'schema.sql');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260901);
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

const BASE_DATE = '2026-09-01';

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const monthOf = (iso) => Number(iso.slice(5, 7));

const SEASON = {
  1: 0.88, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.15, 6: 1.08,
  7: 0.92, 8: 0.92, 9: 1.15, 10: 1.12, 11: 0.95, 12: 1.05,
};

function seasonalPrice(baseCents, startDate) {
  return Math.round((baseCents * SEASON[monthOf(startDate)]) / 100) * 100;
}

const depositFor = (totalCents) => Math.round((totalCents * 0.2) / 100) * 100;

const destImage = (slug) => `https://picsum.photos/seed/atlas-dest-${slug}/1600/900`;
const tourImage = (slug) => `https://picsum.photos/seed/atlas-tour-${slug}/1600/900`;
const galleryImage = (slug, n) => `https://picsum.photos/seed/atlas-tour-${slug}-${n}/1200/800`;
const blogImage = (slug) => `https://picsum.photos/seed/atlas-blog-${slug}/1600/900`;

const DESTINATIONS = [
  {
    slug: 'morocco',
    name: 'Morocco',
    country: 'Morocco',
    region: 'North Africa',
    is_featured: 1,
    best_time: 'March to May and September to November. The High Atlas holds snow until April, and the Sahara is punishing from late June to August.',
    summary:
      'From the snowline of the High Atlas to the silence of the Erg Chebbi dunes, Morocco packs four landscapes into a country you can cross in a day. It is where Atlas started, and it is still where our guides go on their own holidays.',
    description: [
      'Morocco rewards travellers who slow down. The obvious route - Marrakech, one night in the dunes, a photograph of a blue wall in Chefchaouen - is worth doing, but the country only opens up when you stay put long enough to be offered a second glass of tea. Our itineraries build in those afternoons deliberately.',
      'The High Atlas is the spine of the country. Villages such as Imlil, Aroumd and Tacheddirt sit where walnut terraces give way to bare rock, and the paths between them are mule tracks that have carried goods for centuries. Jebel Toubkal, at 4,167 m the highest peak in North Africa, is within reach of a fit walker, though we treat the ridge villages as the destination rather than the summit.',
      'South and east, the Draa and Dades valleys unspool past kasbahs of rammed earth towards the Sahara. Merzouga and the Erg Chebbi dunes are the picture everyone has seen; the emptier Erg Chigaga takes a further half-day of piste driving and repays it with silence you can hear.',
      'In the cities, Fes el Bali is still the largest car-free urban area in the world and genuinely disorientating, so we walk it with a guide who grew up on the Talaa Kebira. Food is the throughline everywhere: bissara soup for breakfast in Fes, tanjia cooked in the ashes of a hammam furnace in Marrakech, and a lamb and quince tagine that will spoil the version you make at home.',
    ].join('\n\n'),
  },
  {
    slug: 'albania',
    name: 'Albania',
    country: 'Albania',
    region: 'Western Balkans',
    is_featured: 1,
    best_time: 'May, June and September for the coast. Mid-June to early October for the Alps, when the Valbona Pass is reliably clear of snow.',
    summary:
      'Albania is the last corner of Mediterranean Europe where an August beach can still be empty and a mountain village still cooks what it grows. It is changing quickly, which is the best argument for going now.',
    description: [
      'For fifty years Albania was closed to almost everyone, and the isolation left two things behind: a coastline that escaped the concrete poured over its neighbours, and a mountain culture that carried on more or less uninterrupted. Both are the reason we come.',
      'The Accursed Mountains - Bjeshket e Nemuna - rise behind Shkoder in limestone walls. The crossing from Theth to Valbona over the Valbona Pass is the best known day of walking in the country: four to six hours of switchbacks with a coffee shack at the top, run by a man who carries the beans up himself. Beyond it the Peaks of the Balkans route runs on into Kosovo and Montenegro.',
      'The south is a different country. The Riviera between Dhermi and Himara drops through olive terraces to water that really is turquoise, and the Greek and Roman city at Butrint sits in a lagoon full of herons and terrapins. Gjirokaster and Berat, both UNESCO-listed, are built of stone and glass in a way that photographs better in bad weather than in good.',
      'Eat byrek early, accept the raki when it is offered, and expect lunch to take two hours. The roads are improving fast but they are still mountain roads, and we pace our itineraries for the country that exists rather than the one on the map.',
    ].join('\n\n'),
  },
  {
    slug: 'north-macedonia',
    name: 'North Macedonia',
    country: 'North Macedonia',
    region: 'Western Balkans',
    is_featured: 0,
    best_time: 'May to October. July and August are hot on the lake but perfect on the Shar and Galichica ridges; the beech forests turn in mid-October.',
    summary:
      'A landlocked country built around one extraordinary lake, with mountain ranges on three sides and almost no queues anywhere. Ohrid alone justifies the trip; the ridges above it are why people come back.',
    description: [
      'Lake Ohrid is around three million years old, one of the oldest lakes on Earth and deep enough to hold species found nowhere else, including the Ohrid trout that every restaurant on the promenade will try to sell you. The town stacks Byzantine churches, an Ottoman bazaar and a tenth-century fortress onto a headland you can walk end to end in twenty minutes.',
      'Behind the lake, Galichica National Park runs along a limestone ridge that separates Ohrid from Lake Prespa. The road over the top is spectacular. The walking on the ridge, with both lakes in view at once and griffon vultures working the thermals below you, is considerably better.',
      'In the north-west the Shar Mountains became a national park in 2021. Shepherds still bring flocks up to the summer pastures around Popova Shapka, and the cheese they make there - young, salty, kept in brine - turns up on every table in Tetovo.',
      'Skopje divides opinion. A building programme in the 2010s dropped neoclassical facades and enormous bronze statues over a city that had rebuilt itself in concrete after the 1963 earthquake, and the result is strange enough to be worth an afternoon. The Old Bazaar behind it, the largest in the Balkans after Istanbul, is entirely the real thing.',
    ].join('\n\n'),
  },
  {
    slug: 'jordan',
    name: 'Jordan',
    country: 'Jordan',
    region: 'Middle East',
    is_featured: 1,
    best_time: 'March to May, when the desert flowers, and September to November. Midsummer in Wadi Rum and at the Dead Sea regularly passes 40C.',
    summary:
      'Jordan fits a Roman city, a Nabataean capital, a desert of granite islands and the lowest point on Earth into a country the size of Portugal. It is also, by a distance, the easiest place in the region to travel slowly.',
    description: [
      'Petra deserves its reputation, but not the way most people meet it. Walking in on the back route from Little Petra brings you out above the Monastery in the early morning, an hour before the first coaches from Amman have cleared the Siq, and that is a completely different experience from the one in the brochure.',
      'The Jordan Trail runs 675 km from Umm Qais to Aqaba, and the four-day stretch from Dana to Petra is the best of it: down through the Dana Biosphere Reserve, along the Wadi Araba escarpment and up into the sandstone, camping among juniper with Bedouin hosts whose families have guided this section for three generations.',
      'Wadi Rum is not really sand. It is sandstone and granite jebels rising 800 m out of a red floor, with rock bridges, narrow siqs and Thamudic inscriptions scratched between them. Nights are spent in camps run by families from the Zalabia and Zawaideh tribes, and dinner comes out of a zarb pit dug into the ground.',
      'Then there is the Dead Sea at 430 m below sea level, the Roman street grid at Jerash - the best preserved outside Italy - and mansaf, the national dish of lamb, dried jameed yoghurt and rice. Jordanians will tell you mansaf is not a meal but an event, and after your first one you will agree.',
    ].join('\n\n'),
  },
  {
    slug: 'montenegro',
    name: 'Montenegro',
    country: 'Montenegro',
    region: 'Adriatic',
    is_featured: 0,
    best_time: 'June to September on the coast. The Durmitor high routes are clear of snow from mid-June to early October, and Kotor is at its best in May.',
    summary:
      'Montenegro stacks a fjord-like bay, a canyon 1,300 m deep and glacial lakes at 1,500 m into two hours of driving. For its size it is the most vertical country in Europe.',
    description: [
      'The Bay of Kotor is a drowned river canyon rather than a fjord, and the difference shows: the walls are bare grey karst, and all afternoon the light bounces off them onto the water. Kotor old town is a UNESCO site and busy by eleven; Perast, twenty minutes around the bay, stays quiet and has two islands, one of them built by hand out of scuttled ships.',
      'Inland, Durmitor National Park holds 48 peaks above 2,000 m and eighteen glacial lakes that Montenegrins call gorske oci, mountain eyes. The circuit to Bobotov Kuk is a serious day out; the loop around Crno Jezero is an easy afternoon. Both start from the same car park in Zabljak.',
      'Between the two, the Tara river has cut the deepest canyon in Europe, 1,300 m at its most dramatic and spanned by the Durdevica Tara bridge, which the partisans blew up in 1942 and rebuilt after the war. The rafting section below it runs through water cold enough to take your breath away in August.',
      'Montenegrin food splits along the same line as the landscape. On the coast it is Adriatic: black risotto, buzara, oysters farmed in the bay at Ljuta. Inland it is mountain food: kajmak, Njegusi prosciutto smoked in the village the Petrovic kings came from, and lamb cooked under a metal dome buried in embers.',
    ].join('\n\n'),
  },
  {
    slug: 'greece',
    name: 'Greece',
    country: 'Greece',
    region: 'Eastern Mediterranean',
    is_featured: 1,
    best_time: 'April to June and September to October. Gorges close in extreme summer heat, and August ferries fill up while the meltemi wind cancels them.',
    summary:
      'Beyond the islands everyone can name, Greece is a mountain country with thousands of kilometres of trail and a food culture that changes every fifty kilometres. We go where the ferries run less often and the taverna still has a grandmother in the kitchen.',
    description: [
      'Crete is effectively its own country. The White Mountains, Lefka Ori, hold snow into June, and the gorges draining them to the Libyan Sea include Samaria, at 16 km the longest in Europe, plus a dozen quieter ones such as Aradena and Imbros where you may not meet anybody at all.',
      'The Cyclades reward island-hopping done slowly. Naxos has the highest mountain in the group and villages such as Apiranthos where the marble lanes are original. Amorgos hangs the Hozoviotissa monastery in a cliff face 300 m above the sea. Folegandros keeps its Chora on a ledge and has almost no road to speak of.',
      'On the mainland the Peloponnese is where Greek food makes the most sense: Kalamata olives and the stone oil mills of the Mani, Nemean agiorgitiko grown on red clay, and the citrus plain around Argos that scents the whole road in February.',
      'We move between islands by ferry rather than plane whenever the timetable allows, keep groups small enough to fit on the little boats to Agia Roumeli and Loutro, and always leave one day in the middle of a trip with nothing planned on it at all.',
    ].join('\n\n'),
  },
];

const THEMES = [
  { slug: 'hiking-trekking', name: 'Hiking & Trekking' },
  { slug: 'cultural', name: 'Cultural' },
  { slug: 'food-wine', name: 'Food & Wine' },
  { slug: 'coastal-islands', name: 'Coastal & Islands' },
  { slug: 'desert', name: 'Desert' },
  { slug: 'wildlife', name: 'Wildlife' },
  { slug: 'photography', name: 'Photography' },
  { slug: 'slow-travel', name: 'Slow Travel' },
];

const TOURS = [
  {
    slug: 'atlas-mountains-and-berber-villages',
    title: 'Atlas Mountains & Berber Villages',
    destination: 'morocco',
    duration_days: 8,
    difficulty: 'moderate',
    group_size_min: 4,
    group_size_max: 14,
    base_price_cents: 129000,
    status: 'published',
    is_featured: 1,
    meeting_point: 'Riad Dar Zaman, Kasbah quarter, Marrakech - 18:00 on day one, or Marrakech Menara airport arrivals with a name board',
    themes: ['hiking-trekking', 'cultural', 'photography'],
    summary:
      'Eight days walking the mule paths between the walnut terraces and high pastures of the Ait Mizane and Imenane valleys, sleeping in village guesthouses. No camping and no summit push - just the best walking in North Africa at a Berber pace.',
    description: [
      'The High Atlas is not a wilderness. Every valley we walk through is terraced, farmed and lived in, and the paths between the villages are the roads: mules carry the gas bottles, children carry the bread, and the tracks have been repaired by hand for centuries. Walking them is the closest you will get to being let into daily life at 2,000 metres.',
      'We work the Ait Mizane and Imenane valleys, crossing three passes - Tizi n Tamatert, Tizi n Tacheddirt and Tizi n Mzik - across four walking days of four to six hours each. Nothing is technical and nothing is exposed. You sleep in village gites with hot showers and thick blankets, and dinner arrives on the roof terrace as the last light comes off the ridge opposite.',
      'There is no summit day. Jebel Toubkal is in view for most of the week and we walk up to the shrine at Sidi Chamharouch on its flank, but the trip is built around the villages instead: the threshing floors at Aroumd, the walnut groves above Tacheddirt, and the Saturday souk at Asni where the whole valley comes down to buy, sell and argue.',
      'Two nights in Marrakech bookend the week, with a guided walk through the tanneries and spice souks and a farewell tanjia cooked in the embers of a neighbourhood hammam furnace. Our lead guide Brahim was born in Imlil and has been working these passes for nineteen years.',
    ].join('\n\n'),
    images: [
      'Walnut terraces stepping down to the river below the village of Imlil',
      'A mule train on the stone path climbing towards the Tizi n Tamatert pass',
      'Flat-roofed houses of Aroumd stacked on their moraine above the valley floor',
      'Mint tea poured from height into glasses on a gite roof terrace',
      'Late afternoon light on the north face of Jebel Toubkal seen from Tacheddirt',
    ],
    itinerary: [
      { title: 'Arrive in Marrakech', description: 'Transfer from Menara airport to a riad in the Kasbah quarter, five minutes from the Saadian Tombs. We meet at six on the terrace for a route briefing and a kit check, then walk out for a first dinner of grilled lamb and khobz in the Mellah.', meals: 'Dinner', accommodation: 'Riad Dar Zaman, Marrakech' },
      { title: 'Marrakech to Imlil and Aroumd', description: 'A ninety-minute drive south across the Kik plateau and through the argan groves to Asni, where we stop at the Saturday souk when the day suits. From Imlil we walk the last forty minutes to Aroumd while the mules take the bags, arriving for tea and a slow first afternoon at altitude.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Village gite, Aroumd' },
      { title: 'Over the Tizi n Tamatert to Tacheddirt', description: 'The first proper walking day: about five hours and 700 m of ascent on a broad mule path to the pass at 2,279 m. Lunch is spread out at the top, then an easy contour into Tacheddirt, the highest village inhabited all year round in this valley.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Village gite, Tacheddirt' },
      { title: 'Tacheddirt and the summer pastures', description: 'A shorter day up to the grazing grounds below the Tizi n Tacheddirt, where families move their flocks between June and September. The views open north over the Imenane and south to the Toubkal wall, and we are back in the village for a long lunch and an afternoon of nothing much.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Village gite, Tacheddirt' },
      { title: 'Tacheddirt to Ouaneskra', description: 'Six hours of steady contouring above the Imenane valley on paths cut into the terracing, through four hamlets and past irrigation channels older than anyone can date. Ouaneskra sits on a shelf with a mosque, one shop and a view straight down the valley.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Village gite, Ouaneskra' },
      { title: 'Over the Tizi n Mzik to Imlil', description: 'The last pass of the week at 2,489 m, with the whole Toubkal massif in front of you on the descent. We reach Imlil by early afternoon, and anyone who wants another hour walks up to the shrine at Sidi Chamharouch before dinner.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Kasbah guesthouse, Imlil' },
      { title: 'Back to Marrakech, souks and a hammam', description: 'We drive down in the morning and spend the afternoon walking the city with a local guide: the dyers alley, the spice souk and the Ben Youssef madrasa. Then a proper hammam, and a farewell tanjia cooked in the ashes of the furnace that heats it.', meals: 'Breakfast, Dinner', accommodation: 'Riad Dar Zaman, Marrakech' },
      { title: 'Departure', description: 'Breakfast on the terrace and airport transfers timed to your flight. Anyone leaving late can store bags at the riad and use the pool until mid-afternoon.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Seven nights accommodation: two in a Marrakech riad, five in village gites',
      'All breakfasts, five lunches and seven dinners',
      'A qualified English-speaking Berber mountain guide throughout',
      'Muleteers and mules carrying all luggage on walking days',
      'Private transfers between Marrakech and Imlil',
      'Guided half-day walking tour of the Marrakech medina',
      'Hammam and gommage scrub on the final afternoon',
    ],
    excluded: [
      'International flights to and from Marrakech',
      'Travel insurance, which is compulsory and checked 14 days before departure',
      'Lunches on days 1, 7 and 8',
      'Tips for the guide, muleteers and drivers',
      'Single room supplement, €190 where a single is available',
    ],
    departures: [11, 39, 67, 116, 200, 228, 249, 291],
  },
  {
    slug: 'sahara-dunes-and-the-draa-valley',
    title: 'Sahara Dunes & the Draa Valley',
    destination: 'morocco',
    duration_days: 7,
    difficulty: 'easy',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 118000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Riad Dar Zaman, Kasbah quarter, Marrakech - 08:00 on day one',
    themes: ['desert', 'photography', 'cultural'],
    summary:
      'A week across the Tizi n Tichka to the kasbah valleys, the Todra gorge and a night under the Erg Chebbi dunes. Short drives, long stops, and a camel walk that ends with dinner cooked over a fire in the sand.',
    description: [
      'This is the classic southern loop, run at half the usual speed. Most operators cross the Atlas, sprint to Merzouga and turn around; we take three days getting there, stopping in the Skoura palmeraie and the Dades so the landscape has time to change from oak forest to oleander to bare hammada.',
      'Ait Benhaddou is the first night, a fortified village of rammed earth on the old caravan route from Timbuktu to Marrakech. It is a UNESCO site and it has been in more films than anyone can list, but arriving in the late afternoon once the coaches have gone leaves the ksar almost empty, with low sun turning the mud walls the colour of a terracotta pot.',
      'At Merzouga we hand over to a family from the Ait Atta who have run camps in the Erg Chebbi for two generations. Camels carry the bags the last forty minutes into the dunes and you walk alongside them if you would rather. Dinner is a tagine buried in embers, then drums, then a silence most people find genuinely unfamiliar.',
      'The return follows the Draa through Nkob and Agdz, where a hundred and fifty kasbahs stand along one river of date palms. We buy dates by the kilo at the roadside, drink tea at an argan cooperative run by women from the Ait Ouaouzguite, and are back in Marrakech by early evening.',
    ].join('\n\n'),
    images: [
      'The rammed-earth ksar of Ait Benhaddou catching low afternoon sun',
      'A line of camels crossing the ridge of an Erg Chebbi dune at dawn',
      'Oleander and date palms filling the floor of the Dades valley',
      'The narrow limestone walls of the Todra gorge rising above the road',
      'A tagine lifted out of a bed of embers at a desert camp',
    ],
    itinerary: [
      { title: 'Marrakech over the Tizi n Tichka', description: 'We leave early and climb the Tizi n Tichka at 2,260 m, stopping where the road turns to look back down the whole northern slope. The afternoon is at Ait Benhaddou, walking up through the ksar to the granary at the top once the day-trippers have left.', meals: 'Breakfast, Dinner', accommodation: 'Kasbah guesthouse, Ait Benhaddou' },
      { title: 'Skoura palmeraie and the Valley of Roses', description: 'A short drive to the Skoura oasis, where we walk between irrigation channels to the Amerhidil kasbah, then on through Kelaat M Gouna, the town that supplies most of Morocco with rose water. We reach the Dades in time for the light on the red rock.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Auberge, Dades gorge' },
      { title: 'Dades to the Todra gorge', description: 'A morning walk up a side valley from the Dades to a hamlet where bread is still baked in a shared oven. In the afternoon we drive to Todra, where 300 m limestone walls close to within ten metres of each other over a shallow river.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Riad, Tinghir' },
      { title: 'Into the Erg Chebbi', description: 'East across the hammada to Merzouga, arriving mid-afternoon for tea in the shade. Camels take the bags into the dunes at five, the walk in takes about forty minutes, and you arrive with an hour of light left for the big dune behind camp.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Desert camp, Erg Chebbi' },
      { title: 'Sunrise in the dunes and on to Nkob', description: 'Sunrise from the crest above camp and breakfast in the sand, then out of the erg by four-wheel drive with a stop at the Gnawa village of Khamlia for an hour of music nothing like the tourist version. We drive west into the Draa and sleep in a restored kasbah at Nkob.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Kasbah, Nkob' },
      { title: 'The Draa valley back to Marrakech', description: 'The long and genuinely good drive through Agdz and over the Tizi n Tinififft, date palms on one side and bare rock on the other. We stop at a womens argan cooperative near Taznakht and reach Marrakech in the early evening.', meals: 'Breakfast, Lunch', accommodation: 'Riad Dar Zaman, Marrakech' },
      { title: 'Departure', description: 'A free morning in the medina and transfers to Menara airport. If your flight is late we can add a cookery class in the riad kitchen for a small extra charge.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Six nights accommodation including one night in a private desert camp',
      'All breakfasts, four lunches and five dinners',
      'Private air-conditioned minibus and driver for the whole route',
      'English-speaking Moroccan guide throughout',
      'Camels into and out of the Erg Chebbi, carrying your bags',
      'Guided visits to Ait Benhaddou and the Amerhidil kasbah',
      'Gnawa music evening at Khamlia',
    ],
    excluded: [
      'International flights to and from Marrakech',
      'Travel insurance, compulsory for all travellers',
      'Lunches on days 1 and 7, and dinner on the last night',
      'Tips for the guide and driver',
      'Single room supplement, €160',
    ],
    departures: [18, 46, 74, 95, 130, 207, 235],
  },
  {
    slug: 'imperial-cities-fes-to-marrakech',
    title: 'Imperial Cities: Fes to Marrakech',
    destination: 'morocco',
    duration_days: 9,
    difficulty: 'easy',
    group_size_min: 4,
    group_size_max: 16,
    base_price_cents: 154000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Riad Fes Baraka, Batha quarter, Fes - any time on day one, with a transfer from Fes-Saiss airport included',
    themes: ['cultural', 'food-wine', 'photography'],
    summary:
      'Nine days through Fes, Chefchaouen, Volubilis, Rabat and Marrakech, moving between them by train the way Moroccans do. Two or three nights in each city, so there is time to go back to the place you liked.',
    description: [
      'Four cities have been capital of Morocco at different points, and each kept the architecture of its moment: Roman at Volubilis, Idrisid and Merinid in Fes, Almohad in Rabat, Almoravid and Saadian in Marrakech. Put them in order and you have twelve hundred years of the country inside one week.',
      'Fes gets three nights because it needs them. Fes el Bali has around nine thousand lanes and no cars, and the only way to learn it is slowly, with someone who knows which door is a fourteenth-century madrasa and which is a bakery. We use Yasmine, who grew up two streets from the Chouara tanneries and can get us onto a roof above them.',
      'Between cities we travel by train, which in Morocco is comfortable, punctual and full of people who will talk to you. The exception is the Rif, where we drive up to Chefchaouen for two nights of blue lanes, goat cheese and a walk to the Spanish mosque for the view back over the town.',
      'Marrakech closes the trip with the Ben Youssef madrasa, the Saadian tombs and a morning in the souks, then an evening on the Jemaa el-Fna eating snail soup and grilled aubergine at a stall our guides have been using since before any of us worked here.',
    ].join('\n\n'),
    images: [
      'Tiled courtyard and carved cedar screens at the Bou Inania madrasa in Fes',
      'Dye pits of the Chouara tannery seen from a leather shop roof',
      'A blue-washed staircase and painted doorway in the Chefchaouen medina',
      'Roman columns and the triumphal arch standing in the fields at Volubilis',
      'Night stalls and lantern smoke on the Jemaa el-Fna in Marrakech',
    ],
    itinerary: [
      { title: 'Arrive in Fes', description: 'Transfers from Fes-Saiss airport to a riad in Batha, just inside the Bab Boujloud gate. We meet at seven for a first dinner of pastilla and a walk through the Bou Jeloud gardens while the medina winds down for the night.', meals: 'Dinner', accommodation: 'Riad Fes Baraka, Fes' },
      { title: 'Fes el Bali on foot', description: 'A full day walking the old city from the Talaa Kebira down to the Kairaouine mosque and university, founded in 859 and still teaching. We stop at the Chouara tanneries, the Attarine madrasa and a bissara stall that serves the best two-euro lunch in Morocco.', meals: 'Breakfast, Lunch', accommodation: 'Riad Fes Baraka, Fes' },
      { title: 'Volubilis, Moulay Idriss and Meknes', description: 'A day out of the city to the Roman town of Volubilis, where the mosaics are still in the floors they were laid in. Then the whitewashed hill town of Moulay Idriss, and Meknes for the Bab Mansour gate and the vast granaries Moulay Ismail built for his cavalry.', meals: 'Breakfast, Lunch', accommodation: 'Riad Fes Baraka, Fes' },
      { title: 'Into the Rif to Chefchaouen', description: 'Four hours north through olive country into the foothills of the Rif. Chefchaouen is small enough to learn in an afternoon: the kasbah, the Outa el Hammam square, and a first wander up lanes that are repainted blue every spring.', meals: 'Breakfast, Dinner', accommodation: 'Dar Meziana, Chefchaouen' },
      { title: 'Chefchaouen and the Ras el Maa springs', description: 'A morning walk out along the Ras el Maa stream, where the town still does its washing, and up to the Spanish mosque for the view down over the roofs. The afternoon is free for goat cheese, wool blankets and doing very little.', meals: 'Breakfast', accommodation: 'Dar Meziana, Chefchaouen' },
      { title: 'Chefchaouen to Rabat', description: 'We come down to the coast and swap mountains for the Atlantic. Rabat is the quietest of the imperial cities: the Kasbah des Oudayas above the river mouth, the unfinished Hassan Tower, and a long seafront to walk at sunset.', meals: 'Breakfast, Dinner', accommodation: 'Riad Kalaa, Rabat' },
      { title: 'Rabat to Marrakech by train', description: 'A morning at the Chellah necropolis, where storks nest on Roman and Merinid ruins inside the same walled garden, then the afternoon train south. Four hours in first class with tea from the trolley and the Atlantic plain going past the window.', meals: 'Breakfast', accommodation: 'Riad Dar Zaman, Marrakech' },
      { title: 'Marrakech medina and Jemaa el-Fna', description: 'Ben Youssef madrasa, the Saadian tombs and the souks with a guide in the morning, then a free afternoon for the Majorelle garden or the Yves Saint Laurent museum. In the evening we eat on the Jemaa el-Fna, standing up, at stall number 31.', meals: 'Breakfast, Dinner', accommodation: 'Riad Dar Zaman, Marrakech' },
      { title: 'Departure', description: 'Breakfast on the terrace and transfers to Menara airport. Bags can stay at the riad for anyone on an evening flight.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Eight nights in riads and guesthouses inside the old cities',
      'All breakfasts, three lunches and four dinners',
      'First-class train tickets from Rabat to Marrakech',
      'Private minibus for the Rif and Volubilis sections',
      'Local city guides in Fes, Meknes, Rabat and Marrakech',
      'Every monument entry listed in the itinerary, including Volubilis and the Saadian tombs',
      'Airport transfers on arrival and departure days',
    ],
    excluded: [
      'International flights into Fes and out of Marrakech',
      'Travel insurance, compulsory for all travellers',
      'Meals not listed above, budget around €15 a day',
      'Tips for guides and drivers',
      'Single room supplement, €240',
    ],
    departures: [25, 60, 102, 158, 214, 263],
  },
  {
    slug: 'albanian-alps-theth-to-valbona',
    title: 'Albanian Alps: Theth to Valbona',
    destination: 'albania',
    duration_days: 7,
    difficulty: 'challenging',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 98000,
    status: 'published',
    is_featured: 1,
    meeting_point: 'Hotel Colosseo, Sheshi Skenderbeu, Shkoder - 19:00 on day one, with transfers from Tirana airport included',
    themes: ['hiking-trekking', 'photography', 'slow-travel'],
    summary:
      'The best week of walking in the Balkans: the Valbona Pass crossing, the Grunas waterfall, and the Koman ferry through a flooded canyon on the way home. Guesthouse beds every night, and more food than any group has ever finished.',
    description: [
      'The Accursed Mountains got their name from travellers who had to cross them rather than from anyone who lives there. The limestone runs to 2,600 m, the valleys are deep and narrow, and until the road tunnel opened in 2022 Theth was cut off by snow for four months of the year. That isolation is exactly why the walking is still this good.',
      'The centrepiece is the crossing from Theth to Valbona over the pass at 1,795 m. It is five to six hours, about 1,000 m of ascent on a rough but obvious mule path, and there is a coffee shack near the top run by a man who carries the beans up on his back. Coming over the lip and seeing the Valbona valley open below you is the moment people remember.',
      'Around it we walk to the Grunas waterfall and the Blue Eye of Theth, visit the lock-in tower where families sheltered during blood feuds under the Kanun code, and follow the Valbona riverbed up to Rrogam where the road gives out. Nights are in family guesthouses: raki on arrival, fresh cheese, cornbread, honey from the hives outside, and lamb if you stay long enough.',
      'We come home the good way, by boat. The Koman ferry runs three hours through a canyon flooded by a hydroelectric dam in the 1970s, with walls close enough on either side that it feels like a fjord. It is a working boat, not a tour boat, and half the passengers are villagers with shopping.',
    ].join('\n\n'),
    images: [
      'The stone church and shingle roofs of Theth village under limestone walls',
      'Walkers on the switchback path below the Valbona Pass in morning light',
      'The Grunas waterfall dropping into a pool of meltwater',
      'A traditional lock-in tower with narrow slit windows in Theth',
      'The Koman ferry moving between canyon walls on the flooded Drin river',
    ],
    itinerary: [
      { title: 'Arrive in Shkoder', description: 'Transfers from Tirana airport up to Shkoder, the old capital of the north, where the Rozafa castle sits above three rivers meeting. We meet at seven for a briefing and dinner, then a walk along the pedestrianised Kole Idromeno street where the whole town takes its evening.', meals: 'Dinner', accommodation: 'Hotel Colosseo, Shkoder' },
      { title: 'Shkoder to Theth', description: 'Three hours by minibus, the last part through the tunnel that replaced the old Qafa e Thores road. We arrive for lunch and walk out in the afternoon to the Blue Eye of Theth, a spring pool so cold that nobody stays in longer than eight seconds.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Family guesthouse, Theth' },
      { title: 'Grunas waterfall and the Theth valley', description: 'An easy warm-up day: up the valley to the Grunas waterfall and the canyon below it, then back through the hamlets to the church and the lock-in tower, where our guide explains the Kanun and why a building like that existed. Afternoon free to sleep or read.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Family guesthouse, Theth' },
      { title: 'Over the Valbona Pass', description: 'The big day. We leave at seven to get the climb done before the heat, five to six hours and 1,000 m of ascent to the pass at 1,795 m, with coffee at the shack near the top. The descent into Valbona is long and rocky, and there is beer at the bottom.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Valbona' },
      { title: 'Valbona to Rrogam and the riverbed', description: 'A gentler day walking the white riverbed up to Rrogam, the last settlement in the valley, where the shepherds huts are still used in summer. Four hours with almost no ascent, and time in the afternoon to swim in a pool of the Valbona river if you can stand the temperature.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Valbona' },
      { title: 'The Koman ferry to Shkoder', description: 'A minibus down to Fierze for the morning ferry, then three hours through the flooded Drin canyon with villagers, shopping and the occasional goat. From Koman it is ninety minutes back to Shkoder, and a last dinner of tave kosi and Shkoder lake carp.', meals: 'Breakfast, Dinner', accommodation: 'Hotel Colosseo, Shkoder' },
      { title: 'Departure', description: 'Transfers to Tirana airport, about two hours. Anyone with a late flight can add a stop at the Bunk Art museum in Tirana, which we are happy to arrange.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Six nights accommodation, four of them in family-run mountain guesthouses',
      'All breakfasts, four packed lunches and six dinners',
      'English-speaking Albanian mountain guide for the whole week',
      'Koman ferry tickets and all minibus transfers, including Tirana airport',
      'Luggage transfer by road from Theth to Valbona so you walk with a daypack',
      'Entry to the Theth lock-in tower and the Rozafa castle',
      'Emergency satellite communicator carried by the guide',
    ],
    excluded: [
      'International flights to and from Tirana',
      'Travel insurance with mountain walking cover, compulsory',
      'Lunch on days 1, 6 and 7',
      'Drinks other than water at meals',
      'Tips for the guide and guesthouse families',
    ],
    departures: [5, 19, 33, 278, 292],
  },
  {
    slug: 'albanian-riviera-saranda-to-vlora',
    title: 'Albanian Riviera: Saranda to Vlora',
    destination: 'albania',
    duration_days: 6,
    difficulty: 'easy',
    group_size_min: 4,
    group_size_max: 14,
    base_price_cents: 86000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Hotel Gjirokastra, Old Bazaar, Gjirokaster - 18:00 on day one, with transfers from Tirana airport included',
    themes: ['coastal-islands', 'cultural', 'food-wine'],
    summary:
      'Six days down the Ionian coast from the stone town of Gjirokaster to the Llogara pass, taking in Butrint, the Ksamil islands and the villages above Himara. Swimming every day, and lunch that never takes less than two hours.',
    description: [
      'The stretch of coast between Saranda and Vlora is the last piece of undeveloped Mediterranean shoreline in Europe, and it will not stay that way. Olive terraces drop straight into water that turns from green to deep blue about thirty metres out, and the villages behind the beaches - Qeparo, Old Himara, Dhermi - are still stone, still lived in, and still cooking with what they grow.',
      'We start inland at Gjirokaster, the stone town that gave both Enver Hoxha and Ismail Kadare to Albania, where the houses look like small fortresses because that is what they were. From there it is an hour to the Blue Eye spring, where water comes up out of the ground at six cubic metres a second and nobody has yet found the bottom.',
      'Butrint takes a full morning and deserves it: a Greek theatre, a Roman forum, a Byzantine baptistery with a mosaic floor kept under sand for its own protection, and a Venetian tower, all in one lagoon full of egrets. Come at nine and you will have it more or less to yourself.',
      'The last two days follow the coast road north through Porto Palermo and Himara to Dhermi, then over the Llogara pass, where the road climbs to 1,027 m in a series of hairpins and the whole Riviera lays out behind you. We stop at the top for grilled lamb and the view before dropping into Vlora.',
    ].join('\n\n'),
    images: [
      'Stone roofs of Gjirokaster stacked below the castle walls',
      'The Byzantine baptistery mosaic and lagoon at Butrint',
      'Turquoise shallows and small islands off Ksamil',
      'Olive terraces above the village of Qeparo dropping to the Ionian sea',
      'Hairpins of the Llogara pass road with the Riviera coast far below',
    ],
    itinerary: [
      { title: 'Arrive in Gjirokaster', description: 'Transfer from Tirana, about three and a half hours south through the Drino valley. We meet in the Old Bazaar for a walk up to the castle and its strange collection of artillery, then dinner of qifqi rice balls and lamb in a house that has been a restaurant for forty years.', meals: 'Dinner', accommodation: 'Hotel Gjirokastra, Gjirokaster' },
      { title: 'The Blue Eye and down to Saranda', description: 'A morning wandering the stone lanes and the Skenduli house, an eighteenth-century merchant home still owned by the family. Then the Blue Eye spring on the way south, and Saranda by mid-afternoon with time to swim before dinner on the promenade.', meals: 'Breakfast, Dinner', accommodation: 'Hotel Butrinti, Saranda' },
      { title: 'Butrint and the Ksamil islands', description: 'We are at Butrint for opening, walking the site with an archaeologist for two hours before the coaches arrive. The afternoon is at Ksamil, where four small islands sit close enough to swim to, and the seafood restaurants along the shore serve mussels farmed in the lagoon behind them.', meals: 'Breakfast, Lunch', accommodation: 'Hotel Butrinti, Saranda' },
      { title: 'Up the coast to Himara', description: 'North on the coast road with stops at the Ottoman fortress on the Porto Palermo peninsula and at Borsh for the longest beach on the Riviera. We stay two nights in Himara and walk up to the old village on the hill above it for sunset.', meals: 'Breakfast, Dinner', accommodation: 'Guesthouse, Himara' },
      { title: 'Qeparo, olive terraces and a free afternoon', description: 'A three-hour walk through the abandoned upper village of Qeparo and back down through the olive groves to the sea, with a stop at a family press that still bottles by hand. The afternoon is deliberately empty: swim, sleep, or take the boat to Gjipe beach.', meals: 'Breakfast, Lunch', accommodation: 'Guesthouse, Himara' },
      { title: 'Dhermi, the Llogara pass and Vlora', description: 'A last swim at Dhermi, then the climb over Llogara at 1,027 m for lunch under the pines with the whole coast behind us. We drop to Vlora, where the independence declaration was signed in 1912, and continue to Tirana airport for evening flights.', meals: 'Breakfast, Lunch', accommodation: null },
    ],
    included: [
      'Five nights in family-run hotels and guesthouses, all with sea or old-town views',
      'All breakfasts, three lunches and three dinners',
      'Private minibus and English-speaking Albanian guide throughout',
      'Archaeologist-led tour of Butrint, entry included',
      'Entry to Gjirokaster castle, the Skenduli house and the Blue Eye reserve',
      'Boat transfer to the Ksamil islands',
      'Airport transfers from and to Tirana',
    ],
    excluded: [
      'International flights to and from Tirana',
      'Travel insurance, compulsory for all travellers',
      'Lunches and dinners not listed, budget around €18 a day',
      'Optional boat trip to Gjipe beach, €20 per person',
      'Single room supplement, €130',
    ],
    departures: [8, 29, 50, 258, 279, 300],
  },
  {
    slug: 'lake-ohrid-and-the-galichica-ridge',
    title: 'Lake Ohrid & the Galichica Ridge',
    destination: 'north-macedonia',
    duration_days: 6,
    difficulty: 'moderate',
    group_size_min: 4,
    group_size_max: 14,
    base_price_cents: 89000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Villa Forum, Kosta Abrasevic street, Ohrid old town - 18:30 on day one, with transfers from Ohrid or Skopje airport included',
    themes: ['hiking-trekking', 'wildlife', 'slow-travel'],
    summary:
      'Six days around a three-million-year-old lake, with a ridge walk that puts Ohrid and Prespa in view at the same time and a morning among the pelicans at Stenje. Byzantine frescoes, lake trout, and a monastery you arrive at by boat.',
    description: [
      'Lake Ohrid is one of the oldest and deepest lakes on Earth, and around two hundred species live in it that live nowhere else. The town on its northern shore has been continuously inhabited for two and a half thousand years and stacks a fortress, a Roman theatre, an Ottoman bazaar and around forty churches onto one headland.',
      'Galichica National Park runs south along the limestone ridge that separates Ohrid from Lake Prespa, twenty metres higher and separated by nothing but rock. Water moves between them underground through karst channels and surfaces again at Sveti Naum, which is why the springs there are so cold. From the ridge at Magaro, 2,254 m, you see both lakes at once.',
      'Prespa is the quieter half of the trip. The reed beds at Stenje hold Dalmatian pelicans, the largest freshwater bird in Europe, with a wingspan over three metres, and the colony has grown steadily since the park tightened its protections. We go early with a local ornithologist and a scope.',
      'The food is worth planning around. Ohrid trout is protected and what you are served is usually farmed or from Prespa, and it is still excellent grilled with nothing but oil and lemon. Add ajvar made in October, tavce gravce baked in clay, and the local Vranec that costs less than the water.',
    ].join('\n\n'),
    images: [
      'The church of Sveti Jovan Kaneo on its cliff above Lake Ohrid',
      'Frescoed interior of Sveti Naum monastery near the Albanian border',
      'The Galichica ridge path with Lake Prespa visible on the far side',
      'Dalmatian pelicans on the reed beds at Stenje on Lake Prespa',
      'Grilled trout and ajvar on a table above the lake at sunset',
    ],
    itinerary: [
      { title: 'Arrive in Ohrid', description: 'Transfers from Ohrid airport, or three hours by road from Skopje. We meet at half past six on the terrace above the harbour for a briefing and a first dinner of tavce gravce and lake fish, then a short walk up to Sveti Jovan Kaneo for the light going off the water.', meals: 'Dinner', accommodation: 'Villa Forum, Ohrid' },
      { title: 'Ohrid old town on foot', description: 'A full morning with a local historian: the Samuel fortress, the antique theatre still used for concerts, the church of Sveti Kliment i Panteleimon and the Plaosnik excavation. In the afternoon a boatbuilder shows us how the local flat-bottomed boats are still made from a single template.', meals: 'Breakfast, Lunch', accommodation: 'Villa Forum, Ohrid' },
      { title: 'The Galichica ridge to Magaro', description: 'The main walking day: a transfer up to the Livada saddle, then four to five hours along the ridge to Magaro at 2,254 m with both lakes in sight for most of it. Griffon vultures work the thermals on the Prespa side almost every day in summer.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Ljubanista' },
      { title: 'Prespa, pelicans and Golem Grad', description: 'An early start with an ornithologist at the Stenje reed beds to look for Dalmatian pelicans, then a boat to Golem Grad, the uninhabited island Macedonians call snake island for good reason, with Roman foundations and a colony of cormorants.', meals: 'Breakfast, Lunch', accommodation: 'Guesthouse, Ljubanista' },
      { title: 'Sveti Naum and back by boat', description: 'A morning at the Sveti Naum monastery, where the springs come up through the sand in a shallow lagoon you cross in a rowing boat and the tenth-century church still has its frescoes. In the afternoon we take the boat the length of the lake back to Ohrid, about ninety minutes.', meals: 'Breakfast, Dinner', accommodation: 'Villa Forum, Ohrid' },
      { title: 'Departure', description: 'Free morning in the old bazaar for paper made the Ohrid way and a last coffee on the promenade, then transfers to Ohrid or Skopje airport. Skopje transfers leave at nine to be safe.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Five nights in family-run guesthouses in Ohrid and Ljubanista',
      'All breakfasts, four lunches and three dinners',
      'English-speaking Macedonian guide throughout',
      'Local historian in Ohrid and an ornithologist at Prespa, with a spotting scope',
      'Galichica National Park fees and all transfers, including airport pickups',
      'Boat to Golem Grad island and the return crossing from Sveti Naum to Ohrid',
      'Entry to Sveti Naum, Sveti Jovan Kaneo, Plaosnik and the antique theatre',
    ],
    excluded: [
      'International flights to Ohrid or Skopje',
      'Travel insurance, compulsory for all travellers',
      'Lunch on days 1 and 6, and dinner on days 2, 4 and 6',
      'Drinks with meals',
      'Single room supplement, €120',
    ],
    departures: [15, 43, 71, 251, 272, 293],
  },
  {
    slug: 'jordan-trail-dana-to-petra',
    title: 'Jordan Trail: Dana to Petra',
    destination: 'jordan',
    duration_days: 10,
    difficulty: 'challenging',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 215000,
    status: 'published',
    is_featured: 1,
    meeting_point: 'Hotel Toledo, Jabal Amman, Amman - 18:00 on day one, with transfers from Queen Alia airport included',
    themes: ['hiking-trekking', 'desert', 'cultural'],
    summary:
      'The finest four days of the Jordan Trail, walking from the Dana Biosphere Reserve to Petra and arriving at the Monastery on foot from above. Bedouin camps, Roman Jerash and a last night in Wadi Rum.',
    description: [
      'The Jordan Trail runs 675 km from Umm Qais in the north to Aqaba on the Red Sea. The Dana to Petra section is the one everybody who walks the whole thing talks about afterwards, and it is the reason this trip exists: four days through sandstone canyons, juniper forest and open desert, finishing at the back door of the most famous archaeological site in the Middle East.',
      'You walk between five and seven hours a day with a daypack. Everything else goes ahead by pickup or mule to the next camp, which is set up before you arrive by the Bedouin families we work with in Feynan, Ras al-Feid and Little Petra. Nights are in tents or under stone shelters, with dinner cooked over fire and, at least twice, in a zarb pit dug into the sand.',
      'The reward at the end is arriving at Petra the way the Nabataeans would have: over the ridge at Umm Ad-Dami, down past the Monastery and into the city from above, at eight in the morning, before the coaches from Amman have got through the Siq. We then give Petra a full second day, including the High Place of Sacrifice.',
      'Either side of the trek we build in the rest of the country: Jerash, the best preserved Roman provincial city outside Italy, the King Highway south through Madaba and Kerak, and a final night in a Wadi Rum camp run by a family from the Zalabia tribe.',
    ].join('\n\n'),
    images: [
      'The Dana Biosphere Reserve dropping in terraces towards Wadi Araba',
      'A Bedouin camp under sandstone cliffs on the trail near Ras al-Feid',
      'The facade of the Monastery at Petra seen from the ridge above',
      'The oval forum and colonnaded street of Roman Jerash at first light',
      'Sandstone jebels rising out of the red floor of Wadi Rum',
    ],
    itinerary: [
      { title: 'Arrive in Amman', description: 'Transfers from Queen Alia airport to a hotel in Jabal Amman, on the hill above the Rainbow Street cafes. We meet at six for the trek briefing and a kit check, then dinner of mezze and shish taouk at a place with a view over the whole downtown.', meals: 'Dinner', accommodation: 'Hotel Toledo, Amman' },
      { title: 'Jerash and Ajloun', description: 'North for the day to Jerash, where the colonnaded street still shows the ruts of Roman cartwheels, then the twelfth-century Ajloun castle built by Saladin nephew to watch the Jordan valley. Back in Amman for the evening and an early night.', meals: 'Breakfast, Lunch', accommodation: 'Hotel Toledo, Amman' },
      { title: 'The King Highway to Dana', description: 'The old road south rather than the desert highway: Madaba for the sixth-century mosaic map of the Holy Land, Mount Nebo for the view over the Dead Sea, and Kerak castle. We reach the stone village of Dana at dusk, hanging over a reserve that drops 1,200 m to Wadi Araba.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Dana village guesthouse' },
      { title: 'Trek day one: Dana to Wadi Malaga', description: 'Down through the Dana reserve on the old shepherd path, losing height steadily through juniper and oak into acacia country. Six hours with 900 m of descent, ending at a camp in Wadi Malaga where the walls glow orange for the last hour of light.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Wadi Malaga' },
      { title: 'Trek day two: Wadi Malaga to Ras al-Feid', description: 'The hottest section of the route, out across open ground on the edge of Wadi Araba before climbing back onto the escarpment. Five hours with an early start and a long lunch in shade. Camp is on a shoulder with a view west into Israel and Palestine.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Ras al-Feid' },
      { title: 'Trek day three: Ras al-Feid to Shakret Msaied', description: 'The best walking of the four days, through the sandstone domes and narrow siqs that make this landscape look like Wadi Rum with trees. Seven hours, some easy scrambling, and a camp among white sandstone boulders where dinner comes out of a zarb pit.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Shakret Msaied' },
      { title: 'Trek day four: into Little Petra', description: 'A shorter day, four hours over the ridge and down into Siq al-Barid, the small Nabataean settlement known as Little Petra, where a painted ceiling with grapevines survives in one of the biclinia. We sleep in a Bedouin camp just outside it.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Little Petra' },
      { title: 'The back route into Petra', description: 'Up and over the ridge at first light on the trail the Nabataeans used, arriving above the Monastery around eight while it is still cool and nearly empty. Then down the eight hundred steps into the city, past the Royal Tombs, the theatre and the Treasury, and out through the Siq.', meals: 'Breakfast, Lunch', accommodation: 'Hotel, Wadi Musa' },
      { title: 'Petra second look and Wadi Rum', description: 'A second morning in Petra for the High Place of Sacrifice and the quieter side wadis, then two hours south to Wadi Rum. Four-wheel drive to camp through the Khazali siq, sunset from a dune, and a night in a camp run by a Zalabia family.', meals: 'Breakfast, Dinner', accommodation: 'Desert camp, Wadi Rum' },
      { title: 'Departure', description: 'Sunrise over the jebels, breakfast in camp, then transfers to Aqaba for a short flight or four hours by road to Queen Alia airport in Amman. Both options are included.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Nine nights: three hotels, one village guesthouse, four Bedouin camps and one desert camp',
      'All breakfasts, eight lunches and seven dinners',
      'Certified Jordan Trail guide and a Bedouin support team on the trek',
      'All camping equipment, tents and mattresses, plus baggage transfer between camps',
      'Two-day Petra ticket and entry to Jerash, Ajloun, Kerak and Little Petra',
      'Four-wheel drive transfer and a guided sunset run in Wadi Rum',
      'All transport including airport transfers at both ends',
      'Dana Biosphere Reserve and Wadi Rum protected area fees',
    ],
    excluded: [
      'International flights to and from Jordan',
      'Jordan visa, free of charge with the Jordan Pass which we help you buy',
      'Travel insurance with trekking cover to 2,000 m, compulsory',
      'Lunch on days 1, 3 and 10, dinner on days 8 and 10',
      'Tips for the guide and the Bedouin team, budget around €60 for the week',
    ],
    departures: [21, 49, 77, 105, 189, 217, 245],
  },
  {
    slug: 'wadi-rum-desert-nights',
    title: 'Wadi Rum Desert Nights',
    destination: 'jordan',
    duration_days: 5,
    difficulty: 'easy',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 112000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Hotel Kempinski lobby, Aqaba corniche - 17:00 on day one, or King Hussein airport arrivals with a name board',
    themes: ['desert', 'photography', 'cultural'],
    summary:
      'A short, easy trip built around two nights in Wadi Rum with a Zalabia family and one long day at Petra. Rock bridges, Thamudic inscriptions, zarb cooked underground and stars you can read a map by.',
    description: [
      'Wadi Rum is a protected area of about 720 square kilometres, and almost none of it is the sand people expect. It is sandstone and granite jebels standing 700 to 800 m out of a flat red floor, with siqs, rock bridges and springs hidden in the folds between them. T E Lawrence called it vast, echoing and god-like, and for once the quote is accurate.',
      'We spend two full nights in the desert with a family from the Zalabia tribe, who have lived in Rum village for generations and run the camp themselves. Days mix four-wheel drive with walking: the Burdah rock bridge, the Khazali siq with its Thamudic and Nabataean inscriptions, the Lawrence spring, and one long walk through Rum canyon with nothing motorised in sight.',
      'Evenings are the point. Dinner is zarb, meat and vegetables cooked in a pit of embers under the sand for three hours, and it is dug up in front of you. After it there is tea, and then there is the sky, which at this latitude and with no light within forty kilometres is worth staying up for.',
      'One day is given to Petra, driving up early and walking the Siq before the heat. It is not enough time to see everything, and we say so honestly - but it is enough for the Treasury, the theatre, the Royal Tombs and the climb to the Monastery, which is what most people come for.',
    ].join('\n\n'),
    images: [
      'The Burdah rock bridge arching against the sky in Wadi Rum',
      'Thamudic inscriptions carved into the wall of the Khazali siq',
      'A zarb pit being uncovered at a Bedouin camp after dark',
      'The Treasury at Petra framed by the last narrow turn of the Siq',
      'Camel tracks crossing red sand between two granite jebels at sunrise',
    ],
    itinerary: [
      { title: 'Arrive in Aqaba', description: 'Transfers from King Hussein airport or the Israeli border to a hotel on the Aqaba corniche. We meet at five for a briefing, then a fish dinner in the old souk and, for anyone still awake, a swim in the Red Sea after dark.', meals: 'Dinner', accommodation: 'Hotel, Aqaba' },
      { title: 'Into Wadi Rum', description: 'An hour north to Rum village, where our hosts take over. The afternoon is four-wheel drive to the Khazali siq, the Lawrence spring and the red dunes at Umm Ulaydiyya, finishing on a high point for sunset. Camp is under a cliff twenty minutes from the nearest track.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Wadi Rum' },
      { title: 'Walking day and the Burdah bridge', description: 'A full day on foot: through Rum canyon in the morning, lunch in shade with tea made on a fire, then the scramble up to the Burdah rock bridge in the afternoon for anyone with a head for heights. Zarb for dinner, dug up at eight.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Bedouin camp, Wadi Rum' },
      { title: 'Petra', description: 'Away at six to be at the Petra gate when it opens. Down the Siq, an hour at the Treasury while the light is on it, then the street of facades, the theatre and the eight hundred steps to the Monastery. We are back in Aqaba for a late dinner.', meals: 'Breakfast, Lunch', accommodation: 'Hotel, Aqaba' },
      { title: 'Departure', description: 'A free morning for the Red Sea, with snorkelling gear available at the hotel, then transfers to King Hussein airport or the border. Bags can be left at reception until you leave.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Four nights: two in an Aqaba hotel, two in a Bedouin camp in Wadi Rum',
      'All breakfasts, three lunches and four dinners including one zarb',
      'English-speaking Jordanian guide plus Bedouin hosts in Wadi Rum',
      'All four-wheel drive transport inside the protected area',
      'One-day Petra entry ticket',
      'Wadi Rum protected area fee',
      'Airport and border transfers at Aqaba',
    ],
    excluded: [
      'International flights to Aqaba or Amman',
      'Jordan visa or Jordan Pass',
      'Travel insurance, compulsory for all travellers',
      'Lunch on days 1 and 5',
      'Optional camel ride at Wadi Rum, €25 per person',
    ],
    departures: [4, 32, 60, 88, 116, 172, 200, 228],
  },
  {
    slug: 'durmitor-peaks-and-the-tara-canyon',
    title: 'Durmitor Peaks & the Tara Canyon',
    destination: 'montenegro',
    duration_days: 7,
    difficulty: 'moderate',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 112000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Hotel Soa, Zabljak - 18:00 on day one, with transfers from Podgorica airport included',
    themes: ['hiking-trekking', 'photography', 'wildlife'],
    summary:
      'A week in the Durmitor massif walking to glacial lakes and up Bobotov Kuk, with a day rafting the deepest canyon in Europe. Mountain huts, kajmak for breakfast and a finish at the Ostrog monastery.',
    description: [
      'Durmitor is a limestone massif with 48 peaks over 2,000 m and eighteen glacial lakes scattered between them, and the whole of it sits inside a national park roughly the size of a London borough. Everything starts from Zabljak, the highest town in the Balkans at 1,450 m, which means you are walking within twenty minutes of breakfast.',
      'We build up over the week. The Black Lake circuit and the Ćurevac viewpoint on day two, the Skrcka lakes and the Sedlo pass mid-week, then Bobotov Kuk at 2,523 m, which involves an hour of easy scrambling on good rock with a fixed cable on one short section. Anyone who would rather not do the summit has an equally good walk to the Zeleni Vir.',
      'The Tara canyon is the other half of the park. It is 1,300 m deep at its most dramatic, second in the world only to the Grand Canyon, and the best way to understand it is from water level. We raft the Brstanovica to Scepan Polje section, which is grade two to three and genuinely fun rather than frightening.',
      'Food is mountain food and there is a lot of it. Kajmak, a soft clotted cream that arrives with everything, cicvara made from cornmeal, lamb from under a sac, and forest honey sold at the roadside in old brandy bottles. We finish at Ostrog, the monastery built into a vertical cliff face, on the way back to Podgorica.',
    ].join('\n\n'),
    images: [
      'Crno Jezero reflecting the pine forest and the Medjed peak behind it',
      'The summit ridge of Bobotov Kuk with limestone falling away on both sides',
      'The Durdevica Tara bridge spanning the canyon far above the river',
      'A raft running through green water in the Tara canyon',
      'Ostrog monastery built into a white cliff face above the Zeta valley',
    ],
    itinerary: [
      { title: 'Arrive in Zabljak', description: 'Transfers from Podgorica, two and a half hours up through the Moraca canyon with a stop at the monastery halfway. We meet at six for a briefing and a first dinner of lamb under the sac, which has to be ordered three hours in advance and is worth it.', meals: 'Dinner', accommodation: 'Hotel Soa, Zabljak' },
      { title: 'Black Lake and the Curevac viewpoint', description: 'An easy first day to get the legs going: the circuit of Crno Jezero through the black pine forest, then up to the Curevac viewpoint where the Tara canyon opens 1,000 m below you. Four hours in total with plenty of stopping.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Hotel Soa, Zabljak' },
      { title: 'The Skrcka lakes', description: 'A longer day into the heart of the massif, over the Sedlo pass and down to the two Skrcka lakes in a bowl surrounded by walls on three sides. Six hours, 700 m of ascent, and a mountain hut at the lakes where the warden makes coffee on a wood stove.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Mountain hut, Skrcka lakes' },
      { title: 'Bobotov Kuk', description: 'The summit day, five to six hours up from the hut with an hour of easy scrambling near the top and one short cabled section. From 2,523 m you can see the Tara canyon, the Piva lake and, on a clear day, the Adriatic. The alternative route to Zeleni Vir is just as good and half the effort.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Hotel Soa, Zabljak' },
      { title: 'Rafting the Tara canyon', description: 'Down to the river for the classic Brstanovica to Scepan Polje run, three hours of grade two and three water with a break to swim where a waterfall comes in from the left. Lunch is at the takeout, and we stop at the Durdevica Tara bridge on the way back.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Hotel Soa, Zabljak' },
      { title: 'Ice cave, then south to Podgorica', description: 'A last walk up to the Ledena Pecina, the ice cave under Obla Glava that keeps its formations all summer, then the drive south with a stop at Ostrog monastery, cut into a cliff and visited by Orthodox, Catholic and Muslim pilgrims alike.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Hotel, Podgorica' },
      { title: 'Departure', description: 'Transfers to Podgorica airport, fifteen minutes away, or to Tivat and the coast for anyone extending. We are happy to book onward transfers to Kotor at cost.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Six nights: five in hotels and one in a mountain hut at the Skrcka lakes',
      'All breakfasts, five lunches and six dinners',
      'UIAA-qualified Montenegrin mountain guide throughout',
      'Durmitor National Park entry fees for every walking day',
      'Half-day rafting on the Tara with wetsuit, helmet and licensed river guides',
      'All transfers including Podgorica airport at both ends',
      'Entry to the Ostrog monastery complex and the Ledena Pecina',
    ],
    excluded: [
      'International flights to Podgorica or Tivat',
      'Travel insurance with mountain walking cover, compulsory',
      'Lunch on days 1 and 7',
      'Drinks with meals and anything from the hut bar',
      'Single room supplement, €170, not available in the mountain hut',
    ],
    departures: [2, 16, 30, 285, 299],
  },
  {
    slug: 'bay-of-kotor-slow-travel',
    title: 'Bay of Kotor Slow Travel',
    destination: 'montenegro',
    duration_days: 4,
    difficulty: 'easy',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 68000,
    status: 'draft',
    is_featured: 0,
    meeting_point: 'Palace Jelena, Perast waterfront - 17:00 on day one, with transfers from Tivat airport included',
    themes: ['slow-travel', 'coastal-islands', 'food-wine'],
    summary:
      'Four unhurried days on the Bay of Kotor: Perast at dawn, oysters at Ljuta, the Vrmac ridge and the city walls before the cruise ships arrive. A short break for people who would rather look at one place properly.',
    description: [
      'This is our first deliberately short trip, and it is built around a simple observation: almost everybody who comes to the Bay of Kotor sees it between ten and four, which is the only part of the day when it is unpleasant. Stay in Perast, get up early, and you have the whole bay to yourself twice a day.',
      'We stay three nights in one place, a stone house on the Perast waterfront with twelve rooms and no lift. From there everything is either a walk or a ten-minute boat: Our Lady of the Rocks, the artificial island built by fishermen dropping stones for two hundred years; the oyster and mussel beds at Ljuta; the abandoned village of Gornji Stoliv up in the chestnut forest above the water.',
      'One morning we start at half past five and walk the 1,350 steps up the Kotor city walls to the Saint John fortress for sunrise, coming down for breakfast before the first tender lands. Another day is the Vrmac ridge, an old Austro-Hungarian military road with the bay on one side and Tivat on the other.',
      'Food follows the bay: buzara cooked with the mussels farmed two hundred metres away, black risotto, Njegusi prosciutto smoked in the village on the mountain behind, and the last Montenegrin oyster season stretching from spring into autumn. Nothing on this trip starts before eight except the two mornings that are worth it.',
    ].join('\n\n'),
    images: [
      'Our Lady of the Rocks island church seen from the Perast waterfront',
      'The Kotor city walls climbing the mountainside above the old town',
      'Oyster and mussel lines floating in the bay at Ljuta',
      'Stone houses and a bell tower in the abandoned village of Gornji Stoliv',
      'Evening light on the karst wall above the bay near Risan',
    ],
    itinerary: [
      { title: 'Arrive in Perast', description: 'Transfers from Tivat airport, thirty minutes around the bay. We meet at five on the terrace for a glass of Vranac and a walk along the waterfront, sixteen palaces and seventeen churches in a village of three hundred people, then dinner of buzara at a table over the water.', meals: 'Dinner', accommodation: 'Palace Jelena, Perast' },
      { title: 'Our Lady of the Rocks and the oyster beds', description: 'A boat to the island church in the morning, where every ex-voto on the walls was left by a sailor who made it home, and the story of the two hundred year rock-dropping tradition that built the island. In the afternoon, oysters and mussels straight off the lines at Ljuta.', meals: 'Breakfast, Lunch', accommodation: 'Palace Jelena, Perast' },
      { title: 'Kotor walls at dawn and the Vrmac ridge', description: 'Up at half past five for the 1,350 steps to the Saint John fortress and sunrise over the bay, then breakfast in Kotor before the cruise tenders arrive. The afternoon is a gentle walk along the Vrmac ridge on the old Austro-Hungarian military road.', meals: 'Breakfast, Dinner', accommodation: 'Palace Jelena, Perast' },
      { title: 'Gornji Stoliv and departure', description: 'A last short walk up through the chestnut forest to Gornji Stoliv, abandoned in the 1960s when the families moved down to the water, with one church still in use once a year. Transfers to Tivat or Dubrovnik airport from midday.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Three nights in a restored stone palace on the Perast waterfront',
      'All breakfasts, one lunch and two dinners',
      'English-speaking Montenegrin guide throughout',
      'Private boat to Our Lady of the Rocks and to the Ljuta oyster beds',
      'Kotor city walls entry and the Perast maritime museum',
      'Tivat airport transfers on arrival and departure',
    ],
    excluded: [
      'International flights to Tivat, Podgorica or Dubrovnik',
      'Travel insurance, compulsory for all travellers',
      'Meals not listed above',
      'Dubrovnik airport transfer, €60 per person',
    ],
    departures: [],
  },
  {
    slug: 'crete-samaria-and-the-white-mountains',
    title: 'Crete: Samaria & the White Mountains',
    destination: 'greece',
    duration_days: 9,
    difficulty: 'challenging',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 158000,
    status: 'published',
    is_featured: 0,
    meeting_point: 'Casa Delfino, Theotokopoulou street, Chania old town - 19:00 on day one, with transfers from Chania airport included',
    themes: ['hiking-trekking', 'coastal-islands', 'food-wine'],
    summary:
      'Nine days through the gorges of the Lefka Ori and along the Libyan Sea coast path, staying in villages the road does not reach. Samaria, Aradena and Imbros, plus three nights in Chania at either end.',
    description: [
      'The White Mountains fill the western third of Crete and hold snow into June, which is why the gorges below them still have water when everything else on the island has dried out. Samaria is the famous one, 16 km from the Omalos plateau to the Libyan Sea and the longest gorge in Europe, but the quieter ones are the reason to spend a week here.',
      'The south-west coast between Agia Roumeli and Loutro has no road. Villages are supplied by a small ferry that runs once or twice a day, and the only way to walk between them is the coast path, part of the E4, which climbs over headlands and drops back to shingle beaches with nobody on them. We use the ferry for our bags and walk with daypacks.',
      'Aradena gorge is the best day of the trip: a descent on iron rungs bolted to the rock, then two hours between walls that close to four metres apart, coming out at Marmara beach where a taverna does grilled octopus and there is nothing else at all. Imbros, on the last walking day, is shorter and gentler and ends with lunch in Komitades.',
      'Chania bookends the week. It is a Venetian harbour with an Ottoman quarter behind it, a covered market from 1913, and the best raki culture on the island - order one and it comes free with something to eat, every time, and it is considered strange to refuse.',
    ].join('\n\n'),
    images: [
      'The Iron Gates of the Samaria gorge with walls three metres apart',
      'The E4 coast path above the Libyan Sea between Loutro and Marmara',
      'Whitewashed houses of Loutro around a bay with no road to it',
      'Iron rungs bolted into rock on the descent into the Aradena gorge',
      'The Venetian lighthouse at the entrance to Chania old harbour',
    ],
    itinerary: [
      { title: 'Arrive in Chania', description: 'Transfers from Chania airport to a hotel inside the Venetian old town, two streets from the harbour. We meet at seven for a briefing, then dinner of dakos, snails in rosemary and lamb with stamnagathi greens, with the first raki of the trip on the house.', meals: 'Dinner', accommodation: 'Casa Delfino, Chania' },
      { title: 'Chania and the Akrotiri peninsula', description: 'A morning in the covered market and the tanners quarter at Halepa with a food guide, tasting graviera, mizithra and the local wild greens. In the afternoon we drive out to Akrotiri for the Gouverneto and Katholiko monasteries and a swim at Stavros.', meals: 'Breakfast, Lunch', accommodation: 'Casa Delfino, Chania' },
      { title: 'The Samaria gorge', description: 'An early bus to the Omalos plateau at 1,250 m and the Xyloskalo, then 16 km down through the gorge past the abandoned village of Samaria and the Iron Gates. Six to seven hours, all descent, hard on the knees. The ferry from Agia Roumeli is not an option, so it is the walk or nothing.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Agia Roumeli' },
      { title: 'Coast path to Loutro', description: 'The E4 east along the Libyan Sea, four to five hours over two headlands with the sea two hundred metres below on the right for most of it. Loutro has thirty houses, no road, no cars, and water that stays swimmable into November.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Loutro' },
      { title: 'Aradena gorge and Marmara beach', description: 'A boat to Marmara and then up the Aradena gorge, two hours between walls that narrow to four metres with the iron rungs section in the middle. We come out at the abandoned village of Aradena and its Ottoman bridge, then walk down to Anopoli for the night.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Guesthouse, Anopoli' },
      { title: 'Anopoli, Sfakia and a slow afternoon', description: 'A short morning walk down the old kalderimi to Chora Sfakion, the Sfakian capital and the place the 1770 revolt started. The rest of the day is free: swim, sleep, eat Sfakian pie with honey, or take the boat to Glyka Nera beach where fresh water comes up through the shingle.', meals: 'Breakfast, Dinner', accommodation: 'Hotel, Chora Sfakion' },
      { title: 'The Imbros gorge', description: 'The gentlest of the three gorges and the prettiest in autumn: eight kilometres down from Imbros village to Komitades, three hours, with cypress growing out of the walls. Lunch in Komitades, then the drive back over the mountains to Chania.', meals: 'Breakfast, Lunch', accommodation: 'Casa Delfino, Chania' },
      { title: 'Chania, and a day with nothing in it', description: 'Nothing is planned. Most people walk the harbour, visit the archaeological museum in the old Venetian monastery, or take a bus to Balos or Elafonisi. In the evening we eat together for the last time at a taverna in Splantzia with a mulberry tree through the roof.', meals: 'Breakfast, Dinner', accommodation: 'Casa Delfino, Chania' },
      { title: 'Departure', description: 'Transfers to Chania airport, twenty minutes east of the city. Bags can stay at the hotel for anyone on an evening flight, and the harbour is a five-minute walk away.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Eight nights in old-town hotels and village guesthouses, including three nights in Chania',
      'All breakfasts, five lunches and six dinners',
      'English-speaking Cretan mountain guide throughout',
      'Food-market walking tour in Chania with tastings',
      'All ferries, boats and buses on the walking days, plus baggage transfer by boat',
      'Samaria gorge and Imbros gorge entry fees',
      'Chania airport transfers on arrival and departure',
    ],
    excluded: [
      'International flights to and from Chania',
      'Travel insurance with hill walking cover, compulsory',
      'Lunch on days 1, 6, 8 and 9',
      'Optional boat to Glyka Nera or Elafonisi',
      'Single room supplement, €260, limited availability in Loutro and Anopoli',
    ],
    departures: [9, 37, 65, 226, 247, 268, 289],
  },
  {
    slug: 'cyclades-island-hopping-naxos-amorgos-folegandros',
    title: 'Cyclades Island Hopping: Naxos, Amorgos, Folegandros',
    destination: 'greece',
    duration_days: 11,
    difficulty: 'moderate',
    group_size_min: 4,
    group_size_max: 12,
    base_price_cents: 198000,
    status: 'published',
    is_featured: 1,
    meeting_point: 'Hotel Adrian, Plaka, Athens - 19:00 on day one, five minutes from Monastiraki metro',
    themes: ['coastal-islands', 'slow-travel', 'food-wine'],
    summary:
      'Eleven days and three islands, all of them by ferry, with old marble footpaths to walk and no schedule after lunch. Mount Zas, the Hozoviotissa monastery and a Chora on Folegandros that sits on a cliff edge.',
    description: [
      'Island-hopping usually means four islands in six days and a lot of time on boats. We do the opposite: three islands in eleven days, arriving in the afternoon and leaving three or four days later, which is roughly when a place stops being a view and starts being somewhere you know.',
      'Naxos is the largest of the Cyclades and the only one with real agriculture, so it has potatoes, citrus, graviera cheese and a mountain, Zas at 1,004 m, which is the highest in the group and takes about three hours up from Filoti. The inland villages - Halki, Apiranthos, Moni - are marble-paved and were built inland deliberately, out of sight of pirates.',
      'Amorgos is long, thin and vertical. The Hozoviotissa monastery is built into a cliff 300 m above the sea, eight metres deep and white against grey rock, and it has been occupied since 1017. The old donkey paths between Chora, Aegiali and Tholaria are waymarked and beautiful, and the ferry from Katapola runs to islands smaller than most villages.',
      'Folegandros is the smallest and quietest, with a Chora on a ledge 200 m above the sea and one road that runs the length of the island. We walk to the Panagia church for sunset with everybody else on the island, then eat matsata, hand-cut pasta with rooster, at a table in a square with no cars in it.',
    ].join('\n\n'),
    images: [
      'The Portara marble doorway standing alone on the islet at Naxos town',
      'Marble lanes and bougainvillea in the mountain village of Apiranthos',
      'The Hozoviotissa monastery built white into a cliff face on Amorgos',
      'The old donkey path descending from Tholaria to Aegiali bay',
      'The Chora of Folegandros on its ledge above the sea at dusk',
    ],
    itinerary: [
      { title: 'Arrive in Athens', description: 'We meet at seven in Plaka for a briefing and dinner on a roof with the Acropolis lit up behind us. Anyone arriving early can walk up Filopappou hill, which has the same view for free and almost nobody on it.', meals: 'Dinner', accommodation: 'Hotel Adrian, Athens' },
      { title: 'Ferry to Naxos', description: 'The metro to Piraeus and the morning blue star ferry, five hours through the Cyclades with Paros and Syros going past the window. We arrive in Naxos town in the afternoon, walk out to the Portara for sunset, and eat in the old market.', meals: 'Breakfast, Dinner', accommodation: 'Hotel, Naxos town' },
      { title: 'Naxos: the marble villages', description: 'Inland by bus to Halki for the kitron distillery, which has been making citrus liqueur in copper stills since 1896, then a walking path through olive groves to the Panagia Drosiani, one of the oldest churches in the Balkans, with sixth-century frescoes.', meals: 'Breakfast, Lunch', accommodation: 'Hotel, Naxos town' },
      { title: 'Mount Zas', description: 'Up from Filoti on the old path past the Zas cave, where Zeus was supposedly raised, to the summit at 1,004 m in about three hours. On a clear day you can see Ios, Paros, Mykonos and Santorini at once. We come down the other side to Danakos and its watermill.', meals: 'Breakfast, Lunch, Dinner', accommodation: 'Hotel, Naxos town' },
      { title: 'Ferry to Amorgos', description: 'A late morning ferry east, two and a half hours, arriving in Katapola in time for a swim. Amorgos is immediately quieter than Naxos. We walk up to Chora in the evening, where the lanes are so narrow the wind cannot get down them.', meals: 'Breakfast, Dinner', accommodation: 'Guesthouse, Chora, Amorgos' },
      { title: 'The Hozoviotissa monastery', description: 'The old stepped path down from Chora to the monastery, three hundred steps up the cliff to a building eight metres wide clinging to the rock. Long trousers and covered shoulders required; you are given raki and a loukoumi at the top by whoever is on duty.', meals: 'Breakfast, Lunch', accommodation: 'Guesthouse, Chora, Amorgos' },
      { title: 'Aegiali to Tholaria and Langada', description: 'A bus to Aegiali and a loop on the old donkey paths through Tholaria and Langada, four hours with a long lunch in the middle and a swim at the end. These are the best waymarked trails in the Cyclades and they were rebuilt stone by stone by a local association.', meals: 'Breakfast, Lunch', accommodation: 'Guesthouse, Chora, Amorgos' },
      { title: 'Ferry to Folegandros', description: 'West again, three hours by ferry with a stop at Ios. Folegandros has one road, four hundred permanent residents and a Chora built on a cliff. We check in, then walk up to the Panagia church for sunset with what feels like the entire island.', meals: 'Breakfast, Dinner', accommodation: 'Guesthouse, Chora, Folegandros' },
      { title: 'Folegandros on foot', description: 'The path along the north coast to Ano Meria, a scattered farming village with a folk museum in a working farmstead, then down to Agios Georgios beach for a swim and back by bus. Five hours of walking with very little shade, so we start early.', meals: 'Breakfast, Lunch', accommodation: 'Guesthouse, Chora, Folegandros' },
      { title: 'Ferry back to Athens', description: 'The morning boat back to Piraeus, four to five hours depending on the route, then the metro into the city. A last dinner in Psyrri with the group, and a proper bed after nine nights of ferries.', meals: 'Breakfast, Dinner', accommodation: 'Hotel Adrian, Athens' },
      { title: 'Departure', description: 'The metro runs from Monastiraki to the airport in forty minutes and we will see you onto it. Anyone with a late flight has time for the Acropolis Museum, which is five minutes from the hotel.', meals: 'Breakfast', accommodation: null },
    ],
    included: [
      'Ten nights in small hotels and family guesthouses, all in old towns or Choras',
      'All breakfasts, five lunches and six dinners',
      'Every ferry ticket between Athens, Naxos, Amorgos, Folegandros and back',
      'English-speaking Greek guide throughout, plus local walking guides on Naxos and Amorgos',
      'Kitron distillery visit and tasting at Halki',
      'Entry to the Panagia Drosiani and the Ano Meria folk museum',
      'All island bus and transfer costs on walking days',
    ],
    excluded: [
      'International flights to and from Athens',
      'Travel insurance, compulsory for all travellers',
      'Athens airport metro or taxi at either end',
      'Lunches and dinners not listed, budget around €20 a day',
      'Single room supplement, €320, very limited in July and August',
    ],
    departures: [6, 27, 48, 255, 276, 297],
  },
];

const USERS = [
  {
    name: 'Nadia Berrada',
    email: 'admin@atlas.travel',
    password: 'atlas123',
    role: 'admin',
    phone: '+212 661 44 21 08',
    created_at: '2025-09-02 09:00:00',
  },
  {
    name: 'Sara Lleshi',
    email: 'sara@atlas.travel',
    password: 'atlas123',
    role: 'staff',
    phone: '+355 69 402 11 87',
    created_at: '2025-11-18 11:30:00',
  },
  {
    name: 'Maria Ilieva',
    email: 'maria@example.com',
    password: 'atlas123',
    role: 'customer',
    phone: '+389 70 214 883',
    created_at: '2026-01-12 20:14:00',
  },
];

const PROMOTIONS = [
  {
    name: 'Autumn Escape Sale',
    code: null,
    badge_text: '-10%',
    description: 'Ten percent off every Atlas departure while the autumn sale runs - nothing to type, the price you see is already reduced.',
    type: 'percentage',
    value: 10,
    scope: 'all',
    scope_slug: null,
    min_booking_cents: 0,
    min_travellers: 1,
    min_days_before: null,
    max_days_before: null,
    usage_limit: null,
    usage_count: 148,
    per_customer_limit: null,
    priority: 10,
  },
  {
    name: 'Morocco Week',
    code: null,
    badge_text: '-15%',
    description: 'Fifteen percent off every trip in Morocco, applied automatically to the High Atlas, the Sahara and the imperial cities.',
    type: 'percentage',
    value: 15,
    scope: 'destination',
    scope_slug: 'morocco',
    min_booking_cents: 0,
    min_travellers: 1,
    min_days_before: null,
    max_days_before: null,
    usage_limit: null,
    usage_count: 63,
    per_customer_limit: null,
    priority: 30,
  },
  {
    name: 'Early Bird',
    code: null,
    badge_text: 'Early bird',
    description: 'Book at least 90 days before departure and twelve percent comes off automatically — no code to type, just plan ahead.',
    type: 'percentage',
    value: 12,
    scope: 'all',
    scope_slug: null,
    min_booking_cents: 0,
    min_travellers: 1,
    min_days_before: 90,
    max_days_before: null,
    usage_limit: null,
    usage_count: 91,
    per_customer_limit: null,
    priority: 20,
  },
  {
    name: 'Last Minute Places',
    code: null,
    badge_text: 'Last minute',
    description: 'Twenty percent off any departure leaving within three weeks, because an empty seat helps nobody.',
    type: 'percentage',
    value: 20,
    scope: 'all',
    scope_slug: null,
    min_booking_cents: 0,
    min_travellers: 1,
    min_days_before: null,
    max_days_before: 21,
    usage_limit: null,
    usage_count: 22,
    per_customer_limit: null,
    priority: 40,
  },
  {
    name: 'Newsletter Welcome',
    code: 'ATLAS25',
    badge_text: '€150 off',
    description: 'Our newsletter welcome offer: €150 off any booking over €1,200. Enter ATLAS25 at checkout, one use per customer.',
    type: 'fixed',
    value: 15000,
    scope: 'all',
    scope_slug: null,
    min_booking_cents: 120000,
    min_travellers: 1,
    min_days_before: null,
    max_days_before: null,
    usage_limit: 100,
    usage_count: 37,
    per_customer_limit: 1,
    priority: 15,
  },
  {
    name: 'Group of Four',
    code: 'GROUP4',
    badge_text: 'Groups of 4+',
    description: 'Travelling as four or more? Enter GROUP4 and eight percent comes off the whole booking.',
    type: 'percentage',
    value: 8,
    scope: 'all',
    scope_slug: null,
    min_booking_cents: 0,
    min_travellers: 4,
    min_days_before: null,
    max_days_before: null,
    usage_limit: null,
    usage_count: 12,
    per_customer_limit: null,
    priority: 5,
  },
];

const PROMO_WINDOW = { starts_at: '2026-01-01 00:00:00', ends_at: '2027-06-30 23:59:59' };

const PAST_DEPARTURES = [
  { tour: 'atlas-mountains-and-berber-villages', offset: -143, seats_total: 14, seats_booked: 14, status: 'sold_out' },
  { tour: 'jordan-trail-dana-to-petra', offset: -178, seats_total: 12, seats_booked: 10, status: 'guaranteed' },
  { tour: 'cyclades-island-hopping-naxos-amorgos-folegandros', offset: -101, seats_total: 12, seats_booked: 9, status: 'guaranteed' },
  { tour: 'lake-ohrid-and-the-galichica-ridge', offset: -87, seats_total: 14, seats_booked: 11, status: 'guaranteed' },
];

const BOOKINGS = [
  {
    reference: 'ATL-7K2M9P',
    tour: 'atlas-mountains-and-berber-villages',
    departure_offset: -143,
    status: 'completed',
    promotion: null,
    promo_code: null,
    contact_name: 'Maria Ilieva',
    contact_email: 'maria@example.com',
    contact_phone: '+389 70 214 883',
    notes: 'Second trip with Atlas. Please put us in the same gite as last April if Brahim is guiding.',
    created_at: '2026-01-20 10:24:00',
    travellers: [
      { full_name: 'Maria Ilieva', dob: '1991-03-14', nationality: 'Macedonian', dietary: null, is_lead: 1 },
      { full_name: 'Goran Ilievski', dob: '1988-11-02', nationality: 'Macedonian', dietary: 'No pork', is_lead: 0 },
    ],
  },
  {
    reference: 'ATL-3QF8VD',
    tour: 'jordan-trail-dana-to-petra',
    departure_offset: 77,
    status: 'paid',
    promotion: 'Newsletter Welcome',
    promo_code: 'ATLAS25',
    contact_name: 'Maria Ilieva',
    contact_email: 'maria@example.com',
    contact_phone: '+389 70 214 883',
    notes: 'Elena is vegetarian - please confirm the Bedouin camps can cover this for four nights.',
    created_at: '2026-06-14 18:02:00',
    travellers: [
      { full_name: 'Maria Ilieva', dob: '1991-03-14', nationality: 'Macedonian', dietary: null, is_lead: 1 },
      { full_name: 'Elena Kostova', dob: '1990-07-21', nationality: 'Bulgarian', dietary: 'Vegetarian', is_lead: 0 },
    ],
  },
  {
    reference: 'ATL-9BX4TN',
    tour: 'cyclades-island-hopping-naxos-amorgos-folegandros',
    departure_offset: 255,
    status: 'confirmed',
    promotion: 'Group of Four',
    promo_code: 'GROUP4',
    contact_name: 'Maria Ilieva',
    contact_email: 'maria@example.com',
    contact_phone: '+389 70 214 883',
    notes: 'Four of us, two twin rooms please. We would like to add two nights in Athens at the end.',
    created_at: '2026-08-02 09:47:00',
    travellers: [
      { full_name: 'Maria Ilieva', dob: '1991-03-14', nationality: 'Macedonian', dietary: null, is_lead: 1 },
      { full_name: 'Goran Ilievski', dob: '1988-11-02', nationality: 'Macedonian', dietary: 'No pork', is_lead: 0 },
      { full_name: 'Ana Petkovska', dob: '1994-01-30', nationality: 'Macedonian', dietary: 'Gluten free', is_lead: 0 },
      { full_name: 'Filip Trajkov', dob: '1992-09-09', nationality: 'Macedonian', dietary: null, is_lead: 0 },
    ],
  },
  {
    reference: 'ATL-5MD2WQ',
    tour: 'wadi-rum-desert-nights',
    departure_offset: 116,
    status: 'pending',
    promotion: 'Early Bird',
    promo_code: null,
    contact_name: 'Maria Ilieva',
    contact_email: 'maria@example.com',
    contact_phone: '+389 70 214 883',
    notes: 'Christmas week. Happy to share a tent. Do we need sleeping bags or are they provided?',
    created_at: '2026-08-18 21:15:00',
    travellers: [
      { full_name: 'Maria Ilieva', dob: '1991-03-14', nationality: 'Macedonian', dietary: null, is_lead: 1 },
      { full_name: 'Goran Ilievski', dob: '1988-11-02', nationality: 'Macedonian', dietary: 'No pork', is_lead: 0 },
    ],
  },
];

const REVIEWS = [
  { tour: 'atlas-mountains-and-berber-villages', author: 'Maria I.', rating: 5, status: 'approved', created_at: '2026-04-24 19:12:00', linked: 'ATL-7K2M9P', title: 'The gite in Ouaneskra alone was worth it', body: 'We walked four passes in six days and never once felt rushed. Brahim adjusted the pace on day three without making a thing of it, and the family in Ouaneskra fed us far more than any group could eat. I have already booked something else with Atlas.' },
  { tour: 'atlas-mountains-and-berber-villages', author: 'Thomas B.', rating: 5, status: 'approved', created_at: '2026-05-11 08:40:00', title: 'Exactly as described, which is rare', body: 'The itinerary said four to six hours a day on mule paths and that is precisely what it was. Nobody tried to upsell us a Toubkal summit we had not signed up for. The hammam on the last afternoon is a very good idea after five days of walking.' },
  { tour: 'atlas-mountains-and-berber-villages', author: 'Ingrid S.', rating: 4, status: 'approved', created_at: '2026-03-30 16:05:00', title: 'Wonderful walking, cold nights', body: 'March in the High Atlas is colder than I expected and the gites are heated by a single stove in the dining room. Take a proper sleeping bag liner. The walking, the food and the guiding were all excellent and the terrace at Aroumd at sunset is something I still think about.' },
  { tour: 'atlas-mountains-and-berber-villages', author: 'Cecile M.', rating: 5, status: 'pending', created_at: '2026-08-14 21:33:00', title: 'Best week of our year', body: 'Two of us, both in our sixties, and we managed everything on the itinerary. The mules take the bags so you only carry water and a jacket, which makes an enormous difference. Ask for the tanjia on the last night.' },

  { tour: 'sahara-dunes-and-the-draa-valley', author: 'Peter H.', rating: 5, status: 'approved', created_at: '2026-02-18 13:22:00', title: 'The silence in the erg is the point', body: 'I went for the photographs and stayed awake half the night for the sky instead. The camp is far enough from the road that you hear absolutely nothing. Khamlia was not a tourist show, it was four men and a room, and it was the best hour of the trip.' },
  { tour: 'sahara-dunes-and-the-draa-valley', author: 'Ana P.', rating: 4, status: 'approved', created_at: '2026-04-06 10:11:00', title: 'A lot of driving, handled well', body: 'It is a long way from Marrakech to Merzouga and no operator can change that, but the stops were well chosen and the vehicle was comfortable. Todra in the morning before the coaches is the version you want. One night in the dunes felt short.' },
  { tour: 'sahara-dunes-and-the-draa-valley', author: 'Luuk V.', rating: 5, status: 'approved', created_at: '2026-01-09 17:48:00', title: 'Ait Benhaddou at five in the afternoon', body: 'Staying the night there instead of passing through changes everything. We had the top of the ksar to ourselves with the light going orange. The driver, Hassan, knew every roadside stop worth making and none that were not.' },

  { tour: 'imperial-cities-fes-to-marrakech', author: 'Julia R.', rating: 5, status: 'approved', created_at: '2026-05-28 09:15:00', title: 'Yasmine made Fes make sense', body: 'Three nights in Fes sounded like a lot until we started walking it. Our guide grew up in the medina and got us onto a tannery roof, into a working bakery and past nine thousand lanes without us getting lost once. The bissara lunch cost two euros and was better than the hotel dinner.' },
  { tour: 'imperial-cities-fes-to-marrakech', author: 'Dan K.', rating: 4, status: 'approved', created_at: '2026-03-12 14:37:00', title: 'Train travel was a nice surprise', body: 'I had assumed we would be in a minibus the whole time. Doing Rabat to Marrakech first class on the train was comfortable and much more interesting. Chefchaouen is as blue as the photos and twice as busy at midday, so go out early.' },
  { tour: 'imperial-cities-fes-to-marrakech', author: 'Sofia G.', rating: 3, status: 'approved', created_at: '2026-06-19 20:02:00', title: 'Great content, tight schedule in the middle', body: 'Days four to six move quickly and Rabat gets less time than it deserves. Everything included was genuinely good and the guides were excellent throughout. I would have swapped one Marrakech night for another in Chefchaouen.' },

  { tour: 'albanian-alps-theth-to-valbona', author: 'Michael O.', rating: 5, status: 'approved', created_at: '2026-07-02 11:26:00', title: 'The pass, the ferry, the food', body: 'The Valbona crossing lived up to everything I had read, and the coffee shack at the top is real. What I did not expect was the Koman ferry, which was three hours of canyon with villagers and their shopping. The guesthouses feed you until you have to say stop.' },
  { tour: 'albanian-alps-theth-to-valbona', author: 'Elena K.', rating: 5, status: 'approved', created_at: '2026-06-27 18:54:00', title: 'Hard day, easy week', body: 'The pass day is a genuine 1,000 m of ascent and you should train for it, but everything either side is gentle. Luggage went by road to Valbona so we walked with daypacks. Our guide Ardit knew every family in both valleys.' },
  { tour: 'albanian-alps-theth-to-valbona', author: 'Rob T.', rating: 4, status: 'approved', created_at: '2025-10-04 12:09:00', title: 'Go before it changes', body: 'Theth already has more guesthouses than it did two years ago and the tunnel has made it easy to reach. It is still extraordinary. Take earplugs, because the rooster in Valbona starts at four.' },
  { tour: 'albanian-alps-theth-to-valbona', author: 'Nora F.', rating: 5, status: 'approved', created_at: '2026-08-01 07:41:00', title: 'The best guiding I have had anywhere', body: 'Small group, honest briefing about what the pass involves, and a genuine offer to arrange a road transfer for anyone who did not want to walk it. Nobody took it. The lock-in tower and the Kanun explanation were fascinating and slightly chilling.' },

  { tour: 'albanian-riviera-saranda-to-vlora', author: 'Giulia N.', rating: 5, status: 'approved', created_at: '2026-06-08 16:30:00', title: 'Butrint at nine in the morning', body: 'Having an archaeologist walk us round an empty site for two hours was the highlight of the week. The baptistery mosaic is only uncovered occasionally and we were lucky. Qeparo and the olive press afternoon was the other thing I would not skip.' },
  { tour: 'albanian-riviera-saranda-to-vlora', author: 'Marcus W.', rating: 4, status: 'approved', created_at: '2026-05-19 19:17:00', title: 'Beautiful coast, some building sites', body: 'The Riviera is changing fast and there is construction around Saranda and Dhermi that nobody can hide. Between the villages it is still stunning and the water is genuinely that colour. Llogara pass with lunch under the pines was a great finish.' },

  { tour: 'lake-ohrid-and-the-galichica-ridge', author: 'Vesna D.', rating: 5, status: 'approved', created_at: '2026-06-21 10:48:00', title: 'Both lakes from one ridge', body: 'The Galichica walk gives you Ohrid on one side and Prespa on the other for about three hours and I did not know anywhere in Europe did that. Vultures came past below us twice. We finished with trout and Vranec on a terrace over the water.' },
  { tour: 'lake-ohrid-and-the-galichica-ridge', author: 'James A.', rating: 4, status: 'approved', created_at: '2026-05-30 15:23:00', title: 'The pelicans were worth the alarm clock', body: 'Six in the morning at Stenje with a scope and an ornithologist who clearly loves the place. We saw maybe forty Dalmatian pelicans plus a lot else. The boat back from Sveti Naum to Ohrid is a lovely way to end a trip.' },
  { tour: 'lake-ohrid-and-the-galichica-ridge', author: 'Klara B.', rating: 5, status: 'approved', created_at: '2026-07-14 21:02:00', title: 'Ohrid deserves more than a day trip', body: 'Two nights in town and we still did not see everything. Plaosnik, the antique theatre and the boatbuilder in the afternoon were all excellent. Golem Grad genuinely does have snakes and the guide warns you properly before you go.' },

  { tour: 'jordan-trail-dana-to-petra', author: 'Sarah L.', rating: 5, status: 'approved', created_at: '2026-04-02 08:29:00', title: 'Arriving at the Monastery on foot', body: 'Four days of walking and then you come over the ridge and it is just there, at eight in the morning, with nobody else on it. That single moment justified the whole trip. The Bedouin team were superb and the zarb at Shakret Msaied was the best meal of the year.' },
  { tour: 'jordan-trail-dana-to-petra', author: 'Andreas H.', rating: 5, status: 'approved', created_at: '2026-03-25 20:44:00', title: 'Properly organised expedition', body: 'Camps were set up before we arrived, water was managed carefully and the guide carried a satellite communicator. Day two is hot and exposed and they start it early for good reason. Ten days is the right length for this route.' },
  { tour: 'jordan-trail-dana-to-petra', author: 'Priya M.', rating: 4, status: 'approved', created_at: '2026-05-16 13:58:00', title: 'Tough in the best way', body: 'I train regularly and still found day three long at seven hours with scrambling. The scenery through the sandstone domes is unlike anywhere else I have walked. Two days at Petra rather than one makes a real difference.' },
  { tour: 'jordan-trail-dana-to-petra', author: 'Owen C.', rating: 5, status: 'pending', created_at: '2026-08-09 11:36:00', title: 'Jerash surprised me more than Petra', body: 'Everyone goes for Petra and it is remarkable, but standing on the colonnaded street at Jerash at eight in the morning with cart ruts still in the stone was the thing I keep describing to people. The King Highway drive south is not a transfer day, it is a whole day of sites.' },

  { tour: 'wadi-rum-desert-nights', author: 'Hannah P.', rating: 5, status: 'approved', created_at: '2026-02-27 17:14:00', title: 'Two nights is the right number', body: 'One night in Wadi Rum is a photo stop, two nights is a place. The Zalabia family who run the camp ate with us both evenings. Burdah bridge is a proper scramble and they are honest about that before you start.' },
  { tour: 'wadi-rum-desert-nights', author: 'Tomasz K.', rating: 4, status: 'approved', created_at: '2026-01-31 09:52:00', title: 'Short, well-paced, cold at night', body: 'January nights in the desert drop close to freezing and the camp blankets do the job but bring a hat. The Petra day is long and starts at six, which is exactly right. Wish we had added a third day.' },
  { tour: 'wadi-rum-desert-nights', author: 'Lena F.', rating: 5, status: 'approved', created_at: '2026-04-19 22:07:00', title: 'The zarb is dug up in front of you', body: 'They lift the lid off a pit of embers and there is dinner. Small group, easy walking, and enough four-wheel drive to cover ground without it becoming a rally. The Khazali siq inscriptions are three thousand years old and nobody was there but us.' },

  { tour: 'durmitor-peaks-and-the-tara-canyon', author: 'Stefan V.', rating: 5, status: 'approved', created_at: '2026-07-22 14:41:00', title: 'Bobotov Kuk and the hut night', body: 'Sleeping at the Skrcka lakes with a warden making coffee on a wood stove was the part I did not expect to love. The summit has one cabled section and good rock, nothing alarming. Rafting the Tara the next day was the perfect recovery.' },
  { tour: 'durmitor-peaks-and-the-tara-canyon', author: 'Amelie D.', rating: 4, status: 'approved', created_at: '2026-06-30 18:19:00', title: 'Great mountains, enormous portions', body: 'Nobody warns you properly about kajmak. Durmitor is superb walking and Zabljak means you start high without any long approach. The alternative route on summit day is genuinely good, so nobody feels left behind.' },

  { tour: 'crete-samaria-and-the-white-mountains', author: 'George M.', rating: 5, status: 'approved', created_at: '2026-05-07 12:33:00', title: 'Loutro has no road and that is the point', body: 'Walking the E4 between villages the ferry supplies is a completely different Crete. Samaria is long and hard on the knees, so do the descent slowly. Aradena with the iron rungs was the day everyone talked about afterwards.' },
  { tour: 'crete-samaria-and-the-white-mountains', author: 'Bettina R.', rating: 4, status: 'approved', created_at: '2025-10-15 16:58:00', title: 'Nine days, three gorges, one blister', body: 'Take boots you have already broken in, because there is a lot of loose rock. The free day in Chania at the end was well judged after a week of walking. The food tour on day two set the tone for everything we ate afterwards.' },

  { tour: 'cyclades-island-hopping-naxos-amorgos-folegandros', author: 'Nikos T.', rating: 5, status: 'approved', created_at: '2026-06-11 19:26:00', title: 'Three islands, no rushing', body: 'Everyone else on the ferry was doing five islands in a week and looked exhausted. We had three or four nights in each place and by the end the bakery in Folegandros knew our order. Hozoviotissa at nine in the morning is worth every one of those steps.' },
  { tour: 'cyclades-island-hopping-naxos-amorgos-folegandros', author: 'Claire B.', rating: 5, status: 'approved', created_at: '2026-05-31 08:47:00', title: 'The old paths on Amorgos are the best in Greece', body: 'A local association rebuilt those donkey trails stone by stone and it shows. Aegiali to Tholaria took us four hours with a two-hour lunch inside it. Mount Zas on Naxos is a proper climb and the view takes in half the Cyclades.' },
  { tour: 'cyclades-island-hopping-naxos-amorgos-folegandros', author: 'Felix W.', rating: 3, status: 'pending', created_at: '2026-08-16 20:11:00', title: 'Good trip, ferries are ferries', body: 'Two of our four crossings were delayed and one was moved forward by an hour, which is normal in the Cyclades but does eat into the day. Atlas handled the rebooking well and nothing was missed. The walking and the guesthouses were excellent.' },
];

const BLOG_POSTS = [
  {
    slug: 'when-to-walk-the-albanian-alps',
    title: 'When to walk the Albanian Alps',
    author: 'Sara Lleshi',
    author_email: 'sara@atlas.travel',
    published_at: '2026-04-14 09:00:00',
    excerpt: 'The Valbona Pass is only reliably open for about four months a year, and the difference between the second week of June and the last week of September is bigger than most people expect.',
    body: [
      'The single question we get asked most about Albania is when to go, and the honest answer is that it depends entirely on whether you intend to cross the Valbona Pass. For everything else in the country the season is long and forgiving. For that one day, it is not.',
      'Snow lies on the pass at 1,795 m well into spring. In a normal year the route becomes walkable without axe or crampons somewhere between the first and third week of June, and the guesthouses in Theth and Valbona open at the same time because there is no point opening earlier. We have had years when it cleared in late May and one, in 2023, when a group in the second week of June still crossed a snowfield. If you are booking a June departure, plan for the possibility of a road transfer instead.',
      'July and August are hot, dry and busy by Albanian standards, which still means you will meet perhaps forty people on the pass rather than four hundred. The advantage is certainty: the path is clear, the coffee shack near the top is open every day, and the Koman ferry runs a full timetable. The disadvantage is that the guesthouses fill, and the good ones in Valbona are booked out months ahead.',
      'September is our favourite month and it is not close. The heat has gone out of the valleys, the light is lower and better, the blueberries are finished but the plums are not, and the ferry is quiet enough that you can sit outside. Groups walking in the third week of September regularly have the pass to themselves for the first two hours.',
      'By the second week of October the guesthouses start closing, the ferry drops to one crossing a day, and the first snow can arrive on the tops without much warning. We stop running the crossing after the first week of October, and we would gently discourage anyone from attempting it independently after that without checking conditions in Shkoder first.',
      'One more thing, which has nothing to do with weather: the tunnel that opened in 2022 cut the drive to Theth from four hours of dirt road to about ninety minutes of tarmac. It has made the valley far easier to reach, and the number of guesthouses has roughly doubled since. Theth is still remarkable. It will not be a secret for much longer.',
    ].join('\n\n'),
  },
  {
    slug: 'a-first-timers-guide-to-ramadan-travel-in-morocco',
    title: 'A first-timer’s guide to Ramadan travel in Morocco',
    author: 'Nadia Berrada',
    author_email: 'admin@atlas.travel',
    published_at: '2026-02-03 08:30:00',
    excerpt: 'Travelling in Morocco during Ramadan is not a problem to be managed. It is one of the more interesting months to be there, provided you understand what changes and what does not.',
    body: [
      'Every year we get emails asking whether a trip should be moved because it falls in Ramadan. Almost always the answer is no. Ramadan changes the rhythm of the day in Morocco, and if you go in knowing that, it is one of the most rewarding months to visit.',
      'What actually changes: many restaurants in the medinas close during daylight hours, though anywhere serving tourists in Marrakech, Fes or Chefchaouen stays open. Cafes are quieter. Museums and monuments often shift to shorter hours, typically closing by four. Traffic in the hour before sunset is genuinely dangerous because everybody is trying to get home for iftar, so we simply do not schedule drives at that time.',
      'What does not change: the mountains. Our High Atlas trips run through Ramadan every year. Guides who are fasting will tell you honestly whether they are, and most of our mountain guides fast and walk anyway, which is more impressive than it sounds at 2,400 m. We shorten walking days slightly and move lunch stops around, and nobody has ever noticed a drop in the standard of guiding.',
      'Eating and drinking as a visitor is fine. Nobody will comment if you drink water on a mountain path or eat a packed lunch on a pass. In a city street it is considered polite to be discreet rather than to abstain, and stepping into a courtyard or your riad is enough.',
      'Iftar is the reason to go. At sunset the whole country stops and eats at the same moment: harira soup, dates, chebakia pastries, boiled eggs, msemen. If you are invited to a family iftar, accept, arrive with pastries, and do not eat until your host does. We build one into every Morocco departure that falls in the month, and it is invariably the meal people write to us about afterwards.',
      'The last practical note is on prices and crowds. Ramadan is a quieter month for tourism, so flights and riads are cheaper and the sites are emptier. Eid at the end is the opposite: everything closes for two or three days, transport is impossible to book, and we avoid scheduling departures across it.',
    ].join('\n\n'),
  },
  {
    slug: 'ferry-logic-planning-a-cyclades-route-that-works',
    title: 'Ferry logic: planning a Cyclades route that actually works',
    author: 'Sara Lleshi',
    author_email: 'sara@atlas.travel',
    published_at: '2026-05-22 10:15:00',
    excerpt: 'Most island-hopping itineraries fail for the same reason: they were built from a map instead of a timetable. Here is how we build ours backwards.',
    body: [
      'The Cyclades look like a cluster of islands close enough to pick freely between. The ferry network does not agree. Boats run along lines, not between neighbours, and two islands ten kilometres apart can be a five-hour journey with a change, or simply impossible on a Tuesday.',
      'So we build every island route backwards from the timetable. First we find the islands that are genuinely connected in the season we are travelling, then we decide how long to stay on each, and only then do we write an itinerary. It is why our Cyclades trip goes Naxos, Amorgos, Folegandros rather than the more obvious Naxos, Paros, Santorini: those three sit on lines that actually meet.',
      'Two ferry types matter. The big blue-and-white conventional ships are slower, much cheaper, run in worse weather and have deck seating where you can sit outside for four hours watching islands go past. The high-speed catamarans are half the time, twice the price, cancel in strong meltemi, and have no outside deck at all. For a trip built around slowness, the slow boat is not a compromise.',
      'The meltemi is the real planning constraint. It is a dry north wind that blows in July and August, sometimes for a week at a time, and at force seven or above the fast boats stop. Conventional ferries usually keep going. If your itinerary depends on a catamaran crossing in August with a flight the same evening, you have built a trip with a single point of failure.',
      'Our rule is one buffer night before any flight home. It costs a night of hotel and it removes the only genuinely stressful part of island travel. In eleven years we have used that buffer perhaps a dozen times, and every one of those groups made their flight.',
      'Finally, book the ferries but not everything else. Tickets for the popular summer crossings sell out and should be bought in advance. Restaurants, boat trips and beaches should not be planned at all. The best afternoon on any island trip is the one nobody scheduled.',
    ].join('\n\n'),
  },
  {
    slug: 'what-to-pack-for-four-days-on-the-jordan-trail',
    title: 'What to pack for four days on the Jordan Trail',
    author: 'Nadia Berrada',
    author_email: 'admin@atlas.travel',
    published_at: '2026-06-09 07:45:00',
    excerpt: 'A support vehicle carries your bag between camps, so the question is not what you own but what goes in the daypack. This is the list our guides actually check.',
    body: [
      'On the Dana to Petra section you walk with a daypack and everything else travels ahead to camp. That sounds like it removes the packing problem. It does not, because the four things that will ruin your week all live in the daypack.',
      'Water first. Our guides carry a reserve, but you should start each day with three litres and a way to drink it without stopping, because people who have to take a pack off to drink simply drink less. Two one-and-a-half litre bottles in the side pockets work as well as a bladder and are easier to refill from a jerrycan.',
      'Sun second. There is very little shade between Wadi Malaga and Ras al-Feid. A brimmed hat, long sleeves in light fabric, and factor fifty applied before you leave camp rather than when you notice. Sunglasses that actually stay on when you look down.',
      'Feet third. Boots or trail shoes you have already walked at least fifty kilometres in, and a spare pair of socks in the pack so you can change at lunch. Bring blister plasters even if you never get blisters, because the sand gets into everything and abrades in places it does not at home. Gaiters are optional but the people who bring them are quietly smug by day three.',
      'Warmth fourth, which surprises people. The desert loses heat fast after sunset, and in March or November a camp at 1,200 m can drop close to freezing. A light down jacket and a warm hat weigh almost nothing and get used every evening. Sleeping bags are provided but a silk liner adds a few degrees and takes no space.',
      'Everything else is optional. A head torch, obviously. Long trousers and a scarf for the monastery visits and for the villages. A power bank, because there is no electricity in camp and you will take more photographs than you expect. And leave the drone at home; Wadi Rum and the Dana reserve both require permits that we cannot obtain for individual travellers.',
    ].join('\n\n'),
  },
  {
    slug: 'nine-things-to-eat-in-ohrid-before-you-leave',
    title: 'Nine things to eat in Ohrid before you leave',
    author: 'Sara Lleshi',
    author_email: 'sara@atlas.travel',
    published_at: '2026-07-01 11:20:00',
    excerpt: 'Lake trout is what everybody orders, and it is not the most interesting thing on the table. A short list from three years of lunches on the Macedonian shore.',
    body: [
      'Ohrid trout is protected and has been since the population collapsed in the 1990s. What you are served is farmed, or comes from Lake Prespa over the ridge, and it is genuinely good grilled with oil and lemon. It is also the most expensive thing on the menu and the least surprising, so here is what we order instead.',
      'Tavce gravce, first, always. Beans baked in a clay dish with paprika and onion until the top goes dark, served bubbling. Every restaurant claims theirs is the best and the difference between them is real. It is a two-euro dish that will hold you until dinner.',
      'Ajvar, made in October when the peppers come in, roasted and peeled and cooked down for hours. Almost every family still makes their own, and a guesthouse that puts out a jar of somebody grandmother ajvar at breakfast is a guesthouse worth staying in. Buy a jar at the market; it travels fine.',
      'Then the cheeses. Bieno sirenje from the Shar mountains, kneaded while warm so it comes out stringy and salty. Young brined sirenje that squeaks. Kashkaval for grilling. Ask for a mixed plate and a glass of Vranec, which is the local red and costs less than bottled water.',
      'Pastrmajlija is the one people miss because it looks like a pizza. It is not: it is a boat of bread dough with cubed pork and an egg cracked over it near the end, from Shtip originally, and it is the best thing to eat after a day on the Galichica ridge. Order the one with the egg.',
      'Finish with kifli and a Turkish coffee in the old bazaar, or in season with a bowl of the small wild strawberries that get sold from buckets along the Prespa road. And if somebody offers you homemade rakija at eleven in the morning, that is a normal time, and refusing is harder than accepting.',
    ].join('\n\n'),
  },
  {
    slug: 'why-our-prices-go-down-in-november',
    title: 'Why our prices go down in November',
    author: 'Nadia Berrada',
    author_email: 'admin@atlas.travel',
    published_at: '2026-08-05 16:00:00',
    excerpt: 'Every Atlas price is a rule rather than a number typed in by hand, which is why a departure can be cheaper in November without anybody being told a story about it.',
    body: [
      'We have never run a sale where the original price was invented to make the discount look bigger. That practice is common enough in travel that it is worth explaining exactly how our prices work instead, because the answer is boringly mechanical.',
      'Every tour has one base price. Every departure of that tour then has its own price, set by the season it falls in: our peak months carry up to fifteen percent above the base, our quiet months up to twelve percent below. A November departure of the Sahara trip is cheaper than an October one because November is quieter in the Draa valley, not because we decided to run a promotion.',
      'On top of that sit promotions, and a promotion in our system is a rule, never an edited number. It has a start date, an end date, conditions, and a value. When it applies, the original price is still there underneath it and we show both. When it expires, the price returns by itself because nobody ever overwrote it.',
      'That matters for a practical reason. If a member of staff types a discounted price over the original one, the original is gone, and three weeks later nobody can prove what the trip used to cost. Keeping the base price and computing the discount at the moment you look at the page means the was-price on our site is always a price somebody could actually have paid.',
      'Some of our promotions need no code at all. The early bird takes twelve percent off automatically if you book more than ninety days ahead, and the last-minute rule takes twenty percent off anything leaving within three weeks. You do not have to find them, type them or ask about them; if you qualify, the price you see already includes them.',
      'When more than one rule applies, we take the one worth the most to you rather than the one worth the most to us, and we do not stack percentages, because twenty percent plus twenty percent is thirty-six percent and nobody has ever expected that number. If a code you have been sent is worth less than the automatic discount already on the page, we simply keep the better one and tell you so.',
    ].join('\n\n'),
  },
];

const ENQUIRIES = [
  {
    name: 'Robert Whelan',
    email: 'r.whelan@example.co.uk',
    phone: '+44 7700 900412',
    tour: 'jordan-trail-dana-to-petra',
    subject: 'Fitness required for the Dana to Petra section',
    message: 'I am 58 and walk regularly in Snowdonia, usually 15 to 20 km with 900 m of ascent. Is the third trek day realistically within reach, and is there an option to go by vehicle to the next camp if I have a bad morning? Also, do you have a departure in early April 2027?',
    status: 'new',
    created_at: '2026-08-21 14:32:00',
  },
  {
    name: 'Ines Marques',
    email: 'ines.marques@example.pt',
    phone: null,
    tour: 'cyclades-island-hopping-naxos-amorgos-folegandros',
    subject: 'Single room availability in June',
    message: 'Two of us travelling but we would each like a single room rather than sharing. The listing mentions a supplement of €320 with limited availability. Could you confirm whether both singles are possible on the June departure, and whether the Amorgos guesthouse can hold them?',
    status: 'in_progress',
    created_at: '2026-08-14 09:05:00',
  },
  {
    name: 'Karl-Heinz Vogt',
    email: 'kh.vogt@example.de',
    phone: '+49 151 22348890',
    tour: null,
    subject: 'Private departure for a group of nine',
    message: 'We are a walking club from Freiburg, nine people, all experienced. We would like a private departure of one of your Balkan trips in September 2027 and we are flexible on which. Can you quote for a private group, and does the group discount code apply to a private booking or is the pricing different?',
    status: 'in_progress',
    created_at: '2026-07-30 17:48:00',
  },
  {
    name: 'Amelia Cross',
    email: 'amelia.cross@example.com',
    phone: '+353 86 1234567',
    tour: 'atlas-mountains-and-berber-villages',
    subject: 'Vegetarian and gluten free in the gites',
    message: 'One of our party is coeliac and I am vegetarian. I know the village gites cook one meal for everyone. Realistically, how well can this be handled over five nights, and should we bring supplies from Marrakech?',
    status: 'closed',
    created_at: '2026-06-11 11:19:00',
  },
  {
    name: 'Dario Conti',
    email: 'dario.conti@example.it',
    phone: '+39 340 5567120',
    tour: 'bay-of-kotor-slow-travel',
    subject: 'When does the Kotor trip go on sale?',
    message: 'I saw the Bay of Kotor itinerary mentioned in your newsletter but I cannot find dates for it anywhere on the site. Is it running in 2027, and can I be told when the first departures are published? Happy to be put on a list.',
    status: 'new',
    created_at: '2026-08-19 20:56:00',
  },
];

const NEWSLETTER = [
  { email: 'r.whelan@example.co.uk', created_at: '2026-08-21 14:34:00' },
  { email: 'ines.marques@example.pt', created_at: '2026-08-14 09:06:00' },
  { email: 'dario.conti@example.it', created_at: '2026-06-02 08:41:00' },
  { email: 'maria@example.com', created_at: '2026-01-12 20:16:00' },
  { email: 'j.hoekstra@example.nl', created_at: '2026-03-27 13:12:00' },
  { email: 'lucie.bernard@example.fr', created_at: '2026-05-09 19:33:00' },
  { email: 'tomasz.k@example.pl', created_at: '2026-02-14 10:07:00' },
  { email: 'walkingclub.freiburg@example.de', created_at: '2026-07-30 17:50:00' },
];

const AUDIT = [
  { actor_email: 'admin@atlas.travel', action: 'promotion.create', entity: 'promotion', entity_name: 'Autumn Escape Sale', detail: 'Site-wide 10% automatic discount opened for the 2026-27 season.', created_at: '2026-01-01 09:12:00' },
  { actor_email: 'admin@atlas.travel', action: 'promotion.create', entity: 'promotion', entity_name: 'Morocco Week', detail: 'Destination-scoped 15% automatic discount added for Morocco.', created_at: '2026-01-01 09:18:00' },
  { actor_email: 'sara@atlas.travel', action: 'tour.update', entity: 'tour', entity_name: 'Albanian Alps: Theth to Valbona', detail: 'Group maximum reduced from 14 to 12 after guide feedback on the pass day.', created_at: '2026-05-04 15:26:00' },
  { actor_email: 'sara@atlas.travel', action: 'review.approve', entity: 'review', entity_name: 'The pass, the ferry, the food', detail: 'Approved after checking the reviewer travelled on the June departure.', created_at: '2026-07-03 08:55:00' },
  { actor_email: 'admin@atlas.travel', action: 'tour.create', entity: 'tour', entity_name: 'Bay of Kotor Slow Travel', detail: 'Draft created. Departures not published until the Perast contract is signed.', created_at: '2026-08-06 12:40:00' },
  { actor_email: 'sara@atlas.travel', action: 'booking.update', entity: 'booking', entity_name: 'ATL-3QF8VD', detail: 'Balance received, status moved from confirmed to paid.', created_at: '2026-08-12 10:02:00' },
];

const args = process.argv.slice(2);
const reset = args.includes('--reset');

if (existsSync(DB_PATH) && !reset) {
  console.log('');
  console.log('  data/atlas.db already exists, so nothing has been touched.');
  console.log('  Run `npm run reset` to wipe the database and seed it again.');
  console.log('');
  process.exit(0);
}

if (!existsSync(SCHEMA_PATH)) {
  console.error(`Cannot find the schema at ${SCHEMA_PATH}. Run this from the project root.`);
  process.exit(1);
}

for (const t of TOURS) {
  if (t.itinerary.length !== t.duration_days) {
    throw new Error(`${t.slug}: ${t.itinerary.length} itinerary days for a ${t.duration_days} day tour`);
  }
  if (t.images.length !== 5) {
    throw new Error(`${t.slug}: expected 5 gallery images, found ${t.images.length}`);
  }
  if (!DESTINATIONS.some((d) => d.slug === t.destination)) {
    throw new Error(`${t.slug}: unknown destination ${t.destination}`);
  }
}

mkdirSync(DATA_DIR, { recursive: true });
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  if (existsSync(f)) unlinkSync(f);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(SCHEMA_PATH, 'utf8'));

const lastId = (stmt, ...params) => Number(stmt.run(...params).lastInsertRowid);

db.exec('BEGIN');
try {
  const insUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const userIdByEmail = {};
  for (const u of USERS) {
    userIdByEmail[u.email] = lastId(insUser, u.name, u.email, hashPassword(u.password), u.role, u.phone, u.created_at);
  }
  const adminId = userIdByEmail['admin@atlas.travel'];
  const staffId = userIdByEmail['sara@atlas.travel'];
  const customerId = userIdByEmail['maria@example.com'];

  const insDest = db.prepare(
    `INSERT INTO destinations (slug, name, country, region, summary, description, hero_image, best_time, is_featured, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const destIdBySlug = {};
  for (const d of DESTINATIONS) {
    destIdBySlug[d.slug] = lastId(
      insDest, d.slug, d.name, d.country, d.region, d.summary, d.description,
      destImage(d.slug), d.best_time, d.is_featured, '2025-09-04 10:00:00',
    );
  }

  const insTheme = db.prepare('INSERT INTO themes (slug, name) VALUES (?, ?)');
  const themeIdBySlug = {};
  for (const th of THEMES) themeIdBySlug[th.slug] = lastId(insTheme, th.slug, th.name);

  const insTour = db.prepare(
    `INSERT INTO tours (slug, title, destination_id, summary, description, duration_days, difficulty,
                        group_size_min, group_size_max, base_price_cents, hero_image, meeting_point,
                        status, is_featured, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insImage = db.prepare('INSERT INTO tour_images (tour_id, url, alt, sort_order) VALUES (?, ?, ?, ?)');
  const insTourTheme = db.prepare('INSERT INTO tour_themes (tour_id, theme_id) VALUES (?, ?)');
  const insDay = db.prepare(
    'INSERT INTO itinerary_days (tour_id, day_number, title, description, meals, accommodation) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insFact = db.prepare('INSERT INTO tour_facts (tour_id, kind, text, sort_order) VALUES (?, ?, ?, ?)');

  const tourIdBySlug = {};
  const tourIdByTitle = {};

  TOURS.forEach((t, index) => {
    const createdAt = `2025-1${index < 2 ? 0 : 1}-0${(index % 8) + 1} 09:${20 + index}:00`;
    const tourId = lastId(
      insTour, t.slug, t.title, destIdBySlug[t.destination], t.summary, t.description,
      t.duration_days, t.difficulty, t.group_size_min, t.group_size_max, t.base_price_cents,
      tourImage(t.slug), t.meeting_point, t.status, t.is_featured, createdAt, '2026-08-06 12:40:00',
    );
    tourIdBySlug[t.slug] = tourId;
    tourIdByTitle[t.title] = tourId;

    t.images.forEach((alt, i) => {
      insImage.run(tourId, galleryImage(t.slug, i + 1), alt, i);
    });
    for (const themeSlug of t.themes) {
      insTourTheme.run(tourId, themeIdBySlug[themeSlug]);
    }
    t.itinerary.forEach((day, i) => {
      insDay.run(tourId, i + 1, day.title, day.description, day.meals, day.accommodation);
    });
    t.included.forEach((text, i) => {
      insFact.run(tourId, 'included', text, i);
    });
    t.excluded.forEach((text, i) => {
      insFact.run(tourId, 'excluded', text, i);
    });
  });

  const insDep = db.prepare(
    `INSERT INTO departures (tour_id, start_date, end_date, price_cents, seats_total, seats_booked, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const depIdByKey = {};

  TOURS.forEach((t, index) => {
    if (t.status !== 'published' || t.departures.length === 0) return;
    const tourId = tourIdBySlug[t.slug];
    const soldOutIndex = (index + 2) % t.departures.length;

    t.departures.forEach((offset, i) => {
      const start = addDays(BASE_DATE, offset);
      const end = addDays(start, t.duration_days - 1);
      const seatsTotal = 12 + ((index + i) % 5);
      let seatsBooked = randInt(0, 9);
      let status;
      if (i === soldOutIndex) {
        seatsBooked = seatsTotal;
        status = 'sold_out';
      } else {
        status = seatsBooked >= 6 ? 'guaranteed' : 'open';
      }
      const id = lastId(
        insDep, tourId, start, end, seasonalPrice(t.base_price_cents, start),
        seatsTotal, seatsBooked, status, '2026-01-05 09:00:00',
      );
      depIdByKey[`${t.slug}|${offset}`] = { id, price_cents: seasonalPrice(t.base_price_cents, start), seatsTotal };
    });
  });

  for (const p of PAST_DEPARTURES) {
    const t = TOURS.find((x) => x.slug === p.tour);
    const start = addDays(BASE_DATE, p.offset);
    const end = addDays(start, t.duration_days - 1);
    const price = seasonalPrice(t.base_price_cents, start);
    const id = lastId(
      insDep, tourIdBySlug[p.tour], start, end, price,
      p.seats_total, p.seats_booked, p.status, '2025-11-02 09:00:00',
    );
    depIdByKey[`${p.tour}|${p.offset}`] = { id, price_cents: price, seatsTotal: p.seats_total };
  }

  const insPromo = db.prepare(
    `INSERT INTO promotions (name, code, description, badge_text, type, value, scope, scope_id,
                             starts_at, ends_at, min_booking_cents, min_travellers, min_days_before,
                             max_days_before, usage_limit, usage_count, per_customer_limit,
                             priority, stackable, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)`,
  );
  const promoIdByName = {};
  const promoByName = {};
  for (const p of PROMOTIONS) {
    const scopeId = p.scope === 'destination' ? destIdBySlug[p.scope_slug] : null;
    promoIdByName[p.name] = lastId(
      insPromo, p.name, p.code, p.description, p.badge_text, p.type, p.value, p.scope, scopeId,
      PROMO_WINDOW.starts_at, PROMO_WINDOW.ends_at, p.min_booking_cents, p.min_travellers,
      p.min_days_before, p.max_days_before, p.usage_limit, p.usage_count, p.per_customer_limit,
      p.priority, '2026-01-01 09:00:00',
    );
    promoByName[p.name] = p;
  }

  const insHistory = db.prepare(
    'INSERT INTO price_history (tour_id, departure_id, price_cents, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const t of TOURS) {
    insHistory.run(tourIdBySlug[t.slug], null, t.base_price_cents, adminId, '2026-01-05 09:00:00');
    const first = t.departures.length ? depIdByKey[`${t.slug}|${t.departures[0]}`] : null;
    if (first) {
      insHistory.run(tourIdBySlug[t.slug], first.id, first.price_cents - 5000, staffId, '2026-02-10 14:20:00');
      insHistory.run(tourIdBySlug[t.slug], first.id, first.price_cents, staffId, '2026-04-02 11:05:00');
    }
  }

  const insBooking = db.prepare(
    `INSERT INTO bookings (reference, user_id, tour_id, departure_id, status, travellers_count,
                           base_total_cents, discount_cents, total_cents, deposit_cents,
                           promotion_id, promo_code, contact_name, contact_email, contact_phone,
                           notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insTraveller = db.prepare(
    'INSERT INTO booking_travellers (booking_id, full_name, dob, nationality, dietary, is_lead) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const bumpSeats = db.prepare(
    'UPDATE departures SET seats_booked = MIN(seats_total, MAX(seats_booked, ?)) WHERE id = ?',
  );

  const bookingIdByRef = {};

  for (const b of BOOKINGS) {
    const dep = depIdByKey[`${b.tour}|${b.departure_offset}`];
    if (!dep) throw new Error(`booking ${b.reference}: no departure at offset ${b.departure_offset} for ${b.tour}`);

    const count = b.travellers.length;
    const baseTotal = dep.price_cents * count;
    const promo = b.promotion ? promoByName[b.promotion] : null;
    let discount = 0;
    if (promo) {
      discount = promo.type === 'percentage'
        ? Math.round((baseTotal * promo.value) / 100)
        : promo.value;
      discount = Math.max(0, Math.min(discount, baseTotal));
    }
    const total = baseTotal - discount;

    const bookingId = lastId(
      insBooking, b.reference, customerId, tourIdBySlug[b.tour], dep.id, b.status, count,
      baseTotal, discount, total, depositFor(total),
      promo ? promoIdByName[b.promotion] : null, b.promo_code,
      b.contact_name, b.contact_email, b.contact_phone, b.notes, b.created_at,
    );
    bookingIdByRef[b.reference] = bookingId;

    for (const tr of b.travellers) {
      insTraveller.run(bookingId, tr.full_name, tr.dob, tr.nationality, tr.dietary, tr.is_lead);
    }
    bumpSeats.run(count, dep.id);
  }

  const insReview = db.prepare(
    `INSERT INTO reviews (tour_id, user_id, booking_id, author_name, rating, title, body, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const reviewIdByTitle = {};
  for (const r of REVIEWS) {
    const bookingId = r.linked ? bookingIdByRef[r.linked] : null;
    reviewIdByTitle[r.title] = lastId(
      insReview, tourIdBySlug[r.tour], r.linked ? customerId : null, bookingId,
      r.author, r.rating, r.title, r.body, r.status, r.created_at,
    );
  }

  const insPost = db.prepare(
    `INSERT INTO blog_posts (slug, title, excerpt, body, hero_image, author_id, author_name, status, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
  );
  for (const p of BLOG_POSTS) {
    insPost.run(
      p.slug, p.title, p.excerpt, p.body, blogImage(p.slug),
      userIdByEmail[p.author_email] ?? null, p.author, p.published_at, p.published_at,
    );
  }

  const insEnquiry = db.prepare(
    'INSERT INTO enquiries (name, email, phone, tour_id, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const e of ENQUIRIES) {
    insEnquiry.run(e.name, e.email, e.phone, e.tour ? tourIdBySlug[e.tour] : null, e.subject, e.message, e.status, e.created_at);
  }

  const insSub = db.prepare('INSERT INTO newsletter_subscribers (email, created_at) VALUES (?, ?)');
  for (const s of NEWSLETTER) insSub.run(s.email, s.created_at);

  const insAudit = db.prepare(
    'INSERT INTO audit_log (user_id, actor_name, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const entityId = (entity, name) => {
    if (entity === 'promotion') return promoIdByName[name] ?? null;
    if (entity === 'tour') return tourIdByTitle[name] ?? null;
    if (entity === 'booking') return bookingIdByRef[name] ?? null;
    if (entity === 'review') return reviewIdByTitle[name] ?? null;
    return null;
  };
  for (const a of AUDIT) {
    const actor = USERS.find((u) => u.email === a.actor_email);
    insAudit.run(
      userIdByEmail[a.actor_email], actor.name, a.action, a.entity,
      entityId(a.entity, a.entity_name), `${a.entity_name}: ${a.detail}`, a.created_at,
    );
  }

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Seed failed, the database was rolled back:');
  console.error(err);
  process.exit(1);
}

{
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const rows = [
    ['destinations', count('destinations')],
    ['themes', count('themes')],
    ['tours', count('tours')],
    ['tour_images', count('tour_images')],
    ['tour_themes', count('tour_themes')],
    ['itinerary_days', count('itinerary_days')],
    ['tour_facts', count('tour_facts')],
    ['departures', count('departures')],
    ['promotions', count('promotions')],
    ['price_history', count('price_history')],
    ['bookings', count('bookings')],
    ['booking_travellers', count('booking_travellers')],
    ['reviews', count('reviews')],
    ['blog_posts', count('blog_posts')],
    ['enquiries', count('enquiries')],
    ['newsletter_subscribers', count('newsletter_subscribers')],
    ['users', count('users')],
    ['audit_log', count('audit_log')],
  ];

  const published = db.prepare("SELECT COUNT(*) AS n FROM tours WHERE status = 'published'").get().n;
  const drafts = db.prepare("SELECT COUNT(*) AS n FROM tours WHERE status = 'draft'").get().n;
  const pendingReviews = db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'").get().n;
  const autoPromos = db.prepare('SELECT COUNT(*) AS n FROM promotions WHERE code IS NULL').get().n;
  const firstDep = db.prepare('SELECT MIN(start_date) AS d FROM departures').get().d;
  const lastDep = db.prepare('SELECT MAX(start_date) AS d FROM departures').get().d;

  const pad = (s, n) => String(s).padEnd(n, ' ');
  console.log('');
  console.log('  Atlas database seeded -> data/atlas.db');
  console.log('  ' + '-'.repeat(46));
  for (const [table, n] of rows) {
    console.log(`  ${pad(table, 24)}${String(n).padStart(5, ' ')}`);
  }
  console.log('  ' + '-'.repeat(46));
  console.log(`  ${published} published tours, ${drafts} draft`);
  console.log(`  ${autoPromos} of ${PROMOTIONS.length} promotions apply automatically (no code)`);
  console.log(`  ${pendingReviews} reviews waiting in the moderation queue`);
  console.log(`  departures run ${firstDep} to ${lastDep}`);
  console.log('');
  console.log('  Sign in with:');
  console.log('    admin@atlas.travel / atlas123   (admin)');
  console.log('    sara@atlas.travel  / atlas123   (staff)');
  console.log('    maria@example.com  / atlas123   (customer, 4 bookings)');
  console.log('');
}

db.close();
