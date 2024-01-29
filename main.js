const TelegramBot = require('node-telegram-bot-api')
const execa = require('execa')
const fs = require('fs')
const path = require('path')

const tempDir = path.join(__dirname, 'tmp')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

const token = process.env.TG_TOKEN
const durationLimit = process.env.TIME_LIMIT || 600 // seconds

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

const downloadVideo = async (url) => {
  const { stdout } = await exec('yt-dlp', ['-j', url])
  const { duration } = JSON.parse(stdout)
  if (duration > durationLimit) return

  const filePath = path.join(tempDir, Date.now().toString())
  await exec('yt-dlp', ['-o', filePath, '--merge-output-format', 'mp4', url])
  return { filePath: filePath  + '.mp4' }
}

const tryToSendVideo = async (url, chatId) => {
  let createdFile = ''
  try {
    const { filePath } = await downloadVideo(url)
    createdFile = filePath

    await bot.sendVideo(chatId, filePath)
  } catch (err) {
    console.warn('Failed to download or send video', { url, createdFile }, err)
  } finally {
    try {
      if (createdFile) fs.unlinkSync(createdFile)
    } catch (err) {
      console.error('Failed to delete file', createdFile, err)
    }
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
