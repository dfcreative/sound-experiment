(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; i++) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var this$1 = this;

  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this$1, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this$1, start, end)

      case 'ascii':
        return asciiSlice(this$1, start, end)

      case 'binary':
        return binarySlice(this$1, start, end)

      case 'base64':
        return base64Slice(this$1, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this$1, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var this$1 = this;

  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this$1, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var this$1 = this;

  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this$1, i, i + 3)
    swap(this$1, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = 0; byteOffset + i < arrLength; i++) {
    if (read(arr, byteOffset + i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return (byteOffset + foundIndex) * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }
  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  var this$1 = this;

  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this$1, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this$1, string, offset, length)

      case 'ascii':
        return asciiWrite(this$1, string, offset, length)

      case 'binary':
        return binaryWrite(this$1, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this$1, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this$1, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var this$1 = this;

  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this$1[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  var this$1 = this;

  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this$1[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  var this$1 = this;

  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this$1[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  var this$1 = this;

  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this$1[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  var this$1 = this;

  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this$1[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  var this$1 = this;

  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this$1[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  var this$1 = this;

  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this$1[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  var this$1 = this;

  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this$1[offset + i - 1] !== 0) {
      sub = 1
    }
    this$1[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  var this$1 = this;

  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this$1[offset + i + 1] !== 0) {
      sub = 1
    }
    this$1[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  var this$1 = this;

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this$1[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this$1[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  var this$1 = this;

  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; i++) {
      this$1[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; i++) {
      this$1[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":1,"ieee754":4,"isarray":5}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var this$1 = this;

  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this$1, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var this$1 = this;

  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this$1.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this$1.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var arguments$1 = arguments;

    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments$1[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
module.exports = function a (f) {
	var f2 = f*f;
	return 1.2588966 * 148840000 * f2*f2 /
	((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148840000));
};
},{}],8:[function(require,module,exports){
module.exports = function b (f) {
	var f2 = f*f;
	return 1.019764760044717 * 148840000 * f*f2 /
	((f2 + 424.36) * Math.sqrt(f2 + 25122.25) * (f2 + 148840000));
};
},{}],9:[function(require,module,exports){
module.exports = function c (f) {
	var f2 = f*f;
	return 1.0069316688518042 * 148840000 * f2 /
	((f2 + 424.36) * (f2 + 148840000));
};
},{}],10:[function(require,module,exports){
module.exports = function d (f) {
	var f2 = f*f;
	return (f / 6.8966888496476e-5) * Math.sqrt(
		(
			((1037918.48 - f2)*(1037918.48 - f2) + 1080768.16*f2) /
			((9837328 - f2)*(9837328 - f2) + 11723776*f2)
		) /	((f2 + 79919.29) * (f2 + 1345600))
	);
};
},{}],11:[function(require,module,exports){
/**
 * @module  noise-weighting
 */

module.exports = {
	a: require('./a'),
	b: require('./b'),
	c: require('./c'),
	d: require('./d'),
	itu: require('./itu'),
	z: require('./z')
};
},{"./a":7,"./b":8,"./c":9,"./d":10,"./itu":12,"./z":13}],12:[function(require,module,exports){
module.exports = function itu (f) {
	var f2 = f*f;

	var h1 = -4.737338981378384e-24*f2*f2*f2 + 2.043828333606125e-15*f2*f2 - 1.363894795463638e-7*f2 + 1;
	var h2 = 1.306612257412824e-19*f2*f2*f - 2.118150887518656e-11*f2*f + 5.559488023498642e-4*f;

	return 8.128305161640991 * 1.246332637532143e-4 * f / Math.sqrt(h1*h1 + h2*h2);
};
},{}],13:[function(require,module,exports){
module.exports = function (f) {
	return 1;
};
},{}],14:[function(require,module,exports){
/* The following list is defined in React's core */
var IS_UNITLESS = {
  animationIterationCount: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridRow: true,
  gridColumn: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true
};

module.exports = function(name, value) {
  if(typeof value === 'number' && !IS_UNITLESS[ name ]) {
    return value + 'px';
  } else {
    return value;
  }
};
},{}],15:[function(require,module,exports){
'use strict';

var arraytools  = function () {

  var that = {};

  var RGB_REGEX =  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,.*)?\)$/;
  var RGB_GROUP_REGEX = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(.*)?\)$/;

  function isPlainObject (v) {
    return !Array.isArray(v) && v !== null && typeof v === 'object';
  }

  function linspace (start, end, num) {
    var inc = (end - start) / Math.max(num - 1, 1);
    var a = [];
    for( var ii = 0; ii < num; ii++)
      a.push(start + ii*inc);
    return a;
  }

  function zip () {
      var arrays = [].slice.call(arguments);
      var lengths = arrays.map(function (a) {return a.length;});
      var len = Math.min.apply(null, lengths);
      var zipped = [];
      for (var i = 0; i < len; i++) {
          zipped[i] = [];
          for (var j = 0; j < arrays.length; ++j) {
              zipped[i][j] = arrays[j][i];
          }
      }
      return zipped;
  }

  function zip3 (a, b, c) {
      var len = Math.min.apply(null, [a.length, b.length, c.length]);
      var result = [];
      for (var n = 0; n < len; n++) {
          result.push([a[n], b[n], c[n]]);
      }
      return result;
  }

  function sum (A) {
    var acc = 0;
    accumulate(A, acc);
    function accumulate(x) {
      for (var i = 0; i < x.length; i++) {
        if (Array.isArray(x[i]))
          accumulate(x[i], acc);
        else
          acc += x[i];
      }
    }
    return acc;
  }

  function copy2D (arr) {
    var carr = [];
    for (var i = 0; i < arr.length; ++i) {
      carr[i] = [];
      for (var j = 0; j < arr[i].length; ++j) {
        carr[i][j] = arr[i][j];
      }
    }

    return carr;
  }


  function copy1D (arr) {
    var carr = [];
    for (var i = 0; i < arr.length; ++i) {
      carr[i] = arr[i];
    }

    return carr;
  }


  function isEqual(arr1, arr2) {
    if(arr1.length !== arr2.length)
      return false;
    for(var i = arr1.length; i--;) {
      if(arr1[i] !== arr2[i])
        return false;
    }

    return true;
  }


  function str2RgbArray(str, twoFiftySix) {
    // convert hex or rbg strings to 0->1 or 0->255 rgb array
    var rgb,
        match;

    if (typeof str !== 'string') return str;

    rgb = [];
    // hex notation
    if (str[0] === '#') {
      str = str.substr(1) // remove hash
      if (str.length === 3) str += str // fff -> ffffff
      match = parseInt(str, 16);
      rgb[0] = ((match >> 16) & 255);
      rgb[1] = ((match >> 8) & 255);
      rgb[2] = (match & 255);
    }

    // rgb(34, 34, 127) or rgba(34, 34, 127, 0.1) notation
    else if (RGB_REGEX.test(str)) {
      match = str.match(RGB_GROUP_REGEX);
      rgb[0] = parseInt(match[1]);
      rgb[1] = parseInt(match[2]);
      rgb[2] = parseInt(match[3]);
    }

    if (!twoFiftySix) {
      for (var j=0; j<3; ++j) rgb[j] = rgb[j]/255
    }


    return rgb;
  }


  function str2RgbaArray(str, twoFiftySix) {
    // convert hex or rbg strings to 0->1 or 0->255 rgb array
    var rgb,
        match;

    if (typeof str !== 'string') return str;

    rgb = [];
    // hex notation
    if (str[0] === '#') {
      str = str.substr(1) // remove hash
      if (str.length === 3) str += str // fff -> ffffff
      match = parseInt(str, 16);
      rgb[0] = ((match >> 16) & 255);
      rgb[1] = ((match >> 8) & 255);
      rgb[2] = (match & 255);
    }

    // rgb(34, 34, 127) or rgba(34, 34, 127, 0.1) notation
    else if (RGB_REGEX.test(str)) {
      match = str.match(RGB_GROUP_REGEX);
      rgb[0] = parseInt(match[1]);
      rgb[1] = parseInt(match[2]);
      rgb[2] = parseInt(match[3]);
      if (match[4]) rgb[3] = parseFloat(match[4]);
      else rgb[3] = 1.0;
    }



    if (!twoFiftySix) {
      for (var j=0; j<3; ++j) rgb[j] = rgb[j]/255
    }


    return rgb;
  }





  that.isPlainObject = isPlainObject;
  that.linspace = linspace;
  that.zip3 = zip3;
  that.sum = sum;
  that.zip = zip;
  that.isEqual = isEqual;
  that.copy2D = copy2D;
  that.copy1D = copy1D;
  that.str2RgbArray = str2RgbArray;
  that.str2RgbaArray = str2RgbaArray;

  return that

}


module.exports = arraytools();

},{}],16:[function(require,module,exports){
var window = require('global/window');

var Context = window.AudioContext || window.webkitAudioContext;
if (Context) module.exports = new Context;

},{"global/window":44}],17:[function(require,module,exports){
/*!
	Autosize 3.0.17
	license: MIT
	http://www.jacklmoore.com/autosize
*/
(function (global, factory) {
	if (typeof define === 'function' && define.amd) {
		define(['exports', 'module'], factory);
	} else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
		factory(exports, module);
	} else {
		var mod = {
			exports: {}
		};
		factory(mod.exports, mod);
		global.autosize = mod.exports;
	}
})(this, function (exports, module) {
	'use strict';

	var set = typeof Set === 'function' ? new Set() : (function () {
		var list = [];

		return {
			has: function has(key) {
				return Boolean(list.indexOf(key) > -1);
			},
			add: function add(key) {
				list.push(key);
			},
			'delete': function _delete(key) {
				list.splice(list.indexOf(key), 1);
			} };
	})();

	var createEvent = function createEvent(name) {
		return new Event(name);
	};
	try {
		new Event('test');
	} catch (e) {
		// IE does not support `new Event()`
		createEvent = function (name) {
			var evt = document.createEvent('Event');
			evt.initEvent(name, true, false);
			return evt;
		};
	}

	function assign(ta) {
		if (!ta || !ta.nodeName || ta.nodeName !== 'TEXTAREA' || set.has(ta)) return;

		var heightOffset = null;
		var clientWidth = ta.clientWidth;
		var cachedHeight = null;

		function init() {
			var style = window.getComputedStyle(ta, null);

			if (style.resize === 'vertical') {
				ta.style.resize = 'none';
			} else if (style.resize === 'both') {
				ta.style.resize = 'horizontal';
			}

			if (style.boxSizing === 'content-box') {
				heightOffset = -(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
			} else {
				heightOffset = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
			}
			// Fix when a textarea is not on document body and heightOffset is Not a Number
			if (isNaN(heightOffset)) {
				heightOffset = 0;
			}

			update();
		}

		function changeOverflow(value) {
			{
				// Chrome/Safari-specific fix:
				// When the textarea y-overflow is hidden, Chrome/Safari do not reflow the text to account for the space
				// made available by removing the scrollbar. The following forces the necessary text reflow.
				var width = ta.style.width;
				ta.style.width = '0px';
				// Force reflow:
				/* jshint ignore:start */
				ta.offsetWidth;
				/* jshint ignore:end */
				ta.style.width = width;
			}

			ta.style.overflowY = value;

			resize();
		}

		function getParentOverflows(el) {
			var arr = [];

			while (el && el.parentNode && el.parentNode instanceof Element) {
				if (el.parentNode.scrollTop) {
					arr.push({
						node: el.parentNode,
						scrollTop: el.parentNode.scrollTop });
				}
				el = el.parentNode;
			}

			return arr;
		}

		function resize() {
			var originalHeight = ta.style.height;
			var overflows = getParentOverflows(ta);
			var docTop = document.documentElement && document.documentElement.scrollTop; // Needed for Mobile IE (ticket #240)

			ta.style.height = 'auto';

			var endHeight = ta.scrollHeight + heightOffset;

			if (ta.scrollHeight === 0) {
				// If the scrollHeight is 0, then the element probably has display:none or is detached from the DOM.
				ta.style.height = originalHeight;
				return;
			}

			ta.style.height = endHeight + 'px';

			// used to check if an update is actually necessary on window.resize
			clientWidth = ta.clientWidth;

			// prevents scroll-position jumping
			overflows.forEach(function (el) {
				el.node.scrollTop = el.scrollTop;
			});

			if (docTop) {
				document.documentElement.scrollTop = docTop;
			}
		}

		function update() {
			resize();

			var computed = window.getComputedStyle(ta, null);
			var computedHeight = Math.round(parseFloat(computed.height));
			var styleHeight = Math.round(parseFloat(ta.style.height));

			// The computed height not matching the height set via resize indicates that
			// the max-height has been exceeded, in which case the overflow should be set to visible.
			if (computedHeight !== styleHeight) {
				if (computed.overflowY !== 'visible') {
					changeOverflow('visible');
				}
			} else {
				// Normally keep overflow set to hidden, to avoid flash of scrollbar as the textarea expands.
				if (computed.overflowY !== 'hidden') {
					changeOverflow('hidden');
				}
			}

			if (cachedHeight !== computedHeight) {
				cachedHeight = computedHeight;
				var evt = createEvent('autosize:resized');
				ta.dispatchEvent(evt);
			}
		}

		var pageResize = function pageResize() {
			if (ta.clientWidth !== clientWidth) {
				update();
			}
		};

		var destroy = (function (style) {
			window.removeEventListener('resize', pageResize, false);
			ta.removeEventListener('input', update, false);
			ta.removeEventListener('keyup', update, false);
			ta.removeEventListener('autosize:destroy', destroy, false);
			ta.removeEventListener('autosize:update', update, false);
			set['delete'](ta);

			Object.keys(style).forEach(function (key) {
				ta.style[key] = style[key];
			});
		}).bind(ta, {
			height: ta.style.height,
			resize: ta.style.resize,
			overflowY: ta.style.overflowY,
			overflowX: ta.style.overflowX,
			wordWrap: ta.style.wordWrap });

		ta.addEventListener('autosize:destroy', destroy, false);

		// IE9 does not fire onpropertychange or oninput for deletions,
		// so binding to onkeyup to catch most of those events.
		// There is no way that I know of to detect something like 'cut' in IE9.
		if ('onpropertychange' in ta && 'oninput' in ta) {
			ta.addEventListener('keyup', update, false);
		}

		window.addEventListener('resize', pageResize, false);
		ta.addEventListener('input', update, false);
		ta.addEventListener('autosize:update', update, false);
		set.add(ta);
		ta.style.overflowX = 'hidden';
		ta.style.wordWrap = 'break-word';

		init();
	}

	function destroy(ta) {
		if (!(ta && ta.nodeName && ta.nodeName === 'TEXTAREA')) return;
		var evt = createEvent('autosize:destroy');
		ta.dispatchEvent(evt);
	}

	function update(ta) {
		if (!(ta && ta.nodeName && ta.nodeName === 'TEXTAREA')) return;
		var evt = createEvent('autosize:update');
		ta.dispatchEvent(evt);
	}

	var autosize = null;

	// Do nothing in Node.js environment and IE8 (or lower)
	if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
		autosize = function (el) {
			return el;
		};
		autosize.destroy = function (el) {
			return el;
		};
		autosize.update = function (el) {
			return el;
		};
	} else {
		autosize = function (el, options) {
			if (el) {
				Array.prototype.forEach.call(el.length ? el : [el], function (x) {
					return assign(x, options);
				});
			}
			return el;
		};
		autosize.destroy = function (el) {
			if (el) {
				Array.prototype.forEach.call(el.length ? el : [el], destroy);
			}
			return el;
		};
		autosize.update = function (el) {
			if (el) {
				Array.prototype.forEach.call(el.length ? el : [el], update);
			}
			return el;
		};
	}

	module.exports = autosize;
});
},{}],18:[function(require,module,exports){
var size = require('element-size')

module.exports = fit

var scratch = new Float32Array(2)

function fit(canvas, parent, scale) {
  var isSVG = canvas.nodeName.toUpperCase() === 'SVG'

  canvas.style.position = canvas.style.position || 'absolute'
  canvas.style.top = 0
  canvas.style.left = 0

  resize.scale  = parseFloat(scale || 1)
  resize.parent = parent

  return resize()

  function resize() {
    var p = resize.parent || canvas.parentNode
    if (typeof p === 'function') {
      var dims   = p(scratch) || scratch
      var width  = dims[0]
      var height = dims[1]
    } else
    if (p && p !== document.body) {
      var psize  = size(p)
      var width  = psize[0]|0
      var height = psize[1]|0
    } else {
      var width  = window.innerWidth
      var height = window.innerHeight
    }

    if (isSVG) {
      canvas.setAttribute('width', width * resize.scale + 'px')
      canvas.setAttribute('height', height * resize.scale + 'px')
    } else {
      canvas.width = width * resize.scale
      canvas.height = height * resize.scale
    }

    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    return resize
  }
}

},{"element-size":34}],19:[function(require,module,exports){
/**
 * @module  caret-position/get
 *
 * Adoption from code at
 * http://blogs.nitobi.com/alexei/wp-content/uploads/2008/01/getcaretselection3.js
 *
 * @return the caret position in a text field
 */
module.exports = function (input) {
	var docObj = input.ownerDocument,
		result = { start:0, end:0, caret:0 };

	if (navigator.appVersion.indexOf("MSIE")!=-1) {
		if (input.tagName == "TEXTAREA") {
			if (input.value.charCodeAt(input.value.length-1) < 14) {
				input.value = input.value.replace(/34/g,'') + String.fromCharCode(28);
			}
			var range = docObj.selection.createRange(),
				rangeCopy = range.duplicate();

			rangeCopy.moveToElementText(input);
			rangeCopy.setEndPoint('StartToEnd', range);
			result.end = input.value.length - rangeCopy.text.length;

			rangeCopy.setEndPoint('StartToStart', range);
			result.start = input.value.length-rangeCopy.text.length;
			result.caret = result.end;

			if (input.value.substr(input.value.length-1) == String.fromCharCode(28)) {
				input.value = input.value.substr(0, input.value.length-1);
			}
		} else {
			var range = docObj.selection.createRange(),
				rangeCopy = range.duplicate();

			result.start = 0 - rangeCopy.moveStart('character', -100000);
			result.end = result.start + range.text.length;
			result.caret = result.end;
		}
	} else {
		result.start = input.selectionStart;
		result.end = input.selectionEnd;
		result.caret = result.end;
	}
	if (result.start < 0) {
		 result = { start:0, end:0, caret:0 };
	}
	return result;
};
},{}],20:[function(require,module,exports){
/**
 * @module  caret-position
 */

module.exports = caret;

function caret(a,b,c){
	if (b !== undefined) return caret.get(a);
	return caret.set(a,b,c);
};

caret.get = require('./get');
caret.set = require('./set');
},{"./get":19,"./set":21}],21:[function(require,module,exports){
/**
 * @module  caret-position/set
 *
 * Adoption from code at http://blog.vishalon.net/index.php/javascript-getting-and-setting-caret-position-in-textarea/
 *
 * @param {string} input Select in that input
 * @param {int} start from character number
 * @param {int} end to character number
 */
module.exports = function(input, start, end) {
	if (end === undefined) { end = start; }

	if (input.setSelectionRange) {
		input.focus();
		input.setSelectionRange(start, end);
	} else {
		var range = input.createTextRange();
		range.collapse(true);
		range.moveEnd('character', start);
		range.moveStart('character', end);
		range.select();
	}
};
},{}],22:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)
},{"buffer":2}],23:[function(require,module,exports){
module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};
},{}],24:[function(require,module,exports){
/**
 * @module color-parse
 */

module.exports = parse;


var names = require('color-name');
var pad = require('left-pad');
var isObject = require('is-plain-obj');


/**
 * Base hues
 * http://dev.w3.org/csswg/css-color/#typedef-named-hue
 */
//FIXME: use external hue detector
var baseHues = {
	red: 0,
	orange: 60,
	yellow: 120,
	green: 180,
	blue: 240,
	purple: 300
};

var channels = {
	r: 0,
	red: 0,
	g: 1,
	green: 1,
	b: 2,
	blue: 2
};


/**
 * Parse color from the string passed
 *
 * @return {Object} A space indicator `space`, an array `values` and `alpha`
 */
function parse (cstr) {
	var m, parts = [0,0,0], alpha = 1, space = 'rgb';

	//keyword
	if (names[cstr]) {
		parts = names[cstr].slice();
	}

	//reserved words
	else if (cstr === 'transparent') alpha = 0;

	//number (weird) case
	else if (typeof cstr === 'number') {
		parts = [cstr >>> 16, (cstr & 0x00ff00) >>> 8, cstr & 0x0000ff];
	}

	//object case - detects css cases of rgb and hsl
	else if (isObject(cstr)) {
		if (cstr.r != null) {
			parts = [cstr.r, cstr.g, cstr.b];
		}
		else if (cstr.red != null) {
			parts = [cstr.red, cstr.green, cstr.blue];
		}
		else if (cstr.h != null) {
			parts = [cstr.h, cstr.s, cstr.l];
			space = 'hsl';
		}
		else if (cstr.hue != null) {
			parts = [cstr.hue, cstr.saturation, cstr.lightness];
			space = 'hsl';
		}

		if (cstr.a != null) alpha = cstr.a;
		else if (cstr.alpha != null) alpha = cstr.alpha;
		else if (cstr.opacity != null) alpha = cstr.opacity / 100;
	}

	//array passed
	else if (Array.isArray(cstr) || ArrayBuffer.isView(cstr)) {
		parts = [cstr[0], cstr[1], cstr[2]];
		alpha = cstr.length === 4 ? cstr[3] : 1;
	}

	//hex
	else if (/^#[A-Fa-f0-9]+$/.test(cstr)) {
		var base = cstr.replace(/^#/,'');
		var size = base.length;
		var isShort = size <= 4;

		parts = base.split(isShort ? /(.)/ : /(..)/);
		parts = parts.filter(Boolean)
			.map(function (x) {
				if (isShort) {
					return parseInt(x + x, 16);
				}
				else {
					return parseInt(x, 16);
				}
			});

		if (parts.length === 4) {
			alpha = parts[3] / 255;
			parts = parts.slice(0,3);
		}
		if (!parts[0]) parts[0] = 0;
		if (!parts[1]) parts[1] = 0;
		if (!parts[2]) parts[2] = 0;
	}

	//color space
	else if (m = /^((?:rgb|hs[lvb]|hwb|cmyk?|xy[zy]|gray|lab|lchu?v?|[ly]uv|lms)a?)\s*\(([^\)]*)\)/.exec(cstr)) {
		var name = m[1];
		var base = name.replace(/a$/, '');
		space = base;
		var size = base === 'cmyk' ? 4 : base === 'gray' ? 1 : 3;
		parts = m[2].trim()
			.split(/\s*,\s*/)
			.map(function (x, i) {
				//<percentage>
				if (/%$/.test(x)) {
					//alpha
					if (i === size)	return parseFloat(x) / 100;
					//rgb
					if (base === 'rgb') return parseFloat(x) * 255 / 100;
					return parseFloat(x);
				}
				//hue
				else if (base[i] === 'h') {
					//<deg>
					if (/deg$/.test(x)) {
						return parseFloat(x);
					}
					//<base-hue>
					else if (baseHues[x] !== undefined) {
						return baseHues[x];
					}
				}
				return parseFloat(x);
			});

		if (name === base) parts.push(1);
		alpha = parts[size] === undefined ? 1 : parts[size];
		parts = parts.slice(0, size);
	}

	//named channels case
	else if (cstr.length > 10 && /[0-9](?:\s|\/)/.test(cstr)) {
		parts = cstr.match(/([0-9]+)/g).map(function (value) {
			return parseFloat(value);
		});

		space = cstr.match(/([a-z])/ig).join('').toLowerCase();
	}

	else {
		throw Error('Unable to parse ' + cstr);
	}

	return {
		space: space,
		values: parts,
		alpha: alpha
	};
}
},{"color-name":23,"is-plain-obj":52,"left-pad":54}],25:[function(require,module,exports){
/**
 * @module color-space/hsl
 */

var rgb = require('./rgb');

module.exports = {
	name: 'hsl',
	min: [0,0,0],
	max: [360,100,100],
	channel: ['hue', 'saturation', 'lightness'],
	alias: ['HSL'],

	rgb: function(hsl) {
		var h = hsl[0] / 360,
				s = hsl[1] / 100,
				l = hsl[2] / 100,
				t1, t2, t3, rgb, val;

		if (s === 0) {
			val = l * 255;
			return [val, val, val];
		}

		if (l < 0.5) {
			t2 = l * (1 + s);
		}
		else {
			t2 = l + s - l * s;
		}
		t1 = 2 * l - t2;

		rgb = [0, 0, 0];
		for (var i = 0; i < 3; i++) {
			t3 = h + 1 / 3 * - (i - 1);
			if (t3 < 0) {
				t3++;
			}
			else if (t3 > 1) {
				t3--;
			}

			if (6 * t3 < 1) {
				val = t1 + (t2 - t1) * 6 * t3;
			}
			else if (2 * t3 < 1) {
				val = t2;
			}
			else if (3 * t3 < 2) {
				val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
			}
			else {
				val = t1;
			}

			rgb[i] = val * 255;
		}

		return rgb;
	}
};


//extend rgb
rgb.hsl = function(rgb) {
	var r = rgb[0]/255,
			g = rgb[1]/255,
			b = rgb[2]/255,
			min = Math.min(r, g, b),
			max = Math.max(r, g, b),
			delta = max - min,
			h, s, l;

	if (max === min) {
		h = 0;
	}
	else if (r === max) {
		h = (g - b) / delta;
	}
	else if (g === max) {
		h = 2 + (b - r) / delta;
	}
	else if (b === max) {
		h = 4 + (r - g)/ delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	l = (min + max) / 2;

	if (max === min) {
		s = 0;
	}
	else if (l <= 0.5) {
		s = delta / (max + min);
	}
	else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};
},{"./rgb":26}],26:[function(require,module,exports){
/**
 * RGB space.
 *
 * @module  color-space/rgb
 */

module.exports = {
	name: 'rgb',
	min: [0,0,0],
	max: [255,255,255],
	channel: ['red', 'green', 'blue'],
	alias: ['RGB']
};
},{}],27:[function(require,module,exports){
module.exports={
	"jet":[{"index":0,"rgb":[0,0,131]},{"index":0.125,"rgb":[0,60,170]},{"index":0.375,"rgb":[5,255,255]},{"index":0.625,"rgb":[255,255,0]},{"index":0.875,"rgb":[250,0,0]},{"index":1,"rgb":[128,0,0]}],

	"hsv":[{"index":0,"rgb":[255,0,0]},{"index":0.169,"rgb":[253,255,2]},{"index":0.173,"rgb":[247,255,2]},{"index":0.337,"rgb":[0,252,4]},{"index":0.341,"rgb":[0,252,10]},{"index":0.506,"rgb":[1,249,255]},{"index":0.671,"rgb":[2,0,253]},{"index":0.675,"rgb":[8,0,253]},{"index":0.839,"rgb":[255,0,251]},{"index":0.843,"rgb":[255,0,245]},{"index":1,"rgb":[255,0,6]}],

	"hot":[{"index":0,"rgb":[0,0,0]},{"index":0.3,"rgb":[230,0,0]},{"index":0.6,"rgb":[255,210,0]},{"index":1,"rgb":[255,255,255]}],

	"cool":[{"index":0,"rgb":[0,255,255]},{"index":1,"rgb":[255,0,255]}],

	"spring":[{"index":0,"rgb":[255,0,255]},{"index":1,"rgb":[255,255,0]}],

	"summer":[{"index":0,"rgb":[0,128,102]},{"index":1,"rgb":[255,255,102]}],

	"autumn":[{"index":0,"rgb":[255,0,0]},{"index":1,"rgb":[255,255,0]}],

	"winter":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[0,255,128]}],

	"bone":[{"index":0,"rgb":[0,0,0]},{"index":0.376,"rgb":[84,84,116]},{"index":0.753,"rgb":[169,200,200]},{"index":1,"rgb":[255,255,255]}],

	"copper":[{"index":0,"rgb":[0,0,0]},{"index":0.804,"rgb":[255,160,102]},{"index":1,"rgb":[255,199,127]}],

	"greys":[{"index":0,"rgb":[0,0,0]},{"index":1,"rgb":[255,255,255]}],

	"yignbu":[{"index":0,"rgb":[8,29,88]},{"index":0.125,"rgb":[37,52,148]},{"index":0.25,"rgb":[34,94,168]},{"index":0.375,"rgb":[29,145,192]},{"index":0.5,"rgb":[65,182,196]},{"index":0.625,"rgb":[127,205,187]},{"index":0.75,"rgb":[199,233,180]},{"index":0.875,"rgb":[237,248,217]},{"index":1,"rgb":[255,255,217]}],

	"greens":[{"index":0,"rgb":[0,68,27]},{"index":0.125,"rgb":[0,109,44]},{"index":0.25,"rgb":[35,139,69]},{"index":0.375,"rgb":[65,171,93]},{"index":0.5,"rgb":[116,196,118]},{"index":0.625,"rgb":[161,217,155]},{"index":0.75,"rgb":[199,233,192]},{"index":0.875,"rgb":[229,245,224]},{"index":1,"rgb":[247,252,245]}],

	"yiorrd":[{"index":0,"rgb":[128,0,38]},{"index":0.125,"rgb":[189,0,38]},{"index":0.25,"rgb":[227,26,28]},{"index":0.375,"rgb":[252,78,42]},{"index":0.5,"rgb":[253,141,60]},{"index":0.625,"rgb":[254,178,76]},{"index":0.75,"rgb":[254,217,118]},{"index":0.875,"rgb":[255,237,160]},{"index":1,"rgb":[255,255,204]}],

	"bluered":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[255,0,0]}],

	"rdbu":[{"index":0,"rgb":[5,10,172]},{"index":0.35,"rgb":[106,137,247]},{"index":0.5,"rgb":[190,190,190]},{"index":0.6,"rgb":[220,170,132]},{"index":0.7,"rgb":[230,145,90]},{"index":1,"rgb":[178,10,28]}],

	"picnic":[{"index":0,"rgb":[0,0,255]},{"index":0.1,"rgb":[51,153,255]},{"index":0.2,"rgb":[102,204,255]},{"index":0.3,"rgb":[153,204,255]},{"index":0.4,"rgb":[204,204,255]},{"index":0.5,"rgb":[255,255,255]},{"index":0.6,"rgb":[255,204,255]},{"index":0.7,"rgb":[255,153,255]},{"index":0.8,"rgb":[255,102,204]},{"index":0.9,"rgb":[255,102,102]},{"index":1,"rgb":[255,0,0]}],

	"rainbow":[{"index":0,"rgb":[150,0,90]},{"index":0.125,"rgb":[0,0,200]},{"index":0.25,"rgb":[0,25,255]},{"index":0.375,"rgb":[0,152,255]},{"index":0.5,"rgb":[44,255,150]},{"index":0.625,"rgb":[151,255,0]},{"index":0.75,"rgb":[255,234,0]},{"index":0.875,"rgb":[255,111,0]},{"index":1,"rgb":[255,0,0]}],

	"portland":[{"index":0,"rgb":[12,51,131]},{"index":0.25,"rgb":[10,136,186]},{"index":0.5,"rgb":[242,211,56]},{"index":0.75,"rgb":[242,143,56]},{"index":1,"rgb":[217,30,30]}],

	"blackbody":[{"index":0,"rgb":[0,0,0]},{"index":0.2,"rgb":[230,0,0]},{"index":0.4,"rgb":[230,210,0]},{"index":0.7,"rgb":[255,255,255]},{"index":1,"rgb":[160,200,255]}],

	"earth":[{"index":0,"rgb":[0,0,130]},{"index":0.1,"rgb":[0,180,180]},{"index":0.2,"rgb":[40,210,40]},{"index":0.4,"rgb":[230,230,50]},{"index":0.6,"rgb":[120,70,20]},{"index":1,"rgb":[255,255,255]}],

	"electric":[{"index":0,"rgb":[0,0,0]},{"index":0.15,"rgb":[30,0,100]},{"index":0.4,"rgb":[120,0,100]},{"index":0.6,"rgb":[160,90,0]},{"index":0.8,"rgb":[230,200,0]},{"index":1,"rgb":[255,250,220]}],

	"alpha": [{"index":0, "rgb": [255,255,255,0]},{"index":0, "rgb": [255,255,255,1]}],

	"viridis": [{"index":0,"rgb":[68,1,84]},{"index":0.13,"rgb":[71,44,122]},{"index":0.25,"rgb":[59,81,139]},{"index":0.38,"rgb":[44,113,142]},{"index":0.5,"rgb":[33,144,141]},{"index":0.63,"rgb":[39,173,129]},{"index":0.75,"rgb":[92,200,99]},{"index":0.88,"rgb":[170,220,50]},{"index":1,"rgb":[253,231,37]}],

	"inferno": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[31,12,72]},{"index":0.25,"rgb":[85,15,109]},{"index":0.38,"rgb":[136,34,106]},{"index":0.5,"rgb":[186,54,85]},{"index":0.63,"rgb":[227,89,51]},{"index":0.75,"rgb":[249,140,10]},{"index":0.88,"rgb":[249,201,50]},{"index":1,"rgb":[252,255,164]}],

	"magma": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[28,16,68]},{"index":0.25,"rgb":[79,18,123]},{"index":0.38,"rgb":[129,37,129]},{"index":0.5,"rgb":[181,54,122]},{"index":0.63,"rgb":[229,80,100]},{"index":0.75,"rgb":[251,135,97]},{"index":0.88,"rgb":[254,194,135]},{"index":1,"rgb":[252,253,191]}],

	"plasma": [{"index":0,"rgb":[13,8,135]},{"index":0.13,"rgb":[75,3,161]},{"index":0.25,"rgb":[125,3,168]},{"index":0.38,"rgb":[168,34,150]},{"index":0.5,"rgb":[203,70,121]},{"index":0.63,"rgb":[229,107,93]},{"index":0.75,"rgb":[248,148,65]},{"index":0.88,"rgb":[253,195,40]},{"index":1,"rgb":[240,249,33]}],

	"warm": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[172,0,187]},{"index":0.25,"rgb":[219,0,170]},{"index":0.38,"rgb":[255,0,130]},{"index":0.5,"rgb":[255,63,74]},{"index":0.63,"rgb":[255,123,0]},{"index":0.75,"rgb":[234,176,0]},{"index":0.88,"rgb":[190,228,0]},{"index":1,"rgb":[147,255,0]}],

	"cool": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[116,0,218]},{"index":0.25,"rgb":[98,74,237]},{"index":0.38,"rgb":[68,146,231]},{"index":0.5,"rgb":[0,204,197]},{"index":0.63,"rgb":[0,247,146]},{"index":0.75,"rgb":[0,255,88]},{"index":0.88,"rgb":[40,255,8]},{"index":1,"rgb":[147,255,0]}],

	"rainbow-soft": [{"index":0,"rgb":[125,0,179]},{"index":0.1,"rgb":[199,0,180]},{"index":0.2,"rgb":[255,0,121]},{"index":0.3,"rgb":[255,108,0]},{"index":0.4,"rgb":[222,194,0]},{"index":0.5,"rgb":[150,255,0]},{"index":0.6,"rgb":[0,255,55]},{"index":0.7,"rgb":[0,246,150]},{"index":0.8,"rgb":[50,167,222]},{"index":0.9,"rgb":[103,51,235]},{"index":1,"rgb":[124,0,186]}],

	"bathymetry": [{"index":0,"rgb":[40,26,44]},{"index":0.13,"rgb":[59,49,90]},{"index":0.25,"rgb":[64,76,139]},{"index":0.38,"rgb":[63,110,151]},{"index":0.5,"rgb":[72,142,158]},{"index":0.63,"rgb":[85,174,163]},{"index":0.75,"rgb":[120,206,163]},{"index":0.88,"rgb":[187,230,172]},{"index":1,"rgb":[253,254,204]}],

	"cdom": [{"index":0,"rgb":[47,15,62]},{"index":0.13,"rgb":[87,23,86]},{"index":0.25,"rgb":[130,28,99]},{"index":0.38,"rgb":[171,41,96]},{"index":0.5,"rgb":[206,67,86]},{"index":0.63,"rgb":[230,106,84]},{"index":0.75,"rgb":[242,149,103]},{"index":0.88,"rgb":[249,193,135]},{"index":1,"rgb":[254,237,176]}],

	"chlorophyll": [{"index":0,"rgb":[18,36,20]},{"index":0.13,"rgb":[25,63,41]},{"index":0.25,"rgb":[24,91,59]},{"index":0.38,"rgb":[13,119,72]},{"index":0.5,"rgb":[18,148,80]},{"index":0.63,"rgb":[80,173,89]},{"index":0.75,"rgb":[132,196,122]},{"index":0.88,"rgb":[175,221,162]},{"index":1,"rgb":[215,249,208]}],

	"density": [{"index":0,"rgb":[54,14,36]},{"index":0.13,"rgb":[89,23,80]},{"index":0.25,"rgb":[110,45,132]},{"index":0.38,"rgb":[120,77,178]},{"index":0.5,"rgb":[120,113,213]},{"index":0.63,"rgb":[115,151,228]},{"index":0.75,"rgb":[134,185,227]},{"index":0.88,"rgb":[177,214,227]},{"index":1,"rgb":[230,241,241]}],

	"freesurface-blue": [{"index":0,"rgb":[30,4,110]},{"index":0.13,"rgb":[47,14,176]},{"index":0.25,"rgb":[41,45,236]},{"index":0.38,"rgb":[25,99,212]},{"index":0.5,"rgb":[68,131,200]},{"index":0.63,"rgb":[114,156,197]},{"index":0.75,"rgb":[157,181,203]},{"index":0.88,"rgb":[200,208,216]},{"index":1,"rgb":[241,237,236]}],

	"freesurface-red": [{"index":0,"rgb":[60,9,18]},{"index":0.13,"rgb":[100,17,27]},{"index":0.25,"rgb":[142,20,29]},{"index":0.38,"rgb":[177,43,27]},{"index":0.5,"rgb":[192,87,63]},{"index":0.63,"rgb":[205,125,105]},{"index":0.75,"rgb":[216,162,148]},{"index":0.88,"rgb":[227,199,193]},{"index":1,"rgb":[241,237,236]}],

	"oxygen": [{"index":0,"rgb":[64,5,5]},{"index":0.13,"rgb":[106,6,15]},{"index":0.25,"rgb":[144,26,7]},{"index":0.38,"rgb":[168,64,3]},{"index":0.5,"rgb":[188,100,4]},{"index":0.63,"rgb":[206,136,11]},{"index":0.75,"rgb":[220,174,25]},{"index":0.88,"rgb":[231,215,44]},{"index":1,"rgb":[248,254,105]}],

	"par": [{"index":0,"rgb":[51,20,24]},{"index":0.13,"rgb":[90,32,35]},{"index":0.25,"rgb":[129,44,34]},{"index":0.38,"rgb":[159,68,25]},{"index":0.5,"rgb":[182,99,19]},{"index":0.63,"rgb":[199,134,22]},{"index":0.75,"rgb":[212,171,35]},{"index":0.88,"rgb":[221,210,54]},{"index":1,"rgb":[225,253,75]}],

	"phase": [{"index":0,"rgb":[145,105,18]},{"index":0.13,"rgb":[184,71,38]},{"index":0.25,"rgb":[186,58,115]},{"index":0.38,"rgb":[160,71,185]},{"index":0.5,"rgb":[110,97,218]},{"index":0.63,"rgb":[50,123,164]},{"index":0.75,"rgb":[31,131,110]},{"index":0.88,"rgb":[77,129,34]},{"index":1,"rgb":[145,105,18]}],

	"salinity": [{"index":0,"rgb":[42,24,108]},{"index":0.13,"rgb":[33,50,162]},{"index":0.25,"rgb":[15,90,145]},{"index":0.38,"rgb":[40,118,137]},{"index":0.5,"rgb":[59,146,135]},{"index":0.63,"rgb":[79,175,126]},{"index":0.75,"rgb":[120,203,104]},{"index":0.88,"rgb":[193,221,100]},{"index":1,"rgb":[253,239,154]}],

	"temperature": [{"index":0,"rgb":[4,35,51]},{"index":0.13,"rgb":[23,51,122]},{"index":0.25,"rgb":[85,59,157]},{"index":0.38,"rgb":[129,79,143]},{"index":0.5,"rgb":[175,95,130]},{"index":0.63,"rgb":[222,112,101]},{"index":0.75,"rgb":[249,146,66]},{"index":0.88,"rgb":[249,196,65]},{"index":1,"rgb":[232,250,91]}],

	"turbidity": [{"index":0,"rgb":[34,31,27]},{"index":0.13,"rgb":[65,50,41]},{"index":0.25,"rgb":[98,69,52]},{"index":0.38,"rgb":[131,89,57]},{"index":0.5,"rgb":[161,112,59]},{"index":0.63,"rgb":[185,140,66]},{"index":0.75,"rgb":[202,174,88]},{"index":0.88,"rgb":[216,209,126]},{"index":1,"rgb":[233,246,171]}],

	"velocity-blue": [{"index":0,"rgb":[17,32,64]},{"index":0.13,"rgb":[35,52,116]},{"index":0.25,"rgb":[29,81,156]},{"index":0.38,"rgb":[31,113,162]},{"index":0.5,"rgb":[50,144,169]},{"index":0.63,"rgb":[87,173,176]},{"index":0.75,"rgb":[149,196,189]},{"index":0.88,"rgb":[203,221,211]},{"index":1,"rgb":[254,251,230]}],

	"velocity-green": [{"index":0,"rgb":[23,35,19]},{"index":0.13,"rgb":[24,64,38]},{"index":0.25,"rgb":[11,95,45]},{"index":0.38,"rgb":[39,123,35]},{"index":0.5,"rgb":[95,146,12]},{"index":0.63,"rgb":[152,165,18]},{"index":0.75,"rgb":[201,186,69]},{"index":0.88,"rgb":[233,216,137]},{"index":1,"rgb":[255,253,205]}],

	"cubehelix": [{"index":0,"rgb":[0,0,0]},{"index":0.07,"rgb":[22,5,59]},{"index":0.13,"rgb":[60,4,105]},{"index":0.2,"rgb":[109,1,135]},{"index":0.27,"rgb":[161,0,147]},{"index":0.33,"rgb":[210,2,142]},{"index":0.4,"rgb":[251,11,123]},{"index":0.47,"rgb":[255,29,97]},{"index":0.53,"rgb":[255,54,69]},{"index":0.6,"rgb":[255,85,46]},{"index":0.67,"rgb":[255,120,34]},{"index":0.73,"rgb":[255,157,37]},{"index":0.8,"rgb":[241,191,57]},{"index":0.87,"rgb":[224,220,93]},{"index":0.93,"rgb":[218,241,142]},{"index":1,"rgb":[227,253,198]}]
};

},{}],28:[function(require,module,exports){
/*
 * Ben Postlethwaite
 * January 2013
 * License MIT
 */
'use strict';

var at = require('arraytools');
var clone = require('clone');
var colorScale = require('./colorScales');

module.exports = createColormap;

function createColormap (spec) {
    /*
     * Default Options
     */
    var indicies, rgba, fromrgba, torgba,
        nsteps, cmap, colormap, format,
        nshades, colors, alpha, index, i,
        r = [],
        g = [],
        b = [],
        a = [];

    if ( !at.isPlainObject(spec) ) spec = {};

    nshades = spec.nshades || 72;
    format = spec.format || 'hex';

    colormap = spec.colormap;
    if (!colormap) colormap = 'jet';

    if (typeof colormap === 'string') {
        colormap = colormap.toLowerCase();

        if (!colorScale[colormap]) {
            throw Error(colormap + ' not a supported colorscale');
        }

        cmap = clone(colorScale[colormap]);

    } else if (Array.isArray(colormap)) {
        cmap = clone(colormap);

    } else {
        throw Error('unsupported colormap option', colormap);
    }

    if (cmap.length > nshades) {
        throw new Error(
            colormap+' map requires nshades to be at least size '+cmap.length
        );
    }

    if (!Array.isArray(spec.alpha)) {

        if (typeof spec.alpha === 'number') {
            alpha = [spec.alpha, spec.alpha];

        } else {
            alpha = [1, 1];
        }

    } else if (spec.alpha.length !== 2) {
        alpha = [1, 1];

    } else {
        alpha = clone(spec.alpha);
    }

    /*
     * map index points from 0->1 to 0 -> n-1
     */
    indicies = cmap.map(function(c) {
        return Math.round(c.index * nshades);
    });

    /*
     * Add alpha channel to the map
     */
    if (alpha[0] < 0) alpha[0] = 0;
    if (alpha[1] < 0) alpha[0] = 0;
    if (alpha[0] > 1) alpha[0] = 1;
    if (alpha[1] > 1) alpha[0] = 1;

    for (i = 0; i < indicies.length; ++i) {
        index = cmap[i].index;
        rgba = cmap[i].rgb;

        // if user supplies their own map use it
        if (rgba.length === 4 && rgba[3] >= 0 && rgba[3] <= 1) continue;
        rgba[3] = alpha[0] + (alpha[1] - alpha[0])*index;
    }

    /*
     * map increasing linear values between indicies to
     * linear steps in colorvalues
     */
    for (i = 0; i < indicies.length-1; ++i) {
        nsteps = indicies[i+1] - indicies[i];
        fromrgba = cmap[i].rgb;
        torgba = cmap[i+1].rgb;
        r = r.concat(at.linspace(fromrgba[0], torgba[0], nsteps ) );
        g = g.concat(at.linspace(fromrgba[1], torgba[1], nsteps ) );
        b = b.concat(at.linspace(fromrgba[2], torgba[2], nsteps ) );
        a = a.concat(at.linspace(fromrgba[3], torgba[3], nsteps ) );
    }

    r = r.map( Math.round );
    g = g.map( Math.round );
    b = b.map( Math.round );

    colors = at.zip(r, g, b, a);

    if (format === 'hex') colors = colors.map( rgb2hex );
    if (format === 'rgbaString') colors = colors.map( rgbaStr );

    return colors;
};


function rgb2hex (rgba) {
    var dig, hex = '#';
    for (var i = 0; i < 3; ++i) {
        dig = rgba[i];
        dig = dig.toString(16);
        hex += ('00' + dig).substr( dig.length );
    }
    return hex;
}

function rgbaStr (rgba) {
    return 'rgba(' + rgba.join(',') + ')';
}

},{"./colorScales":27,"arraytools":15,"clone":22}],29:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  var this$1 = this;

  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this$1, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};
},{}],30:[function(require,module,exports){
var prefix = require('prefix-style')
var toCamelCase = require('to-camel-case')
var cache = { 'float': 'cssFloat' }
var addPxToStyle = require('add-px-to-style')

function style (element, property, value) {
  var camel = cache[property]
  if (typeof camel === 'undefined') {
    camel = detect(property)
  }

  // may be false if CSS prop is unsupported
  if (camel) {
    if (value === undefined) {
      return element.style[camel]
    }

    element.style[camel] = addPxToStyle(camel, value)
  }
}

function each (element, properties) {
  for (var k in properties) {
    if (properties.hasOwnProperty(k)) {
      style(element, k, properties[k])
    }
  }
}

function detect (cssProp) {
  var camel = toCamelCase(cssProp)
  var result = prefix(camel)
  cache[camel] = cache[cssProp] = cache[result] = result
  return result
}

function set () {
  if (arguments.length === 2) {
    if (typeof arguments[1] === 'string') {
      arguments[0].style.cssText = arguments[1]
    } else {
      each(arguments[0], arguments[1])
    }
  } else {
    style(arguments[0], arguments[1], arguments[2])
  }
}

module.exports = set
module.exports.set = set

module.exports.get = function (element, properties) {
  if (Array.isArray(properties)) {
    return properties.reduce(function (obj, prop) {
      obj[prop] = style(element, prop || '')
      return obj
    }, {})
  } else {
    return style(element, properties || '')
  }
}

},{"add-px-to-style":14,"prefix-style":79,"to-camel-case":105}],31:[function(require,module,exports){
'use strict';

var trim = require('trim');
var prefix = require('prefix');
var prop = prefix('transform');
var propTransOrigin = prefix('transformOrigin');
var fns = require('./lib/properties');

var _has = Object.prototype.hasOwnProperty;

var shortcuts = {
  x: 'translateX',
  y: 'translateY',
  z: 'translateZ'
};


exports = module.exports = transform;

function transform(target, properties) {
  var output = [];
  var i;
  var name;
  var propValue;

  for (i in properties) {
    propValue = properties[i];

    // replace shortcut with its transform value.
    name = _has.call(shortcuts, i)
      ? name = shortcuts[i]
      : name = i;

    if (_has.call(fns, name)) {
      output.push(fns[name](numToString(propValue)));
      continue;
    }

    if (name === 'origin') {
      target.style[propTransOrigin] = propValue;
      continue;
    }

    console.warn(name, 'is not a valid property');
  }

  target.style[prop] = output.join(' ');
}


exports.get = get;

function get(target) {
  return style(target);
}


exports.none = none;

function none(target) {
  target.style[prop] = '';
  target.style[propTransOrigin] = '';
}


exports.isSupported = isSupported;

function isSupported() {
  return prop.length > 0;
}


function style(target) {
  return target.style[prop];
}


function numToString(value) {
  if (typeof value === 'number') {
    value += '';
  } else {
    value = trim(value);
  }

  return value;
}

},{"./lib/properties":33,"prefix":80,"trim":108}],32:[function(require,module,exports){
'use strict';

exports = module.exports = compose;

function compose() {
  var funcs = arguments;

  return function() {
    var this$1 = this;

    var args = arguments;
    for (var i = funcs.length-1; i >= 0; i--) {
      args = [funcs[i].apply(this$1, args)];
    }
    return args[0];
  };
}

},{}],33:[function(require,module,exports){
'use strict';

var trim = require('trim');
var compose = require('./compose');

var NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

module.exports = {
  translate: compose(function(value) {
    return 'translate(' + value + ')';
  }, defaultUnit('px'), comma),

  translate3d: compose(function(value) {
    return 'translate3d(' + value + ')';
  }, defaultUnit('px'), comma),

  translateX: compose(function(x) {
    return 'translateX(' + x + ')';
  }, defaultUnit('px')),

  translateY: compose(function(y) {
    return 'translateY(' + y + ')';
  }, defaultUnit('px')),

  translateZ: compose(function(z) {
    return 'translateZ(' + z + ')';
  }, defaultUnit('px')),


  scale: compose(function(value) {
    return 'scale(' + value + ')';
  }, comma),

  scale3d: compose(function(value) {
    return 'scale3d(' + value + ')';
  }, comma),

  scaleX: function(value) {
    return 'scaleX(' + value + ')';
  },

  scaleY: function(value) {
    return 'scaleY(' + value + ')';
  },

  scaleZ: function(value) {
    return 'scaleZ(' + value + ')';
  },


  rotate: compose(function(value) {
    return 'rotate(' + value + ')';
  }, defaultUnit('deg'), comma),

  rotate3d: compose(function(value) {
    return 'rotate3d(' + value + ')';
  }, comma),

  rotateX: compose(function(value) {
    return 'rotateX(' + value + ')';
  }, defaultUnit('deg')),

  rotateY: compose(function(value) {
    return 'rotateY(' + value + ')';
  }, defaultUnit('deg')),

  rotateZ: compose(function(value) {
    return 'rotateZ(' + value + ')';
  }, defaultUnit('deg')),


  skew: compose(function(value) {
    return 'skew(' + value + ')';
  }, defaultUnit('deg'), comma),

  skewX: compose(function(value) {
    return 'skewX(' + value + ')';
  }, defaultUnit('deg')),

  skewY: compose(function(value) {
    return 'skewY(' + value + ')';
  }, defaultUnit('deg')),


  matrix: compose(function(value) {
    return 'matrix(' + value + ')';
  }, comma),

  matrix3d: compose(function(value) {
    return 'matrix3d(' + value + ')';
  }, comma),


  perspective: compose(function(value) {
    return 'perspective(' + value + ')';
  }, defaultUnit('px')),
};


function comma(value) {
  if (!/,/.test(value)) {
    value = value.split(' ').join(',');
  }

  return value;
}


function defaultUnit(unit) {
  return function(value) {
    return value.split(',').map(function(v) {
      v = trim(v);

      if (NUMBER_REGEX.test(v)) {
        v += unit;
      }

      return v;
    }).join(',');
  };
}

},{"./compose":32,"trim":108}],34:[function(require,module,exports){
module.exports = getSize

function getSize(element) {
  // Handle cases where the element is not already
  // attached to the DOM by briefly appending it
  // to document.body, and removing it again later.
  if (element === window || element === document.body) {
    return [window.innerWidth, window.innerHeight]
  }

  if (!element.parentNode) {
    var temporary = true
    document.body.appendChild(element)
  }

  var bounds = element.getBoundingClientRect()
  var styles = getComputedStyle(element)
  var height = (bounds.height|0)
    + parse(styles.getPropertyValue('margin-top'))
    + parse(styles.getPropertyValue('margin-bottom'))
  var width  = (bounds.width|0)
    + parse(styles.getPropertyValue('margin-left'))
    + parse(styles.getPropertyValue('margin-right'))

  if (temporary) {
    document.body.removeChild(element)
  }

  return [width, height]
}

function parse(prop) {
  return parseFloat(prop) || 0
}

},{}],35:[function(require,module,exports){
require('typedarray-methods');
require('get-float-time-domain-data');
var css = require('insert-styles');


css("/*! normalize.css v4.1.1 | MIT License | github.com/necolas/normalize.css */\n\n/**\n * 1. Change the default font family in all browsers (opinionated).\n * 2. Correct the line height in all browsers.\n * 3. Prevent adjustments of font size after orientation changes in IE and iOS.\n */\n\nhtml {\n  font-family: sans-serif; /* 1 */\n  line-height: 1.15; /* 2 */\n  -ms-text-size-adjust: 100%; /* 3 */\n  -webkit-text-size-adjust: 100%; /* 3 */\n}\n\n/**\n * Remove the margin in all browsers (opinionated).\n */\n\nbody {\n  margin: 0;\n}\n\n/* HTML5 display definitions\n   ========================================================================== */\n\n/**\n * Add the correct display in IE 9-.\n * 1. Add the correct display in Edge, IE, and Firefox.\n * 2. Add the correct display in IE.\n */\n\narticle,\naside,\ndetails, /* 1 */\nfigcaption,\nfigure,\nfooter,\nheader,\nmain, /* 2 */\nmenu,\nnav,\nsection,\nsummary { /* 1 */\n  display: block;\n}\n\n/**\n * Add the correct display in IE 9-.\n */\n\naudio,\ncanvas,\nprogress,\nvideo {\n  display: inline-block;\n}\n\n/**\n * Add the correct display in iOS 4-7.\n */\n\naudio:not([controls]) {\n  display: none;\n  height: 0;\n}\n\n/**\n * Add the correct vertical alignment in Chrome, Firefox, and Opera.\n */\n\nprogress {\n  vertical-align: baseline;\n}\n\n/**\n * Add the correct display in IE 10-.\n * 1. Add the correct display in IE.\n */\n\ntemplate, /* 1 */\n[hidden] {\n  display: none;\n}\n\n/* Links\n   ========================================================================== */\n\n/**\n * 1. Remove the gray background on active links in IE 10.\n * 2. Remove gaps in links underline in iOS 8+ and Safari 8+.\n */\n\na {\n  background-color: transparent; /* 1 */\n  -webkit-text-decoration-skip: objects; /* 2 */\n}\n\n/**\n * Remove the outline on focused links when they are also active or hovered\n * in all browsers (opinionated).\n */\n\na:active,\na:hover {\n  outline-width: 0;\n}\n\n/* Text-level semantics\n   ========================================================================== */\n\n/**\n * 1. Remove the bottom border in Firefox 39-.\n * 2. Add the correct text decoration in Chrome, Edge, IE, Opera, and Safari.\n */\n\nabbr[title] {\n  border-bottom: none; /* 1 */\n  text-decoration: underline; /* 2 */\n  text-decoration: underline dotted; /* 2 */\n}\n\n/**\n * Prevent the duplicate application of `bolder` by the next rule in Safari 6.\n */\n\nb,\nstrong {\n  font-weight: inherit;\n}\n\n/**\n * Add the correct font weight in Chrome, Edge, and Safari.\n */\n\nb,\nstrong {\n  font-weight: bolder;\n}\n\n/**\n * Add the correct font style in Android 4.3-.\n */\n\ndfn {\n  font-style: italic;\n}\n\n/**\n * Correct the font size and margin on `h1` elements within `section` and\n * `article` contexts in Chrome, Firefox, and Safari.\n */\n\nh1 {\n  font-size: 2em;\n  margin: 0.67em 0;\n}\n\n/**\n * Add the correct background and color in IE 9-.\n */\n\nmark {\n  background-color: #ff0;\n  color: #000;\n}\n\n/**\n * Add the correct font size in all browsers.\n */\n\nsmall {\n  font-size: 80%;\n}\n\n/**\n * Prevent `sub` and `sup` elements from affecting the line height in\n * all browsers.\n */\n\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline;\n}\n\nsub {\n  bottom: -0.25em;\n}\n\nsup {\n  top: -0.5em;\n}\n\n/* Embedded content\n   ========================================================================== */\n\n/**\n * Remove the border on images inside links in IE 10-.\n */\n\nimg {\n  border-style: none;\n}\n\n/**\n * Hide the overflow in IE.\n */\n\nsvg:not(:root) {\n  overflow: hidden;\n}\n\n/* Grouping content\n   ========================================================================== */\n\n/**\n * 1. Correct the inheritance and scaling of font size in all browsers.\n * 2. Correct the odd `em` font sizing in all browsers.\n */\n\ncode,\nkbd,\npre,\nsamp {\n  font-family: monospace, monospace; /* 1 */\n  font-size: 1em; /* 2 */\n}\n\n/**\n * Add the correct margin in IE 8.\n */\n\nfigure {\n  margin: 1em 40px;\n}\n\n/**\n * 1. Add the correct box sizing in Firefox.\n * 2. Show the overflow in Edge and IE.\n */\n\nhr {\n  box-sizing: content-box; /* 1 */\n  height: 0; /* 1 */\n  overflow: visible; /* 2 */\n}\n\n/* Forms\n   ========================================================================== */\n\n/**\n * 1. Change font properties to `inherit` in all browsers (opinionated).\n * 2. Remove the margin in Firefox and Safari.\n */\n\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  font: inherit; /* 1 */\n  margin: 0; /* 2 */\n}\n\n/**\n * Restore the font weight unset by the previous rule.\n */\n\noptgroup {\n  font-weight: bold;\n}\n\n/**\n * Show the overflow in IE.\n * 1. Show the overflow in Edge.\n */\n\nbutton,\ninput { /* 1 */\n  overflow: visible;\n}\n\n/**\n * Remove the inheritance of text transform in Edge, Firefox, and IE.\n * 1. Remove the inheritance of text transform in Firefox.\n */\n\nbutton,\nselect { /* 1 */\n  text-transform: none;\n}\n\n/**\n * 1. Prevent a WebKit bug where (2) destroys native `audio` and `video`\n *    controls in Android 4.\n * 2. Correct the inability to style clickable types in iOS and Safari.\n */\n\nbutton,\nhtml [type=\"button\"], /* 1 */\n[type=\"reset\"],\n[type=\"submit\"] {\n  -webkit-appearance: button; /* 2 */\n}\n\n/**\n * Remove the inner border and padding in Firefox.\n */\n\nbutton::-moz-focus-inner,\n[type=\"button\"]::-moz-focus-inner,\n[type=\"reset\"]::-moz-focus-inner,\n[type=\"submit\"]::-moz-focus-inner {\n  border-style: none;\n  padding: 0;\n}\n\n/**\n * Restore the focus styles unset by the previous rule.\n */\n\nbutton:-moz-focusring,\n[type=\"button\"]:-moz-focusring,\n[type=\"reset\"]:-moz-focusring,\n[type=\"submit\"]:-moz-focusring {\n  outline: 1px dotted ButtonText;\n}\n\n/**\n * Change the border, margin, and padding in all browsers (opinionated).\n */\n\nfieldset {\n  border: 1px solid #c0c0c0;\n  margin: 0 2px;\n  padding: 0.35em 0.625em 0.75em;\n}\n\n/**\n * 1. Correct the text wrapping in Edge and IE.\n * 2. Correct the color inheritance from `fieldset` elements in IE.\n * 3. Remove the padding so developers are not caught out when they zero out\n *    `fieldset` elements in all browsers.\n */\n\nlegend {\n  box-sizing: border-box; /* 1 */\n  color: inherit; /* 2 */\n  display: table; /* 1 */\n  max-width: 100%; /* 1 */\n  padding: 0; /* 3 */\n  white-space: normal; /* 1 */\n}\n\n/**\n * Remove the default vertical scrollbar in IE.\n */\n\ntextarea {\n  overflow: auto;\n}\n\n/**\n * 1. Add the correct box sizing in IE 10-.\n * 2. Remove the padding in IE 10-.\n */\n\n[type=\"checkbox\"],\n[type=\"radio\"] {\n  box-sizing: border-box; /* 1 */\n  padding: 0; /* 2 */\n}\n\n/**\n * Correct the cursor style of increment and decrement buttons in Chrome.\n */\n\n[type=\"number\"]::-webkit-inner-spin-button,\n[type=\"number\"]::-webkit-outer-spin-button {\n  height: auto;\n}\n\n/**\n * 1. Correct the odd appearance in Chrome and Safari.\n * 2. Correct the outline style in Safari.\n */\n\n[type=\"search\"] {\n  -webkit-appearance: textfield; /* 1 */\n  outline-offset: -2px; /* 2 */\n}\n\n/**\n * Remove the inner padding and cancel buttons in Chrome and Safari on OS X.\n */\n\n[type=\"search\"]::-webkit-search-cancel-button,\n[type=\"search\"]::-webkit-search-decoration {\n  -webkit-appearance: none;\n}\n\n/**\n * Correct the text style of placeholders in Chrome, Edge, and Safari.\n */\n\n::-webkit-input-placeholder {\n  color: inherit;\n  opacity: 0.54;\n}\n\n/**\n * 1. Correct the inability to style clickable types in iOS and Safari.\n * 2. Change font properties to `inherit` in Safari.\n */\n\n::-webkit-file-upload-button {\n  -webkit-appearance: button; /* 1 */\n  font: inherit; /* 2 */\n}\n");

addMeta({
	name: 'viewport',
	content: 'width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=0'
});
addMeta({
	'http-equiv': 'x-ua-compatible',
	content: 'ie=edge'
});
addMeta({
	charset: 'utf-8'
});


function addMeta (obj) {
	var meta = document.createElement('meta');
	var qs = 'meta';
	for (var name in obj) {
		qs += "[" + name + "]"
		meta.setAttribute(name, obj[name]);
	}
	if (!document.querySelector(qs)) {
		document.head.insertBefore(meta, document.head.firstChild);
	}
}
},{"get-float-time-domain-data":38,"insert-styles":47,"typedarray-methods":109}],36:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],37:[function(require,module,exports){
module.exports = getCanvasContext
function getCanvasContext (type, opts) {
  if (typeof type !== 'string') {
    throw new TypeError('must specify type string')
  }

  opts = opts || {}

  if (typeof document === 'undefined' && !opts.canvas) {
    return null // check for Node
  }

  var canvas = opts.canvas || document.createElement('canvas')
  if (typeof opts.width === 'number') {
    canvas.width = opts.width
  }
  if (typeof opts.height === 'number') {
    canvas.height = opts.height
  }

  var attribs = opts
  var gl
  try {
    var names = [ type ]
    // prefix GL contexts
    if (type.indexOf('webgl') === 0) {
      names.push('experimental-' + type)
    }

    for (var i = 0; i < names.length; i++) {
      gl = canvas.getContext(names[i], attribs)
      if (gl) return gl
    }
  } catch (e) {
    gl = null
  }
  return (gl || null) // ensure null on fail
}

},{}],38:[function(require,module,exports){
(function (global){
"use strict";

if (global.AnalyserNode && !global.AnalyserNode.prototype.getFloatTimeDomainData) {
  var uint8 = new Uint8Array(2048);
  global.AnalyserNode.prototype.getFloatTimeDomainData = function(array) {
    this.getByteTimeDomainData(uint8);
    for (var i = 0, imax = array.length; i < imax; i++) {
      array[i] = (uint8[i] - 128) * 0.0078125;
    }
  };
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],39:[function(require,module,exports){
/** generate unique id for selector */
var counter = Date.now() % 1e9;

module.exports = function getUid(){
	return (Math.random() * 1e9 >>> 0) + (counter++);
};
},{}],40:[function(require,module,exports){
/**
 * @module  gl-spectrum
 */
'use strict';

var extend = require('xtend/mutable');
var getContext = require('get-canvas-context');
var fit = require('canvas-fit');
var loop = require('raf-loop');
var raf = require('raf');
var isBrowser = require('is-browser');
var Emitter = require('events').EventEmitter;
var inherits = require('inherits');
var isPlainObject = require('is-plain-obj');

module.exports = Component;


//per-context cache of texture/attributes
var texturesCache = new WeakMap();
var attributesCache = new WeakMap();


/**
 * @contructor
 */
function Component (options) {
	var this$1 = this;

	if (!(this instanceof Component)) return new Component(options);

	if (options instanceof Function) {
		options = {
			render: options
		}
	}

	extend(this, options);

	//preserve initial viewport argument
	this.initialViewport = this.viewport;

	if (typeof this.context === 'string') {
		this.context = getContext(this.context);
	}
	else if (isPlainObject(this.context)) {
		this.context = getContext((this.is2d || this.context.is2d || this.context['2d']) ? '2d' : (this.context.type || 'webgl'), this.context);
	}

	this.canvas = this.context.canvas;

	//null-container means background renderer, so only undefined is recognized as default
	if (this.container === undefined) {
		this.container = this.canvas.parentNode || (isBrowser ? document.body || document.documentElement : {});
		this.container.appendChild(this.canvas);
	}

	this.is2d = !this.context.drawingBufferHeight;
	var gl = this.gl = this.context;

	//cache of textures/attributes
	this.textures = this.textures || {};
	this.attributes = extend({position: [-1,-1, -1,4, 4,-1]}, this.attributes);

	//setup webgl context
	if (!this.is2d) {
		if (this.float) {
			var float = gl.getExtension('OES_texture_float');
			if (!float) {
				var float = gl.getExtension('OES_texture_half_float');
				if (!float) {
					throw Error('WebGL does not support floats.');
				}
				var floatLinear = gl.getExtension('OES_texture_half_float_linear');
			}
			else {
				var floatLinear = gl.getExtension('OES_texture_float_linear');

			}
			if (!floatLinear) throw Error('WebGL does not support floats.');
		}

		this.program = this.createProgram(this.vert, this.frag);

		//preset passed attributes
		this.setAttribute(this.attributes);

		gl.linkProgram(this.program);

		//stub textures with empty data (to avoid errors)
		if (this.autoinitTextures) {
			var numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
			for(var i=0; i<numUniforms; ++i) {
				var info = gl.getActiveUniform(this$1.program, i);
				if (info && info.type === gl.SAMPLER_2D) {
					if (!this$1.textures[info.name]) {
						this$1.textures[info.name] = null
					}
				}
			}
		}
		//preset textures
		this.setTexture(this.textures);

		this.viewportLocation = gl.getUniformLocation(this.program, 'viewport');
	}

	//set canvas fit container size
	if (isBrowser) {
		this.fit = fit(this.canvas, this.container);
		this.resize = this.resize.bind(this);

		this.resize();
		window.addEventListener('resize', this.resize, false);
	}


	//create raf loop
	this.engine = loop(function (dt) { return this$1.render(); });
	this.autostart && this.start();
}


inherits(Component, Emitter);


/**
 * Create and use webgl or 2d context
 */
Component.prototype.context = {
	antialias: false,
	alpha: true,
	premultipliedAlpha: true
};

//start rendering cycle on raf automatically
Component.prototype.autostart = true;

Component.prototype.vert = "\n\tattribute vec2 position;\n\tvoid main () {\n\t\tgl_Position = vec4(position, 0, 1);\n\t}\n";


Component.prototype.frag = "\n\tprecision mediump float;\n\tuniform vec4 viewport;\n\tvoid main () {\n\t\tgl_FragColor = vec4(gl_FragCoord.xy / viewport.zw, 1, 1);\n\t}\n";


//enable floating-point textures
Component.prototype.float = false;


//autoinit textures prevents errors in expense of extra-texture call
Component.prototype.autoinitTextures = true;


/**
 * Set texture
 */
Component.prototype.setTexture = function (a, b) {
	var this$1 = this;

	if (this.is2d) return this;

	if (arguments.length === 2 || typeof a === 'string') {
		var opts = {};
		opts[typeof a === 'string' ? a : ''] = b;
	}
	else {
		var opts = a || {};
	}

	var gl = this.context;

	gl.useProgram(this.program);

	for (var name in opts) {
		var obj = this$1.textures[name];

		if (obj && !isPlainObject(obj)) {
			obj = this$1.textures[name] = {name: name, data: obj};
		}
		//if no object - create and bind texture
		else if (!obj) {
			obj = {name: name};

			//if texture name is passed - save obj
			if (name) {
				this$1.textures[name] = obj;
			}
		}

		//check if passed some data/image-like object for the texture or settings object
		var opt = isPlainObject(opts[name]) ? opts[name] : {data: opts[name]};

		if (!obj.name) obj.name = name;

		if (!obj.location && name) {
			obj.location = gl.getUniformLocation(this$1.program, name);
		}

		if (obj.name && obj.unit == null || opt.unit != null) {
			var textureCount = texturesCache.get(this$1.context) || 0;
			obj.unit = opt.unit != null ? opt.unit : textureCount++;
			textureCount = Math.max(textureCount, obj.unit);
			texturesCache.set(this$1.context, textureCount);
			obj.location && gl.uniform1i(obj.location, obj.unit);
		}

		if (!obj.texture) {
			obj.texture = gl.createTexture();
		}

		gl.activeTexture(gl.TEXTURE0 + obj.unit);
		gl.bindTexture(gl.TEXTURE_2D, obj.texture);

		if (opt.wrap || opt.wrapS || !obj.wrapS) {
			obj.wrapS = opt.wrap && opt.wrap[0] || opt.wrapS || opt.wrap || obj.wrapS || gl.REPEAT;
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, obj.wrapS);
		}

		if (opt.wrap || opt.wrapT || !obj.wrapT) {
			obj.wrapT = opt.wrap && opt.wrap[1] || opt.wrapT || opt.wrap || obj.wrapT || gl.REPEAT;
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, obj.wrapT);
		}

		if (opt.filter || opt.minFilter || !obj.minFilter) {
			obj.minFilter = opt.minFilter || opt.filter || obj.minFilter || gl.NEAREST;
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, obj.minFilter);
		}

		if (opt.filter || opt.magFilter || !obj.magFilter) {
			obj.magFilter = opt.magFilter || opt.filter || obj.magFilter || gl.NEAREST;
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, obj.magFilter);
		}

		if (!obj.type || opt.type) {
			obj.type = opt.type || obj.type || (this$1.float ? gl.FLOAT : gl.UNSIGNED_BYTE);
		}

		if (!obj.format || opt.format) {
			obj.format = opt.format || obj.format || gl.RGBA;
		}


		var data = opt.data || null;
		if (isBrowser) {
			if (typeof data === 'string') {
				if (data === (obj.data && obj.data._src) || data === (obj.data && obj.data.src)) {
					return this$1;
				}
				var image = new Image;
				image.src = data;
				image._src = data;
			}
			else if (data instanceof Image && !data.complete) {
				var image = data;
			}

			if (image) {
				if (image.complete && image === obj.data || image.src === obj.data.src) {
					return this$1;
				}
				image.addEventListener('load', function () {
					this$1.setTexture(obj.name || obj.texture, image)
				});
				data = null;
			}
		}

		//handle raw data case
		if (data == null || Array.isArray(data) || ArrayBuffer.isView(data)) {
			if (opt && opt.shape) {
				obj.width = opt.shape[0];
				obj.height = opt.shape[1];
			}
			else {
				var len = data && data.length || 1;
				obj.width = opt.width || data && data.width || (obj.format === gl.ALPHA ? len : Math.max(len / 4, 1));
				obj.height = opt.height || (data && data.height) || 1;
			}
			obj.data = data == null ? null : obj.type === gl.FLOAT ? new Float32Array(data) : obj.type === gl.UNSIGNED_SHORT ? new Uint16Array(data) : new Uint8Array(data);

			gl.texImage2D(gl.TEXTURE_2D, 0, obj.format, obj.width, obj.height, 0, obj.format, obj.type, obj.data);
		} else {
			obj.width = data && data.width || 1;
			obj.height = data && data.height || 1;
			obj.data = data;
			gl.texImage2D(gl.TEXTURE_2D, 0, obj.format, obj.format, obj.type, obj.data);
		}
	}

	return this;
};



//create and set buffer
Component.prototype.setAttribute = function (a, b) {
	var this$1 = this;

	if (this.is2d) return this;

	if (arguments.length === 2 || typeof a === 'string') {
		var opts = {};
		opts[a] = b;
	}
	else {
		var opts = a || {position: [-1,-1, -1,4, 4,-1]};
	}

	var gl = this.context;

	gl.useProgram(this.program);

	for (var name in opts) {
		var obj = this$1.attributes[name];
		if (obj && !isPlainObject(obj)) {
			obj = this$1.attributes[name] = {name: name, data: obj};
		}
		else if (obj && obj.data === opts[name]) {
			continue;
		}

		//if object exists and ony the data passed - just update buffer data
		if (obj) {
			if (opts[name] && obj.data && !isPlainObject(opts[name]) && opts[name].length <= obj.data.length) {
				if (obj.target === gl.ELEMENT_ARRAY_BUFFER) {
					obj.data = new Uint16Array(opts[name]);
				}
				else if (obj.type === gl.FLOAT) {
					obj.data = new Float32Array(opts[name]);
				}
				else if (obj.type === gl.UNSIGNED_BYTE) {
					obj.data = new Uint8Array(opts[name]);
				}

				gl.bufferSubData(obj.target, 0, obj.data);
				return this$1;
			}
		}
		//if no object - create and bind texture
		else {
			obj = this$1.attributes[name] = {name: name};
		}

		if (!obj.name) obj.name = name;

		//check if passed some data/image-like object for the texture or settings object
		var opt = isPlainObject(opts[name]) ? opts[name] : {data: opts[name]};

		extend(obj, opt);

		if (!obj.target) {
			obj.target = gl.ARRAY_BUFFER;
		}

		if (!obj.data) {
			obj.data = [-1,-1,-1,4,4,-1]
		}

		if (!obj.buffer) {
			obj.buffer = gl.createBuffer();
		}

		if (!obj.usage) {
			obj.usage = gl.STATIC_DRAW;
		}

		if (obj.index == null) {
			var attrCount = attributesCache.get(this$1.context) || 0;
			obj.index = attrCount++;
			attrCount = Math.max(attrCount, obj.index);
			attributesCache.set(this$1.context, attrCount);
		}

		if (!obj.size) {
			obj.size = 2;
		}

		if (!obj.type) {
			obj.type = obj.target === gl.ELEMENT_ARRAY_BUFFER ? gl.UNSIGNED_SHORT : gl.FLOAT;
		}

		if (obj.type === gl.FLOAT) {
			obj.data = new Float32Array(obj.data);
		}
		else if (obj.type === gl.UNSIGNED_BYTE) {
			obj.data = new Uint8Array(obj.data);
		}
		else if (obj.type === gl.UNSIGNED_SHORT) {
			obj.data =  new Uint16Array(obj.data);
		}

		if (obj.normalized == null) {
			obj.normalized = false;
		}

		if (obj.stride == null) {
			obj.stride = 0;
		}

		if (obj.offset == null) {
			obj.offset = 0;
		}

		gl.bindBuffer(obj.target, obj.buffer);
		gl.bufferData(obj.target, obj.data, obj.usage);
		gl.enableVertexAttribArray(obj.index);
		gl.vertexAttribPointer(obj.index, obj.size, obj.type, obj.normalized, obj.stride, obj.offset);
		gl.bindAttribLocation(this$1.program, obj.index, obj.name);
	}

	return this;
}



/**
 * Do resize routine
 */
Component.prototype.resize = function () {
	this.fit();

	this.updateViewport();

	this.emit('resize');

	return this;
};

Component.prototype.updateViewport = function () {
	var gl = this.context;
	var w = this.canvas.width, h = this.canvas.height;

	//if vp is undefined - set it as full-height
	if (!this.initialViewport) {
		this.viewport = [0, 0, w, h];
	}
	else if (this.initialViewport instanceof Function) {
		this.viewport = this.initialViewport(w, h);
	}
	else {
		this.viewport = this.initialViewport;
	}

	if (!this.is2d) {
		//this trickery inverts viewport Y
		var top = h-(this.viewport[3]+this.viewport[1]);
		this.glViewport = [this.viewport[0], top, this.viewport[2], this.viewport[3] + Math.min(top, 0)];
		gl.useProgram(this.program);
		gl.uniform4fv(this.viewportLocation, this.glViewport);
	}

	return this;
}

/**
 * Stop rendering loop
 */
Component.prototype.stop = function () {
	this.engine.stop();
	return this;
};
Component.prototype.start = function () {
	this.engine.start();
	return this;
};


/**
 * Render main loop
 */
Component.prototype.render = function (data) {
	var this$1 = this;

	var gl = this.context;

	if (!this.is2d) {
		//save viewport
		// var viewport = gl.getParameter(gl.VIEWPORT);

		gl.viewport.apply(gl, this.glViewport);

		// gl.viewport.apply(gl, viewport);
	}

	this.emit('render', data);

	//manual rendering should not be more frequent than raf
	if (!this.autostart) {
		if (this._planned) return this;
		this._planned = true;
		raf(function () {
			this$1._planned = false;
			this$1.draw(data)
		});
	} else {
		this.draw(data);
	}

	return this;
};

/**
 * A specific way to draw data.
 */
Component.prototype.draw = function (data) {

	if (this.is2d) return this;

	this.gl.useProgram(this.program);
	//Q: how should we organize drawArrays method?
	//1. we may want to avoid calling it - how?
	//2. we may want to change draw mode
	//3. we may want to draw a specific subset of data
	//a. place everything to event loop, cept this method
	//   - that disables outside `.render` invocation
	//b. provide `.drawMode` param
	//   - that is a bad pattern (diff to remember, god object, too declarative)
	//   - still unable to cancel invocation
	//c. how about a separate `.draw` method?
	//   - a bit of a headache for users to discern render and draw
	//   + though pattern is simple: .render for call, not overriding, draw is for redefinition, not call. Also draw may take params.
	this.gl.drawArrays(this.gl.TRIANGLES, 0, this.attributes.position.data.length / this.attributes.position.size);

	return this;
}


//create program (2 shaders)
Component.prototype.createProgram = function (vSrc, fSrc) {
	if (this.is2d) return null;

	var gl = this.gl;

	var fShader = gl.createShader(gl.FRAGMENT_SHADER);
	var vShader = gl.createShader(gl.VERTEX_SHADER);

	gl.shaderSource(fShader, fSrc);
	gl.shaderSource(vShader, vSrc);

	gl.compileShader(fShader);

	if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fShader));
	}

	gl.compileShader(vShader);

	if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vShader));
	}


	var program = gl.createProgram();
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
	}

	gl.useProgram(program);

	return program;
}
},{"canvas-fit":18,"events":3,"get-canvas-context":37,"inherits":45,"is-browser":48,"is-plain-obj":52,"raf":82,"raf-loop":81,"xtend/mutable":110}],41:[function(require,module,exports){
/**
 * @module  gl-spectrogram/lib/core
 */


var extend = require('xtend/mutable');
var Component = require('gl-component');
var inherits = require('inherits');
var isBrowser = require('is-browser');
var createGrid = require('plot-grid');
var flatten = require('flatten');
var lg = require('mumath/lg');
var clamp = require('mumath/clamp');
var weighting = require('a-weighting');
var colormap = require('colormap');
var parseColor = require('color-parse');
var hsl = require('color-space/hsl');
var colorScales = require('colormap/colorScales');

module.exports = Spectrogram;



/**
 * @contructor
 */
function Spectrogram (options) {
	if (!(this instanceof Spectrogram)) return new Spectrogram(options);

	Component.call(this, options);

	if (isBrowser) this.container.classList.add(this.className);

	this.init();

	//preset initial freqs

	this.push(this.magnitudes);

	//init style props
	this.update();
}

inherits(Spectrogram, Component);

Spectrogram.prototype.className = 'gl-spectrogram';

Spectrogram.prototype.init = function () {};

Spectrogram.prototype.antialias = false;
Spectrogram.prototype.premultipliedAlpha = true;
Spectrogram.prototype.alpha = true;
Spectrogram.prototype.float = false;

Spectrogram.prototype.maxDecibels = -30;
Spectrogram.prototype.minDecibels = -90;

Spectrogram.prototype.maxFrequency = 20000;
Spectrogram.prototype.minFrequency = 40;

Spectrogram.prototype.smoothing = 0.75;
Spectrogram.prototype.details = 1;

Spectrogram.prototype.grid = true;
Spectrogram.prototype.axes = false;
Spectrogram.prototype.logarithmic = true;
Spectrogram.prototype.weighting = 'itu';
Spectrogram.prototype.sampleRate = 44100;

Spectrogram.prototype.fill = 'greys';
Spectrogram.prototype.background = undefined;



//array with initial values of the last moment
Spectrogram.prototype.magnitudes = Array(1024).fill(-150);


//set last actual frequencies values
Spectrogram.prototype.push = function (magnitudes) {
	var this$1 = this;

	if (!magnitudes) magnitudes = [-150];

	var gl = this.gl;
	var halfRate = this.sampleRate * 0.5;
	var l = halfRate / this.magnitudes.length;
	var w = weighting[this.weighting] || weighting.z;

	magnitudes = [].slice.call(magnitudes);

	//apply weighting and clamping
	for (var i = 0; i < magnitudes.length; i++) {
		var v = magnitudes[i];
		magnitudes[i] = clamp(clamp(v, -100, 0) + 20 * Math.log(w(i * l)) / Math.log(10), -200, 0);
	}

	var smoothing = this.smoothing;

	for (var i = 0; i < magnitudes.length; i++) {
		magnitudes[i] = magnitudes[i] * (1 - smoothing) + this$1.magnitudes[Math.floor(this$1.magnitudes.length * (i / magnitudes.length))] * smoothing;
	}

	//save actual magnitudes in db
	this.magnitudes = magnitudes;

	//find peak
	this.peak = this.magnitudes.reduce(function (prev, curr) { return Math.max(curr, prev); }, -200);
	//emit magnitudes in db range
	this.emit('push', magnitudes, this.peak);

	return this;
};


/**
 * Reset colormap
 */
Spectrogram.prototype.setFill = function (cm, inverse) {
	this.fill = cm;
	this.inversed = inverse;

	//named colormap
	if (typeof cm === 'string') {
		//a color scale
		if (colorScales[cm]) {
			var cm = (flatten(colormap({
				colormap: cm,
				nshades: 128,
				format: 'rgba',
				alpha: 1
			})));//.map((v,i) => !((i + 1) % 4) ? v : v/255));
		}
		//url
		else if (/\\|\//.test(cm)) {
			this.setTexture('fill', cm);
			return this;
		}
		//plain color or CSS color string
		else {
			var parsed = parseColor(cm);

			if (parsed.space === 'hsl') {
				cm = hsl.rgb(parsed.values);
			}
			else {
				cm = parsed.values;
			}
		}
	}
	else if (!cm) {
		if (!this.background) this.setBackground([0,0,0,1]);
		return this;
	}
	//image, canvas etc
	else if (!Array.isArray(cm)) {
		this.setTexture('fill', cm);

		return this;
	}
	//custom array, like palette etc.
	else {
		cm = flatten(cm);
	}

	if (inverse) {
		var reverse = cm.slice();
		for (var i = 0; i < cm.length; i+=4){
			reverse[cm.length - i - 1] = cm[i + 3];
			reverse[cm.length - i - 2] = cm[i + 2];
			reverse[cm.length - i - 3] = cm[i + 1];
			reverse[cm.length - i - 4] = cm[i + 0];
		}
		cm = reverse;
	}

	this.setTexture('fill', {
		data: cm,
		height: 1,
		width: (cm.length / 4)|0
	});

	//ensure bg
	if (!this.background) {
		this.setBackground(cm.slice(0, 4));
	}

	var mainColor = cm.slice(-4);
	this.color = "rgba(" + mainColor + ")";

	this.fillData = cm;

	//set grid color to colormap’s color
	if (this.gridComponent) {
		this.gridComponent.linesContainer.style.color = this.color;
	}

	return this;
};


/** Set background */
Spectrogram.prototype.setBackground = function (bg) {
	if (this.background !== null) {
		var bgStyle = null;
		if (typeof bg === 'string') {
			bgStyle = bg;
		}
		else if (Array.isArray(bg)) {
			//map 0..1 range to 0..255
			if (bg[0] && bg[0] <= 1 && bg[1] && bg[1] <= 1 && bg[2] && bg[2] <= 1) {
				bg = [
					bg[0] * 255, bg[1] * 255, bg[2] * 255, bg[3] || 1
				];
			}

			bgStyle = "rgba(" + (bg.slice(0,3).map(function (v) { return Math.round(v); }).join(', ')) + ", " + (bg[3]) + ")";
		}
		this.canvas.style.background = bgStyle;
	}

	return this;
};




//update view
Spectrogram.prototype.update = function () {
	var this$1 = this;

	var gl = this.gl;

	if (typeof this.smoothing === 'string') {
		this.smoothing = parseFloat(this.smoothing);
	}

	if (this.grid) {
		if (!this.gridComponent) {
			this.gridComponent = createGrid({
				container: this.container,
				viewport: function () { return this$1.viewport; },
				lines: Array.isArray(this.grid.lines) ? this.grid.lines : (this.grid.lines === undefined || this.grid.lines === true) && [{
					min: this.minFrequency,
					max: this.maxFrequency,
					orientation: 'y',
					logarithmic: this.logarithmic,
					titles: function (value) {
						return (value >= 1000 ? ((value / 1000).toLocaleString() + 'k') : value.toLocaleString()) + 'Hz';
					}
				}, this.logarithmic ? {
					min: this.minFrequency,
					max: this.maxFrequency,
					orientation: 'y',
					logarithmic: this.logarithmic,
					values: function (value) {
						var str = value.toString();
						if (str[0] !== '1') return null;
						return value;
					},
					titles: null,
					style: {
						borderLeftStyle: 'solid',
						pointerEvents: 'none',
						opacity: '0.08',
						display: this.logarithmic ? null :'none'
					}
				} : null],
				axes: Array.isArray(this.grid.axes) ? this.grid.axes : (this.grid.axes || this.axes) && [{
					name: 'Frequency',
					labels: function (value, i, opt) {
						var str = value.toString();
						if (str[0] !== '2' && str[0] !== '1' && str[0] !== '5') return null;
						return opt.titles[i];
					}
				}]
			});

			this.on('resize', function () {
				if (this$1.isPlannedGridUpdate) return;
				this$1.isPlannedGridUpdate = true;
				this$1.once('render', function () {
					this$1.isPlannedGridUpdate = false;
					this$1.gridComponent.update();
				});
			});
		}
		else {
			this.gridComponent.linesContainer.style.display = 'block';
		}
	}
	else if (this.gridComponent) {
		this.gridComponent.linesContainer.style.display = 'none';
	}

	this.setBackground(this.background);
	this.setFill(this.fill, this.inversed);

	this.emit('update');
};

},{"a-weighting":11,"color-parse":24,"color-space/hsl":25,"colormap":28,"colormap/colorScales":27,"flatten":36,"gl-component":40,"inherits":45,"is-browser":48,"mumath/clamp":67,"mumath/lg":69,"plot-grid":78,"xtend/mutable":110}],42:[function(require,module,exports){
/**
 * @module  gl-spectrum
 */

var Spectrum = require('./lib/core');
var clamp = require('mumath/clamp');

module.exports = Spectrum;

Spectrum.prototype.init = function () {
	var this$1 = this;

	var gl = this.gl;

	//setup alpha
	gl.enable( gl.BLEND );
	gl.blendEquation( gl.FUNC_ADD );
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	this.alignLocation = gl.getUniformLocation(this.program, 'align');
	this.minFrequencyLocation = gl.getUniformLocation(this.program, 'minFrequency');
	this.maxFrequencyLocation = gl.getUniformLocation(this.program, 'maxFrequency');
	this.minDecibelsLocation = gl.getUniformLocation(this.program, 'minDecibels');
	this.maxDecibelsLocation = gl.getUniformLocation(this.program, 'maxDecibels');
	this.logarithmicLocation = gl.getUniformLocation(this.program, 'logarithmic');
	this.sampleRateLocation = gl.getUniformLocation(this.program, 'sampleRate');
	this.peakLocation = gl.getUniformLocation(this.program, 'peak');
	this.trailPeakLocation = gl.getUniformLocation(this.program, 'trailPeak');
	this.widthLocation = gl.getUniformLocation(this.program, 'width');
	this.sizeLocation = gl.getUniformLocation(this.program, 'size');
	this.typeLocation = gl.getUniformLocation(this.program, 'type');
	this.brightnessLocation = gl.getUniformLocation(this.program, 'brightness');

	this.setTexture({
		magnitudes: {
			type: gl.UNSIGNED_BYTE,
			filter: gl.LINEAR,
			wrap: gl.CLAMP_TO_EDGE,
			format: gl.ALPHA
		},
		trail: {
			type: gl.UNSIGNED_BYTE,
			filter: gl.LINEAR,
			wrap: gl.CLAMP_TO_EDGE,
			format: gl.ALPHA
		},
		fill: {
			type: gl.UNSIGNED_BYTE,
			format: gl.RGBA,
			// filter: gl.LINEAR,
			// wrap: gl.CLAMP_TO_EDGE,
			filter: gl.LINEAR,
			wrap: gl.CLAMP_TO_EDGE,
		}
	});

	this.on('data', function (magnitudes) {
		//map mags to 0..255 range limiting by db subrange
		magnitudes = magnitudes.map(function (value) { return clamp(255 * (1 + value / 100), 0, 255); });
		var trail = this$1.trailMagnitudes.map(function (v) { return clamp(255 * (v * .01 + 1), 0, 255); });

		this$1.gl.uniform1f(this$1.peakLocation, this$1.peak * .01 + 1);
		this$1.gl.uniform1f(this$1.trailPeakLocation, this$1.trailPeak * .01 + 1);

		this$1.setTexture('magnitudes', magnitudes);
		this$1.setTexture('trail', trail);
	});

	this.on('resize', function () {
		this$1.recalc();
	});

	this.on('update', function () {

		//update verteces
		this$1.recalc();

		//update uniforms
		this$1.gl.uniform1f(this$1.alignLocation, this$1.align);
		this$1.gl.uniform1f(this$1.minFrequencyLocation, this$1.minFrequency);
		this$1.gl.uniform1f(this$1.maxFrequencyLocation, this$1.maxFrequency);
		this$1.gl.uniform1f(this$1.minDecibelsLocation, this$1.minDecibels);
		this$1.gl.uniform1f(this$1.maxDecibelsLocation, this$1.maxDecibels);
		this$1.gl.uniform1f(this$1.logarithmicLocation, this$1.logarithmic ? 1 : 0);
		this$1.gl.uniform1f(this$1.sampleRateLocation, this$1.sampleRate);
		this$1.gl.uniform1f(this$1.widthLocation, this$1.width);
		this$1.gl.uniform1f(this$1.sizeLocation, this$1.magnitudes.length);
		this$1.gl.uniform1f(this$1.brightnessLocation, 1);
	})
}


Spectrum.prototype.antialias = true;
Spectrum.prototype.premultipliedAlpha = true;
Spectrum.prototype.alpha = true;
Spectrum.prototype.float = false;


//scale verteces to magnitudes values and apply alignment
Spectrum.prototype.vert = "\n\tprecision highp float;\n\n\tattribute vec2 position;\n\n\tuniform sampler2D magnitudes;\n\tuniform sampler2D trail;\n\tuniform float align;\n\tuniform float minFrequency;\n\tuniform float maxFrequency;\n\tuniform float minDecibels;\n\tuniform float maxDecibels;\n\tuniform float logarithmic;\n\tuniform float sampleRate;\n\tuniform vec4 viewport;\n\tuniform float width;\n\tuniform float size;\n\tuniform float peak;\n\tuniform float trailPeak;\n\tuniform float type;\n\n\tvarying float vDist;\n\tvarying float vMag;\n\tvarying float vIntensity;\n\n\tconst float log10 = " + (Math.log(10)) + ";\n\n\tfloat lg (float x) {\n\t\treturn log(x) / log10;\n\t}\n\n\t//return a or b based on weight\n\tfloat decide (float a, float b, float w) {\n\t\treturn step(0.5, w) * b + step(w, 0.5) * a;\n\t}\n\n\t//get mapped frequency\n\tfloat f (float ratio) {\n\t\tfloat halfRate = sampleRate * .5;\n\n\t\tfloat logF = pow(10., lg(minFrequency) + ratio * (lg(maxFrequency) - lg(minFrequency)) );\n\n\t\tratio = decide(ratio, (logF - minFrequency) / (maxFrequency - minFrequency), logarithmic);\n\n\t\tfloat leftF = minFrequency / halfRate;\n\t\tfloat rightF = maxFrequency / halfRate;\n\n\t\tratio = leftF + ratio * (rightF - leftF);\n\n\t\treturn ratio;\n\t}\n\n\tfloat unf (float ratio) {\n\t\tfloat halfRate = sampleRate * .5;\n\t\tfloat leftF = minFrequency / halfRate;\n\t\tfloat rightF = maxFrequency / halfRate;\n\n\t\tratio = (ratio - leftF) / (rightF - leftF);\n\n\t\tfloat logRatio = ratio * (maxFrequency - minFrequency) + minFrequency;\n\n\t\tlogRatio = (lg(logRatio) - lg(minFrequency)) / (lg(maxFrequency) - lg(minFrequency));\n\n\t\tratio = decide(ratio, logRatio, logarithmic);\n\n\t\treturn clamp(ratio, 0., 1.);\n\t}\n\n\t//bring magnitude to range\n\tfloat m (float mag) {\n\t\treturn clamp( ((mag - 1.) * 100. - minDecibels) / (maxDecibels - minDecibels), 0., 1.);\n\t}\n\n\tvoid main () {\n\t\tvec2 coord = position;\n\n\t\tfloat c = .01 / size;\n\n\t\t//the bar’s left coord x\n\t\tfloat leftX = floor( (coord.x + c) * size)/size;\n\t\tfloat nextLeftX = ceil( (coord.x + c) * size)/size;\n\n\t\tfloat isRight = step( .25 / size, coord.x - leftX);\n\n\t\tfloat widthRatio = width / viewport.z;\n\n\t\tfloat realLeftX = unf(leftX);\n\t\tcoord.x = decide(realLeftX, min(unf(nextLeftX), realLeftX + widthRatio), isRight);\n\n\n\t\tfloat trail = texture2D(trail, vec2(leftX, 0.5)).w;\n\t\tfloat mag = texture2D(magnitudes, vec2(leftX, 0.5)).w;\n\n\t\tvIntensity = decide(mag/peak, trail/trailPeak, type);\n\n\t\ttrail = m(trail);\n\t\tmag = m(mag);\n\n\t\tvMag = mag;\n\n\t\t//map y-coord to alignment\n\t\tmag = decide(mag, trail, type);\n\t\tcoord.y = coord.y * mag - mag * align + align;\n\n\t\t//save distance from the align\n\t\tvDist = (coord.y - align) * (1. / max(align, 1. - align));\n\n\t\t// gl_Position = vec4(position, 0, 1);\n\t\tgl_Position = vec4(coord*2. - 1., 0, 1);\n\t}\n";

Spectrum.prototype.frag = "\n\tprecision highp float;\n\n\tuniform sampler2D fill;\n\tuniform vec4 viewport;\n\tuniform float align;\n\tuniform float width;\n\tuniform float type;\n\n\tconst float balance = .5;\n\n\tvarying float vDist;\n\tvarying float vIntensity;\n\tvarying float vMag;\n\n\tvec2 coord;\n\n\tfloat decide (float a, float b, float w) {\n\t\treturn step(0.5, w) * b + step(w, 0.5) * a;\n\t}\n\n\tvoid main () {\n\t\tcoord = (gl_FragCoord.xy - viewport.xy) / (viewport.zw);\n\n\t\tfloat dist = abs(vDist);\n\n\t\t//0-type - render magnitudes\n\t\t//1-type - render trail\n\t\t//2-type - render variance of trail/mag\n\n\t\tfloat intensity = pow(dist + .1, .8888) * balance + pow(vIntensity, 2.) * (1. - balance);\n\t\tintensity = clamp(intensity, 0., 1.);\n\n\t\tintensity = decide(intensity, (intensity + .333) * 1.1, step(.5, type));\n\n\t\tfloat widthRatio = (width - .5) / viewport.w;\n\t\tfloat mag = abs(vMag);\n\t\tintensity *= decide(1., .5 * smoothstep(.99 * mag, 1.01*mag, dist), type - .5);\n\n\n\t\tvec4 fillColor = texture2D(fill, vec2(intensity, coord.x));\n\t\tfillColor.a = 1.;\n\n\t\tgl_FragColor = fillColor;\n\t}\n";


/**
 * Recalculate number of verteces
 */
//FIXME: might be need to be called on data push as it takes data length
Spectrum.prototype.recalc = function () {
	var data = [], l = this.magnitudes.length;

	var type = ''+this.type;
	var isBar = /bar/.test(type);
	var isLine = /line/.test(type);
	var isFill = /fill/.test(type);

	//stripe
	if (!isBar) {
		for (var i = 0; i < l; i++) {
			var curr = i/l;
			var next = (i+1)/l;
			data.push(curr);
			data.push(1);
			data.push(next);
			data.push(1);
			data.push(curr);
			data.push(0);
			data.push(next);
			data.push(0);
		}
	}

	//bars
	else {
		for (var i = 0; i < l; i++) {
			var curr = i/l;
			var next = (i+.5)/l;
			data.push(curr);
			data.push(1);
			data.push(curr);
			data.push(1);
			data.push(curr);
			data.push(1);
			data.push(next);
			data.push(1);
			data.push(curr);
			data.push(0);
			data.push(next);
			data.push(0);
			data.push(next);
			data.push(0);
			data.push(next);
			data.push(0);
		}
	}

	this.setAttribute('position', data);

	return this;
};


/**
 * Render main loop
 */
Spectrum.prototype.draw = function () {
	var gl = this.gl;

	gl.useProgram(this.program);

	var count = this.attributes.position.data.length / 2;

	var type = ''+this.type;
	var isLine = /line/.test(type);

	if (isLine) {
		if (this.trail) {
			gl.uniform1f(this.typeLocation, 2);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.attributes.position.data.length / 2);
		}
		gl.uniform1f(this.typeLocation, 1);
		gl.drawArrays(gl.LINES, 0, this.attributes.position.data.length / 2);
	} else {
		gl.uniform1f(this.typeLocation, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.attributes.position.data.length / 2);
		if (this.trail) {
			gl.uniform1f(this.typeLocation, 1);
			gl.drawArrays(gl.LINES, 0, this.attributes.position.data.length / 2);
		}
	}

	return this;
};
},{"./lib/core":43,"mumath/clamp":67}],43:[function(require,module,exports){
/**
 * @module  gl-spectrum/lib/code
 */

var extend = require('xtend/mutable');
var inherits = require('inherits');
var lg = require('mumath/lg');
var isBrowser = require('is-browser');
var createGrid = require('plot-grid');
var clamp = require('mumath/clamp');
var Spectrogram = require('gl-spectrogram/lib/core');

module.exports = Spectrum;


/**
 * @contructor
 */
function Spectrum (options) {
	if (!(this instanceof Spectrum)) return new Spectrum(options);

	//stack of frequency snapshots
	this.trailStack = [];

	Spectrogram.call(this, options);
}

inherits(Spectrum, Spectrogram);

Spectrum.prototype.className = 'gl-spectrum';

//amount of alignment
Spectrum.prototype.align = .0;

//shadow frequencies, like averaged/max values
Spectrum.prototype.trail = 1;

//style of rendering
Spectrum.prototype.type = 'fill';
Spectrum.prototype.width = 1;


/**
 * Set frequencies taking into account smoothing, logarithmic and grouping params
 */
Spectrum.prototype.setFrequencyData = function (magnitudes) {
	var this$1 = this;

	this.push(magnitudes);

	magnitudes = this.magnitudes;

	//calc trail
	if (this.trail) {
		this.trailStack.unshift(magnitudes);
		this.trailStack = this.trailStack.slice(0, this.trail);
		var trail = magnitudes.slice();
		for (var k = 1; k < this.trailStack.length; k++) {
			for (var i = 0; i < Math.min(trail.length, this.trailStack[k].length); i++) {
				trail[i] = Math.max(this$1.trailStack[k][i], trail[i]);
			}
		}
		this.trailMagnitudes = trail;
	}
	else {
		this.trailMagnitudes = magnitudes;
	}

	//find trail peak
	this.trailPeak = this.trailMagnitudes.reduce(function (prev, curr) { return Math.max(curr, prev); }, -200);

	this.emit('data', magnitudes);
};


/**
 * Reset colormap
 * Completely compatible with gl-spectrogram setValues
 */
Spectrum.prototype.setFill = function (cm, inverse) {
	Spectrogram.prototype.setFill.call(this, cm, inverse);

	//set grid color to colormap’s color
	if (this.freqGridComponent) {
		this.freqGridComponent.linesContainer.style.color = this.color;
		this.topGridComponent.linesContainer.style.color = this.color;
		this.bottomGridComponent.linesContainer.style.color = this.color;
	}

	return this;
};


/**
 * Update uniforms values, textures etc.
 * It should be called when the settings changed.
 */
Spectrum.prototype.update = function () {
	var this$1 = this;

	var gl = this.gl;

	//fix values
	if (typeof this.trail === 'string') {
		this.trail = parseInt(this.trail);
	}

	if (typeof this.smoothing === 'string') {
		this.smoothing = parseFloat(this.smoothing);
	}

	if (typeof this.align === 'string') {
		this.align = parseFloat(this.align);
	}

	//limit base
	this.minFrequency = Math.max(1, this.minFrequency);

	//create grid, if not created yet
	if (this.grid) {
		if (!this.freqGridComponent) {
			this.freqGridComponent = createGrid({
				container: this.container,
				viewport: function () { return this$1.viewport; },
				lines: Array.isArray(this.grid.lines) ? this.grid.lines : (this.grid.lines === undefined || this.grid.lines === true) && [{
					min: this.minFrequency,
					max: this.maxFrequency,
					orientation: 'x',
					logarithmic: this.logarithmic,
					titles: function (value) {
						return (value >= 1000 ? ((value / 1000).toLocaleString() + 'k') : value.toLocaleString()) + 'Hz';
					}
				}, this.logarithmic ? {
					min: this.minFrequency,
					max: this.maxFrequency,
					orientation: 'x',
					logarithmic: this.logarithmic,
					values: function (value) {
						var str = value.toString();
						if (str[0] !== '1') return null;
						return value;
					},
					titles: null,
					style: {
						borderLeftStyle: 'solid',
						pointerEvents: 'none',
						opacity: '0.08',
						display: this.logarithmic ? null :'none'
					}
				} : null],
				axes: Array.isArray(this.grid.axes) ? this.grid.axes : (this.grid.axes || this.axes) && [{
					name: 'Frequency',
					labels: function (value, i, opt) {
						var str = value.toString();
						if (str[0] !== '2' && str[0] !== '1' && str[0] !== '5') return null;
						return opt.titles[i];
					}
				}]
			});

			this.topGridComponent = createGrid({
				container: this.container,
				viewport: function () { return [
					this$1.viewport[0],
					this$1.viewport[1],
					this$1.viewport[2],
					this$1.viewport[3] * (1 - this$1.align)
				]; },
				lines: [{
					min: this.minDecibels,
					max: this.maxDecibels,
					orientation: 'y',
					titles: function (value) {
						return value.toLocaleString() + 'dB';
					}
				}],
				axes: Array.isArray(this.grid.axes) ? this.grid.axes : (this.grid.axes || this.axes) && [{
					name: 'Magnitude'
				}]
			});

			//alignment requires additional grid
			this.bottomGridComponent = createGrid({
				container: this.container,
				viewport: function () { return [
					this$1.viewport[0],
					this$1.viewport[1] + this$1.viewport[3] * (1 - this$1.align),
					this$1.viewport[2],
					this$1.viewport[3] * this$1.align
				]; },
				lines: [{
					min: this.maxDecibels,
					max: this.minDecibels,
					orientation: 'y',
					titles: function (value) {
						return value.toLocaleString() + 'dB';
					}
				}],
				axes: Array.isArray(this.grid.axes) ? this.grid.axes : (this.grid.axes || this.axes) && [{
					name: 'Magnitude'
				}]
			});

			this.on('resize', function () {
				this$1.topGridComponent.update();
				this$1.bottomGridComponent.update();
				this$1.freqGridComponent.update();
			});
		} else {
			this.freqGridComponent.linesContainer.style.display = 'block';
			this.topGridComponent.linesContainer.style.display = 'block';
			this.bottomGridComponent.linesContainer.style.display = 'block';

			this.topGridComponent.update({
				lines: [{
					min: this.minDecibels,
					max: this.maxDecibels
				}]
			});
			this.bottomGridComponent.update({
				lines: [{
					max: this.minDecibels,
					min: this.maxDecibels
				}]
			});
			this.freqGridComponent.update({
				lines: [{
						logarithmic: this.logarithmic,
						min: this.minFrequency,
						max: this.maxFrequency,
					}, {
						logarithmic: this.logarithmic,
						min: this.minFrequency,
						max: this.maxFrequency,
						style: {
							display: this.logarithmic ? null : 'none'
						}
					}
				]
			});
		}

	}
	else if (this.freqGridComponent) {
		this.freqGridComponent.linesContainer.style.display = 'none';
		this.topGridComponent.linesContainer.style.display = 'none';
		this.bottomGridComponent.linesContainer.style.display = 'none';
	}

	//preset trail buffer
	if (this.trail === true) {
		this.trail = Spectrogram.prototype.trail;
	}

	//update textures
	this.setBackground(this.background);
	this.setFrequencyData(this.magnitudes.slice());
	this.setFill(this.fill, this.inversed);

	//emit update
	this.emit('update');

	return this;
};
},{"gl-spectrogram/lib/core":41,"inherits":45,"is-browser":48,"mumath/clamp":67,"mumath/lg":69,"plot-grid":78,"xtend/mutable":110}],44:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],45:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],46:[function(require,module,exports){
/**
 * @module  input-number
 */

var caret = require('caret-position2');
var clamp = require('mumath/clamp');
var round = require('mumath/round');
var keys = {
	38: 'up',
	40: 'down'
};
var numRE = /[\-\.0-9]/;

module.exports = numerify;

function numerify (input, opts) {
	opts = opts || {};
	opts.step = opts.step || ((opts.min && opts.max) ? (opts.max - opts.min / 100) : 1);
	opts.max = opts.max || Infinity;
	opts.min = opts.min || -Infinity;
	opts.precision = opts.precision || 0.00001;

	var focused = false;

	input.addEventListener('keydown', function (e) {
		var key = keys[e.which];

		if (!key) return;

		e.preventDefault();

		var str = input.value;
		var pos = caret.get(input);

		//parse left side
		var left = pos.start;
		while (numRE.test(str[left - 1])) {
			left--;
		}

		//parse right side
		var right = pos.end;
		while (numRE.test(str[right])) {
			right++;
		}

		var numStr = str.slice(left, right);

		if (!numStr) return;

		var number = parseFloat(numStr);


		if (key === 'up') {
			number = clamp((number+opts.step), opts.min, opts.max);
		}
		else {
			number = clamp((number-opts.step), opts.min, opts.max);
		}
		number = round(number, opts.precision);

		var leftStr = str.slice(0, left);
		var rightStr = str.slice(right);

		var result = leftStr + number + rightStr;

		input.value = result;

		caret.set(input, left, result.length - rightStr.length);

		//resurrect suppressed event
		var inputEvent = new Event('input');
		input.dispatchEvent(inputEvent);

		//emulate change event
		if (!focused) {
			focused = true;
			input.addEventListener('blur', function change () {
				input.removeEventListener('blur', change);
				var changeEvent = new Event('change');
				input.dispatchEvent(changeEvent);
				focused = false;
			});
		}
	});

	return input;
}
},{"caret-position2":20,"mumath/clamp":67,"mumath/round":73}],47:[function(require,module,exports){
(function (global){
'use strict'

var cache = {}

function noop () {}

module.exports = !global.document ? noop : insertStyles

function insertStyles (styles, options) {
  var id = options && options.id || styles

  var element = cache[id] = (cache[id] || createStyle(id))

  if ('textContent' in element) {
    element.textContent = styles
  } else {
    element.styleSheet.cssText = styles
  }
}

function createStyle (id) {
  var element = document.getElementById(id)

  if (element) return element

  element = document.createElement('style')
  element.setAttribute('type', 'text/css')

  document.head.appendChild(element)

  return element
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],48:[function(require,module,exports){
module.exports = true;
},{}],49:[function(require,module,exports){
module.exports = isMobile;

function isMobile (ua) {
  if (!ua && typeof navigator != 'undefined') ua = navigator.userAgent;
  if (ua && ua.headers && typeof ua.headers['user-agent'] == 'string') {
    ua = ua.headers['user-agent'];
  }
  if (typeof ua != 'string') return false;

  return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(ua) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(ua.substr(0,4));
}

},{}],50:[function(require,module,exports){
/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function isNumber(n) {
  return (!!(+n) && !Array.isArray(n)) && isFinite(n)
    || n === '0'
    || n === 0;
};

},{}],51:[function(require,module,exports){
(function(root) {
  'use strict';

  function isNumeric(v) {
    if (typeof v === 'number' && !isNaN(v)) return true;
    v = (v||'').toString().trim();
    if (!v) return false;
    return !isNaN(v);
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = isNumeric;
    }
    exports.isNumeric = isNumeric;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return isNumeric;
    });
  } else {
    root.isNumeric = isNumeric;
  }

})(this);

},{}],52:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString;

module.exports = function (x) {
	var prototype;
	return toString.call(x) === '[object Object]' && (prototype = Object.getPrototypeOf(x), prototype === null || prototype === Object.getPrototypeOf({}));
};

},{}],53:[function(require,module,exports){
module.exports = extend;

/*
  var obj = {a: 3, b: 5};
  extend(obj, {a: 4, c: 8}); // {a: 4, b: 5, c: 8}
  obj; // {a: 4, b: 5, c: 8}

  var obj = {a: 3, b: 5};
  extend({}, obj, {a: 4, c: 8}); // {a: 4, b: 5, c: 8}
  obj; // {a: 3, b: 5}

  var arr = [1, 2, 3];
  var obj = {a: 3, b: 5};
  extend(obj, {c: arr}); // {a: 3, b: 5, c: [1, 2, 3]}
  arr.push[4];
  obj; // {a: 3, b: 5, c: [1, 2, 3, 4]}

  var arr = [1, 2, 3];
  var obj = {a: 3, b: 5};
  extend(true, obj, {c: arr}); // {a: 3, b: 5, c: [1, 2, 3]}
  arr.push[4];
  obj; // {a: 3, b: 5, c: [1, 2, 3]}
*/

function extend(obj1, obj2 /*, [objn]*/) {
  var args = [].slice.call(arguments);
  var deep = false;
  if (typeof args[0] === 'boolean') {
    deep = args.shift();
  }
  var result = args[0];
  var extenders = args.slice(1);
  var len = extenders.length;
  for (var i = 0; i < len; i++) {
    var extender = extenders[i];
    for (var key in extender) {
      // include prototype properties
      var value = extender[key];
      if (deep && value && (typeof value == 'object')) {
        var base = Array.isArray(value) ? [] : {};
        result[key] = extend(true, base, value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

},{}],54:[function(require,module,exports){
'use strict';
module.exports = leftPad;

var cache = [
  '',
  ' ',
  '  ',
  '   ',
  '    ',
  '     ',
  '      ',
  '       ',
  '        ',
  '         '
];

function leftPad (str, len, ch) {
  // convert `str` to `string`
  str = str + '';
  // `len` is the `pad`'s length now
  len = len - str.length;
  // doesn't need to pad
  if (len <= 0) return str;
  // `ch` defaults to `' '`
  if (!ch && ch !== 0) ch = ' ';
  // convert `ch` to `string`
  ch = ch + '';
  // cache common use cases
  if (ch === ' ' && len < 10) return cache[len] + str;
  // `pad` starts with an empty string
  var pad = '';
  // loop
  while (true) {
    // add `ch` to `pad` if `len` is odd
    if (len & 1) pad += ch;
    // devide `len` by 2, ditch the fraction
    len >>= 1;
    // "double" the `ch` so this operation count grows logarithmically on `len`
    // each time `ch` is "doubled", the `len` would need to be "doubled" too
    // similar to finding a value in binary search tree, hence O(log(n))
    if (len) ch += ch;
    // `len` is 0, exit the loop
    else break;
  }
  // pad `str`!
  return pad + str;
}

},{}],55:[function(require,module,exports){
/**
 * lodash 3.1.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * The base implementation of `_.flatten` with added support for restricting
 * flattening and specifying the start index.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, isDeep, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (isObjectLike(value) && isArrayLike(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (isDeep) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, isDeep, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = baseFlatten;

},{"lodash.isarguments":61,"lodash.isarray":62}],56:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isFunction = require('lodash.isfunction');

/**
 * The base implementation of `_.functions` which creates an array of
 * `object` function property names filtered from those provided.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Array} props The property names to filter.
 * @returns {Array} Returns the new array of filtered property names.
 */
function baseFunctions(object, props) {
  var index = -1,
      length = props.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var key = props[index];
    if (isFunction(object[key])) {
      result[++resIndex] = key;
    }
  }
  return result;
}

module.exports = baseFunctions;

},{"lodash.isfunction":63}],57:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    CURRY_RIGHT_FLAG = 16,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64,
    ARY_FLAG = 128,
    FLIP_FLAG = 512;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(prototype) {
    if (isObject(prototype)) {
      object.prototype = prototype;
      var result = new object;
      object.prototype = undefined;
    }
    return result || {};
  };
}());

/**
 * Creates an array that is the composition of partially applied arguments,
 * placeholders, and provided arguments into a single array of arguments.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to prepend to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgs(args, partials, holders) {
  var holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      leftIndex = -1,
      leftLength = partials.length,
      result = Array(leftLength + argsLength);

  while (++leftIndex < leftLength) {
    result[leftIndex] = partials[leftIndex];
  }
  while (++argsIndex < holdersLength) {
    result[holders[argsIndex]] = args[argsIndex];
  }
  while (argsLength--) {
    result[leftIndex++] = args[argsIndex++];
  }
  return result;
}

/**
 * This function is like `composeArgs` except that the arguments composition
 * is tailored for `_.partialRight`.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to append to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgsRight(args, partials, holders) {
  var holdersIndex = -1,
      holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      rightIndex = -1,
      rightLength = partials.length,
      result = Array(argsLength + rightLength);

  while (++argsIndex < argsLength) {
    result[argsIndex] = args[argsIndex];
  }
  var offset = argsIndex;
  while (++rightIndex < rightLength) {
    result[offset + rightIndex] = partials[rightIndex];
  }
  while (++holdersIndex < holdersLength) {
    result[offset + holders[holdersIndex]] = args[argsIndex++];
  }
  return result;
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg`.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createBaseWrapper(func, bitmask, thisArg) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
    return fn.apply(isBind ? thisArg : this, arguments);
  }
  return wrapper;
}

/**
 * Creates a function that produces an instance of `Ctor` regardless of
 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
 *
 * @private
 * @param {Function} Ctor The constructor to wrap.
 * @returns {Function} Returns the new wrapped function.
 */
function createCtorWrapper(Ctor) {
  return function() {
    // Use a `switch` statement to work with class constructors.
    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
    // for more details.
    var args = arguments;
    switch (args.length) {
      case 0: return new Ctor;
      case 1: return new Ctor(args[0]);
      case 2: return new Ctor(args[0], args[1]);
      case 3: return new Ctor(args[0], args[1], args[2]);
      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);

    // Mimic the constructor's `return` behavior.
    // See https://es5.github.io/#x13.2.2 for more details.
    return isObject(result) ? result : thisBinding;
  };
}

/**
 * Creates a function that wraps `func` to enable currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {number} arity The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createCurryWrapper(func, bitmask, arity) {
  var Ctor = createCtorWrapper(func);

  function wrapper() {
    var arguments$1 = arguments;

    var length = arguments.length,
        index = length,
        args = Array(length),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func,
        placeholder = wrapper.placeholder;

    while (index--) {
      args[index] = arguments$1[index];
    }
    var holders = (length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder)
      ? []
      : replaceHolders(args, placeholder);

    length -= holders.length;
    return length < arity
      ? createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, undefined, args, holders, undefined, undefined, arity - length)
      : apply(fn, this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with optional `this`
 * binding of `thisArg`, partial application, and currying.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
  var isAry = bitmask & ARY_FLAG,
      isBind = bitmask & BIND_FLAG,
      isBindKey = bitmask & BIND_KEY_FLAG,
      isCurry = bitmask & CURRY_FLAG,
      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
      isFlip = bitmask & FLIP_FLAG,
      Ctor = isBindKey ? undefined : createCtorWrapper(func);

  function wrapper() {
    var arguments$1 = arguments;

    var length = arguments.length,
        index = length,
        args = Array(length);

    while (index--) {
      args[index] = arguments$1[index];
    }
    if (partials) {
      args = composeArgs(args, partials, holders);
    }
    if (partialsRight) {
      args = composeArgsRight(args, partialsRight, holdersRight);
    }
    if (isCurry || isCurryRight) {
      var placeholder = wrapper.placeholder,
          argsHolders = replaceHolders(args, placeholder);

      length -= argsHolders.length;
      if (length < arity) {
        return createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, thisArg, args, argsHolders, argPos, ary, arity - length);
      }
    }
    var thisBinding = isBind ? thisArg : this,
        fn = isBindKey ? thisBinding[func] : func;

    if (argPos) {
      args = reorder(args, argPos);
    } else if (isFlip && args.length > 1) {
      args.reverse();
    }
    if (isAry && ary < args.length) {
      args.length = ary;
    }
    if (this && this !== root && this instanceof wrapper) {
      fn = Ctor || createCtorWrapper(fn);
    }
    return fn.apply(thisBinding, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg` and the `partials` prepended to those provided to
 * the wrapper.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} partials The arguments to prepend to those provided to the new function.
 * @returns {Function} Returns the new wrapped function.
 */
function createPartialWrapper(func, bitmask, thisArg, partials) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var arguments$1 = arguments;

    var argsIndex = -1,
        argsLength = arguments.length,
        leftIndex = -1,
        leftLength = partials.length,
        args = Array(leftLength + argsLength),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;

    while (++leftIndex < leftLength) {
      args[leftIndex] = partials[leftIndex];
    }
    while (argsLength--) {
      args[leftIndex++] = arguments$1[++argsIndex];
    }
    return apply(fn, isBind ? thisArg : this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to continue currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {Function} wrapFunc The function to create the `func` wrapper.
 * @param {*} placeholder The placeholder to replace.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createRecurryWrapper(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
  var isCurry = bitmask & CURRY_FLAG,
      newArgPos = argPos ? copyArray(argPos) : undefined,
      newsHolders = isCurry ? holders : undefined,
      newHoldersRight = isCurry ? undefined : holders,
      newPartials = isCurry ? partials : undefined,
      newPartialsRight = isCurry ? undefined : partials;

  bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
  bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

  if (!(bitmask & CURRY_BOUND_FLAG)) {
    bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
  }
  var result = wrapFunc(func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, arity);

  result.placeholder = placeholder;
  return result;
}

/**
 * Creates a function that either curries or invokes `func` with optional
 * `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags.
 *  The bitmask may be composed of the following flags:
 *     1 - `_.bind`
 *     2 - `_.bindKey`
 *     4 - `_.curry` or `_.curryRight` of a bound function
 *     8 - `_.curry`
 *    16 - `_.curryRight`
 *    32 - `_.partial`
 *    64 - `_.partialRight`
 *   128 - `_.rearg`
 *   256 - `_.ary`
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to be partially applied.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
  var isBindKey = bitmask & BIND_KEY_FLAG;
  if (!isBindKey && typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = partials ? partials.length : 0;
  if (!length) {
    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
    partials = holders = undefined;
  }
  ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
  arity = arity === undefined ? arity : toInteger(arity);
  length -= holders ? holders.length : 0;

  if (bitmask & PARTIAL_RIGHT_FLAG) {
    var partialsRight = partials,
        holdersRight = holders;

    partials = holders = undefined;
  }
  var newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

  func = newData[0];
  bitmask = newData[1];
  thisArg = newData[2];
  partials = newData[3];
  holders = newData[4];
  arity = newData[9] = newData[9] == null
    ? (isBindKey ? 0 : func.length)
    : nativeMax(newData[9] - length, 0);

  if (!arity && bitmask & (CURRY_FLAG | CURRY_RIGHT_FLAG)) {
    bitmask &= ~(CURRY_FLAG | CURRY_RIGHT_FLAG);
  }
  if (!bitmask || bitmask == BIND_FLAG) {
    var result = createBaseWrapper(func, bitmask, thisArg);
  } else if (bitmask == CURRY_FLAG || bitmask == CURRY_RIGHT_FLAG) {
    result = createCurryWrapper(func, bitmask, arity);
  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !holders.length) {
    result = createPartialWrapper(func, bitmask, thisArg, partials);
  } else {
    result = createHybridWrapper.apply(undefined, newData);
  }
  return result;
}

/**
 * Reorder `array` according to the specified indexes where the element at
 * the first index is assigned as the first element, the element at
 * the second index is assigned as the second element, and so on.
 *
 * @private
 * @param {Array} array The array to reorder.
 * @param {Array} indexes The arranged array indexes.
 * @returns {Array} Returns `array`.
 */
function reorder(array, indexes) {
  var arrLength = array.length,
      length = nativeMin(indexes.length, arrLength),
      oldArray = copyArray(array);

  while (length--) {
    var index = indexes[length];
    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
  }
  return array;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = createWrapper;

},{"lodash._root":58}],58:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],59:[function(require,module,exports){
/**
 * lodash 3.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFlatten = require('lodash._baseflatten'),
    createWrapper = require('lodash._createwrapper'),
    functions = require('lodash.functions'),
    restParam = require('lodash.restparam');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1;

/**
 * Binds methods of an object to the object itself, overwriting the existing
 * method. Method names may be specified as individual arguments or as arrays
 * of method names. If no method names are provided all enumerable function
 * properties, own and inherited, of `object` are bound.
 *
 * **Note:** This method does not set the `length` property of bound functions.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Object} object The object to bind and assign the bound methods to.
 * @param {...(string|string[])} [methodNames] The object method names to bind,
 *  specified as individual method names or arrays of method names.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var view = {
 *   'label': 'docs',
 *   'onClick': function() {
 *     console.log('clicked ' + this.label);
 *   }
 * };
 *
 * _.bindAll(view);
 * jQuery('#docs').on('click', view.onClick);
 * // => logs 'clicked docs' when the element is clicked
 */
var bindAll = restParam(function(object, methodNames) {
  methodNames = methodNames.length ? baseFlatten(methodNames) : functions(object);

  var index = -1,
      length = methodNames.length;

  while (++index < length) {
    var key = methodNames[index];
    object[key] = createWrapper(object[key], BIND_FLAG, object);
  }
  return object;
});

module.exports = bindAll;

},{"lodash._baseflatten":55,"lodash._createwrapper":57,"lodash.functions":60,"lodash.restparam":65}],60:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFunctions = require('lodash._basefunctions'),
    keysIn = require('lodash.keysin');

/**
 * Creates an array of function property names from all enumerable properties,
 * own and inherited, of `object`.
 *
 * @static
 * @memberOf _
 * @alias methods
 * @category Object
 * @param {Object} object The object to inspect.
 * @returns {Array} Returns the new array of property names.
 * @example
 *
 * _.functions(_);
 * // => ['all', 'any', 'bind', ...]
 */
function functions(object) {
  return baseFunctions(object, keysIn(object));
}

module.exports = functions;

},{"lodash._basefunctions":56,"lodash.keysin":64}],61:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isArguments;

},{}],62:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],63:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isFunction;

},{}],64:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"lodash.isarguments":61,"lodash.isarray":62}],65:[function(require,module,exports){
/**
 * lodash 3.6.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],66:[function(require,module,exports){
/**
 * Special language-specific overrides.
 *
 * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
 *
 * @type {Object}
 */
var LANGUAGES = {
  tr: {
    regexp: /\u0130|\u0049|\u0049\u0307/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  az: {
    regexp: /[\u0130]/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  lt: {
    regexp: /[\u0049\u004A\u012E\u00CC\u00CD\u0128]/g,
    map: {
      '\u0049': '\u0069\u0307',
      '\u004A': '\u006A\u0307',
      '\u012E': '\u012F\u0307',
      '\u00CC': '\u0069\u0307\u0300',
      '\u00CD': '\u0069\u0307\u0301',
      '\u0128': '\u0069\u0307\u0303'
    }
  }
}

/**
 * Lowercase a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  var lang = LANGUAGES[locale]

  str = str == null ? '' : String(str)

  if (lang) {
    str = str.replace(lang.regexp, function (m) { return lang.map[m] })
  }

  return str.toLowerCase()
}

},{}],67:[function(require,module,exports){
/**
 * Clamp value.
 * Detects proper clamp min/max.
 *
 * @param {number} a Current value to cut off
 * @param {number} min One side limit
 * @param {number} max Other side limit
 *
 * @return {number} Clamped value
 */

module.exports = require('./wrap')(function(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max);
});
},{"./wrap":75}],68:[function(require,module,exports){
/**
 * @module  mumath/closest
 */

module.exports = function closest (num, arr) {
	var curr = arr[0];
	var diff = Math.abs (num - curr);
	for (var val = 0; val < arr.length; val++) {
		var newdiff = Math.abs (num - arr[val]);
		if (newdiff < diff) {
			diff = newdiff;
			curr = arr[val];
		}
	}
	return curr;
}
},{}],69:[function(require,module,exports){
/**
 * Base 10 logarithm
 *
 * @module mumath/lg
 */
module.exports = require('./wrap')(function (a) {
	return Math.log(a) / Math.log(10);
});
},{"./wrap":75}],70:[function(require,module,exports){
/**
 * Looping function for any framesize.
 * Like fmod.
 *
 * @module  mumath/loop
 *
 */

module.exports = require('./wrap')(function (value, left, right) {
	//detect single-arg case, like mod-loop or fmod
	if (right === undefined) {
		right = left;
		left = 0;
	}

	//swap frame order
	if (left > right) {
		var tmp = right;
		right = left;
		left = tmp;
	}

	var frame = right - left;

	value = ((value + left) % frame) - left;
	if (value < left) value += frame;
	if (value > right) value -= frame;

	return value;
});
},{"./wrap":75}],71:[function(require,module,exports){
/**
 * @module mumath/order
 */
module.exports = require('./wrap')(function (n) {
	n = Math.abs(n);
	var order = Math.floor(Math.log(n) / Math.LN10 + 0.000000001);
	return Math.pow(10,order);
});
},{"./wrap":75}],72:[function(require,module,exports){
/**
 * @module  mumath/precision
 *
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

module.exports = require('./wrap')(function(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
});
},{"./wrap":75}],73:[function(require,module,exports){
/**
 * Precision round
 *
 * @param {number} value
 * @param {number} step Minimal discrete to round
 *
 * @return {number}
 *
 * @example
 * toPrecision(213.34, 1) == 213
 * toPrecision(213.34, .1) == 213.3
 * toPrecision(213.34, 10) == 210
 */
var precision = require('./precision');

module.exports = require('./wrap')(function(value, step) {
	if (step === 0) return value;
	if (!step) return Math.round(value);
	step = parseFloat(step);
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(precision(step)));
});
},{"./precision":72,"./wrap":75}],74:[function(require,module,exports){
/**
 * Whether element is between left & right including
 *
 * @param {number} a
 * @param {number} left
 * @param {number} right
 *
 * @return {Boolean}
 */
module.exports = require('./wrap')(function(a, left, right){
	if (left > right) {
		var tmp = left;
		left = right;
		right = tmp;
	}
	if (a <= right && a >= left) return true;
	return false;
});
},{"./wrap":75}],75:[function(require,module,exports){
/**
 * Get fn wrapped with array/object attrs recognition
 *
 * @return {Function} Target function
 */
module.exports = function(fn){
	return function (a) {
		var this$1 = this;

		var args = arguments;
		if (a instanceof Array) {
			var result = new Array(a.length), slice;
			for (var i = 0; i < a.length; i++){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = args[j] instanceof Array ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this$1, slice);
			}
			return result;
		}
		else if (typeof a === 'object') {
			var result = {}, slice;
			for (var i in a){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = typeof args[j] === 'object' ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this$1, slice);
			}
			return result;
		}
		else {
			return fn.apply(this, args);
		}
	};
};
},{}],76:[function(require,module,exports){
var sentenceCase = require('sentence-case')

/**
 * Param case a string.
 *
 * @param  {String} string
 * @param  {String} [locale]
 * @return {String}
 */
module.exports = function (string, locale) {
  return sentenceCase(string, locale, '-')
}

},{"sentence-case":85}],77:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.7.1
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

}).call(this,require('_process'))
},{"_process":6}],78:[function(require,module,exports){
(function (Buffer){
/**
 * @module  plot-grid
 */

var extend = require('xtend/mutable');
var isBrowser = require('is-browser');
var lg = require('mumath/lg');
var Emitter = require('events').EventEmitter;
var inherits = require('inherits');
var closestNumber = require('mumath/closest');
var mod = require('mumath/mod');
var mag = require('mumath/order');
var within = require('mumath/within');
var uid = require('get-uid');
var insertStyles = require('insert-styles');


insertStyles(Buffer("Omhvc3Qgew0KCXBvc2l0aW9uOiByZWxhdGl2ZTsNCn0NCg0KLmdyaWQgew0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCgl0b3A6IDA7DQoJbGVmdDogMDsNCglib3R0b206IDA7DQoJcmlnaHQ6IDA7DQoJcG9pbnRlci1ldmVudHM6IG5vbmU7DQoJZm9udC1mYW1pbHk6IHNhbnMtc2VyaWY7DQp9DQouZ3JpZC1saW5lcyB7DQoJcG9zaXRpb246IGFic29sdXRlOw0KCXRvcDogMDsNCglsZWZ0OiAwOw0KCWJvdHRvbTogMDsNCglyaWdodDogMDsNCglvdmVyZmxvdzogaGlkZGVuOw0KCXBvaW50ZXItZXZlbnRzOiBub25lOw0KfQ0KDQouZ3JpZC1saW5lIHsNCglwb2ludGVyLWV2ZW50czogYWxsOw0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCgl0b3A6IDA7DQoJbGVmdDogMDsNCgl3aWR0aDogLjVyZW07DQoJaGVpZ2h0OiAuNXJlbTsNCglvcGFjaXR5OiAuMjU7DQp9DQouZ3JpZC1saW5lW2hpZGRlbl0gew0KCWRpc3BsYXk6IG5vbmU7DQp9DQouZ3JpZC1saW5lOmhvdmVyIHsNCglvcGFjaXR5OiAuNTsNCn0NCg0KQHN1cHBvcnRzICgtLWNzczogdmFyaWFibGVzKSB7DQoJLmdyaWQgew0KCQktLW9wYWNpdHk6IC4xNTsNCgl9DQoJLmdyaWQtbGluZSB7DQoJCW9wYWNpdHk6IHZhcigtLW9wYWNpdHkpOw0KCX0NCgkuZ3JpZC1saW5lOmhvdmVyIHsNCgkJb3BhY2l0eTogY2FsYyh2YXIoLS1vcGFjaXR5KSAqIDIpOw0KCX0NCn0NCg0KLmdyaWQtbGluZS14IHsNCgloZWlnaHQ6IDEwMCU7DQoJd2lkdGg6IDA7DQoJYm9yZGVyLWxlZnQ6IDFweCBzb2xpZDsNCgltYXJnaW4tbGVmdDogLTFweDsNCn0NCi5ncmlkLWxpbmUteDphZnRlciB7DQoJY29udGVudDogJyc7DQoJcG9zaXRpb246IGFic29sdXRlOw0KCXdpZHRoOiAuNXJlbTsNCgl0b3A6IDA7DQoJYm90dG9tOiAwOw0KCWxlZnQ6IC0uMjVyZW07DQp9DQouZ3JpZC1saW5lLXguZ3JpZC1saW5lLW1pbiB7DQoJbWFyZ2luLWxlZnQ6IDBweDsNCn0NCg0KLmdyaWQtbGluZS15IHsNCgl3aWR0aDogMTAwJTsNCgloZWlnaHQ6IDA7DQoJbWFyZ2luLXRvcDogLTFweDsNCglib3JkZXItdG9wOiAxcHggc29saWQ7DQp9DQouZ3JpZC1saW5lLXk6YWZ0ZXIgew0KCWNvbnRlbnQ6ICcnOw0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCgloZWlnaHQ6IC41cmVtOw0KCWxlZnQ6IDA7DQoJcmlnaHQ6IDA7DQoJdG9wOiAtLjI1cmVtOw0KfQ0KLmdyaWQtbGluZS15LmdyaWQtbGluZS1tYXggew0KCW1hcmdpbi10b3A6IDBweDsNCn0NCg0KLyogcmFkaWFsIGxpbmVzICovDQouZ3JpZC1saW5lLXIgew0KCWhlaWdodDogMTAwJTsNCgl3aWR0aDogMTAwJTsNCglsZWZ0OiA1MCU7DQoJdG9wOiA1MCU7DQoJYm9yZGVyLXJhZGl1czogNTB2dzsNCglib3gtc2hhZG93OiBpbnNldCAwIDAgMCAxcHg7DQp9DQouZ3JpZC1saW5lLXIuZ3JpZC1saW5lLW1pbiB7DQp9DQoNCi8qIGFuZ3VsYXIgbGluZXMgKi8NCi5ncmlkLWxpbmUtYSB7DQoJaGVpZ2h0OiAwOw0KCXRvcDogNTAlOw0KCWxlZnQ6IDUwJTsNCgl0cmFuc2Zvcm0tb3JpZ2luOiBsZWZ0IGNlbnRlcjsNCgl3aWR0aDogNTAlOw0KCWJvcmRlci10b3A6IDFweCBzb2xpZDsNCn0NCi5ncmlkLWxpbmUtYTphZnRlciB7DQoJY29udGVudDogJyc7DQoJcG9zaXRpb246IGFic29sdXRlOw0KCWhlaWdodDogLjVyZW07DQoJbGVmdDogMDsNCglyaWdodDogMDsNCgl0b3A6IC0uMjVyZW07DQp9DQouZ3JpZC1saW5lLWE6YmVmb3JlIHsNCgljb250ZW50OiAnJzsNCglwb3NpdGlvbjogYWJzb2x1dGU7DQoJd2lkdGg6IC40cmVtOw0KCXJpZ2h0OiAwOw0KCXRvcDogLTFweDsNCgloZWlnaHQ6IDA7DQoJYm9yZGVyLWJvdHRvbTogMnB4IHNvbGlkOw0KfQ0KDQoNCi5ncmlkLWF4aXMgew0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCn0NCi5ncmlkLWF4aXMteCB7DQoJdG9wOiBhdXRvOw0KCWJvdHRvbTogMDsNCglyaWdodDogMDsNCglsZWZ0OiAwOw0KCWJvcmRlci1ib3R0b206IDJweCBzb2xpZDsNCgltYXJnaW4tYm90dG9tOiAtLjVyZW07DQp9DQouZ3JpZC1heGlzLXkgew0KCWJvcmRlci1sZWZ0OiAycHggc29saWQ7DQoJcmlnaHQ6IGF1dG87DQoJdG9wOiAwOw0KCWJvdHRvbTogMDsNCglsZWZ0OiAtMXB4Ow0KCW1hcmdpbi1sZWZ0OiAtLjVyZW07DQp9DQouZ3JpZC1heGlzLWEgew0KCWhlaWdodDogMTAwJTsNCgl3aWR0aDogMTAwJTsNCglsZWZ0OiA1MCU7DQoJdG9wOiA1MCU7DQoJYm9yZGVyLXJhZGl1czogNTB2dzsNCglib3gtc2hhZG93OiAwIDAgMCAycHg7DQp9DQouZ3JpZC1heGlzLXIgew0KCWJvcmRlci1sZWZ0OiAycHggc29saWQ7DQoJcmlnaHQ6IGF1dG87DQoJdG9wOiA1MCU7DQoJaGVpZ2h0OiAxMDAlOw0KCWxlZnQ6IC0xcHg7DQoJbWFyZ2luLWxlZnQ6IC0uNXJlbTsNCn0NCg0KLmdyaWQtbGFiZWwgew0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCgl0b3A6IGF1dG87DQoJbGVmdDogYXV0bzsNCgltaW4taGVpZ2h0OiAxcmVtOw0KCW1hcmdpbi10b3A6IC0uNXJlbTsNCglmb250LXNpemU6IC44cmVtOw0KCXBvaW50ZXItZXZlbnRzOiBhbGw7DQoJd2hpdGUtc3BhY2U6IG5vd3JhcDsNCn0NCi5ncmlkLWxhYmVsLXggew0KCWJvdHRvbTogYXV0bzsNCgl0b3A6IDEwMCU7DQoJbWFyZ2luLXRvcDogMS41cmVtOw0KCXdpZHRoOiAycmVtOw0KCW1hcmdpbi1sZWZ0OiAtMXJlbTsNCgl0ZXh0LWFsaWduOiBjZW50ZXI7DQp9DQouZ3JpZC1sYWJlbC14OmJlZm9yZSB7DQoJY29udGVudDogJyc7DQoJcG9zaXRpb246IGFic29sdXRlOw0KCWhlaWdodDogLjVyZW07DQoJd2lkdGg6IDA7DQoJYm9yZGVyLWxlZnQ6IDJweCBzb2xpZDsNCgl0b3A6IC0xcmVtOw0KCW1hcmdpbi1sZWZ0OiAtMXB4Ow0KCW1hcmdpbi10b3A6IC0ycHg7DQoJbGVmdDogMXJlbTsNCn0NCg0KLmdyaWQtbGFiZWwteSB7DQoJcmlnaHQ6IDEwMCU7DQoJbWFyZ2luLXJpZ2h0OiAxLjVyZW07DQoJbWFyZ2luLXRvcDogLS41cmVtOw0KfQ0KLmdyaWQtbGFiZWwteTpiZWZvcmUgew0KCWNvbnRlbnQ6ICcnOw0KCXBvc2l0aW9uOiBhYnNvbHV0ZTsNCgl3aWR0aDogLjVyZW07DQoJaGVpZ2h0OiAwOw0KCWJvcmRlci10b3A6IDJweCBzb2xpZDsNCglyaWdodDogLTFyZW07DQoJdG9wOiAuNHJlbTsNCgltYXJnaW4tcmlnaHQ6IC0xcHg7DQp9DQoNCi5ncmlkLWxhYmVsLXIgew0KCXJpZ2h0OiAxMDAlOw0KCXRvcDogY2FsYyg1MCUgLSAuNXJlbSk7DQoJbWFyZ2luLXJpZ2h0OiAxLjVyZW07DQp9DQouZ3JpZC1sYWJlbC1yOmJlZm9yZSB7DQoJY29udGVudDogJyc7DQoJcG9zaXRpb246IGFic29sdXRlOw0KCXdpZHRoOiAuNXJlbTsNCgloZWlnaHQ6IDA7DQoJYm9yZGVyLXRvcDogMnB4IHNvbGlkOw0KCXJpZ2h0OiAtMXJlbTsNCgl0b3A6IC40cmVtOw0KCW1hcmdpbi1yaWdodDogLTFweDsNCn0NCg0KDQouZ3JpZC1sYWJlbC1hIHsNCglib3R0b206IGF1dG87DQoJd2lkdGg6IDJyZW07DQoJdGV4dC1hbGlnbjogY2VudGVyOw0KfQ==","base64"));


module.exports = Grid;

/**
 * @constructor
 */
function Grid (options) {
	if (!(this instanceof Grid)) return new Grid(options);

	extend(this, options);

	this.id = uid();

	if (!isBrowser) return;

	//obtian container
	this.container = options.container || document.body;
	if (typeof this.container === 'string') this.container = document.querySelector(this.container);
	this.container.classList.add('grid-container');

	this.element = document.createElement('div');
	this.element.classList.add('grid');
	this.container.appendChild(this.element);

	if (this.className) this.element.className += ' ' + this.className;

	//create lines container
	this.linesContainer = document.createElement('div');
	this.element.appendChild(this.linesContainer);
	this.linesContainer.classList.add('grid-lines');

	this.update(options);
}

inherits(Grid, Emitter);


Grid.prototype.container = null;
Grid.prototype.viewport = null;

Grid.prototype.lines = null;
Grid.prototype.axes = null;

Grid.prototype.prefixes = {
	8: 'Y', // yotta
	7: 'Z', // zetta
	6: 'E', // exa
	5: 'P', // peta
	4: 'T', // tera
	3: 'G', // giga
	2: 'M', // mega
	1: 'k', // kilo
	0: '',
	'-1': 'm', // milli
	'-2': 'µ', // micro
	'-3': 'n', // nano
	'-4': 'p', // pico
	'-5': 'f', // femto
	'-6': 'a', // atto
	'-7': 'z', // zepto
	'-8': 'y'  // ycoto
};

Grid.prototype.defaultLines = {
	orientation: 'x',
	logarithmic: false,
	min: 0,
	max: 100,
	//detected from range
	values: undefined,
	//copied from values
	titles: undefined,
	format: true,
	units: ''
};

Grid.prototype.defaultAxis = {
	name: '',
	//detected from range
	values: undefined,
	//copied from values
	labels: undefined,
	//copied from labels
	titles: undefined,
	format: true,
	units: ''
};

Grid.prototype.update = function (options) {
	var this$1 = this;

	options = options || {};

	var that = this;

	var element = this.element;
	var linesContainer = this.linesContainer;
	var id = this.id;

	//set viewport
	if (options.viewport) this.viewport = options.viewport;
	var viewport = this.viewport;

	//hide element to avoid live calc
	element.setAttribute('hidden', true);

	var w = this.container.offsetWidth;
	var h = this.container === document.body ? window.innerHeight : this.container.offsetHeight;

	//calc viewport
	if (viewport instanceof Function) {
		viewport = viewport(w, h);
	}

	if (!viewport) viewport = [0,0,w,h];
	if (viewport[2] < 0 || viewport[3] < 0) throw 'Viewport size is negative, probably because grid container size is 0 or something. Please, check the container size.';

	element.style.left = viewport[0] + (typeof viewport[0] === 'number' ? 'px' : '');
	element.style.top = viewport[1] + (typeof viewport[1] === 'number' ? 'px' : '');
	element.style.width = viewport[2] + (typeof viewport[2] === 'number' ? 'px' : '');
	element.style.height = viewport[3] + (typeof viewport[3] === 'number' ? 'px' : '');


	//ensure lines values are not empty
	this.lines = this.lines || [];
	if (options.lines) {
		this.lines = options.lines.map(function (lines, i) { return lines && extend({}, this$1.defaultLines, this$1.lines[i], lines); });
	}
	this.axes = this.axes || [];
	if (options.axes) {
		this.axes = options.axes.map(function (axis, i) { return axis && extend({}, this$1.defaultAxis, this$1.lines[i], axis); });
	}

	//exceptional case of overflow:hidden
	// if (this.container === document.body) {
	// 	if ((viewport[0] + viewport[2]) >= window.innerWidth || (viewport[1] + viewport[3]) >= window.innerHeight) {
	// 		linesContainer.style.overflow = 'hidden';
	// 	}
	// 	else {
	// 		linesContainer.style.overflow = 'visible';
	// 	}
	// }

	//hide all lines, labels, axes first
	var lines = element.querySelectorAll('.grid-line');
	for (var i = 0; i < lines.length; i++) {
		lines[i].setAttribute('hidden', true);
	}
	var axes = element.querySelectorAll('.grid-axis');
	for (var i = 0; i < axes.length; i++) {
		axes[i].setAttribute('hidden', true);
	}
	var labels = element.querySelectorAll('.grid-label');
	for (var i = 0; i < labels.length; i++) {
		labels[i].setAttribute('hidden', true);
	}

	//set lines
	this.lines.forEach(function (lines, idx) {
		if (!lines) return;

		//temp object keeping state of current lines run
		var stats = {
			linesContainer: linesContainer,
			idx: idx,
			id: id
		};

		if (options.lines) {
			if (options.lines[idx] && options.lines[idx].style) {
				this.lines[idx].style = extend(this.lines[idx].style, options.lines[idx].style);
				delete options.lines[idx].style;
			}
			this.lines[idx] = lines = extend(this.lines[idx], options.lines[idx]);
		}
		stats.lines = lines;
		var linesMin = Math.min(lines.max, lines.min);
		var linesMax = Math.max(lines.min, lines.max);
		stats.min = linesMin;
		stats.max = linesMax;

		//detect steps, if not defined, as one per each 50px
		var values = [];
		var minW = Math.min(viewport[2], viewport[3]);
		var intersteps = (lines.orientation === 'x' ? (typeof viewport[2] === 'number' ? viewport[2] : linesContainer.clientWidth) : lines.orientation === 'y' ? (typeof viewport[3] === 'number' ? viewport[3] : linesContainer.clientHeight) : /a/.test(lines.orientation) ? minW * 2 : minW ) / 50 ;
		if (intersteps < 1) {
			values = [linesMin, linesMax];
		}
		//for non-log scale do even distrib
		else if (!lines.logarithmic) {
			var stepSize = (linesMax - linesMin) / Math.floor(intersteps);
			var order = mag(stepSize);

			var scale = /a/.test(lines.orientation) ? [1.5, 3] : [1, 2, 2.5, 5, 10];

			stepSize = closestNumber(stepSize, scale.map(function (v) { return v * order; }));

			var start = stepSize * Math.round(linesMin / stepSize);

			for (var step = start; step <= linesMax; step += stepSize) {
				if (step < linesMin) continue;
				values.push(step);
			}
		}
		else {
			//each logarithmic divisor
			if (linesMin <= 0 && linesMax >= 0) throw Error('Cannot create logarithmic grid spanning over zero, including zero');

			[1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (base) {
				var order = mag(linesMin);
				var start = base * order;
				for (var step = Math.abs(start); step <= Math.abs(linesMax); step *=10) {
					if (step < Math.abs(linesMin)) continue;
					values.push(step);
				}
			});
		}


		values = lines.values instanceof Function ?
			values.map(function (v, i) { return lines.values(v, i, stats); }, this).filter(function (v) { return v != null; }) :
			lines.values || values;

		//to avoid collisions
		values = values.sort(function (a, b) { return a - b; });

		stats.values = values;

		//define titles
		var titles = lines.titles instanceof Function ? values.map(function (v, i) { return lines.titles(v, i, stats); }, this) :
			lines.titles === undefined ? values.map(function (value) {
				var order = mag(value);
				var power = Math.floor(Math.log(order) / Math.log(1000));
				if (lines.format && that.prefixes[power]) {
					if (power > 1) value /= (power*1000);
					return value.toLocaleString() + that.prefixes[power] + lines.units;
				}
				else {
					return value.toLocaleString() + lines.units;
				}
		}) : lines.titles;
		stats.titles = titles;

		//draw lines
		var offsets = values.slice().reverse().map(function (value, i) {
			var line = linesContainer.querySelector(("#grid-line-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id));
			var ratio;
			if (!line) {
				line = document.createElement('span');
				line.id = "grid-line-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id;
				line.classList.add('grid-line');
				line.classList.add(("grid-line-" + (lines.orientation)));
				if (value === linesMin) line.classList.add('grid-line-min');
				if (value === linesMax) line.classList.add('grid-line-max');
				line.setAttribute('data-value', value);

				linesContainer.appendChild(line);
			}

			titles && line.setAttribute('title', titles[values.length - 1 - i]);

			if (!lines.logarithmic) {
				ratio = (value - linesMin) / (linesMax - linesMin);
			}
			else {
				ratio = (lg(value) - lg(linesMin)) / (lg(linesMax) - lg(linesMin));
			}
			if (lines.min > lines.max) ratio = 1 - ratio;

			ratio *= 100;
			if (lines.orientation === 'x') {
				line.style.left = ratio + '%';
			}
			else if (lines.orientation === 'y' ) {
				line.style.top = (100 - ratio) + '%';
			}
			else if (/r/.test(lines.orientation)) {
				line.style.marginLeft = -minW*ratio*.005 + 'px';
				line.style.marginTop = -minW*ratio*.005 + 'px';
				line.style.width = minW*ratio*.01 + 'px';
				line.style.height = minW*ratio*.01 + 'px';
				line.style.borderRadius = minW + 'px';
			}
			else if (/a/.test(lines.orientation)) {
				if (ratio && !mod(ratio/100 * 360, 360)) {
					linesContainer.removeChild(line);
				}
				line.style.width = minW / 2 + 'px';
				line.style.transform = "rotate(" + (-ratio * 360 / 100) + "deg)";
			}

			if (lines.style) {
				for (var prop in lines.style) {
					var val = lines.style[prop];
					if (typeof val === 'number') val += 'px';
					line.style[prop] = val;
				}
			}
			line.removeAttribute('hidden');

			return ratio;
		}).reverse();
		stats.offsets = offsets;

		//draw axes
		var axis = this.axes[idx];

		//get axis element
		var axisEl = element.querySelector(("#grid-axis-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + idx + "-" + id));

		//do not paint inexisting axis
		if (!axis) {
			axisEl && axisEl.setAttribute('hidden', true);
			return this;
		}
		else {
			axisEl && axisEl.removeAttribute('hidden');
		}

		if (options.axes) axis = extend(this.axes[idx], options.axes[idx]);
		stats.axis = axis;

		//define values
		var axisValues = axis.values || values;
		stats.axisValues = axisValues;

		//define titles
		var axisTitles = axis.titles instanceof Function ? axisValues.map(function (v, i) { return axis.titles(v, i, stats); }, this) : axis.titles ? axis.titles : axisValues === values ? titles : axis.titles === undefined ? axisValues.slice().map(function (value) {
			return value.toLocaleString();
		}) : axis.titles;
		stats.axisTitles = axisTitles;

		//define labels
		var labels = axis.labels instanceof Function ? axisValues.map(function (v, i) { return axis.labels(v, i, stats); }, this) : axis.labels || axisTitles;
		stats.labels = labels;

		if (!axisEl) {
			axisEl = document.createElement('span');
			axisEl.id = "grid-axis-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + idx + "-" + id;
			axisEl.classList.add('grid-axis');
			axisEl.classList.add(("grid-axis-" + (lines.orientation)));
			axisEl.setAttribute('data-name', axis.name);
			axisEl.setAttribute('title', axis.name);
			element.appendChild(axisEl);

		}
		if (/a/.test(lines.orientation)) {
			axisEl.style.marginLeft = -minW*100*.005 + 'px';
			axisEl.style.marginTop = -minW*100*.005 + 'px';
			axisEl.style.width = minW*100*.01 + 'px';
			axisEl.style.height = minW*100*.01 + 'px';
			axisEl.style.borderRadius = minW + 'px';
		}
		else if (/r/.test(lines.orientation)) {
			axisEl.style.marginTop = -minW*100*.005 + 'px';
			axisEl.style.height = minW*100*.01 + 'px';
		}

		axisEl.removeAttribute('hidden');

		//draw labels
		axisValues.forEach(function (value, i) {
			if (value == null || labels[i] == null) return;

			if (lines.orientation === 'x' || lines.orientation === 'y') {
				var label = element.querySelector(("#grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id));

				if (!label) {
					label = document.createElement('label');
					label.id = "grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id;
					label.classList.add('grid-label');
					label.classList.add(("grid-label-" + (lines.orientation)));
					label.setAttribute('for', ("grid-line-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id));
					element.appendChild(label);
				}

				label.innerHTML = labels[i];

				axisTitles && label.setAttribute('title', axisTitles[i]);

				label.setAttribute('data-value', value);

				//hide label for special log case to avoid overlapping
				if (lines.logarithmic) {
					hideLogLabel(label, value, intersteps);
				}

				if (lines.orientation === 'x') {
					label.style.left = offsets[i] + '%';
				}
				else if (lines.orientation === 'y') {
					label.style.top = (100 - offsets[i]) + '%';
				}

				if (within(value, linesMin, linesMax)) {
					label.removeAttribute('hidden');
				} else {
					label.setAttribute('hidden', true);
				}
			}
			else if (/r/.test(lines.orientation)) {
				var labelTop = element.querySelector(("#grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-top"));
				var labelBottom = element.querySelector(("#grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-bottom"));

				if (!labelTop) {
					labelTop = document.createElement('label');
					labelTop.id = "grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-top";
					labelTop.classList.add('grid-label');
					labelTop.classList.add(("grid-label-" + (lines.orientation)));
					labelTop.setAttribute('for', ("grid-line-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id));
					element.appendChild(labelTop);
				}

				labelTop.innerHTML = labels[i];

				axisTitles && labelTop.setAttribute('title', axisTitles[i]);

				labelTop.setAttribute('data-value', value);

				if(!labelBottom) {
					labelBottom = labelTop.cloneNode();
					labelBottom.id = "grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-bottom";
					if (offsets[i]) {
						element.appendChild(labelBottom);
					}
				}

				labelBottom.innerHTML = labels[i];

				// labelTop.style.marginTop = -(minW*.5*offsets[i]/100) + 'px';
				// labelBottom.style.marginTop = (minW*.5*offsets[i]/100) + 'px';
				labelTop.style.top = viewport[3]/2 - (minW*.5*offsets[i]/100) + 'px';
				labelBottom.style.top = viewport[3]/2 + (minW*.5*offsets[i]/100) + 'px';

				if (within(value, linesMin, linesMax)) {
					labelTop.removeAttribute('hidden');
					labelBottom.removeAttribute('hidden');
				} else {
					labelTop.setAttribute('hidden', true);
					labelBottom.setAttribute('hidden', true);
				}

				//hide label for special log case to avoid overlapping
				if (lines.logarithmic) {
					hideLogLabel(labelTop, value, intersteps * 1.7);
					hideLogLabel(labelBottom, value, intersteps * 1.7);
				}
			}
			else if (/a/.test(lines.orientation)) {
				var label$1 = element.querySelector(("#grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-top"));

				if (!label$1) {
					label$1 = document.createElement('label');
					label$1.id = "grid-label-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id + "-top";
					label$1.classList.add('grid-label');
					label$1.classList.add(("grid-label-" + (lines.orientation)));
					label$1.setAttribute('for', ("grid-line-" + (lines.orientation) + (lines.logarithmic?'-log':'') + "-" + (formatValue(value)) + "-" + idx + "-" + id));
					element.appendChild(label$1);
				}

				label$1.innerHTML = labels[i];

				axisTitles && label$1.setAttribute('title', axisTitles[i]);

				label$1.setAttribute('data-value', value);

				var angle = offsets[i] * Math.PI / 50;
				var angleDeg = offsets[i] * 3.6;
				// label.style.transform = `rotate(${angle}deg)`;
				label$1.style.left = viewport[2]/2 + Math.cos(angle) * minW/2 + 'px';
				label$1.style.top = viewport[3]/2 -Math.sin(angle) * minW/2 + 'px';
				label$1.style.marginTop = (-Math.sin(angle) * .8 - .4) + 'rem';
				label$1.style.marginLeft = -1 + (Math.cos(angle)) + 'rem';

				if (within(value, linesMin, linesMax) && angleDeg < 360 ) {
					label$1.removeAttribute('hidden');
				} else {
					label$1.setAttribute('hidden', true);
				}
			}
		});


		//bloody helpers

		function hideLogLabel (label, value, intersteps) {
			var start = parseInt(value.toExponential()[0]);

			if (values.length > intersteps * 2.8) {
				if (start == 2) label.innerHTML = '';
			}
			if (values.length > intersteps * 2.6) {
				if (start == 5) label.innerHTML = '';
			}
			if (values.length > intersteps * 2.3) {
				if (start == 3) label.innerHTML = '';
			}
			if (values.length > intersteps * 2) {
				if (start == 7) label.innerHTML = '';
			}
			if (values.length > intersteps * 1.7) {
				if (start == 4) label.innerHTML = '';
			}
			if (values.length > intersteps * 1.5) {
				if (start == 6) label.innerHTML = '';
			}
			if (values.length > intersteps * 1.2) {
				if (start == 8) label.innerHTML = '';
			}
			if (values.length > intersteps * .9) {
				if (start == 9) label.innerHTML = '';
			}
		}

	}, this);

	element.removeAttribute('hidden');

	this.emit('update');

	return this;
};

function formatValue (v) {
	return v.toExponential().replace('.', '-').replace('+', '-');
}
}).call(this,require("buffer").Buffer)
},{"buffer":2,"events":3,"get-uid":39,"inherits":45,"insert-styles":47,"is-browser":48,"mumath/closest":68,"mumath/lg":69,"mumath/mod":70,"mumath/order":71,"mumath/within":74,"xtend/mutable":110}],79:[function(require,module,exports){
var div = null
var prefixes = [ 'Webkit', 'Moz', 'O', 'ms' ]

module.exports = function prefixStyle (prop) {
  // re-use a dummy div
  if (!div) {
    div = document.createElement('div')
  }

  var style = div.style

  // prop exists without prefix
  if (prop in style) {
    return prop
  }

  // borderRadius -> BorderRadius
  var titleCase = prop.charAt(0).toUpperCase() + prop.slice(1)

  // find the vendor-prefixed prop
  for (var i = prefixes.length; i >= 0; i--) {
    var name = prefixes[i] + titleCase
    // e.g. WebkitBorderRadius or webkitBorderRadius
    if (name in style) {
      return name
    }
  }

  return false
}

},{}],80:[function(require,module,exports){
function identity(x) { return x; }

module.exports = identity;
module.exports.dash = identity;
module.exports.dash = identity;

},{}],81:[function(require,module,exports){
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var now = require('right-now')
var raf = require('raf')

module.exports = Engine
function Engine(fn) {
    if (!(this instanceof Engine))
        return new Engine(fn)
    this.running = false
    this.last = now()
    this._frame = 0
    this._tick = this.tick.bind(this)

    if (fn)
        this.on('tick', fn)
}

inherits(Engine, EventEmitter)

Engine.prototype.start = function() {
    if (this.running)
        return
    this.running = true
    this.last = now()
    this._frame = raf(this._tick)
    return this
}

Engine.prototype.stop = function() {
    this.running = false
    if (this._frame !== 0)
        raf.cancel(this._frame)
    this._frame = 0
    return this
}

Engine.prototype.tick = function() {
    this._frame = raf(this._tick)
    var time = now()
    var dt = time - this.last
    this.emit('tick', dt)
    this.last = time
}
},{"events":3,"inherits":45,"raf":82,"right-now":83}],82:[function(require,module,exports){
(function (global){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function() {
  root.requestAnimationFrame = raf
  root.cancelAnimationFrame = caf
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":77}],83:[function(require,module,exports){
(function (global){
module.exports =
  global.performance &&
  global.performance.now ? function now() {
    return performance.now()
  } : Date.now || function now() {
    return +new Date
  }

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],84:[function(require,module,exports){
module.exports = scope;
scope.replace = replace;

function scope (css, parent) {
	if (!css) return css;

	if (!parent) return css;

	css = replace(css, parent + ' $1$2');

	//regexp.escape
	var parentRe = parent.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	//replace self-selectors
	css = css.replace(new RegExp('(' + parentRe + ')\\s*\\1(?=[\\s\\r\\n,{])', 'g'), '$1');

	//replace `:host` with parent
	css = css.replace(new RegExp('(' + parentRe + ')\\s*:host', 'g'), '$1');

	//revoke wrongly replaced @ statements, like @supports, @import, @media etc.
	css = css.replace(new RegExp('(' + parentRe + ')\\s*@', 'g'), '@');

	return css;
}

function replace (css, replacer) {
	//strip block comments
	css = css.replace(/\/\*([\s\S]*?)\*\//g, '');

	return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, replacer);
}
},{}],85:[function(require,module,exports){
var lowerCase = require('lower-case')

var NON_WORD_REGEXP = require('./vendor/non-word-regexp')
var CAMEL_CASE_REGEXP = require('./vendor/camel-case-regexp')
var TRAILING_DIGIT_REGEXP = require('./vendor/trailing-digit-regexp')

/**
 * Sentence case a string.
 *
 * @param  {String} str
 * @param  {String} locale
 * @param  {String} replacement
 * @return {String}
 */
module.exports = function (str, locale, replacement) {
  if (str == null) {
    return ''
  }

  replacement = replacement || ' '

  function replace (match, index, string) {
    if (index === 0 || index === (string.length - match.length)) {
      return ''
    }

    return replacement
  }

  str = String(str)
    // Support camel case ("camelCase" -> "camel Case").
    .replace(CAMEL_CASE_REGEXP, '$1 $2')
    // Support digit groups ("test2012" -> "test 2012").
    .replace(TRAILING_DIGIT_REGEXP, '$1 $2')
    // Remove all non-word characters and replace with a single space.
    .replace(NON_WORD_REGEXP, replace)

  // Lower case the entire string.
  return lowerCase(str, locale)
}

},{"./vendor/camel-case-regexp":86,"./vendor/non-word-regexp":87,"./vendor/trailing-digit-regexp":88,"lower-case":66}],86:[function(require,module,exports){
module.exports = /([\u0061-\u007A\u00B5\u00DF-\u00F6\u00F8-\u00FF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0561-\u0587\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7FA\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A])([\u0041-\u005A\u00C0-\u00D6\u00D8-\u00DE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA\uFF21-\uFF3A\u0030-\u0039\u00B2\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19])/g

},{}],87:[function(require,module,exports){
module.exports = /[^\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u0030-\u0039\u00B2\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]+/g

},{}],88:[function(require,module,exports){
module.exports = /([\u0030-\u0039\u00B2\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19])([^\u0030-\u0039\u00B2\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19])/g

},{}],89:[function(require,module,exports){
/**
 * @module settings-panel
 */
'use strict';

var Emitter = require('events').EventEmitter;
var inherits = require('inherits');
var extend = require('just-extend');
var css = require('dom-css');
var uid = require('get-uid');

var insertCss = require('insert-styles');
var isPlainObject = require('is-plain-obj');
var format = require('param-case');
var px = require('add-px-to-style');
var scopeCss = require('scope-css');

module.exports = Panel


insertCss(".settings-panel {\r\n\tposition: relative;\r\n\t-webkit-user-select: none;\r\n\t-moz-user-select: none;\r\n\t-ms-user-select: none;\r\n\tuser-select: none;\r\n\tcursor: default;\r\n\ttext-align: left;\r\n\tbox-sizing: border-box;\r\n\tfont-family: sans-serif;\r\n\tfont-size: 1rem;\r\n\twidth: 32em;\r\n\tmax-width: 100%;\r\n\tpadding: 1em;\r\n}\r\n\r\n.settings-panel [hidden] {\r\n\tdisplay: none!important;\r\n}\r\n\r\n.settings-panel * {\r\n\tbox-sizing: border-box;\r\n}\r\n\r\n.settings-panel svg {\r\n\tfill: currentColor;\r\n\tmax-width: 100%;\r\n\tmax-height: 100%;\r\n\tdisplay: inline-block;\r\n}\r\n\r\n.settings-panel input,\r\n.settings-panel button,\r\n.settings-panel textarea,\r\n.settings-panel select {\r\n\tfont-family: inherit;\r\n\tfont-size: inherit;\r\n}\r\n\r\n.settings-panel textarea {\r\n\tmax-height: 8em;\r\n}\r\n\r\n\r\n.settings-panel a {\r\n\tcolor: inherit;\r\n\ttext-decoration: none;\r\n}\r\n\r\n/** Basic layout */\r\n.settings-panel-field {\r\n\tposition: relative;\r\n\tpadding: .25em;\r\n\tdisplay: table;\r\n\twidth: 100%;\r\n}\r\n.settings-panel-field:last-child {\r\n\tmargin-bottom: 0;\r\n}\r\n.settings-panel-label {\r\n\tleft: 0;\r\n\tdisplay: table-cell;\r\n\tline-height: 1.2;\r\n\tvertical-align: baseline;\r\n\tpadding-top: 0;\r\n\tmax-width: 100%;\r\n}\r\n.settings-panel-input {\r\n\tdisplay: table-cell;\r\n\tvertical-align: baseline;\r\n\tposition: relative;\r\n\twhite-space: nowrap;\r\n}\r\n\r\n.settings-panel-orientation-left .settings-panel-label {\r\n\twidth: 9em;\r\n\tpadding-right: .5em;\r\n}\r\n.settings-panel-orientation-right .settings-panel-label {\r\n\tdisplay: block;\r\n\tmargin-right: 0;\r\n\tfloat: right;\r\n\twidth: 9em;\r\n\tpadding-top: .4em;\r\n\tpadding-left: .5em;\r\n}\r\n.settings-panel-orientation-right .settings-panel-label + .settings-panel-input {\r\n\tdisplay: block;\r\n\twidth: calc(100% - 9em);\r\n}\r\n.settings-panel-orientation-top .settings-panel-label {\r\n\tdisplay: block;\r\n\twidth: 100%;\r\n\tmargin-right: 0;\r\n\tpadding-top: 0;\r\n\tline-height: 1.5;\r\n}\r\n.settings-panel-orientation-top .settings-panel-label + .settings-panel-input {\r\n\tdisplay: block;\r\n\twidth: 100%;\r\n\tpadding: 0;\r\n}\r\n.settings-panel-orientation-bottom .settings-panel-label {\r\n\tdisplay: block;\r\n\twidth: 100%;\r\n\tmargin-right: 0;\r\n\tpadding: 0;\r\n\tline-height: 1.5;\r\n\tborder-top: 2.5em solid transparent;\r\n}\r\n.settings-panel-orientation-bottom .settings-panel-label + .settings-panel-input {\r\n\twidth: 100%;\r\n\tposition: absolute;\r\n\ttop: 0;\r\n}\r\n\r\n.settings-panel-orientation-left > .settings-panel-label {\r\n\twidth: 9em;\r\n\tdisplay: table-cell;\r\n}\r\n\r\n.settings-panel-title {\r\n\tfont-size: 1.6em;\r\n\tline-height: 1.25;\r\n\tmargin-top: 0;\r\n\tmargin-bottom: 0;\r\n\tpadding: .25em .25em;\r\n\ttext-align: center;\r\n}\r\n.settings-panel--collapsible .settings-panel-title {\r\n\tcursor: pointer;\r\n}\r\n.settings-panel--collapsed > *:not(.settings-panel-title) {\r\n\tdisplay: none!important;\r\n}\r\n\r\n\r\n/** Button */\r\n.settings-panel-field--button {\r\n\tdisplay: inline-block;\r\n}\r\n.settings-panel-field--button .settings-panel-input {\r\n\tdisplay: block;\r\n\ttext-align: center;\r\n}\r\n.settings-panel-button {\r\n\tvertical-align: baseline;\r\n\tline-height: 1;\r\n\tmin-height: 2em;\r\n\tpadding: .2em 1em;\r\n\twidth: 100%;\r\n\tcursor: pointer;\r\n}\r\n\r\n\r\n/** Default text and alike style */\r\n.settings-panel-text {\r\n\theight: 2em;\r\n\twidth: 100%;\r\n\tvertical-align: baseline;\r\n}\r\n.settings-panel-textarea {\r\n\twidth: 100%;\r\n\tdisplay: block;\r\n\tvertical-align: top; /* allowable as we use autoheight */\r\n\tmin-height: 2em;\r\n}\r\n\r\n/** Checkbox style */\r\n.settings-panel-field--checkbox .settings-panel-input {\r\n\tline-height: 2em;\r\n}\r\n.settings-panel-checkbox-group {\r\n\tborder: none;\r\n\t-webkit-appearance: none;\r\n\t-moz-appearance: none;\r\n\t-o-appearance: none;\r\n\tappearance: none;\r\n\tmargin: 0;\r\n\tpadding: 0;\r\n\twhite-space: normal;\r\n}\r\n.settings-panel-checkbox {\r\n\tdisplay: inline-block;\r\n\tvertical-align: middle;\r\n\twidth: 1.2em;\r\n\theight: 1.2em;\r\n\tline-height: 1.2em;\r\n\tmargin: -.15em .25em 0 0;\r\n}\r\n.settings-panel-checkbox-label {\r\n\tdisplay: inline-block;\r\n\tvertical-align: baseline;\r\n\t-webkit-user-select: none;\r\n\t-moz-user-select: none;\r\n\t-ms-user-select: none;\r\n\tuser-select: none;\r\n\tline-height: 1.2;\r\n\tmargin-right: 1em;\r\n}\r\n.settings-panel-checkbox-group .settings-panel-checkbox-label:last-child {\r\n\tmargin-right: 0;\r\n}\r\n\r\n\r\n/** Color picker style */\r\n.settings-panel-color {\r\n\tposition: relative;\r\n\twidth: 2em;\r\n\theight: 2em;\r\n\tposition: absolute;\r\n\ttop: 0;\r\n\tbottom: 0;\r\n\tmargin: auto;\r\n}\r\n.settings-panel-color-value {\r\n\twidth: 100%;\r\n\theight: 2em;\r\n\tpadding: 0 0 0 2.5em;\r\n}\r\n.settings-panel .Scp {\r\n\t-webkit-user-select: none;\r\n\t-moz-user-select: none;\r\n\t-ms-user-select: none;\r\n\tuser-select: none;\r\n\tposition: absolute;\r\n\tz-index: 10;\r\n\tcursor: pointer;\r\n\tbottom: -120px;\r\n}\r\n.settings-panel .Scp-saturation {\r\n\tposition: relative;\r\n\twidth: calc(100% - 25px);\r\n\theight: 100%;\r\n\tbackground: linear-gradient(to right, #fff 0%, #f00 100%);\r\n\tfloat: left;\r\n}\r\n.settings-panel .Scp-brightness {\r\n\twidth: 100%;\r\n\theight: 100%;\r\n\tbackground: linear-gradient(to top, #000 0%, rgba(255,255,255,0) 100%);\r\n}\r\n.settings-panel .Scp-sbSelector {\r\n\tborder: 1px solid;\r\n\tposition: absolute;\r\n\twidth: 14px;\r\n\theight: 14px;\r\n\tbackground: #fff;\r\n\tborder-radius: 10px;\r\n\ttop: -7px;\r\n\tleft: -7px;\r\n\tbox-sizing: border-box;\r\n\tz-index: 10;\r\n}\r\n.settings-panel .Scp-hue {\r\n\twidth: 20px;\r\n\theight: 100%;\r\n\tposition: relative;\r\n\tfloat: left;\r\n\tbackground: linear-gradient(to bottom, #f00 0%, #f0f 17%, #00f 34%, #0ff 50%, #0f0 67%, #ff0 84%, #f00 100%);\r\n}\r\n.settings-panel .Scp-hSelector {\r\n\tposition: absolute;\r\n\tbackground: #fff;\r\n\tborder-bottom: 1px solid #000;\r\n\tright: -3px;\r\n\twidth: 10px;\r\n\theight: 2px;\r\n}\r\n\r\n\r\n\r\n/** Interval style */\r\n.settings-panel-interval {\r\n\tposition: relative;\r\n\t-webkit-appearance: none;\r\n\tdisplay: inline-block;\r\n\tvertical-align: top;\r\n\theight: 2em;\r\n\tmargin: 0px 0;\r\n\twidth: 70%;\r\n\tbackground: #ddd;\r\n\tcursor: ew-resize;\r\n\t-webkit-touch-callout: none;\r\n\t-webkit-user-select: none;\r\n\t-khtml-user-select: none;\r\n\t-moz-user-select: none;\r\n\t-ms-user-select: none;\r\n\tuser-select: none;\r\n}\r\n.settings-panel-interval-handle {\r\n\tbackground: #7a4;\r\n\tposition: absolute;\r\n\ttop: 0;\r\n\tbottom: 0;\r\n\tmin-width: 1px;\r\n}\r\n.settings-panel.settings-panel-interval-dragging * {\r\n\t-webkit-touch-callout: none !important;\r\n\t-webkit-user-select: none !important;\r\n\t-khtml-user-select: none !important;\r\n\t-moz-user-select: none !important;\r\n\t-ms-user-select: none !important;\r\n\tuser-select: none !important;\r\n\r\n\tcursor: ew-resize !important;\r\n}\r\n\r\n.settings-panel-interval + .settings-panel-value {\r\n\tright: 0;\r\n\tpadding-left: .5em;\r\n}\r\n\r\n\r\n\r\n/** Select style */\r\n.settings-panel-select {\r\n\tdisplay: inline-block;\r\n\twidth: 100%;\r\n\theight: 2em;\r\n\tvertical-align: baseline;\r\n}\r\n\r\n/** Value style */\r\n.settings-panel-value {\r\n\t-webkit-appearance: none;\r\n\t-moz-appearance: none;\r\n\t-o-appearance: none;\r\n\tappearance: none;\r\n\tmin-width: 3em;\r\n\tpadding: 0 0 0 0em;\r\n\tdisplay: inline-block;\r\n\tvertical-align: baseline;\r\n\tcursor: text;\r\n\theight: 2em;\r\n\tborder: none;\r\n\tborder-radius: 0;\r\n\toutline: none;\r\n\tfont-family: inherit;\r\n\tbackground: none;\r\n\tcolor: inherit;\r\n\twidth: 15%;\r\n}\r\n.settings-panel-value:focus {\r\n\toutline: 0;\r\n\tbox-shadow: 0;\r\n}\r\n.settings-panel-value-tip {\r\n\tdisplay: none;\r\n}\r\n\r\n/** Range style */\r\n.settings-panel-range {\r\n\twidth: 85%;\r\n\tpadding: 0;\r\n\tmargin: 0px 0;\r\n\theight: 2em;\r\n\tvertical-align: top;\r\n}\r\n.settings-panel-range + .settings-panel-value {\r\n\tpadding-left: .5em;\r\n\twidth: 15%;\r\n}\r\n\r\n.settings-panel-switch {\r\n\t-webkit-appearance: none;\r\n\t-moz-appearance: none;\r\n\tappearance: none;\r\n\tborder: none;\r\n\tdisplay: block;\r\n\tvertical-align: baseline;\r\n\tpadding: 0;\r\n\tmargin: 0;\r\n\tline-height: 2em;\r\n}\r\n.settings-panel-switch-input {\r\n\tmargin: 0;\r\n\tvertical-align: middle;\r\n\twidth: 1.2em;\r\n\theight: 1.2em;\r\n\tcursor: pointer;\r\n\tmargin-right: .25em;\r\n}\r\n.settings-panel-switch-label {\r\n\tdisplay: inline-block;\r\n\tvertical-align: baseline;\r\n\tline-height: 1.2;\r\n\tmargin-right: 1em;\r\n}\r\n\r\n\r\n.settings-panel hr {\r\n\tborder: none;\r\n\theight: 0;\r\n\tmargin: .5em 0;\r\n\tborder-bottom: 1px dotted;\r\n}\r\n\r\n.settings-panel-field--disabled {\r\n\topacity: .5;\r\n\tpointer-events: none;\r\n}");


/**
 * @constructor
 */
function Panel (items, opts) {
	var this$1 = this;

	if (!(this instanceof Panel)) return new Panel(items, opts)

	extend(this, opts);

	//ensure container
	if (this.container === undefined) this.container = document.body || document.documentElement;

	this.container.classList.add('settings-panel-container');

	//create element
	if (!this.id) this.id = uid();
	this.element = document.createElement('div')
	this.element.className = 'settings-panel settings-panel-' + this.id;
	if (this.className) this.element.className += ' ' + this.className;

	//create title
	if (this.title) {
		this.titleEl = this.element.appendChild(document.createElement('h2'));
		this.titleEl.className = 'settings-panel-title';
	}

	//create collapse button
	if (this.collapsible && this.title) {
		// this.collapseEl = this.element.appendChild(document.createElement('div'));
		// this.collapseEl.className = 'settings-panel-collapse';
		this.element.classList.add('settings-panel--collapsible');
		this.titleEl.addEventListener('click', function () {
			if (this$1.collapsed) {
				this$1.collapsed = false;
				this$1.element.classList.remove('settings-panel--collapsed');
			}
			else {
				this$1.collapsed = true;
				this$1.element.classList.add('settings-panel--collapsed');
			}
		});
	}

	//state is values of items
	this.state = {};

	//items is all items settings
	this.items = {};

	//create fields
	this.set(items);

	if (this.container) {
		this.container.appendChild(this.element)
	}

	//create theme style
	this.update();
}

inherits(Panel, Emitter);


/**
 * Set item value/options
 */
Panel.prototype.set = function (name, value) {
	var this$1 = this;

	//handle list of properties
	if (Array.isArray(name)) {
		var items = name;
		items.forEach(function (item) {
			this$1.set(item.id || item.label, item);
		});

		return this;
	}

	//handle plain object
	if (isPlainObject(name)) {
		var items$1 = name;
		var list = [];
		for (var key in items$1) {
			if (!isPlainObject(items$1[key])) {
				items$1[key] = {value: items$1[key]};
			}
			if (items$1[key].id == null) items$1[key].id = key;
			list.push(items$1[key]);
		}
		list = list.sort(function (a, b) { return (a.order||0) - (b.order||0); });

		return this.set(list);
	}

	//format name
	name = name || '';
	name = name.replace(/\-/g,'dash-');
	name = format(name);

	if (name) {
		var item = this.items[name];
		if (!item) item = this.items[name] = { id: name, panel: this };
	}
	//noname items should not be saved in state
	else {
		var item = {id: null, panel: this};
	}

	var initialValue = item.value;
	var isBefore = item.before;
	var isAfter = item.after;

	if (isPlainObject(value)) {
		item = extend(item, value);
	}
	else {
		//ignore nothing-changed set
		if (value === item.value && value !== undefined) return this;
		item.value = value;
	}

	if (item.value === undefined) item.value = item.default;

	if (name) this.state[name] = item.value;

	//define label via name
	if (item.label === undefined && item.id) {
		item.label = item.id;
	}

	//detect type
	if (!item.type) {
		if (item.value && Array.isArray(item.value)) {
			if (typeof item.value[0] === 'string') {
				item.type = 'checkbox';
			}
			else {
				item.type = 'interval'
			}
		} else if (item.scale || item.max || item.steps || item.step || typeof item.value === 'number') {
			item.type = 'range'
		} else if (item.options) {
			if (Array.isArray(item.options) && item.options.join('').length < 90 ) {
				item.type = 'switch'
			}
			else {
				item.type = 'select'
			}
		} else if (item.format) {
			item.type = 'color'
		} else if (typeof item.value === 'boolean') {
			item.type = 'checkbox'
		} else if (item.content != null) {
			item.type = 'raw'
		} else {
			if (item.value && (item.value.length > 140 || /\n/.test(item.value))) {
				item.type = 'textarea'
			}
			else {
				item.type = 'text'
			}
		}
	}

	var field, fieldId;

	if (item.id != null) {
		fieldId = 'settings-panel-field-' + item.id;
		field = this.element.querySelector('#' + fieldId);
	}

	//create field container
	if (!field) {
		field = document.createElement('div');
		if (fieldId != null) field.id = fieldId;
		this.element.appendChild(field);
		item.field = field;
	}
	else {
		//clean previous before/after
		if (isBefore) {
			this.element.removeChild(field.prevSibling);
		}
		if (isAfter) {
			this.element.removeChild(field.nextSibling);
		}
	}

	field.className = 'settings-panel-field settings-panel-field--' + item.type;

	if (item.orientation) field.className += ' settings-panel-orientation-' + item.orientation;

	if (item.className) field.className += ' ' + item.className;

	if (item.style) {
		if (isPlainObject(item.style)) {
			css(field, item.style);
		}
		else if (typeof item.style === 'string') {
			field.style.cssText = item.style;
		}
	}
	else if (item.style !== undefined) {
		field.style = null;
	}

	if (item.hidden) {
		field.setAttribute('hidden', true);
	}
	else {
		field.removeAttribute('hidden');
	}

	//createe container for the input
	var inputContainer = field.querySelector('.settings-panel-input');

	if (!inputContainer) {
		inputContainer = document.createElement('div');
		inputContainer.className = 'settings-panel-input';
		item.container = inputContainer;
		field.appendChild(inputContainer);
	}

	if (item.disabled) field.className += ' settings-panel-field--disabled';

	var components = this.components;
	var component = item.component;

	if (!component) {
		item.component = component = (components[item.type] || components.text)(item);

		if (component.on) {
			component.on('init', function (data) {
				item.value = data
				if (item.id) this$1.state[item.id] = item.value;
				var state = extend({}, this$1.state);

				item.init && item.init(data, state)
				this$1.emit('init', item.id, data, state)
				item.change && item.change(data, state)
				this$1.emit('change', item.id, data, state)
			});

			component.on('input', function (data) {
				item.value = data
				if (item.id) this$1.state[item.id] = item.value;
				var state = extend({}, this$1.state);

				item.input && item.input(data, state)
				this$1.emit('input', item.id, data, state)
				item.change && item.change(data, state)
				this$1.emit('change', item.id, data, state)
			});

			component.on('action', function () {
				var state = extend({}, this$1.state);
				item.action && item.action(state);
			});

			component.on('change', function (data) {
				item.value = data
				if (item.id) this$1.state[item.id] = item.value;
				var state = extend({}, this$1.state);

				item.change && item.change(data, state)
				this$1.emit('change', item.id, data, state)
			});
		}
	}
	else {
		component.update(item);
	}

	//create field label
	if (component.label !== false && (item.label || item.label === '')) {
		var label = field.querySelector('.settings-panel-label');
		if (!label) {
			label = document.createElement('label')
			label.className = 'settings-panel-label';
			field.insertBefore(label, inputContainer);
		}

		label.htmlFor = item.id;
		label.innerHTML = item.label;
		label.title = item.title || item.label;
	}

	//handle after and before
	// if (item.before) {
	// 	let before = item.before;
	// 	if (before instanceof Function) {
	// 		before = item.before.call(item, component);
	// 	}
	// 	if (before instanceof HTMLElement) {
	// 		this.element.insertBefore(before, field);
	// 	}
	// 	else {
	// 		field.insertAdjacentHTML('beforebegin', before);
	// 	}
	// }
	// if (item.after) {
	// 	let after = item.after;
	// 	if (after instanceof Function) {
	// 		after = item.after.call(item, component);
	// 	}
	// 	if (after instanceof HTMLElement) {
	// 		this.element.insertBefore(after, field.nextSibling);
	// 	}
	// 	else {
	// 		field.insertAdjacentHTML('afterend', after);
	// 	}
	// }

	//emit change
	if (initialValue !== item.value) {
		this.emit('change', item.id, item.value, this.state)
	}

	return this;
}


/**
 * Return property value or a list
 */
Panel.prototype.get = function (name) {
	if (name == null) return this.state;
	return this.state[name];
}


/**
 * Update theme
 */
Panel.prototype.update = function (opts) {
	extend(this, opts);

	//FIXME: decide whether we have to reset these params
	// if (opts && opts.theme) {
	// 	if (opts.theme.fontSize) this.fontSize = opts.theme.fontSize;
	// 	if (opts.theme.inputHeight) this.inputHeight = opts.theme.inputHeight;
	// 	if (opts.theme.fontFamily) this.fontFamily = opts.theme.fontFamily;
	// 	if (opts.theme.labelWidth) this.labelWidth = opts.theme.labelWidth;
	// 	if (opts.theme.palette) this.palette = opts.theme.palette;
	// }

	//update title, if any
	if (this.titleEl) this.titleEl.innerHTML = this.title;

	//update orientation
	this.element.classList.remove('settings-panel-orientation-top');
	this.element.classList.remove('settings-panel-orientation-bottom');
	this.element.classList.remove('settings-panel-orientation-left');
	this.element.classList.remove('settings-panel-orientation-right');
	this.element.classList.add('settings-panel-orientation-' + this.orientation);

	//apply style
	var cssStr = '';
	if (this.theme instanceof Function) {
		cssStr = this.theme.call(this, this);
	}
	else if (typeof this.theme === 'string') {
		cssStr = this.theme;
	}

	//append extra css
	if (this.css) {
		if (this.css instanceof Function) {
			cssStr += this.css.call(this, this);
		}
		else if (typeof this.css === 'string') {
			cssStr += this.css;
		}
	}

	//scope each rule
	cssStr = scopeCss(cssStr || '', '.settings-panel-' + this.id) || '';

	insertCss(cssStr.trim(), {
		id: this.id
	});

	if (this.style) {
		if (isPlainObject(this.style)) {
			css(this.element, this.style);
		}
		else if (typeof this.style === 'string') {
			this.element.style.cssText = this.style;
		}
	}
	else if (this.style !== undefined) {
		this.element.style = null;
	}

	return this;
}

//instance theme
Panel.prototype.theme = require('./theme/none');

/**
 * Registered components
 */
Panel.prototype.components = {
	range: require('./src/range'),

	button: require('./src/button'),
	text: require('./src/text'),
	textarea: require('./src/textarea'),

	checkbox: require('./src/checkbox'),
	toggle: require('./src/checkbox'),

	switch: require('./src/switch'),

	color: require('./src/color'),

	interval: require('./src/interval'),
	multirange: require('./src/interval'),

	custom: require('./src/custom'),
	raw: require('./src/custom'),

	select: require('./src/select')
};


/**
 * Additional class name
 */
Panel.prototype.className;


/**
 * Additional visual setup
 */
Panel.prototype.orientation = 'left';


/** Display collapse button */
Panel.prototype.collapsible = false;
},{"./src/button":90,"./src/checkbox":91,"./src/color":92,"./src/custom":93,"./src/interval":94,"./src/range":95,"./src/select":96,"./src/switch":97,"./src/text":98,"./src/textarea":99,"./theme/none":101,"add-px-to-style":14,"dom-css":30,"events":3,"get-uid":39,"inherits":45,"insert-styles":47,"is-plain-obj":52,"just-extend":53,"param-case":76,"scope-css":84}],90:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

module.exports = Button
inherits(Button, EventEmitter)

function Button (opts) {
	var this$1 = this;

	if (!(this instanceof Button)) return new Button(opts)

	var input = opts.container.querySelector('.settings-panel-button');
	if (!input) {
		this.element = input = opts.container.appendChild(document.createElement('button'))
		input.className = 'settings-panel-button';
		input.addEventListener('click', function (e) {
			e.preventDefault();
			this$1.emit('input');
			this$1.emit('action');
		})
	}

	this.update(opts);
}

Button.prototype.update = function (opts) {
	this.element.innerHTML = opts.value || opts.label;
	return this;
};

Button.prototype.label = false;
},{"events":3,"inherits":45}],91:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var format = require('param-case')
var extend = require('just-extend');

module.exports = Checkbox
inherits(Checkbox, EventEmitter)

function Checkbox (opts) {
	var this$1 = this;

	if (!(this instanceof Checkbox)) return new Checkbox(opts)

	var that = this;

	if (!this.group) {
		this.group = document.createElement('fieldset');
		this.group.className = 'settings-panel-checkbox-group';
		opts.container.appendChild(this.group);
	}

	//detect multiple options from array value
	if (!opts.options && Array.isArray(opts.value)) {
		opts.options = opts.value;
	}

	//single checkbox
	if (!opts.options) {
		var input = this.group.querySelector('.settings-panel-checkbox');
		var label = this.group.querySelector('.settings-panel-checkbox-label');
		if (!input) {
			this.element = input = this.group.appendChild(document.createElement('input'));
			input.className = 'settings-panel-checkbox';
			this.labelEl = label = this.group.appendChild(document.createElement('label'));
			this.labelEl.innerHTML = '&nbsp;';
			label.className = 'settings-panel-checkbox-label';
			input.onchange = function (data) {
				that.emit('input', data.target.checked)
			}
			setTimeout(function () {
				that.emit('init', input.checked)
			})
		}
	}
	//multiple checkboxes
	else {
		var html = '';

		if (Array.isArray(opts.options)) {
			for (var i = 0; i < opts.options.length; i++) {
				var option = opts.options[i]
				html += createOption(option, option);
			}
		} else {
			for (var key in opts.options) {
				html += createOption(opts.options[key], key);
			}
		}

		this.group.innerHTML = html;

		this.group.addEventListener('change', function () {
			this$1.emit('input', getState());
		});
		setTimeout(function () {
			this$1.emit('init', getState());
		});
	}

	function getState () {
		var v = [];
		[].slice.call(that.group.querySelectorAll('.settings-panel-checkbox')).forEach(function (el) {
			if (el.checked) v.push(el.getAttribute('data-value'));
		});
		return v;
	}

	function createOption (label, value) {
		var htmlFor = "settings-panel-" + (format(opts.panel.id)) + "-" + (format(opts.id)) + "-input-" + (format(value));

		var html = "<input type=\"checkbox\" class=\"settings-panel-checkbox\" " + (value === opts.value ? 'checked' : '') + " id=\"" + htmlFor + "\" name=\"" + (format(opts.id)) + "\" data-value=\"" + value + "\" title=\"" + value + "\"/><label for=\"" + htmlFor + "\" class=\"settings-panel-checkbox-label\" title=\"" + value + "\">" + label + "</label>";
		return html;
	}

	this.update(opts);
}

Checkbox.prototype.update = function (opts) {
	var this$1 = this;

	extend(this, opts);

	if (!this.options) {
		this.labelEl.htmlFor = this.id
		this.element.id = this.id
		this.element.type = 'checkbox';
		this.element.checked = !!this.value;
	}
	else {
		if (!Array.isArray(this.value)) this.value = [this.value];
		var els = [].slice.call(this.group.querySelectorAll('.settings-panel-checkbox'));
		els.forEach(function (el) {
			if (this$1.value.indexOf(el.getAttribute('data-value')) >= 0) {
				el.checked = true;
			}
			else {
				el.checked = false;
			}
		});
	}

	this.group.disabled = !!this.disabled;

	return this;
}
},{"events":3,"inherits":45,"just-extend":53,"param-case":76}],92:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var ColorPicker = require('simple-color-picker')
var inherits = require('inherits')
var css = require('dom-css')
var tinycolor = require('tinycolor2')
var formatParam = require('param-case')
var num = require('input-number')

module.exports = Color
inherits(Color, EventEmitter)

function Color (opts) {
	if (!(this instanceof Color)) return new Color(opts)

	this.update(opts);
}

Color.prototype.update = function (opts) {
	var this$1 = this;

	opts.container.innerHTML = '';

	opts = opts || {}
	opts.format = opts.format || 'rgb'
	opts.value = opts.value || '#123456';
	var icon = opts.container.appendChild(document.createElement('div'))
	//FIXME: this needed to make el vertical-aligned by baseline
	icon.innerHTML = '&nbsp;';
	icon.className = 'settings-panel-color'

	var valueInput = opts.container.appendChild(document.createElement('input'));
	valueInput.id = opts.id;
	valueInput.className = 'settings-panel-color-value';
	num(valueInput);
	valueInput.onchange = function () {
		picker.setColor(valueInput.value);
	};
	valueInput.oninput = function () {
		picker.setColor(valueInput.value);
	};

	if (opts.readonly) {
		valueInput.setAttribute('readonly', true);
	}


	var initial = opts.value
	switch (opts.format) {
		case 'rgb':
			initial = tinycolor(initial).toHexString()
			break
		case 'hex':
			initial = tinycolor(initial).toHexString()
			break
		case 'array':
			initial = tinycolor.fromRatio({r: initial[0], g: initial[1], b: initial[2]}).toHexString()
			break
		default:
			break
	}

	var picker = new ColorPicker({
		el: icon,
		color: initial,
		width: 160,
		height: 120
	});

	picker.$el.style.display = 'none';

	if (!opts.readonly) {
		icon.onmouseover = function () {
			picker.$el.style.display = ''
		}
		icon.onmouseout = function (e) {
			picker.$el.style.display = 'none'
		}
	}

	setTimeout(function () {
		this$1.emit('init', initial)
	});

	picker.onChange(function (hex) {
		var v = format(hex);
		if (v !== valueInput.value) valueInput.value = v;
		css(icon, {backgroundColor: hex})
		this$1.emit('input', format(hex))
	})

	function format (hex) {
		switch (opts.format) {
			case 'rgb':
				return tinycolor(hex).toRgbString()
			case 'hex':
				return tinycolor(hex).toHexString()
			case 'array':
				var rgb = tinycolor(hex).toRgb()
				return [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(function (x) {
					return x.toFixed(2)
				})
			default:
				return hex
		}
	};

	return this;
}
},{"dom-css":30,"events":3,"inherits":45,"input-number":46,"param-case":76,"simple-color-picker":102,"tinycolor2":104}],93:[function(require,module,exports){
/**
 * @module  settings-panel/src/custom
 *
 * A custom html component
 */

'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var extend = require('just-extend')

module.exports = Custom
inherits(Custom, EventEmitter)

function Custom (opts) {
	if (!(this instanceof Custom)) return new Custom(opts);

	//FIXME: these guys force unnecessary events, esp if element returns wrong value
	// opts.container.addEventListener('input', (e) => {
	// 	this.emit('input', e.target.value);
	// });
	// opts.container.addEventListener('change', (e) => {
	// 	this.emit('change', e.target.value);
	// });

	this.update(opts);
}

Custom.prototype.update = function (opts) {
	extend(this, opts);
	var el = this.content;
	if (this.content instanceof Function) {
		el = this.content(this);
		if (!el) return;

		if (typeof el === 'string') {
			this.container.innerHTML = el;
		}
		else if (!this.container.contains(el)) {
			this.container.appendChild(el);
		}
	}
	else if (typeof this.content === 'string') {
		this.container.innerHTML = el;
	}
	else if (this.content instanceof Element && (!this.container.contains(el))) {
		this.container.appendChild(el);
	}
	else {
		//empty content is allowable, in case if user wants to show only label for example
		// throw Error('`content` should be a function returning html element or string');
	}
};
},{"events":3,"inherits":45,"just-extend":53}],94:[function(require,module,exports){
'use strict';

var isNumeric = require('is-numeric')
var css = require('dom-css')
var isMobile = require('is-mobile')()
var format = require('param-case')
var clamp = require('mumath/clamp')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits');
var precision = require('mumath/precision');

module.exports = Range

inherits(Range, EventEmitter);

function Range (opts) {
	if (!(this instanceof Range)) return new Range(opts);

	this.update(opts);
}

Range.prototype.update = function (opts) {
	var this$1 = this;

	var self = this
	var scaleValue, scaleValueInverse, logmin, logmax, logsign, input, handle, panel;

	if (!!opts.step && !!opts.steps) {
		throw new Error('Cannot specify both step and steps. Got step = ' + opts.step + ', steps = ', opts.steps)
	}

	opts.container.innerHTML = '';

	if (opts.step) {
		var prec = precision(opts.step) || 1;
	}
	else {
		var prec = precision( (opts.max - opts.min) / opts.steps ) || 1;
	}

	// Create scale functions for converting to/from the desired scale:
	if (opts.scale === 'log' || opts.log) {
		scaleValue = function (x) {
			return logsign * Math.exp(Math.log(logmin) + (Math.log(logmax) - Math.log(logmin)) * x / 100)
		}
		scaleValueInverse = function (y) {
			return (Math.log(y * logsign) - Math.log(logmin)) * 100 / (Math.log(logmax) - Math.log(logmin))
		}
	} else {
		scaleValue = scaleValueInverse = function (x) { return x }
	}

	if (!Array.isArray(opts.value)) {
		opts.value = []
	}
	if (opts.scale === 'log' || opts.log) {
		// Get options or set defaults:
		opts.max = (isNumeric(opts.max)) ? opts.max : 100
		opts.min = (isNumeric(opts.min)) ? opts.min : 0.1

		// Check if all signs are valid:
		if (opts.min * opts.max <= 0) {
			throw new Error('Log range min/max must have the same sign and not equal zero. Got min = ' + opts.min + ', max = ' + opts.max)
		} else {
			// Pull these into separate variables so that opts can define the *slider* mapping
			logmin = opts.min
			logmax = opts.max
			logsign = opts.min > 0 ? 1 : -1

			// Got the sign so force these positive:
			logmin = Math.abs(logmin)
			logmax = Math.abs(logmax)

			// These are now simply 0-100 to which we map the log range:
			opts.min = 0
			opts.max = 100

			// Step is invalid for a log range:
			if (isNumeric(opts.step)) {
				throw new Error('Log may only use steps (integer number of steps), not a step value. Got step =' + opts.step)
			}
			// Default step is simply 1 in linear slider space:
			opts.step = 1
		}

		opts.value = [
			scaleValueInverse(isNumeric(opts.value[0]) ? opts.value[0] : scaleValue(opts.min + (opts.max - opts.min) * 0.25)),
			scaleValueInverse(isNumeric(opts.value[1]) ? opts.value[1] : scaleValue(opts.min + (opts.max - opts.min) * 0.75))
		]

		if (scaleValue(opts.value[0]) * scaleValue(opts.max) <= 0 || scaleValue(opts.value[1]) * scaleValue(opts.max) <= 0) {
			throw new Error('Log range initial value must have the same sign as min/max and must not equal zero. Got initial value = [' + scaleValue(opts.value[0]) + ', ' + scaleValue(opts.value[1]) + ']')
		}
	} else {
		// If linear, this is much simpler:
		opts.max = (isNumeric(opts.max)) ? opts.max : 100
		opts.min = (isNumeric(opts.min)) ? opts.min : 0
		opts.step = (isNumeric(opts.step)) ? opts.step : (opts.max - opts.min) / 100

		opts.value = [
			isNumeric(opts.value[0]) ? opts.value[0] : (opts.min + opts.max) * 0.25,
			isNumeric(opts.value[1]) ? opts.value[1] : (opts.min + opts.max) * 0.75
		]
	}

	// If we got a number of steps, use that instead:
	if (isNumeric(opts.steps)) {
		opts.step = isNumeric(opts.steps) ? (opts.max - opts.min) / opts.steps : opts.step
	}

	// Quantize the initial value to the requested step:
	opts.value[0] = opts.min + opts.step * Math.round((opts.value[0] - opts.min) / opts.step)
	opts.value[1] = opts.min + opts.step * Math.round((opts.value[1] - opts.min) / opts.step)


	//create DOM
	var lValue = require('./value')({
		container: opts.container,
		value: scaleValue(opts.value[0]).toFixed(prec),
		type: 'text',
		left: true,
		disabled: opts.disabled,
		id: opts.id,
		className: 'settings-panel-interval-value settings-panel-interval-value--left',
		input: function (v) {
			//TODO
		}
	})

	panel = opts.container.parentNode;

	input = opts.container.appendChild(document.createElement('span'))
	input.id = 'settings-panel-interval'
	input.className = 'settings-panel-interval'

	handle = document.createElement('span')
	handle.className = 'settings-panel-interval-handle'
	handle.value = 50;
	handle.min = 0;
	handle.max = 50;
	input.appendChild(handle)

	var value = opts.value

	// Display the values:
	var rValue = require('./value')({
		container: opts.container,
		disabled: opts.disabled,
		value: scaleValue(opts.value[1]).toFixed(prec),
		type: 'text',
		className: 'settings-panel-interval-value settings-panel-interval-value--right',
		input: function (v) {
			//TODO
		}
	})

	function setHandleCSS () {
		var left = ((value[0] - opts.min) / (opts.max - opts.min) * 100);
		var right = (100 - (value[1] - opts.min) / (opts.max - opts.min) * 100);
		css(handle, {
			left:  left + '%',
			width: (100 - left - right) + '%'
		});
		opts.container.style.setProperty('--low', left + '%');
		opts.container.style.setProperty('--high', 100 - right + '%');
		lValue.style.setProperty('--value', left + '%');
		rValue.style.setProperty('--value', 100 - right + '%');
	}

	// Initialize CSS:
	setHandleCSS()
	// An index to track what's being dragged:
	var activeIndex = -1

	function mouseX (ev) {
		// Get mouse/touch position in page coords relative to the container:
		return (ev.touches && ev.touches[0] || ev).pageX - input.getBoundingClientRect().left
	}

	function setActiveValue (fraction) {
		if (activeIndex === -1) {
			return
		}

		// Get the position in the range [0, 1]:
		var lofrac = (value[0] - opts.min) / (opts.max - opts.min)
		var hifrac = (value[1] - opts.min) / (opts.max - opts.min)

		// Clip against the other bound:
		if (activeIndex === 0) {
			fraction = Math.min(hifrac, fraction)
		} else {
			fraction = Math.max(lofrac, fraction)
		}

		// Compute and quantize the new value:
		var newValue = opts.min + Math.round((opts.max - opts.min) * fraction / opts.step) * opts.step

		// Update value, in linearized coords:
		value[activeIndex] = newValue

		// Update and send the event:
		setHandleCSS()
		input.oninput()
	}

	var mousemoveListener = function (ev) {
		if (ev.target === input || ev.target === handle) ev.preventDefault()

		var fraction = clamp(mouseX(ev) / input.offsetWidth, 0, 1)

		setActiveValue(fraction)
	}

	var mouseupListener = function (ev) {
		panel.classList.remove('settings-panel-interval-dragging')

		document.removeEventListener(isMobile ? 'touchmove' : 'mousemove', mousemoveListener)
		document.removeEventListener(isMobile ? 'touchend' : 'mouseup', mouseupListener)

		activeIndex = -1
	}

	input.addEventListener(isMobile ? 'touchstart' : 'mousedown', function (ev) {
		// Tweak control to make dragging experience a little nicer:
		panel.classList.add('settings-panel-interval-dragging')

		// Get mouse position fraction:
		var fraction = clamp(mouseX(ev) / input.offsetWidth, 0, 1)

		// Get the current fraction of position --> [0, 1]:
		var lofrac = (value[0] - opts.min) / (opts.max - opts.min)
		var hifrac = (value[1] - opts.min) / (opts.max - opts.min)

		// This is just for making decisions, so perturb it ever
		// so slightly just in case the bounds are numerically equal:
		lofrac -= Math.abs(opts.max - opts.min) * 1e-15
		hifrac += Math.abs(opts.max - opts.min) * 1e-15

		// Figure out which is closer:
		var lodiff = Math.abs(lofrac - fraction)
		var hidiff = Math.abs(hifrac - fraction)

		activeIndex = lodiff < hidiff ? 0 : 1

		// Attach this to *document* so that we can still drag if the mouse
		// passes outside the container:
		document.addEventListener(isMobile ? 'touchmove' : 'mousemove', mousemoveListener)
		document.addEventListener(isMobile ? 'touchend' : 'mouseup', mouseupListener)
	})

	setTimeout(function () {
		var scaledLValue = scaleValue(value[0])
		var scaledRValue = scaleValue(value[1])
		lValue.value = scaledLValue.toFixed(prec)
		rValue.value = scaledRValue.toFixed(prec)
		this$1.emit('init', [scaledLValue, scaledRValue])
	})

	input.oninput = function () {
		var scaledLValue = scaleValue(value[0])
		var scaledRValue = scaleValue(value[1])
		lValue.value = scaledLValue.toFixed(prec)
		rValue.value = scaledRValue.toFixed(prec)
		this$1.emit('input', [scaledLValue, scaledRValue])
	}

	return this;
}
},{"./value":100,"dom-css":30,"events":3,"inherits":45,"is-mobile":49,"is-numeric":51,"mumath/clamp":67,"mumath/precision":72,"param-case":76}],95:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var isNumeric = require('is-numeric')
var css = require('dom-css')
var format = require('param-case')
var precision = require('mumath/precision')

module.exports = Range
inherits(Range, EventEmitter)

function Range (opts) {
	if (!(this instanceof Range)) return new Range(opts);

	this.update(opts);
}

Range.prototype.update = function (opts) {
	var this$1 = this;

	var scaleValue, scaleValueInverse, logmin, logmax, logsign

	if (!!opts.step && !!opts.steps) {
		throw new Error('Cannot specify both step and steps. Got step = ' + opts.step + ', steps = ', opts.steps)
	}

	opts.container.innerHTML = '';

	if (!opts.container) opts.container = document.body;

	var input = opts.container.querySelector('.settings-panel-range');

	if (!input) {
		input = opts.container.appendChild(document.createElement('input'))
		input.type = 'range'
		input.className = 'settings-panel-range'
	}

	if (opts.disabled) input.disabled = true;

	if (opts.log) opts.scale = 'log';

	// Create scale functions for converting to/from the desired scale:
	if (opts.scale === 'log') {
		scaleValue = function (x) {
			return logsign * Math.exp(Math.log(logmin) + (Math.log(logmax) - Math.log(logmin)) * x / 100)
		}
		scaleValueInverse = function (y) {
			return (Math.log(y * logsign) - Math.log(logmin)) * 100 / (Math.log(logmax) - Math.log(logmin))
		}
	} else {
		scaleValue = scaleValueInverse = function (x) { return x }
	}

	// Get initial value:
	if (opts.scale === 'log') {
		// Get options or set defaults:
		opts.max = (isNumeric(opts.max)) ? opts.max : 100
		opts.min = (isNumeric(opts.min)) ? opts.min : 0.1

		// Check if all signs are valid:
		if (opts.min * opts.max <= 0) {
			throw new Error('Log range min/max must have the same sign and not equal zero. Got min = ' + opts.min + ', max = ' + opts.max)
		} else {
			// Pull these into separate variables so that opts can define the *slider* mapping
			logmin = opts.min
			logmax = opts.max
			logsign = opts.min > 0 ? 1 : -1

			// Got the sign so force these positive:
			logmin = Math.abs(logmin)
			logmax = Math.abs(logmax)

			// These are now simply 0-100 to which we map the log range:
			opts.min = 0
			opts.max = 100

			// Step is invalid for a log range:
			if (isNumeric(opts.step)) {
				throw new Error('Log may only use steps (integer number of steps), not a step value. Got step =' + opts.step)
			}
			// Default step is simply 1 in linear slider space:
			opts.step = 1
		}

		opts.value = scaleValueInverse(isNumeric(opts.value) ? opts.value : scaleValue((opts.min + opts.max) * 0.5))

		if (opts.value * scaleValueInverse(opts.max) <= 0) {
			throw new Error('Log range initial value must have the same sign as min/max and must not equal zero. Got initial value = ' + opts.value)
		}
	} else {
		// If linear, this is much simpler:
		opts.max = (isNumeric(opts.max)) ? opts.max : 100
		opts.min = (isNumeric(opts.min)) ? opts.min : 0
		opts.step = (isNumeric(opts.step)) ? opts.step : (opts.max - opts.min) / 100

		opts.value = isNumeric(opts.value) ? opts.value : (opts.min + opts.max) * 0.5
	}

	// If we got a number of steps, use that instead:
	if (isNumeric(opts.steps)) {
		opts.step = isNumeric(opts.steps) ? (opts.max - opts.min) / opts.steps : opts.step
	}

	// Quantize the initial value to the requested step:
	var initialStep = Math.round((opts.value - opts.min) / opts.step)
	opts.value = opts.min + opts.step * initialStep

	//preser container data for display
	opts.container.setAttribute('data-min', opts.min);
	opts.container.setAttribute('data-max', opts.max);

	if (opts.scale === 'log') {
		//FIXME: not every log is of precision 3
		var prec = opts.precision != null ? opts.precision : 3;
	}
	else {
		if (opts.step) {
			var prec = opts.precision != null ? opts.precision : precision(opts.step);
		}
		else if (opts.steps) {
			var prec = opts.precision != null ? opts.precision : precision( (opts.max - opts.min) / opts.steps );
		}
	}

	var value = require('./value')({
		id: opts.id,
		container: opts.container,
		className: 'settings-panel-range-value',
		value: scaleValue(opts.value).toFixed(prec),
		type: opts.scale === 'log' ? 'text' : 'number',
		min: scaleValue(opts.min),
		max: scaleValue(opts.max),
		disabled: opts.disabled,
		//FIXME: step here might vary
		step: opts.step,
		input: function (v) {
			var scaledValue = scaleValueInverse(v)
			input.value = scaledValue;
			value.title = input.value;
			// value.value = v
			this$1.emit('input', v);
			input.setAttribute('value', scaledValue.toFixed(0))
			opts.container.style.setProperty('--value', scaledValue + '%');
			opts.container.style.setProperty('--coef', scaledValue/100);
		}
	});

	// Set value on the input itself:
	input.min = opts.min
	input.max = opts.max
	input.step = opts.step
	input.value = opts.value
	var v = 100 * (opts.value - opts.min) / (opts.max - opts.min);
	input.setAttribute('value', v.toFixed(0))
	opts.container.style.setProperty('--value', v + '%');
	opts.container.style.setProperty('--coef', v/100);

	setTimeout(function () {
		this$1.emit('init', parseFloat(value.value))
	});

	input.oninput = function (data) {
		var scaledValue = scaleValue(parseFloat(data.target.value));
		value.value = scaledValue.toFixed(prec);
		var v = 100 * (data.target.value - opts.min) / (opts.max - opts.min);
		input.setAttribute('value', v.toFixed(0));
		opts.container.style.setProperty('--value', v + '%');
		opts.container.style.setProperty('--coef', v/100);
		value.title = scaledValue;
		this$1.emit('input', scaledValue);
	}

	return this;
}
},{"./value":100,"dom-css":30,"events":3,"inherits":45,"is-numeric":51,"mumath/precision":72,"param-case":76}],96:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var format = require('param-case')

module.exports = Select
inherits(Select, EventEmitter)

function Select (opts) {
	if (!(this instanceof Select)) return new Select(opts);

	this.update(opts);
}

Select.prototype.update = function (opts) {
	var this$1 = this;

	var i, container, input, downTriangle, upTriangle, key, option, el, keys

	opts.container.innerHTML = '';

	input = document.createElement('select')
	input.id = opts.id
	input.className = 'settings-panel-select';

	if (opts.disabled) input.disabled = true;

	downTriangle = document.createElement('span')
	downTriangle.className = 'settings-panel-select-triangle settings-panel-select-triangle--down'

	upTriangle = document.createElement('span')
	upTriangle.className = 'settings-panel-select-triangle settings-panel-select-triangle--up'

	if (Array.isArray(opts.options)) {
		for (var i$1 = 0; i$1 < opts.options.length; i$1++) {
			option = opts.options[i$1]
			el = document.createElement('option')
			el.value = el.textContent = option
			if (opts.value === option) {
				el.selected = 'selected'
			}
			input.appendChild(el)
		}
	} else {
		keys = Object.keys(opts.options)
		for (var i$2 = 0; i$2 < keys.length; i$2++) {
			key = keys[i$2]
			el = document.createElement('option')
			el.value = key
			if (opts.value === key) {
				el.selected = 'selected'
			}
			el.textContent = opts.options[key]
			input.appendChild(el)
		}
	}

	opts.container.appendChild(input)
	opts.container.appendChild(downTriangle)
	opts.container.appendChild(upTriangle)

	setTimeout(function () {
		this$1.emit('init', opts.value)
	})

	input.onchange = function (data) {
		this$1.emit('input', data.target.value)
	}

	return this;
}
},{"events":3,"inherits":45,"param-case":76}],97:[function(require,module,exports){
'use strict';

var inherits = require('inherits');
var Emitter = require('events').EventEmitter;
var format = require('param-case');
var extend = require('just-extend');

module.exports = Switch;

inherits(Switch, Emitter);

function Switch (opts) {
	var this$1 = this;

	if (!(this instanceof Switch)) return new Switch(opts);

	this.switch = opts.container.querySelector('.settings-panel-switch');

	if (!this.switch) {
		this.switch = document.createElement('fieldset');
		this.switch.className = 'settings-panel-switch';
		opts.container.appendChild(this.switch);

		var html = '';

		if (Array.isArray(opts.options)) {
			for (var i = 0; i < opts.options.length; i++) {
				var option = opts.options[i]
				html += createOption(option, option);
			}
		} else {
			for (var key in opts.options) {
				html += createOption(opts.options[key], key);
			}
		}

		this.switch.innerHTML = html;

		this.switch.onchange = function (e) {
			this$1.emit('input', e.target.getAttribute('data-value'));
		}

		setTimeout(function () {
			this$1.emit('init', opts.value)
		})
	}

	this.switch.id = opts.id;

	this.update(opts);

	function createOption (label, value) {
		var htmlFor = "settings-panel-" + (format(opts.panel.id)) + "-" + (format(opts.id)) + "-input-" + (format(value));

		var html = "<input type=\"radio\" class=\"settings-panel-switch-input\" " + (value === opts.value ? 'checked' : '') + " id=\"" + htmlFor + "\" name=\"" + (format(opts.id)) + "\" data-value=\"" + value + "\" title=\"" + value + "\"/><label for=\"" + htmlFor + "\" class=\"settings-panel-switch-label\" title=\"" + value + "\">" + label + "</label>";
		return html;
	}
}

Switch.prototype.update = function (opts) {
	return this;
}
},{"events":3,"inherits":45,"just-extend":53,"param-case":76}],98:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var css = require('dom-css')
var num = require('input-number');
var extend = require('just-extend');

module.exports = Text
inherits(Text, EventEmitter)

function Text (opts) {
	var this$1 = this;

	if (!(this instanceof Text)) return new Text(opts)

	var element = opts.container.querySelector('.settings-panel-text');

	if (!element) {
		element = opts.container.appendChild(document.createElement('input'));
		element.className = 'settings-panel-text';
		num(element);

		if (opts.placeholder) element.placeholder = opts.placeholder;

		this.element = element;

		element.oninput = function (data) {
			this$1.emit('input', data.target.value)
		}
		setTimeout(function () {
			this$1.emit('init', element.value)
		});
	}

	this.update(opts);
}

Text.prototype.update = function (opts) {
	extend(this, opts);
	this.element.type = this.type
	this.element.id = this.id
	this.element.value = this.value || ''
	this.element.disabled = !!this.disabled;
	return this;
}
},{"dom-css":30,"events":3,"inherits":45,"input-number":46,"just-extend":53}],99:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var css = require('dom-css')
var autosize = require('autosize');
var extend = require('just-extend');

module.exports = Textarea
inherits(Textarea, EventEmitter)

function Textarea (opts) {
	var this$1 = this;

	if (!(this instanceof Textarea)) return new Textarea(opts)

	//<textarea rows="1" placeholder="${param.placeholder || 'value...'}" id="${param.name}" class="prama-input prama-textarea" title="${param.value}">${param.value}</textarea>
	var input = opts.container.querySelector('.settings-panel-textarea');
	if (!input) {
		input = opts.container.appendChild(document.createElement('textarea'));
		input.className = 'settings-panel-textarea';

		this.element = input;

		setTimeout(function () {
			this$1.emit('init', input.value)
			autosize.update(input);
		})

		input.oninput = function (data) {
			this$1.emit('input', data.target.value)
		}

		autosize(input);
	}

	this.update(opts);
}

Textarea.prototype.update = function (opts) {
	extend(this, opts);

	this.element.rows = this.rows || 1;
	this.element.placeholder = this.placeholder || '';
	this.element.id = this.id

	this.element.value = this.value || '';

	this.element.disabled = !!this.disabled;

	autosize.update(this.element);

	return this;
}
},{"autosize":17,"dom-css":30,"events":3,"inherits":45,"just-extend":53}],100:[function(require,module,exports){
'use strict';

var num = require('input-number');

module.exports = function (opts) {
  opts = opts || {}
  var value = document.createElement('input');

  num(value, opts);

  if (opts.input) {
    value.addEventListener('input', function () {
      var v = value.value;
      if (opts.type === 'number') v = parseFloat(v);
      opts.input(v)
    })
  }
  if (opts.change) {
    value.addEventListener('change', function () {
      var v = value.value;
      if (opts.type === 'number') v = parseFloat(v);
      opts.change(v)
    })
  }

  if (opts.disabled) value.disabled = true;

  value.value = opts.value

  if (opts.id) value.id = opts.id;
  value.className = 'settings-panel-value';
  if (opts.className) value.className += ' ' + opts.className;
  opts.container.appendChild(value);

  //add tip holder after value
  var tip = opts.container.appendChild(document.createElement('div'));
  tip.className = 'settings-panel-value-tip';

  return value
}
},{"input-number":46}],101:[function(require,module,exports){
/**
 * @module  settings-panel/theme/none
 */
'use strict';

var px = require('add-px-to-style');

module.exports = none;

none.palette = ['white', 'black'];
none.fontSize = 13;
none.fontFamily = 'sans-serif';
none.labelWidth = '9em';
none.inputHeight = 2;
none.padding = 1/5;

function none (opts) {
	opts = opts || {};
	var fs = opts.fontSize || none.fontSize;
	var font = opts.fontFamily || none.fontFamily;
	var h = opts.inputHeight || none.inputHeight;
	var labelWidth = opts.labelWidth || none.labelWidth;
	var padding = opts.padding || none.padding;
	var palette = opts.palette || none.palette;
	var white = palette[0];
	var black = palette[palette.length - 1];

	if (/[-0-9.]*/.test(fs)) fs = parseFloat(fs);

	//just size part
	return ("\n\t\t:host {\n\t\t\tbackground: " + white + ";\n\t\t\tcolor: " + black + ";\n\t\t\tfont-family: " + font + ";\n\t\t\tfont-size: " + (px('font-size', fs)) + ";\n\t\t\tpadding: " + (h*2.5*padding) + "em;\n\t\t}\n\n\t\t.settings-panel-title {\n\t\t\tmin-height: " + h + "em;\n\t\t\tline-height: 1.5;\n\t\t\ttext-align: left;\n\t\t\tfont-size: " + (px('font-size',fs*1.333)) + ";\n\t\t\tpadding: " + (h * 2 * padding / 1.333) + "em " + (h * padding / 1.333) + "em;\n\t\t\tmin-height: " + (h/1.333) + "em;\n\t\t\tmargin: 0;\n\t\t}\n\n\t\t.settings-panel-field {\n\t\t\tpadding: " + (h * padding) + "em;\n\t\t}\n\n\t\t:host.settings-panel-orientation-left .settings-panel-label,\n\t\t:host .settings-panel-orientation-left .settings-panel-label,\n\t\t:host.settings-panel-orientation-right .settings-panel-label,\n\t\t:host .settings-panel-orientation-right .settings-panel-label {\n\t\t\twidth: " + (px('width', labelWidth)) + ";\n\t\t}\n\t\t:host.settings-panel-orientation-bottom .settings-panel-label {\n\t\t\tborder-top-width: " + h + "em;\n\t\t}\n\t\t:host.settings-panel-orientation-bottom .settings-panel-label + .settings-panel-input {\n\t\t\ttop: " + (h/8) + "em;\n\t\t}\n\t\t:host.settings-panel-orientation-left .settings-panel-label {\n\t\t\tpadding-right: " + (h/2) + "em;\n\t\t}\n\t\t:host.settings-panel-orientation-right .settings-panel-label {\n\t\t\tpadding-left: " + (h/2) + "em;\n\t\t}\n\t\t:host.settings-panel-orientation-right .settings-panel-label + .settings-panel-input {\n\t\t\twidth: calc(100% - " + labelWidth + ");\n\t\t}\n\n\t\t.settings-panel-text,\n\t\t.settings-panel-textarea,\n\t\t.settings-panel-range,\n\t\t.settings-panel-interval,\n\t\t.settings-panel-select,\n\t\t.settings-panel-color,\n\t\t.settings-panel-color-value,\n\t\t.settings-panel-value {\n\t\t\theight: " + h + "em;\n\t\t}\n\n\t\t.settings-panel-button,\n\t\t.settings-panel-input,\n\t\t.settings-panel-switch,\n\t\t.settings-panel-checkbox-group,\n\t\t.settings-panel-switch-label {\n\t\t\tmin-height: " + h + "em;\n\t\t}\n\t\t.settings-panel-input,\n\t\t.settings-panel-switch,\n\t\t.settings-panel-select,\n\t\t.settings-panel-checkbox-group,\n\t\t.settings-panel-switch-label {\n\t\t\tline-height: " + h + "em;\n\t\t}\n\n\t\t.settings-panel-switch-label,\n\t\t.settings-panel-checkbox,\n\t\t.settings-panel-checkbox-label,\n\t\t.settings-panel-button {\n\t\t\tcursor: pointer;\n\t\t}\n\n\t\t.settings-panel-range::-webkit-slider-thumb {\n\t\t\tcursor: ew-resize;\n\t\t}\n\t\t.settings-panel-range::-moz-range-thumb {\n\t\t\tcursor: ew-resize;\n\t\t}\n\t\t.settings-panel-range::-ms-track {\n\t\t\tcursor: ew-resize;\n\t\t}\n\t\t.settings-panel-range::-ms-thumb {\n\t\t\tcursor: ew-resize;\n\t\t}\n\n\t\t/* Default triangle styles are from control theme, just set display: block */\n\t\t.settings-panel-select-triangle {\n\t\t\tdisplay: none;\n\t\t\tposition: absolute;\n\t\t\tborder-right: .3em solid transparent;\n\t\t\tborder-left: .3em solid transparent;\n\t\t\tline-height: " + h + "em;\n\t\t\tright: 2.5%;\n\t\t\theight: 0;\n\t\t\tz-index: 1;\n\t\t\tpointer-events: none;\n\t\t}\n\t\t.settings-panel-select-triangle--up {\n\t\t\ttop: " + (h/2) + "em;\n\t\t\tmargin-top: -" + (h/4 + h/24) + "em;\n\t\t\tborder-bottom: " + (h/4) + "em solid;\n\t\t\tborder-top: 0px transparent;\n\t\t}\n\t\t.settings-panel-select-triangle--down {\n\t\t\ttop: " + (h/2) + "em;\n\t\t\tmargin-top: " + (h/24) + "em;\n\t\t\tborder-top: " + (h/4) + "em solid;\n\t\t\tborder-bottom: .0 transparent;\n\t\t}\n\n\t\t:host hr {\n\t\t\topacity: .5;\n\n\t\t\tcolor: " + black + "\n\t\t}\n\t");
}
},{"add-px-to-style":14}],102:[function(require,module,exports){
'use strict';

var bindAll = require('lodash.bindall');
var transform = require('dom-transform');
var tinycolor = require('tinycolor2');
var Emitter = require('component-emitter');
var isNumber = require('is-number');
var clamp = require('./src/utils/maths/clamp');

/**
 * Creates a new Colorpicker
 * @param {Object} options
 * @param {String|Number|Object} options.color The default color that the colorpicker will display. Default is #FFFFFF. It can be a hexadecimal number or an hex String.
 * @param {String|Number|Object} options.background The background color of the colorpicker. Default is transparent. It can be a hexadecimal number or an hex String.
 * @param {DomElement} options.el A dom node to add the colorpicker to. You can also use `colorPicker.appendTo(domNode)` afterwards if you prefer.
 * @param {Number} options.width Desired width of the color picker. Default is 175.
 * @param {Number} options.height Desired height of the color picker. Default is 150.
 */
function SimpleColorPicker(options) {
  // options
  options = options || {};

  // properties
  this.color = null;
  this.width = 0;
  this.height = 0;
  this.hue = 0;
  this.choosing = false;
  this.position = {x: 0, y: 0};
  this.huePosition = 0;
  this.saturationWidth = 0;
  this.maxHue = 0;
  this.inputIsNumber = false;

  // bind methods to scope (only if needed)
  bindAll(this, '_onSaturationMouseMove', '_onSaturationMouseDown', '_onSaturationMouseUp', '_onHueMouseDown', '_onHueMouseUp', '_onHueMouseMove');

  // create dom
  this.$el = document.createElement('div');
  this.$el.className = 'Scp';
  this.$el.innerHTML = [
    '<div class="Scp-saturation">',
      '<div class="Scp-brightness"></div>',
      '<div class="Scp-sbSelector"></div>',
    '</div>',
    '<div class="Scp-hue">',
      '<div class="Scp-hSelector"></div>',
    '</div>'
  ].join('\n');

  // dom accessors
  this.$saturation = this.$el.querySelector('.Scp-saturation');
  this.$hue = this.$el.querySelector('.Scp-hue');
  this.$sbSelector = this.$el.querySelector('.Scp-sbSelector');
  this.$hSelector = this.$el.querySelector('.Scp-hSelector');

  // event listeners
  this.$saturation.addEventListener('mousedown', this._onSaturationMouseDown);
  this.$saturation.addEventListener('touchstart', this._onSaturationMouseDown);
  this.$hue.addEventListener('mousedown', this._onHueMouseDown);
  this.$hue.addEventListener('touchstart', this._onHueMouseDown);

  // some styling and DOMing from options
  if (options.el) {
    this.appendTo(options.el);
  }
  if (options.background) {
    this.setBackgroundColor(options.background);
  }
  this.setSize(options.width || 175, options.height || 150);
  this.setColor(options.color);

  return this;
}

Emitter(SimpleColorPicker.prototype);

/* =============================================================================
  Public API
============================================================================= */
/**
 * Add the colorPicker instance to a domElement.
 * @param  {domElement} domElement
 * @return {colorPicker} returns itself for chaining purpose
 */
SimpleColorPicker.prototype.appendTo = function(domElement) {
  domElement.appendChild(this.$el);
  return this;
};

/**
 * Removes colorpicker from is parent and kill all listeners.
 * Call this method for proper destroy.
 */
SimpleColorPicker.prototype.remove = function() {
  this.$saturation.removeEventListener('mousedown', this._onSaturationMouseDown);
  this.$saturation.removeEventListener('touchstart', this._onSaturationMouseDown);
  this.$hue.removeEventListener('mousedown', this._onHueMouseDown);
  this.$hue.removeEventListener('touchstart', this._onHueMouseDown);
  this._onSaturationMouseUp();
  this._onHueMouseUp();
  this.off();
  if (this.$el.parentNode) {
    this.$el.parentNode.removeChild(this.$el);
  }
};

/**
 * Manually set the current color of the colorpicker. This is the method
 * used on instantiation to convert `color` option to actual color for
 * the colorpicker. Param can be a hexadecimal number or an hex String.
 * @param {String|Number} color hex color desired
 */
SimpleColorPicker.prototype.setColor = function(color) {
  if(isNumber(color)) {
    this.inputIsNumber = true;
    color = '#' + ('00000' + (color | 0).toString(16)).substr(-6);
  }
  else {
    this.inputIsNumber = false;
  }
  this.color = tinycolor(color);

  var hsvColor = this.color.toHsv();

  if(!isNaN(hsvColor.h)) {
    this.hue = hsvColor.h;
  }

  this._moveSelectorTo(this.saturationWidth * hsvColor.s, (1 - hsvColor.v) * this.height);
  this._moveHueTo((1 - (this.hue / 360)) * this.height);

  this._updateHue();
  return this;
};

/**
 * Set size of the color picker for a given width and height. Note that
 * a padding of 5px will be added if you chose to use the background option
 * of the constructor.
 * @param {Number} width
 * @param {Number} height
 */
SimpleColorPicker.prototype.setSize = function(width, height) {
  this.width = width;
  this.height = height;
  this.$el.style.width = this.width + 'px';
  this.$el.style.height = this.height + 'px';
  this.saturationWidth = this.width - 25;
  this.maxHue = this.height - 2;
  return this;
};

/**
 * Set the background color of the colorpicker. It also adds a 5px padding
 * for design purpose.
 * @param {String|Number} color hex color desired for background
 */
SimpleColorPicker.prototype.setBackgroundColor = function(color) {
  if(isNumber(color)) {
    color = '#' + ('00000' + (color | 0).toString(16)).substr(-6);
  }
  this.$el.style.padding = '5px';
  this.$el.style.background = tinycolor(color).toHexString();
};

/**
 * Removes background of the colorpicker if previously set. It's no use
 * calling this method if you didn't set the background option on start
 * or if you didn't call setBackgroundColor previously.
 */
SimpleColorPicker.prototype.setNoBackground = function() {
  this.$el.style.padding = '0px';
  this.$el.style.background = 'none';
};

/**
 * Registers callback to the update event of the colorpicker.
 * ColorPicker inherits from [component/emitter](https://github.com/component/emitter)
 * so you could do the same thing by calling `colorPicker.on('update');`
 * @param  {Function} callback
 * @return {colorPicker} returns itself for chaining purpose
 */
SimpleColorPicker.prototype.onChange = function(callback) {
  this.on('update', callback);
  this.emit('update', this.getHexString());
  return this;
};

/* =============================================================================
  Color getters
============================================================================= */
/**
 * Main color getter, will return a formatted color string depending on input
 * or a number depending on the last setColor call.
 * @return {Number|String}
 */
SimpleColorPicker.prototype.getColor = function() {
  if(this.inputIsNumber) {
    return this.getHexNumber();
  }
  return this.color.toString();
};

/**
 * Returns color as css hex string (ex: '#FF0000').
 * @return {String}
 */
SimpleColorPicker.prototype.getHexString = function() {
  return this.color.toHexString().toUpperCase();
};

/**
 * Returns color as number (ex: 0xFF0000).
 * @return {Number}
 */
SimpleColorPicker.prototype.getHexNumber = function() {
  return parseInt(this.color.toHex(), 16);
};

/**
 * Returns color as {r: 255, g: 0, b: 0} object.
 * @return {Object}
 */
SimpleColorPicker.prototype.getRGB = function() {
  return this.color.toRgb();
};

/**
 * Returns color as {h: 100, s: 1, v: 1} object.
 * @return {Object}
 */
SimpleColorPicker.prototype.getHSV = function() {
  return this.color.toHsv();
};

/**
 * Returns true if color is perceived as dark
 * @return {Boolean}
 */
SimpleColorPicker.prototype.isDark = function() {
  return this.color.isDark();
};

/**
 * Returns true if color is perceived as light
 * @return {Boolean}
 */
SimpleColorPicker.prototype.isLight = function() {
  return this.color.isLight();
};

/* =============================================================================
  "Private" Methods LOL silly javascript
============================================================================= */
SimpleColorPicker.prototype._moveSelectorTo = function(x, y) {
  this.position.x = clamp(x, 0, this.saturationWidth);
  this.position.y = clamp(y, 0, this.height);

  transform(this.$sbSelector, {
    x: this.position.x,
    y: this.position.y
  });

};

SimpleColorPicker.prototype._updateColorFromPosition = function() {
  this.color = tinycolor({h: this.hue, s: this.position.x / this.saturationWidth, v: 1 - (this.position.y / this.height)});
  this._updateColor();
};

SimpleColorPicker.prototype._moveHueTo = function(y) {
  this.huePosition = clamp(y, 0, this.maxHue);

  transform(this.$hSelector, {
    y: this.huePosition
  });

};

SimpleColorPicker.prototype._updateHueFromPosition = function() {
  var hsvColor = this.color.toHsv();
  this.hue = 360 * (1 - (this.huePosition / this.maxHue));
  this.color = tinycolor({h: this.hue, s: hsvColor.s, v: hsvColor.v});
  this._updateHue();
};

SimpleColorPicker.prototype._updateHue = function() {
  var hueColor = tinycolor({h: this.hue, s: 1, v: 1});
  this.$saturation.style.background = 'linear-gradient(to right, #fff 0%, ' + hueColor.toHexString() + ' 100%)';
  this._updateColor();
};

SimpleColorPicker.prototype._updateColor = function() {
  this.$sbSelector.style.background = this.color.toHexString();
  this.$sbSelector.style.borderColor = this.color.isDark() ? '#FFF' : '#000';
  this.emit('update', this.color.toHexString());
};

/* =============================================================================
  Events handlers
============================================================================= */
SimpleColorPicker.prototype._onSaturationMouseDown = function(e) {
  this.choosing = true;
  var sbOffset = this.$saturation.getBoundingClientRect();
  var xPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientX : e.clientX;
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveSelectorTo(xPos - sbOffset.left, yPos - sbOffset.top);
  this._updateColorFromPosition();
  window.addEventListener('mouseup', this._onSaturationMouseUp);
  window.addEventListener('touchend', this._onSaturationMouseUp);
  window.addEventListener('mousemove', this._onSaturationMouseMove);
  window.addEventListener('touchmove', this._onSaturationMouseMove);
  e.preventDefault();
};

SimpleColorPicker.prototype._onSaturationMouseMove = function(e) {
  var sbOffset = this.$saturation.getBoundingClientRect();
  var xPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientX : e.clientX;
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveSelectorTo(xPos - sbOffset.left, yPos - sbOffset.top);
  this._updateColorFromPosition();
};

SimpleColorPicker.prototype._onSaturationMouseUp = function() {
  this.choosing = false;
  window.removeEventListener('mouseup', this._onSaturationMouseUp);
  window.removeEventListener('touchend', this._onSaturationMouseUp);
  window.removeEventListener('mousemove', this._onSaturationMouseMove);
  window.removeEventListener('touchmove', this._onSaturationMouseMove);
};

SimpleColorPicker.prototype._onHueMouseDown = function(e) {
  this.choosing = true;
  var hOffset = this.$hue.getBoundingClientRect();
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveHueTo(yPos - hOffset.top);
  this._updateHueFromPosition();
  window.addEventListener('mouseup', this._onHueMouseUp);
  window.addEventListener('touchend', this._onHueMouseUp);
  window.addEventListener('mousemove', this._onHueMouseMove);
  window.addEventListener('touchmove', this._onHueMouseMove);
  e.preventDefault();
};

SimpleColorPicker.prototype._onHueMouseMove = function(e) {
  var hOffset = this.$hue.getBoundingClientRect();
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveHueTo(yPos - hOffset.top);
  this._updateHueFromPosition();
};

SimpleColorPicker.prototype._onHueMouseUp = function() {
  this.choosing = false;
  window.removeEventListener('mouseup', this._onHueMouseUp);
  window.removeEventListener('touchend', this._onHueMouseUp);
  window.removeEventListener('mousemove', this._onHueMouseMove);
  window.removeEventListener('touchmove', this._onHueMouseMove);
};

module.exports = SimpleColorPicker;

},{"./src/utils/maths/clamp":103,"component-emitter":29,"dom-transform":31,"is-number":50,"lodash.bindall":59,"tinycolor2":104}],103:[function(require,module,exports){
'use strict';

module.exports = function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
};
},{}],104:[function(require,module,exports){
// TinyColor v1.4.1
// https://github.com/bgrins/TinyColor
// Brian Grinstead, MIT License

(function(Math) {

var trimLeft = /^\s+/,
    trimRight = /\s+$/,
    tinyCounter = 0,
    mathRound = Math.round,
    mathMin = Math.min,
    mathMax = Math.max,
    mathRandom = Math.random;

function tinycolor (color, opts) {

    color = (color) ? color : '';
    opts = opts || { };

    // If input is already a tinycolor, return itself
    if (color instanceof tinycolor) {
       return color;
    }
    // If we are called as a function, call using new instead
    if (!(this instanceof tinycolor)) {
        return new tinycolor(color, opts);
    }

    var rgb = inputToRGB(color);
    this._originalInput = color,
    this._r = rgb.r,
    this._g = rgb.g,
    this._b = rgb.b,
    this._a = rgb.a,
    this._roundA = mathRound(100*this._a) / 100,
    this._format = opts.format || rgb.format;
    this._gradientType = opts.gradientType;

    // Don't let the range of [0,255] come back in [0,1].
    // Potentially lose a little bit of precision here, but will fix issues where
    // .5 gets interpreted as half of the total, instead of half of 1
    // If it was supposed to be 128, this was already taken care of by `inputToRgb`
    if (this._r < 1) { this._r = mathRound(this._r); }
    if (this._g < 1) { this._g = mathRound(this._g); }
    if (this._b < 1) { this._b = mathRound(this._b); }

    this._ok = rgb.ok;
    this._tc_id = tinyCounter++;
}

tinycolor.prototype = {
    isDark: function() {
        return this.getBrightness() < 128;
    },
    isLight: function() {
        return !this.isDark();
    },
    isValid: function() {
        return this._ok;
    },
    getOriginalInput: function() {
      return this._originalInput;
    },
    getFormat: function() {
        return this._format;
    },
    getAlpha: function() {
        return this._a;
    },
    getBrightness: function() {
        //http://www.w3.org/TR/AERT#color-contrast
        var rgb = this.toRgb();
        return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    },
    getLuminance: function() {
        //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
        var rgb = this.toRgb();
        var RsRGB, GsRGB, BsRGB, R, G, B;
        RsRGB = rgb.r/255;
        GsRGB = rgb.g/255;
        BsRGB = rgb.b/255;

        if (RsRGB <= 0.03928) {R = RsRGB / 12.92;} else {R = Math.pow(((RsRGB + 0.055) / 1.055), 2.4);}
        if (GsRGB <= 0.03928) {G = GsRGB / 12.92;} else {G = Math.pow(((GsRGB + 0.055) / 1.055), 2.4);}
        if (BsRGB <= 0.03928) {B = BsRGB / 12.92;} else {B = Math.pow(((BsRGB + 0.055) / 1.055), 2.4);}
        return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
    },
    setAlpha: function(value) {
        this._a = boundAlpha(value);
        this._roundA = mathRound(100*this._a) / 100;
        return this;
    },
    toHsv: function() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: this._a };
    },
    toHsvString: function() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
        return (this._a == 1) ?
          "hsv("  + h + ", " + s + "%, " + v + "%)" :
          "hsva(" + h + ", " + s + "%, " + v + "%, "+ this._roundA + ")";
    },
    toHsl: function() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: this._a };
    },
    toHslString: function() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
        return (this._a == 1) ?
          "hsl("  + h + ", " + s + "%, " + l + "%)" :
          "hsla(" + h + ", " + s + "%, " + l + "%, "+ this._roundA + ")";
    },
    toHex: function(allow3Char) {
        return rgbToHex(this._r, this._g, this._b, allow3Char);
    },
    toHexString: function(allow3Char) {
        return '#' + this.toHex(allow3Char);
    },
    toHex8: function(allow4Char) {
        return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
    },
    toHex8String: function(allow4Char) {
        return '#' + this.toHex8(allow4Char);
    },
    toRgb: function() {
        return { r: mathRound(this._r), g: mathRound(this._g), b: mathRound(this._b), a: this._a };
    },
    toRgbString: function() {
        return (this._a == 1) ?
          "rgb("  + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ")" :
          "rgba(" + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ", " + this._roundA + ")";
    },
    toPercentageRgb: function() {
        return { r: mathRound(bound01(this._r, 255) * 100) + "%", g: mathRound(bound01(this._g, 255) * 100) + "%", b: mathRound(bound01(this._b, 255) * 100) + "%", a: this._a };
    },
    toPercentageRgbString: function() {
        return (this._a == 1) ?
          "rgb("  + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%)" :
          "rgba(" + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
    },
    toName: function() {
        if (this._a === 0) {
            return "transparent";
        }

        if (this._a < 1) {
            return false;
        }

        return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
    },
    toFilter: function(secondColor) {
        var hex8String = '#' + rgbaToArgbHex(this._r, this._g, this._b, this._a);
        var secondHex8String = hex8String;
        var gradientType = this._gradientType ? "GradientType = 1, " : "";

        if (secondColor) {
            var s = tinycolor(secondColor);
            secondHex8String = '#' + rgbaToArgbHex(s._r, s._g, s._b, s._a);
        }

        return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr="+hex8String+",endColorstr="+secondHex8String+")";
    },
    toString: function(format) {
        var formatSet = !!format;
        format = format || this._format;

        var formattedString = false;
        var hasAlpha = this._a < 1 && this._a >= 0;
        var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");

        if (needsAlphaFormat) {
            // Special case for "transparent", all other non-alpha formats
            // will return rgba when there is transparency.
            if (format === "name" && this._a === 0) {
                return this.toName();
            }
            return this.toRgbString();
        }
        if (format === "rgb") {
            formattedString = this.toRgbString();
        }
        if (format === "prgb") {
            formattedString = this.toPercentageRgbString();
        }
        if (format === "hex" || format === "hex6") {
            formattedString = this.toHexString();
        }
        if (format === "hex3") {
            formattedString = this.toHexString(true);
        }
        if (format === "hex4") {
            formattedString = this.toHex8String(true);
        }
        if (format === "hex8") {
            formattedString = this.toHex8String();
        }
        if (format === "name") {
            formattedString = this.toName();
        }
        if (format === "hsl") {
            formattedString = this.toHslString();
        }
        if (format === "hsv") {
            formattedString = this.toHsvString();
        }

        return formattedString || this.toHexString();
    },
    clone: function() {
        return tinycolor(this.toString());
    },

    _applyModification: function(fn, args) {
        var color = fn.apply(null, [this].concat([].slice.call(args)));
        this._r = color._r;
        this._g = color._g;
        this._b = color._b;
        this.setAlpha(color._a);
        return this;
    },
    lighten: function() {
        return this._applyModification(lighten, arguments);
    },
    brighten: function() {
        return this._applyModification(brighten, arguments);
    },
    darken: function() {
        return this._applyModification(darken, arguments);
    },
    desaturate: function() {
        return this._applyModification(desaturate, arguments);
    },
    saturate: function() {
        return this._applyModification(saturate, arguments);
    },
    greyscale: function() {
        return this._applyModification(greyscale, arguments);
    },
    spin: function() {
        return this._applyModification(spin, arguments);
    },

    _applyCombination: function(fn, args) {
        return fn.apply(null, [this].concat([].slice.call(args)));
    },
    analogous: function() {
        return this._applyCombination(analogous, arguments);
    },
    complement: function() {
        return this._applyCombination(complement, arguments);
    },
    monochromatic: function() {
        return this._applyCombination(monochromatic, arguments);
    },
    splitcomplement: function() {
        return this._applyCombination(splitcomplement, arguments);
    },
    triad: function() {
        return this._applyCombination(triad, arguments);
    },
    tetrad: function() {
        return this._applyCombination(tetrad, arguments);
    }
};

