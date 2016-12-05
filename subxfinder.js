const xray = require('x-ray')()
const _ = require('lodash')

class SubxFinder {
  constructor () {
    this.configs = {
      rootUrl: 'http://www.subdivx.com/index.php?accion=5&buscar=',
      timeout: 20000
    }
  }

  search (title, callback) {
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

        if (data.pages.length != 0) {
          totalPages = (data.pages[data.pages.length - 1] != 'Siguiente »') ? data.pages[data.pages.length - 1] : data.pages[data.pages.length - 2]
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

  searchAndFilter (title, descriptionFilter, strict, callback) {
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
      })
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
    subtitles = subtitles.concat(_.merge(_.merge(data.subs.title, data.subs.description), data.subs.link))
    i = i + 1

    if (i == totalPages) {
      callback(...[null, subtitles])
    } else {
      searchRecursive(configs, toSearch, subtitles, totalPages, i, callback)
    }
  })
}

module.exports = new SubxFinder()
