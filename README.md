# Sueldos de casa

Calculadora mensual de sueldos para **personal de casas particulares** (Ley 26.844), pensada
para una casa con una niñera y una empleada doméstica en **Cipolletti, Río Negro**.

Es una web app que anda en el celular como si fuera una app nativa: se puede agregar a la
pantalla de inicio, funciona sin internet y guarda todo en el teléfono. No hay servidor, no hay
cuenta, no se sube nada a ningún lado.

**Los datos oficiales se actualizan solos**: un robot mira ARCA todos los días y, cuando sale una
resolución nueva, se actualiza la app sin que nadie toque nada.

## Qué resuelve

Cada mes hay que:

1. Fijarse en ARCA cuál es el sueldo mínimo vigente de cada categoría.
2. Sumarle el **31% de zona desfavorable** (Patagonia).
3. Sumarle el **1% por año de antigüedad**.
4. Contar qué días vino y cuáles no.
5. Pagar **doble** los feriados que trabajó, y pagar igual los que cayeron en su día y no vino.
6. Sumar plus, adelantos, aguinaldo, vacaciones.
7. Acordarse de que además hay que pagar el F.102 en ARCA.

La app hace todo eso: se cargan las personas una sola vez, y después cada mes es tocar los días
que fueron distintos y leer el total.

## El robot que mantiene los datos al día

```
                      ┌──────────────────────────────┐
  ARCA (PDF) ────────▶│  scripts/actualizar-datos.py │
  argentinadatos ────▶│  baja, parsea y valida       │
                      └──────────────┬───────────────┘
                                     │ si algo cambió
                                     ▼
                          src/data/*.json  ──▶  npm test  ──▶  commit  ──▶  GitHub Pages
                                                    │
                                            si falla, no publica
```

`.github/workflows/actualizar-datos.yml` corre **todos los días a las 8 de la mañana** (hora
argentina). El script baja los PDF de ARCA, extrae las tablas y las compara con lo que ya hay.
Si no cambió nada, no hace nada. Si cambió:

1. Escribe los JSON nuevos.
2. Corre los 61 tests, incluidos **23 que validan los datos mismos**: que los importes cierren,
   que las categorías estén completas, que los mínimos no bajen, que los feriados existan de
   verdad. Si ARCA cambia el formato del PDF y el parser saca cualquier cosa, esto se pone en rojo
   y **no se publica nada roto**.
3. Commitea y publica.

En la pestaña **Datos** de la app se ve la fecha de la última verificación. Si se queda vieja
(más de 45 días), aparece un aviso: es la señal de que el robot dejó de correr.

### Correrlo a mano

```bash
pip install pypdf && python3 scripts/actualizar-datos.py
```

Opciones: `--forzar` re-baja todo aunque ya esté, `--desde 2026-01` cambia el primer mes a buscar.
También se puede disparar desde la pestaña **Actions** de GitHub, con el botón "Run workflow".

## Datos oficiales

