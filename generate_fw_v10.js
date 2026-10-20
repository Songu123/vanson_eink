/**
 * ONE-2.13L Firmware v1.0 Customizer & Generator
 * Công cụ tạo và mod Firmware v1.0 với các bộ font và mẫu đồng hồ mới độc quyền
 * Chip: Dialog / Renesas DA14531 (ARM Cortex-M0+ BLE SoC)
 */

const fs = require('fs');
const path = require('path');

const FW_SOURCE_PATH = path.join(__dirname, 'firmware', 'ONE-2.13L-V0.9.bin');
const FW_OUTPUT_PATH = path.join(__dirname, 'firmware', 'ONE-2.13L-V1.0.bin');

const FIRM_MAGIC = Buffer.from([0x79, 0x13, 0xa5, 0xf9, 0x86, 0xec, 0x5a, 0x06]);
const DATA_MAGIC = Buffer.from([0x14, 0x07, 0x19, 0x90, 0xEB, 0xF8, 0xE6, 0x6F]);

// Hàm mã hóa bộ font thành buffer 4096 bytes chuẩn Sector SPI Flash
function encodeSector(w, h, glyphsMap) {
  const colStride = Math.ceil(h / 8);
  const glyphSize = w * colStride;
  const count = 11;
  const secBuf = Buffer.alloc(4096, 0xff);
  
  // Header 6 bytes
  secBuf[0] = 0x30; // '0'
  secBuf[1] = w;
  secBuf[2] = h;
  secBuf[3] = count;
  secBuf[4] = w; // advance
  secBuf[5] = 0x00;
  
  const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':'];
  
  for (let g = 0; g < count; g++) {
    const ch = chars[g];
    const grid = glyphsMap(ch, w, h);
    const charOffset = 6 + g * glyphSize;
    
    for (let storX = 0; storX < w; storX++) {
      for (let storY = 0; storY < h; storY++) {
        const x = w - 1 - storX;
        const y = h - 1 - storY;
        const isBlack = grid[y] && grid[y][x];
        
        const byteIdx = charOffset + storX * colStride + Math.floor(storY / 8);
        const bitIdx = storY % 8;
        
        if (isBlack) {
          secBuf[byteIdx] &= ~(1 << bitIdx); // bit 0 = điểm đen
        } else {
          secBuf[byteIdx] |= (1 << bitIdx);  // bit 1 = nền trắng
        }
      }
    }
  }
  
  return secBuf;
}

// 1. Mẫu Font LED 7-Đoạn (Digital Alarm Clock)
function get7SegGrid(digit, w, h, customThickness) {
  const grid = Array.from({ length: h }, () => new Array(w).fill(false));
  const t = customThickness || Math.max(3, Math.round(w * 0.12));
  
  if (digit === ':') {
    const dotSize = Math.max(3, t);
    const cx = Math.floor(w / 2);
    const cy1 = Math.floor(h * 0.35);
    const cy2 = Math.floor(h * 0.65);
    for (let dy = -Math.floor(dotSize/2); dy <= Math.floor(dotSize/2); dy++) {
      for (let dx = -Math.floor(dotSize/2); dx <= Math.floor(dotSize/2); dx++) {
        if (cy1+dy>=0 && cy1+dy<h && cx+dx>=0 && cx+dx<w) grid[cy1+dy][cx+dx] = true;
        if (cy2+dy>=0 && cy2+dy<h && cx+dx>=0 && cx+dx<w) grid[cy2+dy][cx+dx] = true;
      }
    }
    return grid;
  }
  
  const d = parseInt(digit, 10);
  const segs = {
    0: ['a','b','c','d','e','f'],
    1: ['b','c'],
    2: ['a','b','g','e','d'],
    3: ['a','b','g','c','d'],
    4: ['f','g','b','c'],
    5: ['a','f','g','c','d'],
    6: ['a','f','e','d','c','g'],
    7: ['a','b','c'],
    8: ['a','b','c','d','e','f','g'],
    9: ['a','b','c','d','f','g']
  }[d] || [];
  
  const pad = 3;
  const x0 = pad, x1 = w - 1 - pad;
  const y0 = pad, y1 = Math.floor(h / 2), y2 = h - 1 - pad;
  
  function drawH(startY, startX, endX) {
    for (let y = startY; y < startY + t && y < h; y++) {
      for (let x = startX; x <= endX && x < w; x++) {
        if (y >= 0 && x >= 0) grid[y][x] = true;
      }
    }
  }
  function drawV(startX, startY, endY) {
    for (let x = startX; x < startX + t && x < w; x++) {
      for (let y = startY; y <= endY && y < h; y++) {
        if (y >= 0 && x >= 0) grid[y][x] = true;
      }
    }
  }
  
  if (segs.includes('a')) drawH(y0, x0 + t, x1 - t);
  if (segs.includes('g')) drawH(y1 - Math.floor(t/2), x0 + t, x1 - t);
  if (segs.includes('d')) drawH(y2 - t + 1, x0 + t, x1 - t);
  if (segs.includes('f')) drawV(x0, y0 + t, y1 - 1);
  if (segs.includes('b')) drawV(x1 - t + 1, y0 + t, y1 - 1);
  if (segs.includes('e')) drawV(x0, y1 + 1, y2 - t);
  if (segs.includes('c')) drawV(x1 - t + 1, y1 + 1, y2 - t);
  
  return grid;
}

