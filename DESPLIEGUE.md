# Despliegue en un servidor con Tailscale

El simulador corre en dos contenedores: `web` (nginx) y `api` (Node + SQLite). Solo escuchan en
`127.0.0.1:8080` del servidor, así que nadie llega a ellos directamente. Tailscale los publica
dentro de la tailnet con HTTPS, y la app no queda expuesta a internet [R6 §11].

Por qué es así: [PLAN.md](PLAN.md) §24 · decisiones: [docs/DECISIONES.md](docs/DECISIONES.md) §8 y §9.

## Requisitos del servidor

- Linux con **Docker** y el plugin **docker compose** (en Ubuntu, desde el repositorio oficial de
  Docker), con el servicio habilitado al arrancar: `sudo systemctl enable --now docker`.
- **git**.
- **Tailscale** instalado y conectado a la tailnet (`tailscale status` lo muestra).

## 1. Primera instalación

```bash
git clone git@github.com:edgarcamilocamacho/app-electrica.git
cd app-electrica
id -u                                  # si NO es 1000, ver «La API no arranca» más abajo
docker compose up -d --build
docker compose ps                      # web y api en "healthy" (tarda unos segundos)
curl -s localhost:8080/healthz         # debe responder "ok"
```

Los contenedores se reinician solos si se caen o si se reinicia el servidor.

## 2. Publicarlo en la tailnet

**En el panel de Tailscale, una sola vez:** en [DNS](https://login.tailscale.com/admin/dns),
**MagicDNS** y **HTTPS Certificates** tienen que estar activos.

**En el servidor:**

```bash
sudo tailscale serve --bg 8080         # publica 127.0.0.1:8080 en la tailnet, con HTTPS
tailscale serve status                 # muestra la URL
```

`--bg` deja la configuración guardada: sobrevive a reinicios del servidor.

**En el navegador**, desde cualquier equipo de la tailnet:

```
https://<nombre-del-servidor>.<tu-tailnet>.ts.net
```

- La primera carga puede tardar unos segundos mientras Tailscale emite el certificado.
- **Por la IP de Tailscale no funciona** (ni `http://100.x.y.z:8080` ni `https://100.x.y.z`). Es a
  propósito: el puerto solo escucha en `127.0.0.1` y el certificado es para el nombre.
- El nombre completo aparece en `tailscale serve status` o en la columna *Machine* del panel.

Para dejar de publicarlo: `sudo tailscale serve reset`.

## 3. Actualizar

```bash
cd app-electrica
git pull
docker compose up -d --build
```

Los tableros no se tocan: viven en `datos/` [R6 §13, §15]. Quien tenga la app abierta ve el aviso
«Hay una versión nueva de la aplicación» y recarga.

**No borrar la carpeta del repo para volver a clonarla**: `datos/` está adentro y se iría con ella.

## Datos y copias de seguridad

Todo queda en la carpeta **`datos/`** del proyecto, que está fuera de git:

| Qué | Dónde |
|---|---|
| La base con todos los tableros | `datos/tableros.sqlite` |
| Copias automáticas (una al arrancar y una por día; se guardan las últimas 14) | `datos/copias/` |

Ni `docker compose down` ni `docker compose down -v` tocan esa carpeta.

**Copia manual:**

```bash
docker compose exec api node server.js backup      # deja una copia nueva en datos/copias/
```

**Restaurar una copia:**

```bash
docker compose stop api
cp datos/copias/tableros-AAAAMMDD-HHMMSS.sqlite datos/tableros.sqlite
rm -f datos/tableros.sqlite-wal datos/tableros.sqlite-shm
docker compose start api
```

**Llevar todo a otro servidor:** copiar la carpeta `datos/` completa, con la API detenida.

Lo borrado desde la app va a la **papelera** y se puede restaurar durante 30 días [R6 §8]. Las
copias sirven para lo que ya no está ni en la papelera.

## Restringir el acceso (recomendado)

Con la política por defecto de Tailscale, todos los equipos de la tailnet se ven entre sí. Para que
los usuarios **solo** lleguen a la app del servidor, reemplazar la política en
[Access controls](https://login.tailscale.com/admin/acls) por algo así:

```jsonc
{
  "tagOwners": { "tag:simulador": ["autogroup:admin"] },
  "grants": [
    // Los miembros solo llegan a la app (HTTPS de tailscale serve).
    { "src": ["autogroup:member"], "dst": ["tag:simulador"], "ip": ["tcp:443"] },
    // Los administradores, además, por SSH.
    { "src": ["autogroup:admin"], "dst": ["tag:simulador"], "ip": ["tcp:22"] }
  ]
}
```

Antes de guardarla, **etiquetar el servidor** con `tag:simulador`: en el panel, en *Machines* →
el servidor → *Edit ACL tags*. Si no, la regla no lo encuentra y nadie llega a la app.

Con esta política todo lo que no está permitido queda bloqueado, y el servidor no puede iniciar
conexiones hacia los demás equipos. **Revisar que no corte otros accesos** que la tailnet ya
usaba.

## Problemas comunes

**No carga en el navegador.**
1. En el servidor: `curl -s localhost:8080/healthz` debe responder `ok`. Si no, `docker compose ps`
   y `docker compose logs api web`.
2. `tailscale serve status` debe mostrar el proxy hacia `http://127.0.0.1:8080`.
3. ¿HTTPS Certificates está activo en el panel de DNS?
4. ¿Se entra por el nombre `.ts.net` y no por la IP?

**La API no arranca y el registro dice «No puedo escribir en /data».** La API corre con el uid 1000,
que tiene que ser el dueño de `datos/`. O se le da la carpeta:

```bash
sudo chown -R 1000:1000 datos
```

o se le dice a la API con qué usuario correr, en un archivo `.env` junto a `compose.yaml`:

```bash
echo "SIMULADOR_UID=$(id -u)" >> .env
echo "SIMULADOR_GID=$(id -g)" >> .env
docker compose up -d
```

**El puerto 8080 ya está ocupado.** Agregar `SIMULADOR_PUERTO=9090` al `.env`, relanzar y publicar
ese puerto: `sudo tailscale serve --bg 9090`.

**Ver qué pasa:**

```bash
docker compose logs -f api             # registros de la API
docker compose logs -f web             # accesos de nginx
```

## Probarlo sin Tailscale (desarrollo)

- `pnpm dev` → http://localhost:5173, con la API incluida y la base en `.data/`.
- `docker compose up -d --build` en la propia máquina → http://localhost:8080, igual que en el
  servidor pero sin el paso 2.
