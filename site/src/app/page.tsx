import HomeClient from "@/components/HomeClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HomePage() {
  return <HomeClient />;
}
