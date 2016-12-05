const subxfinder = require('./subxfinder')
const fs = require('fs')
const request = require('request')

subxfinder.search('seinfeld', (err, results) => {
  if (err) {
    console.log(err)
  } else if (results) {
    getFile(results, 0)
  };
}, 5)

const getFile = (results, i) => {
  try {
    const sub = results[i]

    if (i < results.length) {
      const mime = require('mime-types')

      request.get(sub.link).on('response', (response) => {
        const responseType = (response.headers['content-type'] || '').split(';')[0].trim()
        const ext = mime.extension(responseType)

        let filename = sub.title

        if (fs.existsSync(`${__dirname}/${filename}.${ext}`)) {
          filename = `${filename} - ${i}`
        }

        filename += `.${ext}`

        const fileStream = fs.createWriteStream(filename).on('finish', () => {
          console.log('Download Complete: %s', filename)
        })

        this.pipe(fileStream)

        i = i + 1
        getFile(results, i)
      })
    }
  } catch (e) {
    console.log(e)
  }
}
