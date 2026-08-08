import { createHash } from 'node:crypto'
import { deflateSync, inflateSync } from 'node:zlib'

const HEADER_SIZE = 0x30
const FILE_TABLE_KEY = createHash('md5').update('allocator', 'ascii').digest()

function rc4(input, key = FILE_TABLE_KEY) {
  const state = Array.from({ length: 256 }, (_, index) => index)
  let j = 0
  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 0xff
    ;[state[i], state[j]] = [state[j], state[i]]
  }
  const output = Buffer.allocUnsafe(input.length)
  let i = 0
  j = 0
  for (let offset = 0; offset < input.length; offset += 1) {
    i = (i + 1) & 0xff
    j = (j + state[i]) & 0xff
    ;[state[i], state[j]] = [state[j], state[i]]
    output[offset] = input[offset] ^ state[(state[i] + state[j]) & 0xff]
  }
  return output
}

function sha1(input) {
  return createHash('sha1').update(input).digest()
}

export function listMcpkEntries(archive) {
  if (archive.subarray(0, 4).toString('ascii') !== 'MCPK') throw new Error('Not an MCPK archive.')
  if (archive.readUInt32LE(4) !== 3) throw new Error('Unsupported MCPK version.')
  const tableAddress = archive.readUInt32LE(32)
  const fileCount = archive.readUInt32LE(36)
  const table = rc4(archive.subarray(tableAddress))
  const entries = []
  let offset = 0
  for (let index = 0; index < fileCount; index += 1) {
    const compressedSize = table.readUInt32LE(offset)
    const size = table.readUInt32LE(offset + 4)
    const address = table.readUInt32LE(offset + 8)
    const checksum = Buffer.from(table.subarray(offset + 12, offset + 32))
    const compression = table.readUInt32LE(offset + 32)
    const nameLength = table.readUInt32LE(offset + 36)
    const name = table.subarray(offset + 40, offset + 40 + nameLength - 1).toString('ascii')
    offset += 40 + nameLength
    entries.push({ name, compressedSize, size, address, checksum, compression })
  }
  return { version: archive.readUInt32LE(4), build: archive.readInt32LE(8), entries }
}

export function extractMcpkEntry(archive, entry) {
  const stored = archive.subarray(entry.address, entry.address + entry.compressedSize)
  const contents = entry.compression === 0x100 ? inflateSync(stored) : Buffer.from(stored)
  if (contents.length !== entry.size) throw new Error(`Size mismatch for ${entry.name}.`)
  if (!sha1(contents).equals(entry.checksum)) throw new Error(`Checksum mismatch for ${entry.name}.`)
  return contents
}

function encodeTableEntry({ name, contents, compressed, address }) {
  const encodedName = Buffer.from(name, 'ascii')
  const entry = Buffer.alloc(40 + encodedName.length + 1)
  entry.writeUInt32LE(compressed.length, 0)
  entry.writeUInt32LE(contents.length, 4)
  entry.writeUInt32LE(address, 8)
  sha1(contents).copy(entry, 12)
  entry.writeUInt32LE(0x100, 32)
  entry.writeUInt32LE(encodedName.length + 1, 36)
  encodedName.copy(entry, 40)
  entry[40 + encodedName.length] = 0
  return entry
}

export function createMcpkArchive(files, { build = 955 } = {}) {
  if (files.length === 0) throw new Error('An MCPK archive must contain at least one file.')
  const packedFiles = []
  const tableEntries = []
  let address = HEADER_SIZE
  for (const file of files) {
    if (!/^[\x20-\x7e]+$/.test(file.name) || file.name.includes('\\')) {
      throw new Error(`Archive path must be printable ASCII with forward slashes: ${file.name}`)
    }
    const contents = Buffer.isBuffer(file.contents) ? file.contents : Buffer.from(file.contents)
    const compressed = deflateSync(contents, { level: 9 })
    packedFiles.push(compressed)
    tableEntries.push(encodeTableEntry({ name: file.name, contents, compressed, address }))
    address += compressed.length
  }
  const encryptedTable = rc4(Buffer.concat(tableEntries))
  const payload = Buffer.concat([...packedFiles, encryptedTable])
  const header = Buffer.alloc(HEADER_SIZE)
  header.write('MCPK', 0, 'ascii')
  header.writeUInt32LE(3, 4)
  header.writeInt32LE(build, 8)
  sha1(payload).copy(header, 12)
  header.writeUInt32LE(address, 32)
  header.writeUInt32LE(files.length, 36)
  return Buffer.concat([header, payload])
}

