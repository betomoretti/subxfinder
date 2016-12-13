const xray = require('x-ray')()
const _ = require('lodash')
const fs = require('fs')
const request = require('request')
const unzip = require('unzip2')
const REG = /(.srt)$/ig

class SubxFinder {
  constructor () {
    this.configs = {
      rootUrl: 'http://www.subdivx.com/index.php?accion=5&buscar=',
      timeout: 20000
    }
  }

  search (title, callback, limit) {
    const toSearch = this.prepareParameter(title)

    xray.timeout(this.configs.timeout)

    try {
      if (title.length <= 3) throw new Error('The search title must have at least 3 letters')

      console.log('Searching subtitles for: %s', title)

      xray(this.configs.rootUrl + toSearch, '#contenedor_interno #contenedor_izq', {
        result: 'span.result_busc',
        pages: xray('.pagination a', ['']),
        subs: {
          title: xray('#menu_detalle_buscador a', [{title: ''}]),
          description: xray('#buscador_detalle_sub', [{description: ''}]),
          link: xray('#buscador_detalle_sub_datos', [{link: 'a:last-child@href'}])
        }
      })((err, data) => {
        if (!data.result) throw new Error('No results available')
        if (err) throw new Error(err)

        let totalPages = 1

        if (data.pages.length !== 0) {
          totalPages = (data.pages[data.pages.length - 1] !== 'Siguiente »') ? data.pages[data.pages.length - 1] : data.pages[data.pages.length - 2]
          totalPages = limit && limit < totalPages ? limit : totalPages
        }

        const subtitles = _.merge(_.merge(data.subs.title, data.subs.description), data.subs.link)

        if (totalPages > 1) {
          const i = 2
          searchRecursive(this.configs, toSearch, subtitles, totalPages, i, callback)
        }
      })
    } catch (error) {
      callback(...[error, null])
    }
  }

  searchAndDownload (term, limit, destPath) {
    const dest = destPath
    this.search(term, function (err, results) {
      if (err) {
        console.log(err)
      } else if (results) {
        getFile(results, 0, dest)
      };
    }, limit)
  }

  searchAndFilter (title, descriptionFilter, strict, callback, limit) {
    const descFilters = (strict) ? [descriptionFilter] : descriptionFilter.split(' ')

    try {
      this.search(title, (err, subtitles) => {
        if (err) {
          throw new Error(err)
        } else {
                    // Filter by description
          const subsFound = _.filter(subtitles, sub => {
            let found = false

            if (sub.description) {
              _(descFilters).forEach(str => {
                if (sub.description.toLowerCase().includes(str.toLowerCase())) {
                  found = true
                  return
                }
              }).value()
            }

            return found
          })

          callback(...[null, subsFound])
        }
      }, limit)
    } catch (error) {
      callback(...[error, null])
    }
  }

  setConfigs (configs) {
    this.configs = _.merge(this.configs, configs)
  }

  prepareParameter (param) {
    return encodeURIComponent(param)
  }
}

/**
 * Search on page recursive
 * @param configs
 * @param toSearch
 * @param subtitles
 * @param totalPages
 * @param i
 * @param callback
 */
const searchRecursive = (configs, toSearch, subtitles, totalPages, i, callback) => {
  console.log('Querying page: %s', i)

  xray(`${configs.rootUrl + toSearch}&pg=${i}`, '#contenedor_interno #contenedor_izq', {
    subs: {
      title: xray('#menu_detalle_buscador a', [{title: ''}]),
      description: xray('#buscador_detalle_sub', [{description: ''}]),
      link: xray('#buscador_detalle_sub_datos', [{link: 'a:last-child@href'}])
    }
  })((err, data) => {
    if (err) console.log(err)
    subtitles = subtitles.concat(_.merge(_.merge(data.subs.title, data.subs.description), data.subs.link))
    i = i + 1

    if (i === totalPages) {
      callback(...[null, subtitles])
    } else {
      searchRecursive(configs, toSearch, subtitles, totalPages, i, callback)
    }
  })
}

/**
 * Search on page recursive
 * @param subtitles
 * @param index
 * @param destPath
 */
const getFile = (subtitles, i, destPath) => {
  try {
    const sub = subtitles[i]

    if (i < subtitles.length) {
      const mime = require('mime-types')

      request
        .get(sub.link)
        .on('response', function (response) {
          const responseType = (response.headers['content-type'] || '').split(';')[0].trim()
          const ext = mime.extension(responseType)

          let filename = sub.title

          if (fs.existsSync(`${__dirname}/${filename}.${ext}`)) {
            filename = `${filename} - ${i}`
          }

          filename += `.${ext}`

          this
            .pipe(unzip.Parse())
            .on('entry', function (entry) {
              const fileName = entry.path
              if (REG.test(fileName)) {
                entry.pipe(fs.createWriteStream(`${destPath}${fileName}`))
              } else {
                entry.autodrain()
              }
            })
            .on('error', console.log)

          i = i + 1
          getFile(subtitles, i)
        })
    }
  } catch (e) {
    console.log(e)
  }
}

module.exports = new SubxFinder()
