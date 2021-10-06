const TelegramBot = require('node-telegram-bot-api')
const execa = require('execa')
const axios = require('axios')

const token = '2096044601:AAF7qW_phkkOATd89T6GdOsHz093EskMxjs'
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
  } = await exec('youtube-dl', ['-j', url], 5000)
  const data = JSON.parse(stdout)
  return data
}

const getVideoInfo = (info) => {
  if (!info.formats || info.formats.length < 1) return null
  const goodFormats = info.formats.filter(
    (f) => f.protocol === 'https' || f.protocol === 'http'
  )
  const bestFormat = goodFormats[goodFormats.length - 1]
  if (!bestFormat) return undefined

  const title = info.title || ''
  const url = bestFormat.url
  const headers = bestFormat.http_headers || {}
  if (!url) return undefined

  return {
    title,
    url,
    headers,
  }
}

const tryToSendVideo = async (url, chatId) => {
  try {
    const info = await getYtdlInfo(url)
    const {
      url: videoUrl,
      title,
      headers
    } = await getVideoInfo(info)
    console.log('Found video', url, title, videoUrl)

    const {
      data
    } = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream',
      headers: headers,
    })

    bot.sendVideo(chatId, data)
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
