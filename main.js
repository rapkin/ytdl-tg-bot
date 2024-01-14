const TelegramBot = require('node-telegram-bot-api')
const execa = require('execa')
const axios = require('axios')

const token = process.env.TG_TOKEN
const durationLimit = process.env.TIME_LIMIT || 600

if (!token || token === 'undefined') {
  console.error('Please define env var TG_TOKEN!')
  process.exit()
}

const bot = new TelegramBot(token, { polling: true })

const exec = async (file, args, timeout = 10000) => {
  const subproccess = execa(file, args, {
    env: {
      PATH: process.env.PATH
    },
    cwd: '/',
  })

  setTimeout(() => {
    subproccess.kill('SIGKILL')
  }, timeout)

  try {
    return await subproccess
  } catch (err) {
    console.error(file + ' error', err)
    throw err
  }
}

const getYtdlInfo = async (url) => {
  const {
    stdout
  } = await exec('yt-dlp', ['-j', url])
  const data = JSON.parse(stdout)
  return data
}

const getVideoInfo = (info) => {
  if (!info.formats || info.formats.length < 1) return null
  const goodFormats = info.formats.filter(
    (f) => f.protocol === 'https' || f.protocol === 'http'
  )
  const filteredSize = goodFormats.filter(f => f.width < 2000) // don't send large videos
  const bestFormat = (filteredSize.length > 0 ? filteredSize : goodFormats)[goodFormats.length - 1]
  if (!bestFormat) return undefined

  const title = info.title || ''
  const { width, height, url } = bestFormat
  const duration = info.duration
  const headers = bestFormat.http_headers || {}
  if (!url) return undefined

  return {
    title,
    url,
    headers,
    width,
    height,
    duration
  }
}

const tryToSendVideo = async (url, chatId) => {
  try {
    const info = await getYtdlInfo(url)
    const {
      url: videoUrl,
      title,
      width,
      height,
      duration,
      headers
    } = getVideoInfo(info)
    if (duration > durationLimit) return

    console.log('Found video', url, title, videoUrl)

    const {
      data
    } = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream',
      headers: headers,
    })

    bot.sendVideo(chatId, data, { duration, width, height })
  } catch (err) {
    console.warn('Failed to send video', url, err)
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id

  const urls = (msg.entities || [])
    .filter(i => i.type === 'url')
    .map(({
      offset,
      length
    }) => (msg.text || '').substring(offset, offset + length))
    .filter((v, i, a) => a.indexOf(v) === i)

  for (const url of urls) {
    await tryToSendVideo(url, chatId)
  }
})
