# Pestañas de Sysacad para Super CVG (desde la 2.4.0)

Nombre interno: «Sysacad caching». Para el alumno, la pantalla se llama **Sysacad** en Super CVG.

Cada vez que el alumno abre una de estas pestañas de Sysacad, la extensión guarda en `chrome.storage.local` una copia
de lo que se vio (solo texto: títulos, párrafos y tablas), una por pestaña, con la fecha. Super CVG la pide al cargar y
al volver a la pestaña, y la muestra. Super CVG la tiene solo en memoria, como los finales.

## Cuándo se guarda

- Solo con Super CVG vinculado (`supercvgVinculado`) y el ajuste `supercvgGuardaPestanas` prendido. Ese ajuste es
  nuevo, arranca en `true` y se apaga en Ajustes, debajo del de Super CVG y solo visible mientras está vinculado
  («Guardar las pestañas que abrís»). Apagarlo borra lo guardado (copias y alumno). Desvincular Super CVG también lo
  borra, desde Ajustes o desde su página.
- Solo en el marco principal (`esPrincipal`), solo en estas pestañas (ruta en minúsculas, sin la consulta):

| `clave` | Ruta | Título que se guarda |
|---|---|---|
| `estado` | `/estadoacademico.asp` | Estado académico |
| `parciales` | `/notasparciales.asp` | Notas de parciales |
| `examenes` | `/examenes.asp` | Exámenes |
| `plan` | `/materiasplan.asp` | Materias del plan |
| `correlativas-cursar` | `/correlatividadcursado.asp` | Correlatividad para cursar |
| `correlativas-rendir` | `/correlatividadexamen.asp` | Correlatividad para rendir |
| `certificados` | `/menucertificados.asp` | Certificados |

- Se lee el contenido original de Sysacad, nunca lo que dibuja la extensión (`#sysacad-lindo`, `.sl-*`, las tablas que
  reemplaza: se toman antes de mejorarlas o de su copia oculta). Fuera: formularios con campos (`input`, `select`,
  `textarea` y sus valores), enlaces (solo su texto), imágenes, scripts, la cabecera y el pie de Sysacad, «Volver a
  menú principal». Fuera también lo oculto (`hidden`, `aria-hidden="true"`, `display: none` en línea). Si no queda
  ningún bloque, no se guarda nada (y lo anterior de esa pestaña queda). Abrir de nuevo una pestaña reemplaza solo su
  copia.
- Cómo se arma (visto con las copias reales): se recorre `.wrapper` (o `body`) en orden. Las tablas de maquetación
  (las que tienen otra tabla adentro o una sola columna) no son bloques: se recorre su contenido. Cada tabla de datos es
  un bloque `tabla`; cada párrafo o tramo de texto suelto, un bloque. La fila de título de Sysacad
  (`td.tituloTabla`, «Exámenes de PEREZ, Juan al 2/11/2026 22:03:03») queda como primer `titulo`: trae el nombre y la
  fecha de los datos.
- El alumno: el nombre de la primera línea de `datosDelAlumno` del menú (`APELLIDO, Nombre`), guardado al pasar por el
  menú como `supercvgAlumno` (solo con Super CVG vinculado y el ajuste prendido). Va en el mensaje para que Super CVG
  lo compare con la cuenta del campus. Si el menú muestra otro nombre que el guardado (otra cuenta en este navegador),
  las copias anteriores se borran.

Lo guardado: `supercvgPestanas: { [clave]: { fecha, bloques } }`, `supercvgAlumno: string` y el ajuste
`supercvgGuardaPestanas: boolean`.

## Mensajes (por `postMessage` de la misma ventana, como la v1)

Página a extensión, nuevos pedidos en `supercvg.js`:

- `{ fuente: 'super-cvg', pide: 'pestanas' }`: contesta el mensaje de abajo.
- `{ fuente: 'super-cvg', pide: 'olvidar-pestanas' }`: borra `supercvgPestanas` y `supercvgAlumno` (Salir en Super CVG,
  o «Borrarlas» cuando son de otra cuenta) y contesta. Lo vuelve a guardar la próxima pestaña o el próximo menú.

Extensión a página, una forma nueva con `v: 2`. El Super CVG publicado la ignora porque exige `v: 1`, y la extensión
sigue contestando el `v: 1` de siempre a `pide: 'sysacad'`:

```js
{
  fuente: 'sysacad-lindo', para: 'super-cvg', v: 2, tipo: 'pestanas',
  vinculada: true | false,
  guarda: true | false,          // el ajuste supercvgGuardaPestanas (false si no está vinculada)
  alumno: 'PEREZ, Juan' | null,  // null si no está vinculada, con el ajuste apagado o si todavía no pasó por el menú
  pestanas: [                    // [] si no está vinculada o no hay nada; en el orden de la tabla de arriba
    { clave: 'examenes', titulo: 'Exámenes', fecha: 1762800000000, bloques: [ ... ] },
  ],
}
```

Bloques, solo estas formas y con estas claves exactas:

- `{ t: 'titulo', texto }`: un encabezado de la página (`h1`–`h6`, siempre, recortado a 200), o un tramo suelto de
  hasta 200 caracteres todo en negrita, `th` o `.tituloTabla` (lo que Sysacad usa de título).
- `{ t: 'texto', texto }`: un párrafo suelto.
- `{ t: 'tabla', titulo, columnas, filas }`: `titulo` es string o `null` (la primera fila de la tabla si tiene una sola
  celda; en las páginas vistas, siempre `null`); `columnas`, array de strings (la primera fila si todas sus celdas con
  texto son `th`, negrita o `.tituloTabla`; si no, `[]`); `filas`, array de arrays de strings. Celdas vacías como
  `''`; filas vacías y la de «Volver a menú principal», fuera. Cada fila con a lo sumo `columnas.length` celdas cuando
  hay columnas (sin columnas, hasta 30); puede tener menos (una fila de total con `colspan` queda con una celda).
- Varias líneas dentro de una celda o un párrafo (`<br>` o bloques adentro) quedan en el mismo string separadas por
  ` · ` (por ejemplo, las correlativas que faltan para una materia).

Topes (la extensión recorta al guardar y Super CVG rechaza el mensaje entero si se pasan): 7 pestañas, 60 bloques por
pestaña, `texto` hasta 2000 caracteres, `titulo` hasta 200, 30 columnas, 500 filas por tabla, celda hasta 300,
`alumno` hasta 120. Textos sin caracteres de control y con los espacios juntados. `fecha` entero positivo y no más de
un día en el futuro. `clave` y `titulo` tienen que coincidir con la tabla de arriba; una `clave` no se repite.
`bloques` nunca va vacío (Super CVG descarta esa pestaña sin rechazar el mensaje). El orden de la tabla es una
promesa, pero Super CVG lo rearma si llega otro. Cualquier otra clave, forma o tipo: el mensaje no vale.

## Qué hace Super CVG con eso

- Solo en memoria. Nunca en disco, en la URL ni en el título.
- Muestra las copias solo si el nombre de `alumno` coincide con la cuenta del campus: palabras sin tildes, mayúsculas,
  comas ni palabras chicas; el conjunto más corto entero dentro del más largo, y al menos dos palabras. Si no
  coincide, no las muestra y ofrece borrarlas (`olvidar-pestanas`). Sin `alumno`, tampoco las muestra (pide pasar por
  el menú de Sysacad). Con `guarda: false`, el alumno apagó el ajuste: decirle dónde se prende, no que pase por el
  menú.
- Salir en Super CVG manda `olvidar-pestanas`.
- Si la extensión contesta la `v: 1` pero no la `v: 2` en un momento, es una versión vieja: «Actualizá Sysacad Lindo».