// If input is an object, force 1 into "1.0" to handle ratios properly
// String input requires "1.0" as input, so 1 will be treated as 1
tinycolor.fromRatio = function(color, opts) {
    if (typeof color == "object") {
        var newColor = {};
        for (var i in color) {
            if (color.hasOwnProperty(i)) {
                if (i === "a") {
                    newColor[i] = color[i];
                }
                else {
                    newColor[i] = convertToPercentage(color[i]);
                }
            }
        }
        color = newColor;
    }

    return tinycolor(color, opts);
};

// Given a string or object, convert that input to RGB
// Possible string inputs:
//
//     "red"
//     "#f00" or "f00"
//     "#ff0000" or "ff0000"
//     "#ff000000" or "ff000000"
//     "rgb 255 0 0" or "rgb (255, 0, 0)"
//     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
//     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
//     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
//     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
//     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
//     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
//
function inputToRGB(color) {

    var rgb = { r: 0, g: 0, b: 0 };
    var a = 1;
    var s = null;
    var v = null;
    var l = null;
    var ok = false;
    var format = false;

    if (typeof color == "string") {
        color = stringInputToObject(color);
    }

    if (typeof color == "object") {
        if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
            rgb = rgbToRgb(color.r, color.g, color.b);
            ok = true;
            format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
        }
        else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
            s = convertToPercentage(color.s);
            v = convertToPercentage(color.v);
            rgb = hsvToRgb(color.h, s, v);
            ok = true;
            format = "hsv";
        }
        else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
            s = convertToPercentage(color.s);
            l = convertToPercentage(color.l);
            rgb = hslToRgb(color.h, s, l);
            ok = true;
            format = "hsl";
        }

        if (color.hasOwnProperty("a")) {
            a = color.a;
        }
    }

    a = boundAlpha(a);

    return {
        ok: ok,
        format: color.format || format,
        r: mathMin(255, mathMax(rgb.r, 0)),
        g: mathMin(255, mathMax(rgb.g, 0)),
        b: mathMin(255, mathMax(rgb.b, 0)),
        a: a
    };
}


