#!/usr/bin/env python3
"""
Actualiza los datos oficiales de la app desde las fuentes públicas.

Fuentes:
  - Escalas salariales   → PDF mensual de ARCA (Casas Particulares)
  - Aportes F.102/RT     → PDF mensual de ARCA
  - Feriados nacionales  → api.argentinadatos.com

Escribe src/data/escalas.json, aportes.json y feriados.json.
Es idempotente: sólo agrega lo que falta y sólo reescribe si algo cambió.

Uso:
    python3 scripts/actualizar-datos.py             # trae lo que falte
    python3 scripts/actualizar-datos.py --forzar    # re-baja todo
    python3 scripts/actualizar-datos.py --desde 2026-01
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("Falta pypdf. Instalalo con:  pip install pypdf")

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "src" / "data"

BASE_ARCA = "https://www.afip.gob.ar/casasparticulares"
URL_ESCALA = BASE_ARCA + "/categorias-y-remuneraciones/documentos/{anio}/Casas-particulares-remuneraciones-{mm}-{aa}.pdf"
URL_APORTES = BASE_ARCA + "/aportes-contribuciones-ART/documentos/{anio}/Casas-particulares-aportes-y-contribuciones-{mm}-{aa}.pdf"
URL_FERIADOS = "https://api.argentinadatos.com/v1/feriados/{anio}"

AGENTE = "Mozilla/5.0 (compatible; sueldos-casa/1.0; actualizador de datos oficiales)"

MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

# Las categorías aparecen siempre en este orden en el PDF de ARCA.
# Cada una se ancla con un texto que la identifica sin ambigüedad.
ANCLAS_CATEGORIAS = [
    ("supervisor", r"Supervisor"),
    ("especificas", r"tareas\s+espec"),
    ("caseros", r"Caseros"),
    ("cuidado", r"Cuidado de personas"),
    ("generales", r"tareas\s+generales"),
]

CAMPOS_ESCALA = ["horaConRetiro", "horaSinRetiro", "mesConRetiro", "mesSinRetiro"]

ANCLAS_TRAMOS = [
    ("Menos de 12 hs semanales", r"Menos de 12", 0, 12),
    ("De 12 a menos de 16 hs semanales", r"menos de 16", 12, 16),
    ("16 hs semanales o más", r"16 o m", 16, None),
]

CAMPOS_APORTES = ["total", "obraSocial", "art", "sipa"]

# "$ 1.234,56", "$ -", y también "$ 5 17.006,43" (ARCA a veces mete un espacio adentro).
RE_PLATA = re.compile(r"\$\s*(-|\d[\d\s.]*,\d{2})")


# --------------------------------------------------------------------------- #
# Utilidades                                                                   #
# --------------------------------------------------------------------------- #

def bajar(url: str) -> bytes | None:
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    try:
        with urllib.request.urlopen(pedido, timeout=45) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"    ! HTTP {e.code} en {url}")
        return None
    except Exception as e:  # red caída, timeout, DNS
        print(f"    ! No se pudo bajar {url}: {e}")
        return None


def texto_del_pdf(crudo: bytes) -> str:
    return PdfReader(io.BytesIO(crudo)).pages[0].extract_text() or ""


def a_numero(token: str) -> float | None:
    """'5 17.006,43' -> 517006.43   |   '-' -> None"""
    if token.strip() == "-":
        return None
    limpio = token.replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return round(float(limpio), 2)
    except ValueError:
        return None


def plata_entre_anclas(texto: str, anclas: list[tuple], cantidad: int) -> dict:
    """
    Para cada ancla, devuelve los `cantidad` importes que aparecen entre esa
    ancla y la siguiente. Es robusto a que el PDF corte las filas en varias
    líneas, porque trabaja sobre el texto aplanado.
    """
    plano = " ".join(texto.split())
    posiciones = []
    for ancla in anclas:
        clave, patron = ancla[0], ancla[1]
        m = re.search(patron, plano, re.IGNORECASE)
        if not m:
            raise ValueError(f"No encontré la fila '{clave}' en el PDF")
        posiciones.append((clave, m.start()))
    posiciones.sort(key=lambda p: p[1])

    salida = {}
    for i, (clave, ini) in enumerate(posiciones):
        fin = posiciones[i + 1][1] if i + 1 < len(posiciones) else len(plano)
        tokens = RE_PLATA.findall(plano[ini:fin])
        if len(tokens) < cantidad:
            raise ValueError(
                f"La fila '{clave}' trajo {len(tokens)} importes y esperaba {cantidad}"
            )
        salida[clave] = [a_numero(t) for t in tokens[:cantidad]]
    return salida


def periodos(desde: str, hasta: str):
    a1, m1 = (int(x) for x in desde.split("-"))
    a2, m2 = (int(x) for x in hasta.split("-"))
    n = a1 * 12 + (m1 - 1)
    fin = a2 * 12 + (m2 - 1)
    while n <= fin:
        yield f"{n // 12:04d}-{n % 12 + 1:02d}"
        n += 1


def etiqueta(periodo: str) -> str:
    a, m = periodo.split("-")
    return f"{MESES[int(m) - 1]} {a}"


def leer_json(nombre: str, clave: str) -> dict:
    ruta = DATOS / nombre
    if ruta.exists():
        return json.loads(ruta.read_text(encoding="utf-8"))
    return {"actualizado": None, clave: []}


def guardar_json(nombre: str, contenido: dict) -> bool:
    """Devuelve True si el archivo cambió."""
    ruta = DATOS / nombre
    contenido["actualizado"] = date.today().isoformat()
    nuevo = json.dumps(contenido, ensure_ascii=False, indent=2) + "\n"
    previo = ruta.read_text(encoding="utf-8") if ruta.exists() else None
    # Comparo ignorando el sello de fecha, para no ensuciar el historial de git.
    if previo is not None:
        a = json.loads(previo)
        b = json.loads(nuevo)
        a.pop("actualizado", None)
        b.pop("actualizado", None)
        if a == b:
            return False
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(nuevo, encoding="utf-8")
    return True


# --------------------------------------------------------------------------- #
# Escalas salariales                                                           #
# --------------------------------------------------------------------------- #

def parsear_escala(texto: str, periodo: str) -> dict:
    filas = plata_entre_anclas(texto, ANCLAS_CATEGORIAS, 4)

    # ARCA lo escribe de dos formas según el mes: "equivalente al 30% sobre..."
    # y "equivalente al TREINTA Y UNO POR CIENTO (31%) sobre...". Me anclo en la
    # frase y tomo el primer porcentaje que aparezca después.
    m = re.search(r"zona\s+desfavorable.{0,300}?(\d{1,3})\s*%", texto, re.IGNORECASE | re.DOTALL)
    if not m:
        raise ValueError("No encontré el porcentaje de zona desfavorable")
    zona = int(m.group(1))
    if not 0 < zona < 100:
        raise ValueError(f"Zona desfavorable fuera de rango: {zona}")

    valores = {}
    for clave, _ in ANCLAS_CATEGORIAS:
        valores[clave] = dict(zip(CAMPOS_ESCALA, filas[clave]))

    # Chequeo de cordura: tareas generales con retiro es siempre el piso.
    piso = valores["generales"]["horaConRetiro"]
    if piso is None or not 100 < piso < 10_000_000:
        raise ValueError(f"El valor hora de tareas generales quedó raro: {piso}")

    return {
        "vigenciaDesde": periodo,
        "etiqueta": etiqueta(periodo),
        "zonaDesfavorablePct": zona,
        "fuente": f"ARCA — Casas particulares, remuneraciones {etiqueta(periodo)}",
        "valores": valores,
    }


def actualizar_escalas(desde: str, hasta: str, forzar: bool) -> bool:
    doc = leer_json("escalas.json", "escalas")
    porPeriodo = {e["vigenciaDesde"]: e for e in doc["escalas"]}
    nuevas = 0

    for periodo in periodos(desde, hasta):
        if periodo in porPeriodo and not forzar:
            continue
        anio, mes = periodo.split("-")
        url = URL_ESCALA.format(anio=anio, mm=mes, aa=anio[2:])
        crudo = bajar(url)
        if crudo is None:
            continue
        try:
            escala = parsear_escala(texto_del_pdf(crudo), periodo)
        except Exception as e:
            print(f"    ! {periodo}: no pude leer el PDF ({e})")
            continue
        estado = "actualizada" if periodo in porPeriodo else "NUEVA"
        porPeriodo[periodo] = escala
        nuevas += 1
        print(
            f"    · {etiqueta(periodo)} {estado}: "
            f"generales c/retiro ${escala['valores']['generales']['horaConRetiro']:,.2f}/h "
            f"· zona {escala['zonaDesfavorablePct']}%"
        )

    doc["escalas"] = sorted(porPeriodo.values(), key=lambda e: e["vigenciaDesde"], reverse=True)
    cambio = guardar_json("escalas.json", doc)
    print(f"  escalas.json: {len(doc['escalas'])} escalas ({nuevas} tocadas)")
    return cambio


# --------------------------------------------------------------------------- #
# Aportes y contribuciones                                                     #
# --------------------------------------------------------------------------- #

def parsear_aportes(texto: str, periodo: str) -> dict:
    # Sólo la tabla de "trabajador activo mayor de 18 años".
    if "Mayor de 18" not in texto:
        raise ValueError("No encontré la sección de mayores de 18")
    seccion = texto.split("Mayor de 18", 1)[1].split("Menor de 18", 1)[0]

    filas = plata_entre_anclas(seccion, ANCLAS_TRAMOS, 4)

    tramos = []
    for nombre, patron, desde_hs, hasta_hs in ANCLAS_TRAMOS:
        vals = dict(zip(CAMPOS_APORTES, filas[nombre]))
        if any(v is None for v in vals.values()):
            raise ValueError(f"El tramo '{nombre}' tiene importes vacíos")
        suma = vals["obraSocial"] + vals["art"] + vals["sipa"]
        if abs(suma - vals["total"]) > 1:
            raise ValueError(
                f"El tramo '{nombre}' no cierra: {suma:.2f} != total {vals['total']:.2f}"
            )
        tramos.append({
            "etiqueta": nombre,
            "desdeHoras": desde_hs,
            "hastaHoras": hasta_hs,
            **vals,
        })

    a, m = periodo.split("-")
    vence = MESES[int(m) % 12]
    return {
        "vigenciaDesde": periodo,
        "etiqueta": f"{etiqueta(periodo)} (vence en {vence.lower()})",
        "fuente": f"ARCA — Casas particulares, aportes y contribuciones {etiqueta(periodo)}",
        "tramos": tramos,
    }


def actualizar_aportes(desde: str, hasta: str, forzar: bool) -> bool:
    doc = leer_json("aportes.json", "tablas")
    porPeriodo = {t["vigenciaDesde"]: t for t in doc["tablas"]}
    nuevas = 0

    for periodo in periodos(desde, hasta):
        if periodo in porPeriodo and not forzar:
            continue
        anio, mes = periodo.split("-")
        url = URL_APORTES.format(anio=anio, mm=mes, aa=anio[2:])
        crudo = bajar(url)
        if crudo is None:
            continue
        try:
            tabla = parsear_aportes(texto_del_pdf(crudo), periodo)
        except Exception as e:
            print(f"    ! {periodo}: no pude leer el PDF ({e})")
            continue
        estado = "actualizada" if periodo in porPeriodo else "NUEVA"
        porPeriodo[periodo] = tabla
        nuevas += 1
        print(f"    · {etiqueta(periodo)} {estado}: 16+ hs ${tabla['tramos'][2]['total']:,.2f}")

    doc["tablas"] = sorted(porPeriodo.values(), key=lambda t: t["vigenciaDesde"], reverse=True)
    cambio = guardar_json("aportes.json", doc)
    print(f"  aportes.json: {len(doc['tablas'])} tablas ({nuevas} tocadas)")
    return cambio


# --------------------------------------------------------------------------- #
# Feriados                                                                     #
# --------------------------------------------------------------------------- #

TIPOS_API = {
    "inamovible": "inamovible",
    "trasladable": "trasladable",
    "puente": "turistico",
    "nolaborable": "no_laborable",
    "no_laborable": "no_laborable",
}


def actualizar_feriados(anios: list[int]) -> bool:
    doc = leer_json("feriados.json", "feriados")
    porFecha = {f["fecha"]: f for f in doc["feriados"]}

    for anio in anios:
        crudo = bajar(URL_FERIADOS.format(anio=anio))
        if crudo is None:
            print(f"    · {anio}: todavía no hay calendario publicado")
            continue
        try:
            lista = json.loads(crudo)
        except Exception as e:
            print(f"    ! {anio}: respuesta inválida ({e})")
            continue
        if not isinstance(lista, list) or not lista:
            print(f"    · {anio}: sin feriados en la respuesta")
            continue

        # Reemplazo el año entero: si salió el decreto, los traslados y los
        # puentes cambian de fecha y no alcanza con agregar.
        for fecha in [f for f in porFecha if f.startswith(str(anio))]:
            del porFecha[fecha]

        for f in lista:
            fecha = f.get("fecha", "")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha):
                continue
            tipo = TIPOS_API.get(str(f.get("tipo", "")).lower().replace(" ", "_"), "inamovible")
            porFecha[fecha] = {
                "fecha": fecha,
                "nombre": f.get("nombre", "Feriado"),
                "tipo": tipo,
            }
        print(f"    · {anio}: {len(lista)} feriados")

    doc["feriados"] = sorted(porFecha.values(), key=lambda f: f["fecha"])
    cambio = guardar_json("feriados.json", doc)
    print(f"  feriados.json: {len(doc['feriados'])} feriados")
    return cambio


# --------------------------------------------------------------------------- #

def main() -> int:
    hoy = date.today()
    ap = argparse.ArgumentParser(description="Actualiza los datos oficiales de sueldos-casa")
    ap.add_argument("--desde", default="2026-01", help="primer período a buscar (AAAA-MM)")
    ap.add_argument("--forzar", action="store_true", help="re-baja todo aunque ya esté")
    args = ap.parse_args()

    # Miro dos meses para adelante: las resoluciones a veces salen anticipadas.
    tope = hoy.year * 12 + (hoy.month - 1) + 2
    hasta = f"{tope // 12:04d}-{tope % 12 + 1:02d}"

    print(f"Actualizando datos oficiales ({args.desde} → {hasta})\n")

    print("Escalas salariales (ARCA)")
    c1 = actualizar_escalas(args.desde, hasta, args.forzar)
    print("\nAportes y contribuciones (ARCA)")
    c2 = actualizar_aportes(args.desde, hasta, args.forzar)
    print("\nFeriados nacionales (argentinadatos)")
    c3 = actualizar_feriados([hoy.year, hoy.year + 1, hoy.year + 2])

    cambio = c1 or c2 or c3
    print(f"\n{'Hubo cambios.' if cambio else 'Sin novedades: ya estaba todo al día.'}")

    # El workflow de GitHub lee esto para decidir si commitea.
    print(f"::cambios::{'si' if cambio else 'no'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
