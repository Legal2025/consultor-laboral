import { notFound } from "next/navigation";
import { MODULOS, moduloPorSlug } from "@cl/shared";
import { VistaModulo } from "./VistaModulo";

const PROPIOS = new Set(["expedientes", "configuracion"]);

export function generateStaticParams() {
  return MODULOS.filter((m) => !PROPIOS.has(m.slug)).map((m) => ({ slug: m.slug }));
}

export default async function PaginaModulo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const modulo = moduloPorSlug(slug);
  if (!modulo || PROPIOS.has(slug)) notFound();
  return <VistaModulo slug={modulo.slug} />;
}