// Conversion Functions
// --------------------

// `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
// <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

// `rgbToRgb`
// Handle bounds / percentage checking to conform to CSS color spec
// <http://www.w3.org/TR/css3-color/>
// *Assumes:* r, g, b in [0, 255] or [0, 1]
// *Returns:* { r, g, b } in [0, 255]
function rgbToRgb(r, g, b){
    return {
        r: bound01(r, 255) * 255,
        g: bound01(g, 255) * 255,
        b: bound01(b, 255) * 255
    };
}

// `rgbToHsl`
// Converts an RGB color value to HSL.
// *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
// *Returns:* { h, s, l } in [0,1]
function rgbToHsl(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min) {
        h = s = 0; // achromatic
    }
    else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return { h: h, s: s, l: l };
}

// `hslToRgb`
// Converts an HSL color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
function hslToRgb(h, s, l) {
    var r, g, b;

    h = bound01(h, 360);
    s = bound01(s, 100);
    l = bound01(l, 100);

    function hue2rgb(p, q, t) {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    if(s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHsv`
// Converts an RGB color value to HSV
// *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
// *Returns:* { h, s, v } in [0,1]
function rgbToHsv(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max === 0 ? 0 : d / max;

    if(max == min) {
        h = 0; // achromatic
    }
    else {
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h, s: s, v: v };
}

// `hsvToRgb`
// Converts an HSV color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
 function hsvToRgb(h, s, v) {

    h = bound01(h, 360) * 6;
    s = bound01(s, 100);
    v = bound01(v, 100);

    var i = Math.floor(h),
        f = h - i,
        p = v * (1 - s),
        q = v * (1 - f * s),
        t = v * (1 - (1 - f) * s),
        mod = i % 6,
        r = [v, q, p, p, t, v][mod],
        g = [t, v, v, q, p, p][mod],
        b = [p, p, t, v, v, q][mod];

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHex`
// Converts an RGB color to hex
// Assumes r, g, and b are contained in the set [0, 255]
// Returns a 3 or 6 character hex
function rgbToHex(r, g, b, allow3Char) {

    var hex = [
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16))
    ];

    // Return a 3 character hex if possible
    if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
    }

    return hex.join("");
}

