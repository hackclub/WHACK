const humanizeDurationLib = require('humanize-duration')
const { v4: uuidv4 } = require('uuid')

exports.rand = (low, high) => {
  const range = high - low

  return Math.floor(Math.random() * range) + low
}

exports.randItem = (array) => {
  const r = exports.rand(0, array.length)

  return array[r]
}

exports.humanizeDuration = (duration) => {
  return humanizeDurationLib(duration)
}

exports.uuid = () => {
  return uuidv4()
}

exports.sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// return a string with char set as every other character in str.
//
// example: intersperse('hello', '1')
//            => 'h1e1l1l1o'
exports.intersperse = (str, char) => {
  let newStr = []

  for (let i = 0; i < str.length; i += 1) {
    if (i+1 < str.length) {
      newStr.push(str.substr(i, 1), char)
    } else { // don't add a trailing char
      newStr.push(str.substr(i, 1))
    }
  }

  return newStr.join('')
}
