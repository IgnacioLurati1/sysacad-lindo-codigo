# Sysacad Lindo

Extensión de Chrome o Edge que rediseña Sysacad FRRO: tu carrera ordenada por año, filtros en las tablas largas, modo oscuro y tus materias a mano. Todas las acciones las hacés vos: no tiene temporizadores, no hace pedidos por su cuenta, no completa ni envía formularios y no guarda credenciales.

## Instalar

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá el modo de desarrollador.
3. Elegí "Cargar descomprimida" y seleccioná esta carpeta.

Para que el login sea rápido, guardá tu usuario y contraseña en el gestor del navegador.

## Usar

- **Estado académico:** muestra promedio, avance y materias por año, con búsqueda y filtros por año y estado. Toma los datos de la tabla de Sysacad, que queda oculta en la página. El filtro cuenta igual que el resumen: Aprobadas, Regulares y Sin cursar son de la carrera, y las electivas tienen su propio filtro.
- **Electivas:** no cuentan para el avance de la carrera. Sus horas se suman aparte y sí entran en el promedio. Una materia complementaria sin cursar tampoco cuenta. Seminario Integrador va con las electivas aunque Sysacad no le ponga la marca, y no suma horas de electivas.
- **Tablas largas:** desde 6 filas tienen búsqueda y filtros por las columnas que se repiten. Si no tienen campos, también se ordenan tocando el título de la columna.
- **Mis materias:** resalta en dorado las filas que coinciden. Escribí el nombre igual que en Sysacad; no importan mayúsculas ni tildes. Si cargás comisión, las otras comisiones de esa materia quedan en dorado claro. Hacé clic en una materia de la barra de abajo para ir a su fila.
- **Mostrar solo mis materias:** oculta las demás filas de esa tabla. Títulos, botones y filas ya marcadas siguen visibles.
- **Probar de nuevo:** aparece en Inscripción a cursado, en la barra de abajo, y recarga esa página. Cada clic hace un solo intento.
- **Cabecera:** acompaña al bajar en todas las páginas internas, con "Ir al menú", "Ajustes" y el modo oscuro.
- **Modo oscuro:** arranca como tu sistema y el botón de la luna lo cambia. Queda guardado.
- **Ajustes:** el botón está en la cabecera, en el menú y en el login. Todo se guarda en este navegador y se aplica al instante:
  - **Vista:** Claustro (tarjetas), Analítico (como un certificado, sin tarjetas) o Tablero (dos columnas compactas).
  - **Tamaño de letra:** chica, normal, grande o muy grande.
  - **Colores:** color principal y color de tus materias. Si elegís un color principal muy claro, se oscurece para que se lea.
  - **Modo daltónicos:** para confundir rojo y verde o azul y amarillo. Cambia los colores de los estados y les suma un símbolo.
  - **Alto contraste:** blanco y negro con bordes marcados. Ignora los colores elegidos y saca el fondo.
  - **Bajo movimiento:** saca el fondo animado y las transiciones. También se activa solo si tu sistema pide reducir el movimiento.
- **Fondo con frases:** notas al margen que aparecen cada tanto, con alguna mala palabra. Se ven en ventanas de 1180 px o más, donde el margen alcanza. Cada dos minutos cruza un avión con un cartel, que no toma clics. Todo se apaga en Ajustes.
- **Correlatividades:** se ordenan por año, con filtros por situación y tipo, la lista de lo que te falta y las materias que más te frenan.
- **¿Y si la saco?:** tocá una materia de "Lo que más te frena" o del mapa para suponer que la sacás. Te dice qué materias ya podrías cursar o rendir y las marca. "Empezar de nuevo" borra la suposición. No se guarda ni se envía nada.
- **Mapa de correlativas:** en "Ver", elegí "Mapa". Muestra una columna por año y una línea desde lo que te falta hasta lo que traba. Al pasar sobre una materia se ilumina todo lo que tiene detrás. En pantallas angostas se desliza de costado.
- **Inscripción a exámenes:** la lista va por año, con las materias de la carrera primero y las electivas aparte, y se filtra por año y por tipo. Las fechas de cada materia van agrupadas por día, y cada tribunal es una tarjeta que se toca entera. Al inscribirte queda un comprobante con el día, el tribunal, el horario y el código de seguridad, y el certificado muestra uno por examen. Los enlaces, las opciones y el botón «Inscribirse» son los de Sysacad: no se manda nada hasta que lo tocás.
- **Certificados:** cada certificado es una tarjeta, y al lado queda el aviso de Sysacad: al generar el certificado de cursado ya no se pueden eliminar las inscripciones.
- **El Santo Resumen:** en el menú y en Estado académico te ofrece vincularla (también en Ajustes). Vinculada, cada vez que entrás a Estado académico guarda en este navegador qué materias aprobaste y regularizaste (solo nombre y estado, sin notas), y `santo.js` se las pasa al mapa de materias de El Santo Resumen (`lutastudios.com/utn`) cuando lo abrís. No sale nada a ningún servidor. Desvincularla borra lo guardado.
- **Super CVG:** después de responder la invitación de El Santo Resumen, el menú y Estado académico ofrecen vincular Super CVG (también en Ajustes, o desde la misma página de Super CVG). Vinculado, cada vez que entrás a Estado académico guarda en este navegador la nota final de cada materia aprobada con nota (solo nombre y nota, sin equivalencias sin nota, tomo, folio ni horas), y `supercvg.js` se las pasa a Super CVG (`supercvg.lutastudios.com`) cuando lo abrís. Si lo vinculaste desde Super CVG y todavía no entraste a Estado académico, el menú te lo recuerda con el enlace. Vinculado, también guarda una copia en texto (títulos, párrafos y tablas, sin campos ni lo que dibuja la extensión) de cada pestaña que abrís: Estado académico, Notas de parciales, Exámenes, Materias del plan, las dos Correlatividades y Certificados, más tu nombre del menú para que Super CVG la muestre solo con tu cuenta. Se apaga en Ajustes ("Guardar las pestañas que abrís"); apagarlo borra las copias. Qué se pasa y cómo: `docs/CONTRATO-SUPERCVG.md`. No sale nada a ningún servidor. Desvincularlo borra lo guardado.
- **Login:** el cronograma y los avisos quedan al lado del formulario. Si ya abriste el menú, marca tu turno según tu año de ingreso.