// `rgbaToHex`
// Converts an RGBA color plus alpha transparency to hex
// Assumes r, g, b are contained in the set [0, 255] and
// a in [0, 1]. Returns a 4 or 8 character rgba hex
function rgbaToHex(r, g, b, a, allow4Char) {

    var hex = [
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16)),
        pad2(convertDecimalToHex(a))
    ];

    // Return a 4 character hex if possible
    if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
    }

    return hex.join("");
}

// `rgbaToArgbHex`
// Converts an RGBA color to an ARGB Hex8 string
// Rarely used, but required for "toFilter()"
function rgbaToArgbHex(r, g, b, a) {

    var hex = [
        pad2(convertDecimalToHex(a)),
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16))
    ];

    return hex.join("");
}

// `equals`
// Can be called with any tinycolor input
tinycolor.equals = function (color1, color2) {
    if (!color1 || !color2) { return false; }
    return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
};

tinycolor.random = function() {
    return tinycolor.fromRatio({
        r: mathRandom(),
        g: mathRandom(),
        b: mathRandom()
    });
};


// Modification Functions
// ----------------------
// Thanks to less.js for some of the basics here
// <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

function desaturate(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.s -= amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
}

function saturate(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.s += amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
}

function greyscale(color) {
    return tinycolor(color).desaturate(100);
}

