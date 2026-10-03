"""Generate PWA icons (no dependencies). Amber cue tone: a filled disc with two sound rings on dark blue-grey."""
import zlib, struct, math

def png(path, size, maskable):
    bg = (14, 19, 24); amber = (231, 155, 62)
    rows = []
    c = size / 2
    scale = 0.62 if maskable else 0.8   # maskable keeps content inside the safe zone
    R = size / 2 * scale
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            d = math.hypot(x + .5 - c, y + .5 - c)
            col = bg
            def ring(r, w):
                return abs(d - r) < w
            if d < R * 0.42 or ring(R * 0.68, R * 0.05) or ring(R * 0.94, R * 0.05):
                col = amber
            # 1px antialias-free edge is fine for icons at these sizes
            if not maskable:
                # rounded corners transparent
                rad = size * 0.2
                dx = max(rad - x, 0, x - (size - 1 - rad)); dy = max(rad - y, 0, y - (size - 1 - rad))
                a = 0 if math.hypot(dx, dy) > rad else 255
            else:
                a = 255
            row += bytes((*col, a))
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d): 
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

png('icons/icon-192.png', 192, False)
png('icons/icon-512.png', 512, False)
png('icons/maskable-512.png', 512, True)
png('icons/apple-touch-icon.png', 180, True)
