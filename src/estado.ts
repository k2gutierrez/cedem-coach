import { atom } from "jotai";

/** Archivo que el coach eligió, para mostrarlo antes de enviarlo. */
export const archivoAtom = atom<{ nombre: string; bytes: number } | null>(null);

/** En qué paso va la carga de una sesión. */
export type Fase = "inicio" | "enviando" | "subiendo" | "leyendo" | "analizando" | "listo";

export const faseAtom = atom<Fase>("inicio");