function lighten (color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.l += amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
}

function brighten(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var rgb = tinycolor(color).toRgb();
    rgb.r = mathMax(0, mathMin(255, rgb.r - mathRound(255 * - (amount / 100))));
    rgb.g = mathMax(0, mathMin(255, rgb.g - mathRound(255 * - (amount / 100))));
    rgb.b = mathMax(0, mathMin(255, rgb.b - mathRound(255 * - (amount / 100))));
    return tinycolor(rgb);
}

function darken (color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.l -= amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
}

// Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
// Values outside of this range will be wrapped into this range.
function spin(color, amount) {
    var hsl = tinycolor(color).toHsl();
    var hue = (hsl.h + amount) % 360;
    hsl.h = hue < 0 ? 360 + hue : hue;
    return tinycolor(hsl);
}

// Combination Functions
// ---------------------
// Thanks to jQuery xColor for some of the ideas behind these
// <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

function complement(color) {
    var hsl = tinycolor(color).toHsl();
    hsl.h = (hsl.h + 180) % 360;
    return tinycolor(hsl);
}

function triad(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
    ];
}

function tetrad(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
    ];
}

function splitcomplement(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
        tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
    ];
}

function analogous(color, results, slices) {
    results = results || 6;
    slices = slices || 30;

    var hsl = tinycolor(color).toHsl();
    var part = 360 / slices;
    var ret = [tinycolor(color)];

    for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
        hsl.h = (hsl.h + part) % 360;
        ret.push(tinycolor(hsl));
    }
    return ret;
}

