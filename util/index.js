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
