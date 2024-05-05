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

  const outFileName = Date.now().toString()
  const outFile = path.join(tempDir, outFileName)
  const fixedFile =  outFile + '_fix.mp4'
  
  await exec('yt-dlp', ['-o', outFile, url])
  const downloadedFile = findFileByPrefix(tempDir, outFileName)

  await exec('ffmpeg',[ '-i', downloadedFile, '-c:v', 'libx264', '-preset', 'fast', fixedFile])
  fs.unlinkSync(downloadedFile)

  const {stdout: outffprobe} = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', fixedFile])
  const [width, height] = outffprobe.split('x').map(Number)
  console.log('VIDEO DIMENSIONS:', width, height);

  return { filePath: fixedFile, width, height }
}

const findFileByPrefix = (dir, prefix) => {
  try {
      const files = fs.readdirSync(dir);
      const matchedFile = files.find(file => file.startsWith(prefix));
      return matchedFile ? path.join(dir, matchedFile) : null;
  } catch (error) {
      console.error('Error finding file by prefix:', error);
      return null;
  }
}

const tryToSendVideo = async (url, chatId) => {
  let createdFile = ''
  try {
    const res = await downloadVideo(url)
    if (!res) return
    const { width, height } = res
    createdFile = res.filePath

    console.log('SEND VIDEO:', res.filePath, url)
    const fStream = fs.createReadStream(res.filePath)
    await bot.sendVideo(chatId, fStream, {
      width,
      height
    }, {
      contentType: 'video/mp4'
    })
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