function monochromatic(color, results) {
    results = results || 6;
    var hsv = tinycolor(color).toHsv();
    var h = hsv.h, s = hsv.s, v = hsv.v;
    var ret = [];
    var modification = 1 / results;

    while (results--) {
        ret.push(tinycolor({ h: h, s: s, v: v}));
        v = (v + modification) % 1;
    }

    return ret;
}

// Utility Functions
// ---------------------

tinycolor.mix = function(color1, color2, amount) {
    amount = (amount === 0) ? 0 : (amount || 50);

    var rgb1 = tinycolor(color1).toRgb();
    var rgb2 = tinycolor(color2).toRgb();

    var p = amount / 100;

    var rgba = {
        r: ((rgb2.r - rgb1.r) * p) + rgb1.r,
        g: ((rgb2.g - rgb1.g) * p) + rgb1.g,
        b: ((rgb2.b - rgb1.b) * p) + rgb1.b,
        a: ((rgb2.a - rgb1.a) * p) + rgb1.a
    };

    return tinycolor(rgba);
};


// Readability Functions
// ---------------------
// <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

// `contrast`
// Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
tinycolor.readability = function(color1, color2) {
    var c1 = tinycolor(color1);
    var c2 = tinycolor(color2);
    return (Math.max(c1.getLuminance(),c2.getLuminance())+0.05) / (Math.min(c1.getLuminance(),c2.getLuminance())+0.05);
};

