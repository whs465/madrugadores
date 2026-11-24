# Cómo actualizar el torneo

Los datos están en `torneo.json`. `index.html` los muestra y `propuesta.js` calcula los saldos. No hay que editar el HTML para agregar información.

Abre `abrir.cmd`: inicia el servidor local y abre http://localhost:8765/index.html. El HTML carga siempre `torneo.json` automáticamente. Después de editar el JSON, recarga la página. También puedes iniciar el servidor con `node servidor.cjs`. La ruta anterior `/propuesta.html` sigue funcionando como compatibilidad.

Puedes modificar los marcadores y asignar parejas en pantalla. El doble clic en **2026** del pie de página exporta el archivo actualizado; reemplaza tu `torneo.json` con esa descarga para conservar los cambios. El navegador no sobrescribe el archivo original automáticamente.

## Estructura

- `jugadores`: cada jugador tiene un `id` estable y un `nombre` visible. Usa el `id` para referenciarlo en las demás listas.
- `grupos`: nombre y lista de identificadores de jugadores. La matriz admite un partido por pareja en el torneo.
- `partidos`: fecha `AAAA-MM-DD`, dos jugadores y marcador en el mismo orden. Usa `null` como marcador si aún no se jugó. Los partidos no generan gastos automáticamente.
- `reservas`: fecha, número de canchas, horas, participantes y gastos efectivamente pagados. Los gastos son independientes de los marcadores.
- `gastos.campo` y `gastos.caddie`: valor total y pagos por jugador. Los pagos deben sumar el valor del concepto. Se pueden omitir conceptos aún no pagados, como el caddie de las próximas reservas.
- `participantes`: reparte cada concepto por igual entre estos jugadores. Usa dos para un partido; la jornada del 19 reúne los ocho jugadores y sus gastos conjuntos. Una lista vacía deja la reserva sin repartir y excluye sus anticipos de los reembolsos sugeridos.
- `tarifasPorHora`: referencia de las tarifas del club; los cálculos usan el `valor` real de cada gasto, para conservar precios históricos.
- `jugadorDestacado`: identificador de quien aparece en la tarjeta principal; actualmente Adrián.
- `reembolsos`: transferencias que ya ocurrieron entre jugadores. Reducen el pendiente de quien devuelve y el saldo a favor de quien recibe, por concepto. No vuelvas a registrarlas como pagos al club o al caddie.

Todos los valores se escriben en pesos enteros, sin puntos ni signo `$`. Las fechas existentes se interpretaron como noviembre de 2026.

## Agregar una reserva

Añade este objeto a `reservas`, usando un `id` nuevo:

```json
{
  "id": "reserva-28",
  "fecha": "2026-11-28",
  "canchas": 1,
  "horas": 1,
  "participantes": ["juan-s", "danilo"],
  "gastos": {
    "campo": {
      "valor": 32000,
      "pagos": [{ "jugador": "adrian", "valor": 32000 }]
    }
  }
}
```

Para registrar un reembolso real, agrega a `reembolsos`, por ejemplo:

```json
{
  "fecha": "2026-11-28",
  "de": "juan-s",
  "para": "adrian",
  "concepto": "campo",
  "valor": 16000
}
```

Los reembolsos sugeridos son una posible distribución para saldar las cuentas: no significan que cada deuda venga de un pago directo de esa persona. Campo y caddie siempre se compensan por separado. El cierre es provisional mientras queden reservas sin asignar o gastos por registrar.
