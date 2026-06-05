🛠️ PROMPT MAESTRO: Especificación Técnica para Sistema de Gestión de Inventario Clínico (Bodega y Farmacia)

1. Contexto del Proyecto

Actúa como un Arquitecto de Software Senior y Desarrollador Full-Stack. Necesito construir un sistema integral de gestión de inventarios para una clínica. El sistema administrará tanto el Almacén General (política FIFO, stock general) como la Farmacia (política FEFO estricta, trazabilidad de lotes, vencimientos, medicamentos controlados y dosis).

Todo el flujo operativo es indispensable para la Fase 1: desde la generación de requisiciones y órdenes de compra, hasta la recepción, almacenamiento en bodega central, picking/despacho, y finalmente la recepción en bodegas satélite y dispensación a pacientes (integrado con el HIS/EMR de la clínica).

2. Stack Tecnológico y Entorno

El sistema debe ser diseñado para soportar más de 500 usuarios concurrentes con alta disponibilidad.

Frontend: Next.js o Vue.js (Diseño responsivo: interfaces complejas para escritorio e interfaces adaptadas para pantallas de PDAs Android).

Backend: Framework compatible con el ecosistema frontend elegido (ej. Node.js/NestJS o Django/FastAPI si se separa del frontend).

Base de Datos: PostgreSQL.

Infraestructura: Sistema 100% Dockerizado (contenedores separados para frontend, backend, base de datos y servicios en background).

3. Hardware Integrado

Lectores de Código de Barras: Compatibilidad dual. Debe funcionar con lectores USB estándar (emulación de teclado) en estaciones de escritorio, y estar optimizado para PDAs industriales Android con escáner láser integrado.

Impresión de Etiquetas: Integración con impresoras Zebra. El backend o frontend debe ser capaz de generar código ZPL (Zebra Programming Language) y enviarlo a las impresoras en red para el etiquetado de productos al momento de la recepción.

4. Autenticación y Seguridad (Requisito Crítico)

RBAC (Control de Acceso Basado en Roles): Múltiples roles (Bodeguero, Regente de Farmacia, Médico, Administrador).

Flujo de Login y 2FA: 1. El usuario ingresa su Documento de Identidad (Cédula) y Contraseña.
2. Las cédulas válidas están alojadas en la base de datos de nuestro sistema, las cuales son extraídas y sincronizadas constantemente mediante una API desde una base de datos externa (de RRHH/Clínica).
3. Si las credenciales son correctas, el sistema envía un código OTP (One Time Password) al correo electrónico registrado del usuario.
4. El usuario ingresa el OTP para iniciar la sesión final.

5. Módulos y Requerimientos Funcionales End-to-End

Módulo 1: Sincronización y Maestros

Cronjob/Worker en Docker para consumir la API externa y actualizar la tabla de Usuarios (Cédulas y correos).

Maestro de Productos con banderas (is_farmacia, requires_lote, is_controlado).

Manejo de múltiples códigos de barras (EAN, GS1, internos) y equivalencias de unidad de medida (Caja -> Blister -> Tableta).

Módulo 2: Compras y Recepción (Entrada)

Creación de Órdenes de Compra (OC).

Interfaz de recepción rápida mediante escaneo (USB/PDA).

Para medicamentos: captura obligatoria de Lote y Fecha de Vencimiento.

Generación automática de códigos internos para productos sin EAN e impresión directa en ZPL (Zebra).

Módulo 3: Bodega Central e Inventario

Separación lógica de sub-inventarios (Almacén vs Farmacia) aunque compartan ubicación física.

Mapeo de ubicaciones (Pasillo, Estante, Nivel).

Alertas automáticas de próximos a vencer (FEFO) y stock bajo.

Funcionalidad de Inventarios Cíclicos optimizada para PDAs (escaneo en pasillo).

Módulo 4: Picking y Bodegas Satélite

Bodegas satélite envían requisiciones internas.

Bodega central genera rutas de picking. El sistema obliga (vía escáner) a hacer picking del lote más antiguo (FEFO) para farmacia.

Traslado de inventario y confirmación de recepción en el satélite.

Módulo 5: Dispensación y Farmacia Clínica

Integración (API Webhooks/Endpoints) con el sistema clínico existente (HIS/EMR).

Las prescripciones médicas generan demandas de inventario.

Despacho a pacientes descontando dosis exactas (fraccionamiento).

Doble validación o registro de seguridad para medicamentos controlados.

6. Instrucciones para tu respuesta

Para comenzar con el desarrollo basado en estos requerimientos, por favor entrega los siguientes entregables en orden:

Esquema de Base de Datos (Entity-Relationship): Proporciona el código SQL (PostgreSQL) para las tablas principales (Usuarios, Productos, Lotes, Bodegas, Inventario, Movimientos), asegurando las relaciones lógicas.

Arquitectura Docker: Un archivo docker-compose.yml base que incluya la base de datos PostgreSQL, el backend, el frontend y un contenedor para tareas en segundo plano (ej. Redis/Celery para envío de OTP y sincronización de API externa).

Lógica de Login: Código base del controlador de autenticación detallando la validación del documento, generación de OTP y posterior verificación.