// `isReadable`
// Ensure that foreground and background color combinations meet WCAG2 guidelines.
// The third argument is an optional Object.
//      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
//      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
// If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

// *Example*
//    tinycolor.isReadable("#000", "#111") => false
//    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
tinycolor.isReadable = function(color1, color2, wcag2) {
    var readability = tinycolor.readability(color1, color2);
    var wcag2Parms, out;

    out = false;

    wcag2Parms = validateWCAG2Parms(wcag2);
    switch (wcag2Parms.level + wcag2Parms.size) {
        case "AAsmall":
        case "AAAlarge":
            out = readability >= 4.5;
            break;
        case "AAlarge":
            out = readability >= 3;
            break;
        case "AAAsmall":
            out = readability >= 7;
            break;
    }
    return out;

};

// `mostReadable`
// Given a base color and a list of possible foreground or background
// colors for that base, returns the most readable color.
// Optionally returns Black or White if the most readable color is unreadable.
// *Example*
//    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
//    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
//    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
//    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
tinycolor.mostReadable = function(baseColor, colorList, args) {
    var bestColor = null;
    var bestScore = 0;
    var readability;
    var includeFallbackColors, level, size ;
    args = args || {};
    includeFallbackColors = args.includeFallbackColors ;
    level = args.level;
    size = args.size;

    for (var i= 0; i < colorList.length ; i++) {
        readability = tinycolor.readability(baseColor, colorList[i]);
        if (readability > bestScore) {
            bestScore = readability;
            bestColor = tinycolor(colorList[i]);
        }
    }

    if (tinycolor.isReadable(baseColor, bestColor, {"level":level,"size":size}) || !includeFallbackColors) {
        return bestColor;
    }
    else {
        args.includeFallbackColors=false;
        return tinycolor.mostReadable(baseColor,["#fff", "#000"],args);
    }
};


