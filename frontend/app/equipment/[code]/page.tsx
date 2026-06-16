// app/equipment/[code]/page.tsx
import EquipmentQRClient from './EquipmentQRClient';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <EquipmentQRClient />;
}