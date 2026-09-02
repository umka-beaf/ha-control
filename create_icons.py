#!/usr/bin/env python3
"""Generates icons/icon{16,48,128}.png for the extension.

Домик в духе Home Assistant (фирменный синий #41bdf5), но не точная копия
логотипа — упрощённый силуэт дома с дверью акцентного цвета (наш маркер
кастомизации, тот же оттенок, что и badge/акценты в popup.css).
"""

import os
import struct
import zlib

HA_BLUE = (65, 189, 245)     # #41bdf5 — фирменный синий Home Assistant
ACCENT = (251, 146, 60)      # #fb923c — наш акцентный оттенок (см. popup.css)

# Силуэт дома (пятиугольник): пик крыши → правый скат → низ → левый скат
HOUSE_POLY = [
    (0.50, 0.05),
    (0.90, 0.42),
    (0.90, 0.92),
    (0.10, 0.92),
    (0.10, 0.42),
]

# Дверь — акцентная деталь внизу домика
DOOR_RECT = (0.39, 0.62, 0.61, 0.92)  # x0, y0, x1, y1

SUPERSAMPLE = 4  # SUPERSAMPLE² под-сэмплов на пиксель для сглаживания


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    x1, y1 = poly[-1]
    for x2, y2 in poly:
        if ((y1 > y) != (y2 > y)) and \
                (x < (x2 - x1) * (y - y1) / (y2 - y1) + x1):
            inside = not inside
        x1, y1 = x2, y2
    return inside


def point_in_rect(x, y, rect):
    x0, y0, x1, y1 = rect
    return x0 <= x <= x1 and y0 <= y <= y1


def coverage(px, py, size, test_fn):
    """Доля под-сэмплов пикселя (px,py), попадающих внутрь фигуры."""
    hits = 0
    step = 1.0 / SUPERSAMPLE
    for sy in range(SUPERSAMPLE):
        for sx in range(SUPERSAMPLE):
            x = (px + (sx + 0.5) * step) / size
            y = (py + (sy + 0.5) * step) / size
            if test_fn(x, y):
                hits += 1
    return hits / (SUPERSAMPLE * SUPERSAMPLE)


def make_png(size):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: None
        for x in range(size):
            house_cov = coverage(x, y, size, lambda px, py: point_in_poly(px, py, HOUSE_POLY))
            door_cov = coverage(x, y, size, lambda px, py: point_in_rect(px, py, DOOR_RECT))

            # "over"-композитинг: дверь поверх дома, дом поверх прозрачного фона
            r = ACCENT[0] * door_cov + HA_BLUE[0] * house_cov * (1 - door_cov)
            g = ACCENT[1] * door_cov + HA_BLUE[1] * house_cov * (1 - door_cov)
            b = ACCENT[2] * door_cov + HA_BLUE[2] * house_cov * (1 - door_cov)
            a = door_cov + house_cov * (1 - door_cov)

            if a > 0:
                r, g, b = r / a, g / a, b / a  # un-premultiply для RGBA PNG
            raw += bytes([round(r), round(g), round(b), round(a * 255)])

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # RGBA
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'extension', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    for size in (16, 48, 128):
        path = os.path.join(icons_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(make_png(size))
        print(f'  icon{size}.png')
    print('Done.')