// Big List of Colors
// ------------------
// <http://www.w3.org/TR/css3-color/#svg-color>
var names = tinycolor.names = {
    aliceblue: "f0f8ff",
    antiquewhite: "faebd7",
    aqua: "0ff",
    aquamarine: "7fffd4",
    azure: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "000",
    blanchedalmond: "ffebcd",
    blue: "00f",
    blueviolet: "8a2be2",
    brown: "a52a2a",
    burlywood: "deb887",
    burntsienna: "ea7e5d",
    cadetblue: "5f9ea0",
    chartreuse: "7fff00",
    chocolate: "d2691e",
    coral: "ff7f50",
    cornflowerblue: "6495ed",
    cornsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "0ff",
    darkblue: "00008b",
    darkcyan: "008b8b",
    darkgoldenrod: "b8860b",
    darkgray: "a9a9a9",
    darkgreen: "006400",
    darkgrey: "a9a9a9",
    darkkhaki: "bdb76b",
    darkmagenta: "8b008b",
    darkolivegreen: "556b2f",
    darkorange: "ff8c00",
    darkorchid: "9932cc",
    darkred: "8b0000",
    darksalmon: "e9967a",
    darkseagreen: "8fbc8f",
    darkslateblue: "483d8b",
    darkslategray: "2f4f4f",
    darkslategrey: "2f4f4f",
    darkturquoise: "00ced1",
    darkviolet: "9400d3",
    deeppink: "ff1493",
    deepskyblue: "00bfff",
    dimgray: "696969",
    dimgrey: "696969",
    dodgerblue: "1e90ff",
    firebrick: "b22222",
    floralwhite: "fffaf0",
    forestgreen: "228b22",
    fuchsia: "f0f",
    gainsboro: "dcdcdc",
    ghostwhite: "f8f8ff",
    gold: "ffd700",
    goldenrod: "daa520",
    gray: "808080",
    green: "008000",
    greenyellow: "adff2f",
    grey: "808080",
    honeydew: "f0fff0",
    hotpink: "ff69b4",
    indianred: "cd5c5c",
    indigo: "4b0082",
    ivory: "fffff0",
    khaki: "f0e68c",
    lavender: "e6e6fa",
    lavenderblush: "fff0f5",
    lawngreen: "7cfc00",
    lemonchiffon: "fffacd",
    lightblue: "add8e6",
    lightcoral: "f08080",
    lightcyan: "e0ffff",
    lightgoldenrodyellow: "fafad2",
    lightgray: "d3d3d3",
    lightgreen: "90ee90",
    lightgrey: "d3d3d3",
    lightpink: "ffb6c1",
    lightsalmon: "ffa07a",
    lightseagreen: "20b2aa",
    lightskyblue: "87cefa",
    lightslategray: "789",
    lightslategrey: "789",
    lightsteelblue: "b0c4de",
    lightyellow: "ffffe0",
    lime: "0f0",
    limegreen: "32cd32",
    linen: "faf0e6",
    magenta: "f0f",
    maroon: "800000",
    mediumaquamarine: "66cdaa",
    mediumblue: "0000cd",
    mediumorchid: "ba55d3",
    mediumpurple: "9370db",
    mediumseagreen: "3cb371",
    mediumslateblue: "7b68ee",
    mediumspringgreen: "00fa9a",
    mediumturquoise: "48d1cc",
    mediumvioletred: "c71585",
    midnightblue: "191970",
    mintcream: "f5fffa",
    mistyrose: "ffe4e1",
    moccasin: "ffe4b5",
    navajowhite: "ffdead",
    navy: "000080",
    oldlace: "fdf5e6",
    olive: "808000",
    olivedrab: "6b8e23",
    orange: "ffa500",
    orangered: "ff4500",
    orchid: "da70d6",
    palegoldenrod: "eee8aa",
    palegreen: "98fb98",
    paleturquoise: "afeeee",
    palevioletred: "db7093",
    papayawhip: "ffefd5",
    peachpuff: "ffdab9",
    peru: "cd853f",
    pink: "ffc0cb",
    plum: "dda0dd",
    powderblue: "b0e0e6",
    purple: "800080",
    rebeccapurple: "663399",
    red: "f00",
    rosybrown: "bc8f8f",
    royalblue: "4169e1",
    saddlebrown: "8b4513",
    salmon: "fa8072",
    sandybrown: "f4a460",
    seagreen: "2e8b57",
    seashell: "fff5ee",
    sienna: "a0522d",
    silver: "c0c0c0",
    skyblue: "87ceeb",
    slateblue: "6a5acd",
    slategray: "708090",
    slategrey: "708090",
    snow: "fffafa",
    springgreen: "00ff7f",
    steelblue: "4682b4",
    tan: "d2b48c",
    teal: "008080",
    thistle: "d8bfd8",
    tomato: "ff6347",
    turquoise: "40e0d0",
    violet: "ee82ee",
    wheat: "f5deb3",
    white: "fff",
    whitesmoke: "f5f5f5",
    yellow: "ff0",
    yellowgreen: "9acd32"
};

// Make it easy to access colors via `hexNames[hex]`
var hexNames = tinycolor.hexNames = flip(names);


// Utilities
// ---------

// `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
function flip(o) {
    var flipped = { };
    for (var i in o) {
        if (o.hasOwnProperty(i)) {
            flipped[o[i]] = i;
        }
    }
    return flipped;
}

// Return a valid alpha value [0,1] with all invalid values being set to 1
function boundAlpha(a) {
    a = parseFloat(a);

    if (isNaN(a) || a < 0 || a > 1) {
        a = 1;
    }

    return a;
}

// Take input from [0, n] and return it as [0, 1]
function bound01(n, max) {
    if (isOnePointZero(n)) { n = "100%"; }

    var processPercent = isPercentage(n);
    n = mathMin(max, mathMax(0, parseFloat(n)));

    // Automatically convert percentage into number
    if (processPercent) {
        n = parseInt(n * max, 10) / 100;
    }

    // Handle floating point rounding errors
    if ((Math.abs(n - max) < 0.000001)) {
        return 1;
    }

    // Convert into [0, 1] range if it isn't already
    return (n % max) / parseFloat(max);
}

// Force a number between 0 and 1
function clamp01(val) {
    return mathMin(1, mathMax(0, val));
}

// Parse a base-16 hex value into a base-10 integer
function parseIntFromHex(val) {
    return parseInt(val, 16);
}

// Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
// <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
function isOnePointZero(n) {
    return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
}

// Check to see if string passed in is a percentage
function isPercentage(n) {
    return typeof n === "string" && n.indexOf('%') != -1;
}

// Force a hex value to have 2 characters
function pad2(c) {
    return c.length == 1 ? '0' + c : '' + c;
}

// Replace a decimal with it's percentage value
function convertToPercentage(n) {
    if (n <= 1) {
        n = (n * 100) + "%";
    }

    return n;
}

// Converts a decimal to a hex value
function convertDecimalToHex(d) {
    return Math.round(parseFloat(d) * 255).toString(16);
}
// Converts a hex value to a decimal
function convertHexToDecimal(h) {
    return (parseIntFromHex(h) / 255);
}

var matchers = (function() {

    // <http://www.w3.org/TR/css3-values/#integers>
    var CSS_INTEGER = "[-\\+]?\\d+%?";

    // <http://www.w3.org/TR/css3-values/#number-value>
    var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

    // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
    var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

    // Actual matching.
    // Parentheses and commas are optional, but not required.
    // Whitespace can take the place of commas or opening paren
    var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
    var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

    return {
        CSS_UNIT: new RegExp(CSS_UNIT),
        rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
        rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
        hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
        hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
        hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
        hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
        hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
        hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
    };
})();

// `isValidCSSUnit`
// Take in a single string / number and check to see if it looks like a CSS unit
// (see `matchers` above for definition).
function isValidCSSUnit(color) {
    return !!matchers.CSS_UNIT.exec(color);
}

// `stringInputToObject`
// Permissive string parsing.  Take in a number of formats, and output an object
// based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
function stringInputToObject(color) {

    color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
    var named = false;
    if (names[color]) {
        color = names[color];
        named = true;
    }
    else if (color == 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0, format: "name" };
    }

    // Try to match string input using regular expressions.
    // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
    // Just return an object and let the conversion functions handle that.
    // This way the result will be the same whether the tinycolor is initialized with string or object.
    var match;
    if ((match = matchers.rgb.exec(color))) {
        return { r: match[1], g: match[2], b: match[3] };
    }
    if ((match = matchers.rgba.exec(color))) {
        return { r: match[1], g: match[2], b: match[3], a: match[4] };
    }
    if ((match = matchers.hsl.exec(color))) {
        return { h: match[1], s: match[2], l: match[3] };
    }
    if ((match = matchers.hsla.exec(color))) {
        return { h: match[1], s: match[2], l: match[3], a: match[4] };
    }
    if ((match = matchers.hsv.exec(color))) {
        return { h: match[1], s: match[2], v: match[3] };
    }
    if ((match = matchers.hsva.exec(color))) {
        return { h: match[1], s: match[2], v: match[3], a: match[4] };
    }
    if ((match = matchers.hex8.exec(color))) {
        return {
            r: parseIntFromHex(match[1]),
            g: parseIntFromHex(match[2]),
            b: parseIntFromHex(match[3]),
            a: convertHexToDecimal(match[4]),
            format: named ? "name" : "hex8"
        };
    }
    if ((match = matchers.hex6.exec(color))) {
        return {
            r: parseIntFromHex(match[1]),
            g: parseIntFromHex(match[2]),
            b: parseIntFromHex(match[3]),
            format: named ? "name" : "hex"
        };
    }
    if ((match = matchers.hex4.exec(color))) {
        return {
            r: parseIntFromHex(match[1] + '' + match[1]),
            g: parseIntFromHex(match[2] + '' + match[2]),
            b: parseIntFromHex(match[3] + '' + match[3]),
            a: convertHexToDecimal(match[4] + '' + match[4]),
            format: named ? "name" : "hex8"
        };
    }
    if ((match = matchers.hex3.exec(color))) {
        return {
            r: parseIntFromHex(match[1] + '' + match[1]),
            g: parseIntFromHex(match[2] + '' + match[2]),
            b: parseIntFromHex(match[3] + '' + match[3]),
            format: named ? "name" : "hex"
        };
    }

    return false;
}

function validateWCAG2Parms(parms) {
    // return valid WCAG2 parms for isReadable.
    // If input parms are invalid, return {"level":"AA", "size":"small"}
    var level, size;
    parms = parms || {"level":"AA", "size":"small"};
    level = (parms.level || "AA").toUpperCase();
    size = (parms.size || "small").toLowerCase();
    if (level !== "AA" && level !== "AAA") {
        level = "AA";
    }
    if (size !== "small" && size !== "large") {
        size = "small";
    }
    return {"level":level, "size":size};
}

// Node: Export function
if (typeof module !== "undefined" && module.exports) {
    module.exports = tinycolor;
}
// AMD/requirejs: Define the module
else if (typeof define === 'function' && define.amd) {
    define(function () {return tinycolor;});
}
// Browser: Expose to window
else {
    window.tinycolor = tinycolor;
}

})(Math);

},{}],105:[function(require,module,exports){

var space = require('to-space-case')

/**
 * Export.
 */

module.exports = toCamelCase

/**
 * Convert a `string` to camel case.
 *
 * @param {String} string
 * @return {String}
 */

function toCamelCase(string) {
  return space(string).replace(/\s(\w)/g, function (matches, letter) {
    return letter.toUpperCase()
  })
}

},{"to-space-case":107}],106:[function(require,module,exports){

/**
 * Export.
 */

module.exports = toNoCase

/**
 * Test whether a string is camel-case.
 */

var hasSpace = /\s/
var hasSeparator = /[\W_]/
var hasCamel = /([a-z][A-Z]|[A-Z][a-z])/

/**
 * Remove any starting case from a `string`, like camel or snake, but keep
 * spaces and punctuation that may be important otherwise.
 *
 * @param {String} string
 * @return {String}
 */

function toNoCase(string) {
  if (hasSpace.test(string)) return string.toLowerCase()
  if (hasSeparator.test(string)) return (unseparate(string) || string).toLowerCase()
  if (hasCamel.test(string)) return uncamelize(string).toLowerCase()
  return string.toLowerCase()
}

/**
 * Separator splitter.
 */

var separatorSplitter = /[\W_]+(.|$)/g

/**
 * Un-separate a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function unseparate(string) {
  return string.replace(separatorSplitter, function (m, next) {
    return next ? ' ' + next : ''
  })
}

/**
 * Camelcase splitter.
 */

var camelSplitter = /(.)([A-Z]+)/g

/**
 * Un-camelcase a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function uncamelize(string) {
  return string.replace(camelSplitter, function (m, previous, uppers) {
    return previous + ' ' + uppers.toLowerCase().split('').join(' ')
  })
}

},{}],107:[function(require,module,exports){

var clean = require('to-no-case')

/**
 * Export.
 */

module.exports = toSpaceCase

/**
 * Convert a `string` to space case.
 *
 * @param {String} string
 * @return {String}
 */

function toSpaceCase(string) {
  return clean(string).replace(/[\W_]+(.|$)/g, function (matches, match) {
    return match ? ' ' + match : ''
  }).trim()
}

},{"to-no-case":106}],108:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],109:[function(require,module,exports){

/**
 * @module typedarray-polyfill
 */

var methods = ['values', 'sort', 'some', 'slice', 'reverse', 'reduceRight', 'reduce', 'map', 'keys', 'lastIndexOf', 'join', 'indexOf', 'includes', 'forEach', 'find', 'findIndex', 'copyWithin', 'filter', 'entries', 'every', 'fill'];

if (typeof Int8Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int8Array.prototype[method]) Int8Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint8Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint8Array.prototype[method]) Uint8Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint8ClampedArray !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint8ClampedArray.prototype[method]) Uint8ClampedArray.prototype[method] = Array.prototype[method];
    }
}
if (typeof Int16Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int16Array.prototype[method]) Int16Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint16Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint16Array.prototype[method]) Uint16Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Int32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int32Array.prototype[method]) Int32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint32Array.prototype[method]) Uint32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Float32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Float32Array.prototype[method]) Float32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Float64Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Float64Array.prototype[method]) Float64Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof TypedArray !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!TypedArray.prototype[method]) TypedArray.prototype[method] = Array.prototype[method];
    }
}
},{}],110:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    var arguments$1 = arguments;

    for (var i = 1; i < arguments.length; i++) {
        var source = arguments$1[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],111:[function(require,module,exports){
require('enable-mobile');
var ctx = require('audio-context');
var Panel = require('settings-panel');
var Spectrum = require('gl-spectrum');



var analyser = ctx.createAnalyser();
analyser.fftSize = 1024*4;
analyser.connect(ctx.destination);

var gain = ctx.createGain();
gain.connect(analyser);

//spectrum
var frequencies = new Float32Array(1024*2);
setInterval(function () {
	analyser.getFloatFrequencyData(frequencies);
	spectrum.setFrequencyData(frequencies);
})
var spectrum = Spectrum({
	fill: 'temperature',
	maxDecibels: 0,
	type: 'fill'
});



var type = 'triangle';
var f = 280;
var n1 = 2;
var n2 = 3;
var n3 = 4;
var n4 = 5;
var d = 8;
var detuneF = 4;
var detuneAmp = 5;

var base = createOscillator(f);
var o1 = createOscillator(f * n1);
var o2 = createOscillator(f * n2);
var o3 = createOscillator(f * n3);
var o4 = createOscillator(f * n4);

//make unperfect unisson
o1.detune.value = -5;
setInterval(function () {
	base.detune.value = Math.sin(2*Math.PI*ctx.currentTime*detuneF) * detuneAmp;
	o1.detune.value = Math.sin(2*Math.PI*ctx.currentTime*detuneF) * detuneAmp;
	o2.detune.value = Math.sin(2*Math.PI*ctx.currentTime*detuneF) * detuneAmp;
	o3.detune.value = Math.sin(2*Math.PI*ctx.currentTime*detuneF) * detuneAmp;
	o4.detune.value = Math.sin(2*Math.PI*ctx.currentTime*detuneF) * detuneAmp;
}, 5);


// setInterval(() => {
// 	gain.gain.value = .9 + .1*Math.sin(2*Math.PI*ctx.currentTime*4);
// }, 5);


function createOscillator(f) {
	var osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.value = f;
	osc.start();
	osc.connect(gain);

	return osc;
}


function update () {
	base.type = type;
	o1.type = type;
	o2.type = type;
	o3.type = type;
	o4.type = type;
	base.frequency.value = f;
	o1.frequency.value = f * n1/d;
	o2.frequency.value = f * n2/d;
	o3.frequency.value = f * n3/d;
	o4.frequency.value = f * n4/d;
}






//settings panel
var panel = Panel([
	{id: 'timbre', type: 'switch', options: ['sine', 'square', 'sawtooth', 'triangle'], value: type, change: function (v) { return type = v; } },
	{id: 'frequency', type: 'range', precision: .01, min: 20, log: true, value: f, max: 15000, change: function (v) {
		f = v;
	}},
	{id: 'denominator', type: 'range', step: 1, min: 1, max: 17, value: d, change: function (v) {
		d = v;
	}},
	{type: 'raw', content: 'Ratios'},
	{id: 'n1', label: 'Osc 1', type: 'range', step: 1, min: 1, max: 17, value: n1, change: function (v) {
		n1 = v;
	}},
	{id: 'n2', label: 'Osc 2', type: 'range', step: 1, min: 1, max: 17, value: n2, change: function (v) {
		n2 = v;
	}},
	{id: 'n3', label: 'Osc 3', type: 'range', step: 1, min: 1, max: 17, value: n3, change: function (v) {
		n3 = v;
	}},
	{id: 'n4', label: 'Osc 4', type: 'range', step: 1, min: 1, max: 17, value: n4, change: function (v) {
		n4 = v;
	}},
	// {type: 'raw', content: 'Detune'},
	// {id: 'detuneAmp', label: 'amplitude', type: 'range', step: 1, min: -500, max: 500, value: detuneAmp, change: v => {
	// 	detuneAmp = v;
	// }},
	// {id: 'detuneF', label: 'frequency', type: 'range', log: true, min: 0.01, max: 20, value: detuneF, change: v => {
	// 	detuneF = v;
	// }}
], {
title: '<a href="https://github.com/dy/sound-experiment">Ratio explorer</a>',
css: "\n\t:host {\n\t\tbackground: none;\n\t\tcolor: white;\n\t}\n"
}).on('change', update);
},{"audio-context":16,"enable-mobile":35,"gl-spectrum":42,"settings-panel":89}]},{},[111]);