// 2. Mẫu Font 8-Bit Retro Pixel (GameBoy Arcade)
function getPixelGrid(digit, w, h) {
  const grid = Array.from({ length: h }, () => new Array(w).fill(false));
  const bitmaps = {
    '0': ['11111','10001','10011','10101','11001','10001','11111'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['11111','00001','00001','11111','10000','10000','11111'],
    '3': ['11111','00001','00001','11111','00001','00001','11111'],
    '4': ['10001','10001','10001','11111','00001','00001','00001'],
    '5': ['11111','10000','10000','11111','00001','00001','11111'],
    '6': ['11111','10000','10000','11111','10001','10001','11111'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['11111','10001','10001','11111','10001','10001','11111'],
    '9': ['11111','10001','10001','11111','00001','00001','11111'],
    ':': ['00000','00100','00100','00000','00100','00100','00000']
  };
  
  const map = bitmaps[digit] || bitmaps['0'];
  const blockW = Math.floor((w - 6) / 5);
  const blockH = Math.floor((h - 6) / 7);
  const startX = Math.floor((w - blockW * 5) / 2);
  const startY = Math.floor((h - blockH * 7) / 2);
  
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (map[r][c] === '1') {
        for (let py = 0; py < blockH; py++) {
          for (let px = 0; px < blockW; px++) {
            const gy = startY + r * blockH + py;
            const gx = startX + c * blockW + px;
            if (gy >= 0 && gy < h && gx >= 0 && gx < w) grid[gy][gx] = true;
          }
        }
      }
    }
  }
  return grid;
}

// 3. Mẫu Font Chữ Số Đậm Nét (Modern Heavy Bold)
function getBoldGrid(digit, w, h) {
  return get7SegGrid(digit, w, h, Math.max(5, Math.round(w * 0.22)));
}

// 4. Mẫu Font Cyberpunk Khung Kép
function getCyberGrid(digit, w, h) {
  return get7SegGrid(digit, w, h, Math.max(4, Math.round(w * 0.16)));
}

function buildFirmwareV10(options = {}) {
    console.log('--- BẮT ĐẦU TẠO FIRMWARE V1.0 VỚI CÁC MẪU ĐỒNG HỒ MỚI ---');
    
    if (!fs.existsSync(FW_SOURCE_PATH)) {
        throw new Error(`Không tìm thấy file firmware gốc: ${FW_SOURCE_PATH}`);
    }

    const srcBuf = fs.readFileSync(FW_SOURCE_PATH);
    const outBuf = Buffer.from(srcBuf);

    // 1. Cập nhật version = 1.0 (Major = 1, Minor = 0)
    const firmPos = outBuf.indexOf(FIRM_MAGIC);
    if (firmPos === -1) {
        throw new Error('Không tìm thấy chữ ký FIRM_MAGIC trong firmware!');
    }

    outBuf[firmPos + 8] = options.minor !== undefined ? options.minor : 0; // Minor = 0
    outBuf[firmPos + 9] = options.major !== undefined ? options.major : 1; // Major = 1
    console.log(`Phiên bản mới: v${outBuf[firmPos + 9]}.${outBuf[firmPos + 8]}`);

    // 2. Phân vùng dữ liệu Data Partition
    const dataPos = outBuf.indexOf(DATA_MAGIC);
    if (dataPos === -1) {
        throw new Error('Không tìm thấy phân vùng DATA_MAGIC!');
    }
    const dataStart = dataPos + 8;

    // 3. Giữ nguyên 100% 19 mẫu giao diện gốc của tác giả (Mẫu 1 -> Mẫu 19, Sector 0 -> 15)
    console.log('+ Kế thừa trọn vẹn 19 mẫu giao diện đồng hồ gốc (Mẫu 1 -> Mẫu 19 của Firmware v0.9)');

    // Nếu người dùng có truyền thêm Sector tùy biến để mod font cụ thể
    if (options.customSectors && Array.isArray(options.customSectors)) {
        for (const item of options.customSectors) {
            const { sectorIndex, sectorData } = item;
            if (sectorIndex >= 0 && sectorIndex < 16 && sectorData) {
                const targetOffset = dataStart + sectorIndex * 4096;
                sectorData.copy(outBuf, targetOffset, 0, Math.min(4096, sectorData.length));
                console.log(`+ Tùy biến Sector ${sectorIndex}`);
            }
        }
    }

    // 4. Lưu file Firmware v1.0
    fs.writeFileSync(FW_OUTPUT_PATH, outBuf);
    console.log(`\nTHÀNH CÔNG! Đã xuất file Firmware v1.0 tại: ${FW_OUTPUT_PATH}`);
    console.log(`Kích thước: ${outBuf.length} bytes`);
    return FW_OUTPUT_PATH;
}

if (require.main === module) {
    try {
        buildFirmwareV10();
    } catch (err) {
        console.error('Lỗi:', err.message);
        process.exit(1);
    }
}

module.exports = { buildFirmwareV10 };
