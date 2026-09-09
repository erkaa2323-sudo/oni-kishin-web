export type CpmService = {
  id: string;
  name: string;
  price: number;
  description: string;
  tier: "STANDARD" | "PRO" | "PREMIUM";
};

export const CPM_SERVICE_CATALOG: CpmService[] = [
  {
    id: "money",
    name: "MONEY",
    price: 1500,
    tier: "STANDARD",
    description:
      "CPM доторх тоглоомын мөнгөтэй холбоотой үйлчилгээ. Худалдан авсны дараа админтай холбогдож гүйцэтгүүлнэ.",
  },
  {
    id: "coins",
    name: "COINS",
    price: 1800,
    tier: "STANDARD",
    description:
      "CPM доторх coin-той холбоотой үйлчилгээ. Худалдан авалт баталгаажмагц админтай холбогдож мэдээллээ өгнө.",
  },
  {
    id: "clone-cars",
    name: "CLONE CARS",
    price: 2800,
    tier: "PRO",
    description:
      "CPM дотор автомашин clone хийх үйлчилгээ. Худалдан авсны дараа шаардлагатай машины мэдээллээ админд өгнө.",
  },
  {
    id: "clone-accounts",
    name: "CLONE ACCOUNTS",
    price: 4200,
    tier: "PREMIUM",
    description:
      "CPM дотор account clone хийх үйлчилгээ. Худалдан авалтын дараа админ зааврын дагуу шаардлагатай мэдээллийг авна.",
  },
  {
    id: "copy-livery",
    name: "COPY LIVERY",
    price: 2200,
    tier: "PRO",
    description:
      "CPM дотор машины livery-г хуулж өгөх үйлчилгээ. Хуулах livery-ийн мэдээллээ худалдан авсны дараа админд өгнө.",
  },
  {
    id: "unlock-all-cars",
    name: "UNLOCK ALL CARS",
    price: 5500,
    tier: "PREMIUM",
    description:
      "CPM дотор бүх автомашины unlock үйлчилгээ. Худалдан авсны дараа админтай холбогдож гүйцэтгүүлнэ.",
  },
  {
    id: "unlock-paid-cars",
    name: "UNLOCK PAID CARS",
    price: 4800,
    tier: "PREMIUM",
    description:
      "CPM дотор paid cars unlock хийх үйлчилгээ. Худалдан авалтын дараа админтай холбогдож гүйцэтгүүлнэ.",
  },
  {
    id: "police-permanent",
    name: "POLICE UNLOCKED · PERMANENT",
    price: 4500,
    tier: "PREMIUM",
    description:
      "CPM дотор Police эрхийг байнгын unlock хэлбэрээр тохируулах үйлчилгээ.",
  },
  {
    id: "engine-permanent",
    name: "ENGINE UNLOCKED · PERMANENT",
    price: 4500,
    tier: "PREMIUM",
    description:
      "CPM дотор Engine unlock-ийг байнгын байдлаар тохируулах үйлчилгээ.",
  },
  {
    id: "all-houses-permanent",
    name: "ALL HOUSES · PERMANENT",
    price: 4000,
    tier: "PREMIUM",
    description:
      "CPM дотор бүх house-ийг байнгын unlock хэлбэрээр нээх үйлчилгээ.",
  },
  {
    id: "smoke-permanent",
    name: "SMOKE UNLOCKED · PERMANENT",
    price: 3500,
    tier: "PRO",
    description:
      "CPM дотор Smoke unlock-ийг байнгын байдлаар тохируулах үйлчилгээ.",
  },
  {
    id: "mileage",
    name: "MILEAGE",
    price: 1500,
    tier: "STANDARD",
    description:
      "CPM дотор машины mileage тохируулах үйлчилгээ. Хүссэн утгаа худалдан авсны дараа админд өгнө.",
  },
  {
    id: "front-bumper",
    name: "FRONT BUMPER",
    price: 1200,
    tier: "STANDARD",
    description:
      "CPM дотор front bumper-тэй холбоотой тохиргоо хийх үйлчилгээ.",
  },
  {
    id: "rear-bumper",
    name: "REAR BUMPER",
    price: 1200,
    tier: "STANDARD",
    description:
      "CPM дотор rear bumper-тэй холбоотой тохиргоо хийх үйлчилгээ.",
  },
  {
    id: "chrome-pack",
    name: "CHROME PACK",
    price: 3200,
    tier: "PRO",
    description:
      "CPM дотор car, headlights, bumpers, rims, calipers хэсгүүдэд Chrome тохиргоо хийх багц үйлчилгээ.",
  },
  {
    id: "king-rank",
    name: "KING RANK",
    price: 6500,
    tier: "PREMIUM",
    description:
      "CPM дотор King Rank-тэй холбоотой үйлчилгээ. Худалдан авсны дараа админтай холбогдож гүйцэтгүүлнэ.",
  },
  {
    id: "unlock-pack",
    name: "UNLOCK PACK",
    price: 5800,
    tier: "PREMIUM",
    description:
      "CPM дотор animation, horns, male gear, female gear болон levels unlock хийх багц үйлчилгээ.",
  },
  {
    id: "change-id",
    name: "CHANGE ID",
    price: 3500,
    tier: "PRO",
    description:
      "CPM дотор тоглогчийн ID-г өөрчлөх үйлчилгээ. Шинэ ID-ийн мэдээллээ админд өгнө.",
  },
  {
    id: "set-wins-losses",
    name: "SET WINS / SET LOSSES",
    price: 3000,
    tier: "PRO",
    description:
      "CPM дотор wins болон losses үзүүлэлтийг тохируулах үйлчилгээ. Хүссэн утгаа админд өгнө.",
  },
  {
    id: "police",
    name: "POLICE",
    price: 2500,
    tier: "PRO",
    description:
      "CPM дотор Police-тэй холбоотой нэг удаагийн үйлчилгээ. Худалдан авсны дараа админтай холбогдоно.",
  },
  {
    id: "premium-30-day",
    name: "CAR PARKING · 30 DAY PREMIUM",
    price: 10000,
    tier: "PREMIUM",
    description:
      "CPM-ийн 30 хоногийн Premium эрхтэй холбоотой хамгийн өндөр үнэтэй үйлчилгээ. Бүтэн сар идэвхтэй Coin цуглуулж байж авах зорилтот premium ангилал.",
  },
  {
    id: "name-color",
    name: "NAME COLOR",
    price: 2500,
    tier: "PRO",
    description:
      "CPM дотор тоглогчийн нэрийн өнгийг сонгосон өнгөөр өөрчлөх үйлчилгээ. Хүссэн өнгөө админд мэдэгдэнэ.",
  },
];

export const SHOP_ADMIN_INSTAGRAM_URL =
  "https://www.instagram.com/crewnike_?stkn=MTFzOGk1bXk0bmhvNg%3D%3D&utm_source=qr";

export const CPM_SERVICE_BY_ID = new Map(CPM_SERVICE_CATALOG.map((service) => [service.id, service]));
