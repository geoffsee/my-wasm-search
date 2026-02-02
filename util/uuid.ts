export function randomUUIDv7() {
    // Start with random entropy (v4-style)
    const uuid = crypto.randomUUID().replace(/-/g, '');
    const bytes = new Uint8Array(16);

    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(uuid.slice(i * 2, i * 2 + 2), 16);
    }

    // 48-bit Unix timestamp (ms)
    const ts = BigInt(Date.now());
    bytes[0] = Number((ts >> 40n) & 0xffn);
    bytes[1] = Number((ts >> 32n) & 0xffn);
    bytes[2] = Number((ts >> 24n) & 0xffn);
    bytes[3] = Number((ts >> 16n) & 0xffn);
    bytes[4] = Number((ts >> 8n) & 0xffn);
    bytes[5] = Number(ts & 0xffn);

    // Version = 7
    bytes[6] = (bytes[6] & 0x0f) | 0x70;

    // Variant = RFC 4122
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return (
        hex.slice(0, 8) + '-' +
        hex.slice(8, 12) + '-' +
        hex.slice(12, 16) + '-' +
        hex.slice(16, 20) + '-' +
        hex.slice(20)
    );
}
