const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
const path = require('path')
const execa = require('execa')
const kill = require('tree-kill')

const tempDir = path.join(__dirname, 'tmp')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

const token = process.env.TG_TOKEN
const durationLimit = process.env.TIME_LIMIT || 600 // seconds

if (!token || token === 'undefined') {
  console.error('Please define env var TG_TOKEN!')
  process.exit()
}

const bot = new TelegramBot(token, { polling: true })

const exec = async (file, args, timeout = 120000) => { // 2 minutes
  console.log('RUN COMMAND:', file, args.join(' '))
  const subprocess = execa(file, args, {
    env: {
      PATH: process.env.PATH
    },
    cwd: '/',
  })

  const killProcess = () => {
    try {
      kill(subprocess.pid, 'SIGKILL', (err) => {
        if (err) {
          console.error('Failed to kill process and its children', err);
        } else {
          console.log(`Successfully killed process ${subprocess.pid} and its children`);
        }
      });
    } catch (err) {
      console.error('Failed to kill process', err)
    }
  }

  setTimeout(() => {
    killProcess()
  }, timeout)

  try {
    return await subprocess
  } catch (err) {
    console.error(file + ' error', err)
    killProcess()
    throw err
  }
}

const downloadVideo = async (url) => {
  const { stdout } = await exec('yt-dlp', ['-j', url])
  const { duration } = JSON.parse(stdout)
  if (duration > durationLimit) return

  const filePath = path.join(tempDir, Date.now() + '.mp4' )
  await exec('yt-dlp', ['-o', filePath, '--recode-video', 'mp4', url])
  // To fix issue with yt-dlp naming
  if (fs.existsSync(filePath + '.mp4')) fs.renameSync(filePath + '.mp4', filePath)
  return { filePath }
}

const tryToSendVideo = async (url, chatId) => {
  let createdFile = ''
  try {
    const res = await downloadVideo(url)
    if (!res) return
    createdFile = res.filePath

    console.log('SEND VIDEO:', res.filePath, url)
    await bot.sendVideo(chatId, res.filePath)
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
    console.log('HANDLE URL:', url)
    await tryToSendVideo(url, chatId)
  }
})