| Qué | Cobertura | Fuente |
|---|---|---|
| Escala salarial completa (5 categorías × hora/mes × con/sin retiro) | Desde enero 2026, todos los meses | [ARCA — Categorías y remuneraciones](https://www.afip.gob.ar/casasparticulares/categorias-y-remuneraciones/) |
| Zona desfavorable | 30% hasta marzo 2026, **31% desde abril 2026** | El porcentaje sale del mismo PDF |
| Aportes y contribuciones (F.102/RT) | Desde enero 2026, todos los meses | [ARCA — Aportes, contribuciones y ART](https://www.afip.gob.ar/casasparticulares/aportes-contribuciones-ART/) |
| Feriados nacionales | 2026 y 2027 | [api.argentinadatos.com](https://api.argentinadatos.com/) |

Los feriados vienen con los **traslados ya aplicados**. Por ejemplo, el Día de la Soberanía de
2026 cae lunes **23/11**, no el 20, porque el 20 es viernes y la ley lo corre al lunes siguiente.

Una salvedad sobre los años futuros: los feriados **trasladables** y los **puentes turísticos** se
fijan por decreto. Hasta que salga, un año futuro aparece con las fechas nominales y sin puentes.
El robot lo corrige solo cuando se publica. Y si liquidás un año que todavía no tiene calendario,
la app te avisa en vez de contar los feriados como días comunes.

## Cómo se calcula

**Valor base**

```
valor = mínimo de escala (o el valor acordado, si le pagás más)
      + 31% de zona desfavorable
      + 1% por cada año de antigüedad cumplido al cierre del mes
```

Zona y antigüedad se calculan sobre el básico, no en cascada.

**Si cobra por hora** (menos de 24 hs semanales)

- Horas trabajadas × valor hora.
- Feriado trabajado: horas × valor hora × 2.
- Feriado que cae en un día suyo y no vino: se paga como día normal.
- Licencias justificadas y vacaciones: se pagan.
- Faltas sin aviso: no se pagan.

**Si cobra por mes** (24 hs semanales o más)

- Sueldo mensual completo.
- Feriado trabajado: se suma un día extra (sueldo ÷ 25).
- Falta sin aviso: se descuenta un día (sueldo ÷ 30).

Los dos divisores se pueden cambiar en Ajustes.

**Horas extra**: 50% en días hábiles y sábados hasta las 13; 100% después de las 13 del sábado,
domingos y feriados.

**Aguinaldo**: mitad de la mejor remuneración del semestre, prorrateada si entró con el semestre
empezado. Se propone solo en junio y diciembre.

**Vacaciones**: 14 días corridos hasta 5 años de antigüedad, 21 hasta 10, 28 hasta 20 y 35 de ahí
en adelante.

**Aportes ARCA**: se muestran aparte, según las horas semanales. No se descuentan del sueldo.

La app avisa sola si algo no cierra: valor por debajo del mínimo legal, alguien liquidado por hora
haciendo 24 horas o más, escala vieja, un mes anterior a los datos que hay cargados, o un año sin
feriados.

## Correr el proyecto

```bash
npm install
```

```bash
npm run dev
```

Otros comandos:

```bash
npm test
```

```bash
npm run build
```

## Publicación

Está en **GitHub Pages**, gratis. Cada push a `main` dispara
`.github/workflows/deploy.yml`, que corre los tests, buildea y publica. Si los tests fallan, no
se publica.

El build son archivos estáticos con rutas relativas (`base: './'`), así que también anda tal cual
en Netlify, Vercel o Cloudflare Pages si alguna vez conviene mudarlo.

> **Ojo**: GitHub apaga los workflows programados si el repo no tiene actividad durante 60 días.
> Avisa por mail y se reactiva con un click desde la pestaña Actions.

## Ponerla en el celular

1. Abrir la URL de GitHub Pages en el celular.
2. **iPhone**: Compartir → "Agregar a pantalla de inicio". **Android**: menú → "Instalar app".

Queda con ícono propio, pantalla completa y funciona sin señal.

## Los datos de las chicas

Todo lo que se carga (personas, días, sueldos) se guarda en el `localStorage` del navegador, en
el teléfono. **Nunca sale de ahí**: no viaja a GitHub ni a ningún servidor. Eso significa que:

- No se comparte entre el celular y la computadora.
- Si se borran los datos del navegador, se pierde.

Por eso en **Ajustes → Copia de seguridad** hay un botón para bajar un `.json` con todo y otro
para restaurarlo. Conviene bajarlo de vez en cuando.

## Estructura

```
scripts/
└─ actualizar-datos.py   Baja y parsea ARCA + feriados
.github/workflows/
├─ actualizar-datos.yml  Robot diario
└─ deploy.yml            Build y publicación
src/
├─ domain/
│  ├─ types.ts           Tipos del dominio
│  ├─ calculo.ts         Motor de cálculo (funciones puras, sin React)
│  └─ calculo.test.ts    38 tests sobre casos reales
├─ data/
│  ├─ escalas.json       ← lo escribe el robot
│  ├─ feriados.json      ← lo escribe el robot
│  ├─ aportes.json       ← lo escribe el robot
│  ├─ *.ts               Wrappers tipados y helpers
│  └─ datos.test.ts      23 tests que validan los datos oficiales
├─ store/store.tsx       Estado + persistencia en localStorage
├─ components/           Calendario y kit de UI
├─ pages/                Mes, Detalle, Personas, Datos, Ajustes
└─ lib/                  Formato de moneda y helpers de fecha
```

El motor de cálculo no depende de React ni del navegador: se puede testear y reusar aparte.

## Aviso

Esto es una ayuda para hacer la cuenta, no un recibo de sueldo oficial ni asesoramiento legal.
Los valores salen de las publicaciones de ARCA citadas arriba. Ante una duda, consultá con un
contador.
