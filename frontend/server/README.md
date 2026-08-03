# Servidor LAN de TRUCO (multijugador local)

Permite jugar **humano contra humano** en la misma red (LAN): 1v1, 2v2 o 3v3.
El servidor es la **autoridad**: corre el mismo Rules Engine que el cliente,
valida cada jugada y difunde el estado a todos.

## Cómo levantarlo

En la máquina que hará de servidor (puede ser la misma que sirve el frontend):

```bash
cd frontend
npm install
npm run server        # escucha en ws://0.0.0.0:8787  (cambiá con PORT=xxxx)
npm run dev           # frontend en http://0.0.0.0:5173 (host expuesto a la LAN)
```

Averiguá tu IP local (por ejemplo `192.168.0.10`):

- Linux/macOS: `ip addr` o `ifconfig`
- Windows: `ipconfig`

## Cómo se conectan los jugadores

1. Cada jugador abre en su navegador `http://<IP-del-server>:5173`.
2. En **Jugar → Jugar por LAN**:
   - Uno **crea** una sala (elige 1v1/2v2/3v3) y comparte el **código**.
   - Los demás **se unen** con ese código.
3. Cuando se completan los asientos, la partida arranca sola.

El cliente se conecta por defecto a `ws://<host-de-la-web>:8787`. Si el servidor
corre en otra máquina/puerto, se puede indicar la dirección en la pantalla de LAN.

## Notas

- MVP: si un jugador se desconecta, la partida se corta.
- El estado se difunde completo (para una LAN de amigos alcanza); una versión
  competitiva debería ocultar las cartas ajenas en el servidor.