## Límites

- El menú, el login, la inscripción cerrada, la inscripción a exámenes (lista, fechas, inscripción hecha y certificado), Exámenes, Notas de parciales, Certificados y las dos Correlatividades se probaron con copias reales, con nombre, notas y fechas de examen cambiados. Estado académico se probó con una página armada a partir de una captura, con datos inventados. La inscripción a cursado abierta y Materias del plan se probaron con páginas simuladas, porque todavía no se vio su HTML real.
- Sysacad corta los nombres a 40 caracteres y a veces se pierde la marca "(Elec.)". Las electivas plan 2023 afectadas están en una lista dentro de `contenido.js`, armada con la página real de correlatividades.
- Las 20 horas de electivas para recibirse salen de la Ordenanza 1877 de la UTN (4 en tercer nivel, 6 en cuarto y 10 en quinto, 480 horas reloj). Se muestran solo en Ingeniería en Sistemas de Información, plan 2023. Las horas sumadas son las que Sysacad indica en cada electiva aprobada.
- Si el navegador muestra su propia página de error porque el servidor no responde, la extensión no aparece. Recargá con F5.

## Pruebas

Abren Chromium con la extensión cargada y responden todo el tráfico localmente, sin contactar a Sysacad.

```
npm install
npx playwright-core install chromium
npm test
```

Si ya tenés Playwright en otro lado, `PLAYWRIGHT_MODULE=<ruta al paquete>` y `CHROMIUM_PATH=<ruta al navegador>` le ganan. Las capturas quedan en `pruebas/capturas/`.

Las pruebas también fallan si `contenido.js` o `inicio.js` incorporan temporizadores, pedidos de red, envíos de formularios o clics simulados.

Las páginas de `pruebas/paginas/` son copias de Sysacad con el alumno, las notas, las fechas y los códigos inventados.

## Versiones

- **2.4.1:** inscripción a exámenes rediseñada: lista por año con las electivas aparte, fechas en tarjetas, comprobante al inscribirte y certificado en tarjetas, sin tu nombre. El ícono dorado del menú se ve en modo oscuro.
- **2.4.0:** copia en texto de las pestañas de Sysacad que abrís, para verlas en Super CVG (se apaga en Ajustes).
- **2.3.0:** vínculo con Super CVG, también desde su página. El filtro de Estado académico cuenta igual que el resumen y suma el filtro Electivas. Seminario Integrador va con las electivas, sin sumar horas. En cada año, las electivas van después de las materias de la carrera.
- **2.2.0:** vínculo con El Santo Resumen.

## Fuentes

Source Serif 4 y Source Sans 3, de Adobe, con licencia SIL Open Font License (`fuentes/OFL-source-serif.txt` y `fuentes/OFL-source-sans.txt`). Vienen dentro de la extensión y no se descargan de ningún lado.

## Licencia

[GNU AGPL v3.0](LICENSE). Si publicás una versión modificada, compartís su código con la misma licencia. Lo que viene de terceros mantiene la suya: [THIRD-PARTY.md](THIRD-PARTY.md).

El nombre «Sysacad Lindo» no entra en la licencia. Una versión tuya lleva otro nombre.
