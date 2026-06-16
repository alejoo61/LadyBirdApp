// app/equipment/[code]/page.tsx
// Server Component wrapper — requerido para static export

export function generateStaticParams() {
  return [];
}

export { default } from './EquipmentQRClient';